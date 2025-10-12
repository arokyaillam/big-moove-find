import fs from "fs";
import path from "path";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import { logger } from "@/lib/logger";

// Load JSON file
const filePath = path.resolve("lib/tests/sample_feed.json");
const raw = fs.readFileSync(filePath, "utf-8");
const sample = JSON.parse(raw);

// Instantiate detector
const detector = new BigMoveDetector();

for (const [symbol, feed] of Object.entries(sample.feeds)) {
  if (symbol === "currentTs") continue;

  logger.info(`[TEST] Processing ${symbol}...`);
  const result = detector.analyze(symbol, feed as any);

  if (result) {
    logger.info(`[RESULT] Symbol: ${symbol}`);
    logger.info(`[RESULT] Score: ${result.score.toFixed(2)}`);
    logger.info(`[RESULT] Alert: ${result.alertLevel}`);
    logger.info(`[RESULT] Metrics: ${JSON.stringify(result.metrics, null, 2)}`);
  } else {
    logger.warn(`[RESULT] No market data found for ${symbol}`);
  }
}
