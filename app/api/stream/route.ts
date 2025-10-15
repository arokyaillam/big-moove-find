// app/api/feed/stream/route.ts
import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const clientId = Math.random().toString(36).slice(2, 8);
    logger.info(`SSE client ${clientId} connecting`, "Stream");

    const feed = getSmartFeed();
    // 1. wait for WS to be ready
    try {
      await new Promise<void>((res, rej) => {
        if (feed.isConnected()) return res();
        feed.once("ready", res);
        setTimeout(() => rej(new Error("WS timeout")), 8000);
      });
    } catch (e) {
      logger.error(`WS not ready for SSE: ${e}`, "Stream");
      return new Response(JSON.stringify({ error: "Feed not ready" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. send first byte to unlock browser
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: "connected",
      id: clientId,
      timestamp: new Date().toISOString(),
    })}\n\n`));
    await writer.write(encoder.encode(":\n\n"));

    // 3. cached data
    try {
      await feed.emitInitialData(writer);
    } catch (e) {
      logger.warn(`Initial data emit failed: ${e}`, "Stream");
    }

    // 4. listener with back-pressure
    const onTick = async (payload: any) => {
      try {
        await writer.ready;
        await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } catch (err) {
        logger.error(`Write failed for ${clientId}`, "Stream");
      }
    };
    feed.on("tick", onTick);
    logger.system(`Attached tick listener for ${clientId}`, "Stream");

    // 5. heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await writer.ready;
        await writer.write(encoder.encode(": heartbeat\n\n"));
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // 6. cleanup
    req.signal.addEventListener("abort", () => {
      try {
        feed.off("tick", onTick);
        clearInterval(heartbeat);
        writer.close().catch(() => {});
        logger.warn(`SSE client ${clientId} disconnected`, "Stream");
      } catch (err) {
        logger.error(`Cleanup error for ${clientId}`, "Stream");
      }
    });

    // 7. response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logger.error(`SSE setup failed: ${error}`, "Stream");
    return new Response(JSON.stringify({ error: "Stream initialization failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}