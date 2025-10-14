// app/api/command/route.ts - Updated to emit immediately

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
      return ws;
    }
    await new Promise((r) => setTimeout(r, 500));
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
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Symbol required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!["sub", "unsub"].includes(type ?? "")) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Invalid type" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    logger.system(`Command: ${type} for ${symbols.length} symbols`, "Command");

    const feed = await getSmartFeed();
    
    if (!feed.isConnected()) {
      logger.error("Feed not connected", "Command");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Feed not connected" 
      }), { 
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ws = await waitForWsOpen(feed);

    const results = [];
    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      
      try {
        if (type === "sub") {
          if (isSubscribed(symbol)) {
            results.push({ 
              symbol, 
              action: "already_subscribed",
              status: "skipped"
            });
            continue;
          }

          // ✅ Pass feed manager to enable immediate emit
          subscribe(symbol, ws, feed);
          
          // ✅ EMIT INITIAL/CACHED DATA IMMEDIATELY
          feed.emitInitialData(symbol);

          results.push({ 
            symbol, 
            action: "subscribed",
            status: "success",
            emitted: true
          });
          
          logger.system(`✅ Subscribed & emitted for ${symbol}`, "Command");

        } else {
          if (!isSubscribed(symbol)) {
            results.push({ 
              symbol, 
              action: "not_subscribed",
              status: "skipped"
            });
            continue;
          }

          // ✅ Pass feed manager for unsubscribe
          unsubscribe(symbol, ws, feed);
          
          results.push({ 
            symbol, 
            action: "unsubscribed",
            status: "success"
          });
          
          logger.system(`❌ Unsubscribed ${symbol}`, "Command");
        }

      } catch (error) {
        logger.error(`Failed to ${type} ${symbol}: ${error}`, "Command");
        results.push({ 
          symbol, 
          action: "failed", 
          status: "error",
          error: String(error) 
        });
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
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (err: any) {
    logger.error(`Command error: ${err.message}`, "Command");
    
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "Internal server error",
      message: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}