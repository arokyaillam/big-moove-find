import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { subscribe, unsubscribe } from "@/lib/feed/subscription";
import { logger } from "@/lib/logger";

// ✅ Node WebSocket types
import WS from "ws";
import type { WebSocket as NodeWebSocket } from "ws";

export const runtime = "nodejs";

/**
 * Helper: Wait for feed.ws to reach OPEN state
 */
async function waitForWsOpen(feed: any, timeout = 7000): Promise<NodeWebSocket> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ws = feed.ws as NodeWebSocket | null;
    if (ws && ws.readyState === ws.OPEN) {
      return ws;
    }
    await new Promise((r) => setTimeout(r, 300)); // retry every 300ms
  }
  throw new Error("WebSocket not ready after timeout");
}

/**
 * API Route: /api/command
 * Handles subscription and unsubscription requests
 *
 * Example:
 * POST /api/command?type=sub&symbol=NSE_EQ|RELIANCE
 * POST /api/command?type=unsub&symbol=NSE_EQ|RELIANCE
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      logger.error("Missing 'symbol' parameter", "Command");
      return new Response("Symbol required", { status: 400 });
    }

    // ✅ initialize feed
    const feed = getSmartFeed();
    logger.system(`Command received: type=${type}, symbol=${symbol}`, "Command");

    // ✅ Wait until feed.ws becomes OPEN
    let ws: NodeWebSocket;
    try {
      ws = await waitForWsOpen(feed, 7000);
      logger.system("Feed WS ready for command", "Command");
    } catch {
      logger.error("Feed WebSocket not ready within timeout", "Command");
      return new Response("Feed not connected", { status: 500 });
    }

    // ✅ Execute command
    if (type === "sub") {
      subscribe(symbol, ws as unknown as WS);
      logger.info(`Subscribed → ${symbol}`, "Command");
    } else if (type === "unsub") {
      unsubscribe(symbol, ws as unknown as WS);
      logger.warn(`Unsubscribed → ${symbol}`, "Command");
    } else {
      logger.error("Invalid command type", "Command");
      return new Response("Invalid type", { status: 400 });
    }

    return Response.json({ ok: true, action: type, symbol });
  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    return new Response("Internal error", { status: 500 });
  }
}
