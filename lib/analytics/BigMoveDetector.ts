import { logger } from "@/lib/logger";
import type { FeedValue } from "@/lib/feed/types";

export class BigMoveDetector {
  private history = new Map<string, any[]>();
  private avgVolumes = new Map<string, number>();

  private extractMarketData(feedValue: FeedValue) {
    if (feedValue?.fullFeed?.marketFF) return feedValue.fullFeed.marketFF;
    if (feedValue?.fullFeed?.indexFF) return feedValue.fullFeed.indexFF;
    if (feedValue?.ltpc) return { ltpc: feedValue.ltpc };
    if (feedValue?.firstLevelWithGreeks) return feedValue.firstLevelWithGreeks as any;
    return null;
  }

  analyze(instrumentKey: string, feedValue: FeedValue) {
    const data = this.extractMarketData(feedValue);
    if (!data) return null;

    const ltp = Number(data.ltpc?.ltp ?? 0);
    const volume = Number(feedValue.vtt ?? 0);

    if (!this.history.has(instrumentKey)) {
      this.history.set(instrumentKey, []);
      this.avgVolumes.set(instrumentKey, volume / 60);
    }

    const avgVol = this.avgVolumes.get(instrumentKey) ?? 0;
    const volumeRatio = avgVol > 0 ? volume / avgVol : 0;

    const tbq = Number(feedValue.tbq ?? 0);
    const tsq = Number(feedValue.tsq ?? 0);
    const obRatio = tsq > 0 ? tbq / tsq : 0;

    let priceRange = 0;
    const lastCandle = feedValue.marketOHLC?.ohlc?.at(-1);
    if (lastCandle && lastCandle.low > 0) {
      priceRange = ((lastCandle.high - lastCandle.low) / lastCandle.low) * 100;
    }

    let score = 0;
    score += Math.min(volumeRatio * 5, 30);
    score += Math.min(priceRange * 5, 25);
    score += Math.min(obRatio * 5, 25);

    const gamma = feedValue.optionGreeks?.gamma ?? 0;
    score += Math.min(gamma * 10000, 20);

    score = Math.min(score, 100);

    let alertLevel: "NORMAL" | "WATCH" | "WARNING" | "CRITICAL" = "NORMAL";
    if (score >= 70) alertLevel = "CRITICAL";
    else if (score >= 50) alertLevel = "WARNING";
    else if (score >= 35) alertLevel = "WATCH";

    if (alertLevel === "CRITICAL")
      logger.alert(`⚠️ Critical move on ${instrumentKey} (${score.toFixed(2)})`, "BigMove");
    else if (alertLevel === "WARNING")
      logger.warn(`Signal on ${instrumentKey} (${score.toFixed(2)})`, "BigMove");

    return {
      score,
      alertLevel,
      metrics: { volumeRatio, obRatio, priceRange, ltp },
    };
  }
}
