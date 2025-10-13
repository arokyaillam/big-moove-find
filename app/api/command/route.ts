import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { subscribe, unsubscribe } from "@/lib/feed/subscription";
import { logger } from "@/lib/logger";
import WS from "ws";
import { normalizeSymbol } from "@/lib/utils/symbol";

export const runtime = "nodejs";

async function waitForWsOpen(feed: any, timeout = 7000): Promise<WS> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ws = feed.ws as WS | null;
    if (ws && ws.readyState === ws.OPEN) return ws;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("WebSocket not ready after timeout");
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let type = searchParams.get("type");
    let rawSymbol = searchParams.get("symbol");

    // ✅ Try to parse JSON body (for batch requests)
    let body: any = {};
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // Merge query params + body payload
    const symbols = body.symbols || (rawSymbol ? [rawSymbol] : []);
    type = body.type || type;

    if (!symbols.length) {
      return new Response("Symbol required", { status: 400 });
    }

    if (!["sub", "unsub"].includes(type ?? "")) {
      return new Response("Invalid type", { status: 400 });
    }

    const feed = await getSmartFeed();
    logger.system(`Command received: type=${type}, count=${symbols.length}`, "Command");

    // Check if feed is properly connected before proceeding
    if (!feed.isConnected()) {
      logger.error("Feed not connected for subscription command", "Command");
      return new Response("Feed not connected", { status: 503 });
    }

    const ws = await waitForWsOpen(feed);

    const results = [];
    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      try {
        if (type === "sub") {
          subscribe(symbol, ws);
          results.push({ symbol, action: "subscribed" });
        } else {
          unsubscribe(symbol, ws);
          results.push({ symbol, action: "unsubscribed" });
        }
      } catch (error) {
        logger.error(`Failed to ${type} ${symbol}: ${error}`, "Command");
        results.push({ symbol, action: "failed", error: String(error) });
      }
    }

    return Response.json({
      ok: true,
      action: type,
      count: symbols.length,
      results
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    return new Response("Internal error", { status: 500 });
  }
}
