// app/api/command/route.ts - Enhanced Version

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
    logger.system(`Waiting for WebSocket... (state: ${ws?.readyState})`, "Command");
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

    // Parse JSON body for batch requests
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
      logger.error("No symbols provided in request", "Command");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Symbol required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!["sub", "unsub"].includes(type ?? "")) {
      logger.error(`Invalid type: ${type}`, "Command");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Invalid type. Use 'sub' or 'unsub'" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    logger.system(`Command received: type=${type}, symbols=${symbols.join(", ")}`, "Command");

    // Get feed instance
    const feed = await getSmartFeed();
    
    // Check feed connection
    if (!feed.isConnected()) {
      logger.error("Feed not connected", "Command");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Feed not connected. Please wait and try again." 
      }), { 
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Wait for WebSocket to be ready
    let ws: WS;
    try {
      ws = await waitForWsOpen(feed);
    } catch (error) {
      logger.error(`WebSocket not ready: ${error}`, "Command");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "WebSocket not ready" 
      }), { 
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Process each symbol
    const results = [];
    for (const sym of symbols) {
      const symbol = normalizeSymbol(sym);
      
      try {
        if (type === "sub") {
          // Check if already subscribed
          if (isSubscribed(symbol)) {
            logger.warn(`${symbol} already subscribed, skipping`, "Command");
            results.push({ 
              symbol, 
              action: "already_subscribed",
              status: "skipped"
            });
            continue;
          }

          subscribe(symbol, ws);
          results.push({ 
            symbol, 
            action: "subscribed",
            status: "success"
          });
          logger.system(`✅ Successfully subscribed to ${symbol}`, "Command");

        } else {
          // Unsubscribe
          if (!isSubscribed(symbol)) {
            logger.warn(`${symbol} not subscribed, skipping`, "Command");
            results.push({ 
              symbol, 
              action: "not_subscribed",
              status: "skipped"
            });
            continue;
          }

          unsubscribe(symbol, ws);
          results.push({ 
            symbol, 
            action: "unsubscribed",
            status: "success"
          });
          logger.system(`❌ Successfully unsubscribed from ${symbol}`, "Command");
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

    // Return success response
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
    logger.error(`Stack: ${err.stack}`, "Command");
    
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "Internal server error",
      message: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};