// =========================
// ⚡ LIVE DATA STREAM ROUTE
// =========================

// 🧠 Next.js API runtime → Node.js backend
import { NextRequest } from "next/server";

// 🧩 நம்ம WebSocket feed instance
import { getSmartFeed } from "@/lib/feed/server-ws";

// 🪵 centralized logger
import { logger } from "@/lib/logger";

// Runtime Node.js தான் (edge அல்ல)
export const runtime = "nodejs";

// =========================
// 🧩 GET (SSE Stream)
// =========================
export async function GET(req: NextRequest) {
  // 1️⃣ — TransformStream உருவாக்குறோம் (Readable → Client, Writable → Server)
  const { readable, writable } = new TransformStream();

  // Writable Writer
  const writer = writable.getWriter();

  // 2️⃣ — Upstox SmartFeed instance எடுக்குறோம்
  const feed = await getSmartFeed();

  // Unique ID — Debug log க்கு
  const id = Math.random().toString(36).slice(2, 8);
  logger.info(`SSE client connected (${id})`, "LiveStream");

  // 3️⃣ — Tick வரும்போது ஒவ்வொரு data packet-ஐ JSON serialize பண்ணி client-க்கு push பண்ணும் function
  const onTick = (payload: any) => {
    try {
      // Feed event வந்த உடனே client-க்கு data அனுப்புறோம்
      writer.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      logger.error(`Stream write failed: ${(err as Error).message}`, "LiveStream");
    }
  };

  // 4️⃣ — FeedManager-ல் இருந்து tick event க்கான listener attach பண்ணுறோம்
  feed.on("tick", onTick);

  // 5️⃣ — Client tab/browser close ஆச்சுன்னா → cleanup
  req.signal.addEventListener("abort", () => {
    feed.off("tick", onTick);
    writer.close();
    logger.warn(`SSE client disconnected (${id})`, "LiveStream");
  });

  // 6️⃣ — Response headers → event-stream format
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",   // 👈 SSE type
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


