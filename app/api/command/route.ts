import { NextRequest } from "next/server";
import { getSmartFeed } from "@/lib/feed/server-ws";
import { subscribe, unsubscribe, isSubscribed } from "@/lib/feed/subscription";
import { logger } from "@/lib/logger";
import { normalizeSymbol } from "@/lib/utils/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function waitForWsReady(feed: any, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (feed.ws?.readyState === 1) {
      logger.system("WebSocket ready", "Command");
      return feed.ws;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("WebSocket timeout");
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

    let body: any = {};
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const symbols = body.symbols || (rawSymbol ? [rawSymbol] : []);
    type = body.type || type;

    if (!symbols.length) {
      return Response.json({ ok: false, error: "Symbol required" }, { status: 400 });
    }

    if (!["sub", "unsub"].includes(type ?? "")) {
      return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
    }

    logger.system(`Command: ${type} for ${symbols.join(", ")}`, "Command");

    // Get feed instance
    const feed = getSmartFeed();
    
    if (!feed.isConnected()) {
      logger.error("Feed not connected", "Command");
      return Response.json({ ok: false, error: "Feed not connected" }, { status: 503 });
    }

    const ws = await waitForWsReady(feed);
    const results = [];

    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      
      try {
        if (type === "sub") {
          if (isSubscribed(symbol)) {
            results.push({ symbol, action: "already_subscribed", status: "skipped" });
            continue;
          }

          // ✅ CRITICAL: Pass feed manager to enable immediate emit
          subscribe(symbol, ws, feed);
          
          results.push({ symbol, action: "subscribed", status: "success" });
          logger.system(`✅ Subscribed: ${symbol}`, "Command");

        } else {
          if (!isSubscribed(symbol)) {
            results.push({ symbol, action: "not_subscribed", status: "skipped" });
            continue;
          }

          // Pass feed manager for unsubscribe too
          unsubscribe(symbol, ws, feed);
          results.push({ symbol, action: "unsubscribed", status: "success" });
          logger.system(`❌ Unsubscribed: ${symbol}`, "Command");
        }
      } catch (error) {
        logger.error(`${type} failed for ${symbol}: ${error}`, "Command");
        results.push({ symbol, action: "failed", status: "error", error: String(error) });
      }
    }

    return Response.json({
      ok: true,
      action: type,
      count: symbols.length,
      successful: results.filter(r => r.status === "success").length,
      results,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });

  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    return Response.json({ 
      ok: false, 
      error: "Internal error",
      message: err.message 
    }, { status: 500 });
  }
}