// app/api/feed/stream/route.ts  (Next.js 13+ route handler)
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

    /* ----------  1.  WAIT UNTIL WEB-SOCKET IS REALLY OPEN  ---------- */
    const feed = getSmartFeed();
    await new Promise<void>((res, rej) => {
      if (feed.isConnected()) return res();          // already happy
      feed.once("ready", res);                       // wait once
      setTimeout(() => rej(new Error("WS timeout")), 8000);
    });

    /* ----------  2.  SEND FIRST BYTE TO UNLOCK BROWSER  -------------- */
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: "connected",
      id: clientId,
      timestamp: new Date().toISOString()
    })}\n\n`));
    await writer.write(encoder.encode(":\n\n"));      // flush headers

    /* ----------  3.  PUSH CACHED DATA (IF ANY)  ---------------------- */
    try {
      await feed.emitInitialData(writer);
    } catch (e) {
      logger.warn(`Initial data emit failed: ${e}`, "Stream");
    }

    /* ----------  4.  LISTEN TO EVERY TICK  --------------------------- */
    const onTick = async (payload: any) => {
      try {
        const data = `data: ${JSON.stringify(payload)}\n\n`;
        await writer.write(encoder.encode(data));
      } catch (err) {
        logger.error(`Tick processing failed for ${clientId}`, "Stream");
      }
    };
    feed.on("tick", onTick);
    logger.system(`Attached tick listener for ${clientId}`, "Stream");

    /* ----------  5.  HEARTBEAT TO KEEP CONNECTION ALIVE  ------------- */
    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(": heartbeat\n\n"));
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    /* ----------  6.  CLEANUP ON DISCONNECT  -------------------------- */
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

    /* ----------  7.  RETURN SSE RESPONSE  ---------------------------- */
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
    return new Response(
      JSON.stringify({ error: "Stream initialization failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}