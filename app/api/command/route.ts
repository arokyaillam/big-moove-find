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

    const feed = getSmartFeed();
    logger.system(`Command received: type=${type}, count=${symbols.length}`, "Command");

    const ws = await waitForWsOpen(feed);

    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      if (type === "sub") {
        subscribe(symbol, ws);
      } else {
        unsubscribe(symbol, ws);
      }
    }

    return Response.json({ ok: true, action: type, symbols });
  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    return new Response("Internal error", { status: 500 });
  }
}
