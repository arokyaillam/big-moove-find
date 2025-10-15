// app/api/feed/stream/route.ts
import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  logger.system("[SSE-FLOW] A. New SSE client arriving", "Stream");
  try {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const clientId = Math.random().toString(36).slice(2, 8);
    logger.system(`[SSE-FLOW] B. Client id = ${clientId}`, "Stream");

    const feed = getSmartFeed();
    try {
      await new Promise<void>((res, rej) => {
        if (feed.isConnected()) return res();
        feed.once("ready", res);
        setTimeout(() => rej(new Error("WS timeout")), 8000);
      });
    } catch {
      logger.error(`[SSE-FLOW] C. WS not ready → 503`, "Stream");
      return new Response(JSON.stringify({ error: "Feed not ready" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.system("[SSE-FLOW] D. Sending connected frame", "Stream");
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: "connected",
      id: clientId,
      timestamp: new Date().toISOString(),
    })}\n\n`));
    await writer.write(encoder.encode(":\n\n"));

    logger.system("[SSE-FLOW] E. Emit initial cached data", "Stream");
    try {
      await feed.emitInitialData(writer);
    } catch {
      logger.warn("[SSE-FLOW] F. Initial data emit failed", "Stream");
    }

    const onTick = async (payload: unknown) => {
      const p = payload as { type?: string; symbol?: string };
      logger.system(`[SSE-FLOW] G. onTick received → ${p.type} ${p.symbol}`, "Stream");
      try {
        await writer.ready;
        const chunk = `data: ${JSON.stringify(payload)}\n\n`;
        await writer.write(encoder.encode(chunk));
        logger.system(`[SSE-FLOW] H. Written to SSE → ${p.type}`, "Stream");
      } catch {
        logger.error(`[SSE-FLOW] I. Write failed for ${clientId}`, "Stream");
      }
    };
    feed.on("tick", onTick);
    logger.system(`[SSE-FLOW] J. Attached tick listener for ${clientId}`, "Stream");

    const heartbeat = setInterval(async () => {
      try {
        await writer.ready;
        await writer.write(encoder.encode(": heartbeat\n\n"));
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    req.signal.addEventListener("abort", () => {
      logger.warn(`[SSE-FLOW] K. Client ${clientId} aborted → cleanup`, "Stream");
      try {
        feed.off("tick", onTick);
        clearInterval(heartbeat);
        writer.close().catch(() => {});
      } catch {
        logger.error(`[SSE-FLOW] L. Cleanup error for ${clientId}`, "Stream");
      }
    });

    logger.system("[SSE-FLOW] M. Returning SSE response", "Stream");
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    logger.error(`[SSE-FLOW] N. SSE setup failed: ${error}`, "Stream");
    return new Response(JSON.stringify({ error: "Stream initialization failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}