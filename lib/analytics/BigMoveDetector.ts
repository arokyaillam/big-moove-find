/**
 * Big Move Detection Algorithm (v2)
 * Analyzes Upstox Market Feed data (v3)
 * Handles fullFeed + Greeks + OB + Volume metrics
 */

export class BigMoveDetector {
  history: Map<string, unknown[]>;
  avgVolumes: Map<string, number>;

  constructor() {
    this.history = new Map();
    this.avgVolumes = new Map();
  }

  /**
   * Extract relevant feed section
   */
  extractMarketData(feedValue: Record<string, unknown>) {
    if (feedValue?.fullFeed?.marketFF) {
      return feedValue.fullFeed.marketFF;
    } else if (feedValue?.ltpc) {
      return { ltpc: feedValue.ltpc };
    } else if (feedValue?.firstLevelWithGreeks) {
      return feedValue.firstLevelWithGreeks;
    }
    return null;
  }

  /**
   * Convert safely to number
   */
  private toNum(v: unknown): number {
    if (v === undefined || v === null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Core analysis - updated for comprehensive market data
   */
  analyze(symbol: string, feedValue: Record<string, unknown>) {
    const mff = feedValue?.fullFeed?.marketFF;
    if (!mff) return null;

    const ltp = this.toNum(mff.ltpc?.ltp);
    const volume = this.toNum(mff.vtt);
    const tbq = this.toNum(mff.tbq);
    const tsq = this.toNum(mff.tsq);
    const gamma = this.toNum(mff.optionGreeks?.gamma);
    const delta = this.toNum(mff.optionGreeks?.delta);
    const iv = this.toNum(mff.optionGreeks?.iv);

    // === Volume ratio
    const avgVol = this.avgVolumes.get(symbol) || (volume / 10 || 1);
    this.avgVolumes.set(symbol, (this.avgVolumes.get(symbol) || 0) * 0.9 + volume * 0.1); // Update average
    const volumeRatio = volume / avgVol;

    // === Orderbook ratio
    const obRatio = tsq > 0 ? tbq / tsq : 0;

    // === Price range (use 1-minute candle if available)
    const candles = mff.marketOHLC?.ohlc || [];
    const candle = candles.find((c: Record<string, unknown>) => c.interval === "I1") ||
                   candles.find((c: Record<string, unknown>) => c.interval === "I15") ||
                   candles[0];

    let priceRange = 0;
    if (candle && candle.low > 0) {
      priceRange = ((candle.high - candle.low) / candle.low) * 100;
    }

    // === Greeks analysis
    const greeksScore = this.calculateGreeksScore(gamma, delta, iv);

    // === Score calculation (enhanced)
    let score = 0;

    // Volume factor (0–35) - increased weight
    if (volumeRatio > 5) score += 35;
    else if (volumeRatio > 3) score += 25;
    else if (volumeRatio > 2) score += 15;
    else if (volumeRatio > 1.5) score += 8;

    // Price range factor (0–30) - increased weight
    if (priceRange > 3) score += 30;
    else if (priceRange > 2) score += 20;
    else if (priceRange > 1) score += 12;
    else if (priceRange > 0.5) score += 5;

    // Order book factor (0–20)
    if (obRatio > 5) score += 20;
    else if (obRatio > 3) score += 15;
    else if (obRatio > 2) score += 10;
    else if (obRatio > 1.5) score += 5;

    // Greeks factor (0–15)
    score += greeksScore;

    score = Math.min(score, 100);

    // === Alert classification (enhanced thresholds)
    let alertLevel = "NORMAL";
    if (score >= 75) alertLevel = "CRITICAL";
    else if (score >= 55) alertLevel = "WARNING";
    else if (score >= 35) alertLevel = "WATCH";

    return {
      score,
      alertLevel,
      metrics: { volumeRatio, obRatio, priceRange, ltp, gamma, delta, iv },
      signals: this.generateSignals(volumeRatio, priceRange, obRatio, gamma, delta, iv),
    };
  }

  /**
   * Calculate Greeks score for options analysis
   */
  private calculateGreeksScore(gamma: number, delta: number, iv: number): number {
    let score = 0;

    // Gamma analysis (0-5 points)
    if (gamma > 0.001) score += 5;
    else if (gamma > 0.0005) score += 3;
    else if (gamma > 0.0001) score += 1;

    // Delta analysis (0-5 points)
    if (Math.abs(delta) > 0.7) score += 5;
    else if (Math.abs(delta) > 0.5) score += 3;
    else if (Math.abs(delta) > 0.3) score += 1;

    // IV analysis (0-5 points)
    if (iv > 0.3) score += 5;
    else if (iv > 0.2) score += 3;
    else if (iv > 0.1) score += 1;

    return Math.min(score, 15);
  }

  /**
   * Generate alert signals - enhanced with more Greeks data
   */
  private generateSignals(
    volRatio: number,
    priceRange: number,
    obRatio: number,
    gamma: number,
    delta?: number,
    iv?: number
  ) {
    const signals: Array<{ type: string; title: string; message: string }> = [];

    if (volRatio > 3) {
      signals.push({
        type: "CRITICAL",
        title: "Volume Spike",
        message: `${volRatio.toFixed(2)}× avg volume`,
      });
    }

    if (priceRange > 2) {
      signals.push({
        type: "CRITICAL",
        title: "Explosive Candle",
        message: `${priceRange.toFixed(2)}% move`,
      });
    }

    if (obRatio > 3) {
      signals.push({
        type: "WARNING",
        title: "Buy Pressure",
        message: `${obRatio.toFixed(2)}:1 bid/ask`,
      });
    } else if (obRatio < 0.33) {
      signals.push({
        type: "WARNING",
        title: "Sell Pressure",
        message: `${(1 / obRatio).toFixed(1)}:1 ask/bid`,
      });
    }

    if (gamma > 0.0005) {
      signals.push({
        type: "INFO",
        title: "High Gamma Detected",
        message: `Gamma = ${gamma.toFixed(4)}`,
      });
    }

    // Enhanced Greeks analysis
    if (delta && Math.abs(delta) > 0.7) {
      signals.push({
        type: "WARNING",
        title: "High Delta Exposure",
        message: `Delta = ${delta.toFixed(3)} (High directional risk)`,
      });
    }

    if (iv && iv > 0.25) {
      signals.push({
        type: "INFO",
        title: "High Implied Volatility",
        message: `IV = ${(iv * 100).toFixed(1)}%`,
      });
    }

    // Combined analysis
    if (gamma > 0.001 && Math.abs(delta || 0) > 0.6) {
      signals.push({
        type: "CRITICAL",
        title: "Gamma-Delta Squeeze",
        message: `High Gamma (${gamma.toFixed(4)}) + High Delta (${delta?.toFixed(3)})`,
      });
    }

    return signals;
  }
}
