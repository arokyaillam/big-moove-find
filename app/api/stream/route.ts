import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const feed = getSmartFeed();
  const clientId = Math.random().toString(36).substring(2, 8);
  logger.info(`SSE client connected (${clientId})`, "LiveStream");

  const onTick = (payload: any) => writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  feed.on("tick", onTick);

  req.signal.addEventListener("abort", () => {
    feed.off("tick", onTick);
    writer.close();
    logger.warn(`SSE client disconnected (${clientId})`, "LiveStream");
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
