// lib/feed/subscription.ts - Final Version with Feed Manager Support

import { logger } from "@/lib/logger";
import WS from "ws";

const activeSubs = new Set<string>();
(global as any).__activeSubs = activeSubs;

/**
 * Subscribe to instrument and optionally emit confirmation
 * @param symbol - Instrument key (e.g., "NSE_FO|42691")
 * @param ws - WebSocket instance
 * @param feedManager - Optional feed manager to emit events
 */
export function subscribe(symbol: string, ws: WS, feedManager?: any) {
  if (activeSubs.has(symbol)) {
    logger.warn(`Already subscribed to ${symbol}`, "Subscription");
    
    // Still emit if feed manager provided
    if (feedManager) {
      feedManager.emit("tick", {
        type: "subscription_status",
        symbol: symbol,
        status: "already_active",
        timestamp: new Date().toISOString(),
        message: `${symbol} is already subscribed`
      });
    }
    return;
  }

  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot subscribe to ${symbol}`, "Subscription");
    return;
  }

  activeSubs.add(symbol);

  // Send subscription request to Upstox
  const payload = {
    guid: "sub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    method: "sub",
    data: {
      mode: "full_d30",  // Full market depth with 30 levels
      instrumentKeys: [symbol]
    }
  };

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    logger.info(`✅ Subscribed → ${symbol} | Mode: full_d30`, "Subscription");
    logger.system(`Subscription payload: ${message}`, "Subscription");

    // ✅ Emit subscription confirmation immediately if feed manager provided
    if (feedManager) {
      feedManager.emit("tick", {
        type: "subscription_confirmed",
        symbol: symbol,
        alertLevel: "NORMAL",
        score: 0,
        metrics: {
          ltp: 0,
          volumeRatio: 0,
          priceRange: 0,
          obRatio: 0
        },
        timestamp: new Date().toISOString(),
        status: "subscribed",
        mode: "full_d30",
        message: `Subscribed to ${symbol} - Waiting for live data...`
      });
      
      logger.system(`📡 Emitted subscription confirmation for ${symbol}`, "Subscription");
    }

  } catch (error) {
    activeSubs.delete(symbol);
    logger.error(`Failed to subscribe to ${symbol}: ${error}`, "Subscription");
    
    // Emit error if feed manager provided
    if (feedManager) {
      feedManager.emit("tick", {
        type: "subscription_error",
        symbol: symbol,
        timestamp: new Date().toISOString(),
        error: String(error),
        message: `Failed to subscribe to ${symbol}`
      });
    }
  }
}

/**
 * Unsubscribe from instrument
 */
export function unsubscribe(symbol: string, ws: WS, feedManager?: any) {
  if (!activeSubs.has(symbol)) {
    logger.warn(`Not subscribed to ${symbol}`, "Subscription");
    return;
  }

  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot unsubscribe from ${symbol}`, "Subscription");
    return;
  }

  activeSubs.delete(symbol);

  const payload = {
    guid: "unsub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    method: "unsub",
    data: {
      mode: "full_d30",
      instrumentKeys: [symbol]
    }
  };

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    logger.warn(`❌ Unsubscribed → ${symbol}`, "Subscription");
    logger.system(`Unsubscription payload: ${message}`, "Subscription");

    // Emit unsubscription confirmation
    if (feedManager) {
      feedManager.emit("tick", {
        type: "unsubscription_confirmed",
        symbol: symbol,
        timestamp: new Date().toISOString(),
        status: "unsubscribed",
        message: `Unsubscribed from ${symbol}`
      });
      
      logger.system(`📡 Emitted unsubscription confirmation for ${symbol}`, "Subscription");
    }

  } catch (error) {
    logger.error(`Failed to unsubscribe from ${symbol}: ${error}`, "Subscription");
  }
}

/**
 * Get all active subscriptions
 */
export function getSubscriptions(): string[] {
  return Array.from(activeSubs);
}

/**
 * Check if symbol is subscribed
 */
export function isSubscribed(symbol: string): boolean {
  return activeSubs.has(symbol);
}

/**
 * Clear all subscriptions (for cleanup)
 */
export function clearSubscriptions(): void {
  activeSubs.clear();
  logger.system("All subscriptions cleared", "Subscription");
}