import fs from "fs";
import path from "path";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import { logger } from "@/lib/logger";

export async function GET() {
  // Load JSON feed from file
  const filePath = path.resolve("lib/tests/sample_feed.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const detector = new BigMoveDetector();
  const encoder = new TextEncoder();

  // Create a readable SSE stream
  const body = new ReadableStream({
    async start(controller) {
      for (const [symbol, feed] of Object.entries(data.feeds)) {
        if (symbol === "currentTs") continue;

        const result = detector.analyze(symbol, feed as any);

        // convert to JSON string
        const packet = JSON.stringify({
          symbol,
          ...result,
          timestamp: Date.now(),
        });

        // Emit one SSE event
        controller.enqueue(encoder.encode(`data: ${packet}\n\n`));

        logger.info(`[TEST-FEED] Emitted ${symbol} (${result?.alertLevel})`);
      }

      // Close connection after sending all
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
