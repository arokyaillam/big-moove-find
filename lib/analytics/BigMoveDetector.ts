/**
 * Big Move Detection Algorithm (v2)
 * Analyzes Upstox Market Feed data (v3)
 * Handles fullFeed + Greeks + OB + Volume metrics
 */

export class BigMoveDetector {
  history: Map<string, any[]>;
  avgVolumes: Map<string, number>;

  constructor() {
    this.history = new Map();
    this.avgVolumes = new Map();
  }

  /**
   * Extract relevant feed section
   */
  extractMarketData(feedValue: any) {
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
  private toNum(v: any): number {
    if (v === undefined || v === null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Core analysis
   */
  analyze(symbol: string, env: any) {
    const mff = env?.fullFeed?.marketFF;
    if (!mff) return null;

    const ltp = this.toNum(mff.ltpc?.ltp);
    const volume = this.toNum(mff.vtt);
    const tbq = this.toNum(mff.tbq);
    const tsq = this.toNum(mff.tsq);
    const gamma = this.toNum(mff.optionGreeks?.gamma);

    // === Volume ratio
    const avgVol = this.avgVolumes.get(symbol) || (volume / 10 || 1);
    const volumeRatio = volume / avgVol;

    // === Orderbook ratio
    const obRatio = tsq > 0 ? tbq / tsq : 0;

    // === Price range
    const candles = mff.marketOHLC?.ohlc || [];
    const candle =
      candles.find((c: any) => c.interval?.toUpperCase() === "I15") ||
      candles.find((c: any) => c.interval?.toUpperCase() === "I1");

    let priceRange = 0;
    if (candle && candle.low > 0) {
      priceRange = ((candle.high - candle.low) / candle.low) * 100;
    }

    // === Score calculation
    let score = 0;

    // Volume factor (0–30)
    if (volumeRatio > 5) score += 30;
    else if (volumeRatio > 3) score += 20;
    else if (volumeRatio > 2) score += 10;

    // Price range factor (0–25)
    if (priceRange > 3) score += 25;
    else if (priceRange > 2) score += 15;
    else if (priceRange > 1) score += 10;

    // Order book factor (0–25)
    if (obRatio > 5) score += 25;
    else if (obRatio > 3) score += 20;
    else if (obRatio > 2) score += 10;

    // Greeks factor (0–20)
    if (gamma > 0.001) score += 20;
    else if (gamma > 0.0005) score += 10;
    else score += Math.min(gamma * 10000, 20);

    score = Math.min(score, 100);

    // === Alert classification
    let alertLevel = "NORMAL";
    if (score >= 70) alertLevel = "CRITICAL";
    else if (score >= 50) alertLevel = "WARNING";
    else if (score >= 35) alertLevel = "WATCH";

    return {
      score,
      alertLevel,
      metrics: { volumeRatio, obRatio, priceRange, ltp },
      signals: this.generateSignals(volumeRatio, priceRange, obRatio, gamma),
    };
  }

  /**
   * Generate alert signals
   */
  private generateSignals(
    volRatio: number,
    priceRange: number,
    obRatio: number,
    gamma: number
  ) {
    const signals: any[] = [];

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

    return signals;
  }
}
