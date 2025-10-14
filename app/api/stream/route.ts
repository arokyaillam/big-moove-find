// ✅ app/api/stream/route.ts
import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const feed = getSmartFeed();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  logger.info("SSE client connected", "LiveStream");

  // Existing cache send (initial snapshot)
  feed.emitInitialData(writer);

  // Live updates
  const onTick = (payload: any) => {
    writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  feed.on("tick", onTick);

  req.signal.addEventListener("abort", () => {
    feed.off("tick", onTick);
    writer.close();
    logger.warn("SSE client disconnected", "LiveStream");
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
