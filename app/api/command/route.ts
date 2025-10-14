// app/api/command/route.ts

import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { subscribe, unsubscribe, isSubscribed } from "@/lib/feed/subscription";
import { logger } from "@/lib/logger";
import WS from "ws";
import { normalizeSymbol } from "@/lib/utils/symbol";

export const runtime = "nodejs";

async function waitForWsOpen(feed: any, timeout = 10000): Promise<WS> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ws = feed.ws as WS | null;
    if (ws && ws.readyState === ws.OPEN) {
      logger.system("WebSocket is OPEN and ready", "Command");
      return ws;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("WebSocket not ready after timeout");
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get("type");
    const querySymbol = searchParams.get("symbol");

    let body: any = {};
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json().catch(() => ({}));
    }

    const type = body.type || queryType;
    const symbols = body.symbols || (querySymbol ? [querySymbol] : []);

    if (!symbols.length) {
      return Response.json({ ok: false, error: "Symbol required" }, { status: 400 });
    }

    if (!["sub", "unsub"].includes(type ?? "")) {
      return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
    }

    const feed = await getSmartFeed();
    if (!feed.isConnected()) {
      return Response.json({ ok: false, error: "Feed not connected" }, { status: 503 });
    }

    const ws = await waitForWsOpen(feed);

    const results: any[] = [];
    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      try {
        if (type === "sub") {
          if (isSubscribed(symbol)) {
            results.push({ symbol, action: "already_subscribed" });
            continue;
          }
          subscribe(symbol, ws);
          results.push({ symbol, action: "subscribed" });
        } else {
          if (!isSubscribed(symbol)) {
            results.push({ symbol, action: "not_subscribed" });
            continue;
          }
          unsubscribe(symbol, ws);
          results.push({ symbol, action: "unsubscribed" });
        }
      } catch (err: any) {
        results.push({ symbol: sym, error: err.message });
      }
    }

    // ✅ Return JSON response (no writer used)
    return Response.json({
      ok: true,
      action: type,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
