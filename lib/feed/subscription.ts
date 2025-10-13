// lib/feed/subscription.ts - Complete Fixed Version

import { logger } from "@/lib/logger";
import WS from "ws";

const activeSubs = new Set<string>();
// Global exposure for health check
(global as any).__activeSubs = activeSubs;

/**
 * Subscribe to instrument with proper Upstox v3 format
 */
export function subscribe(symbol: string, ws: WS) {
  if (activeSubs.has(symbol)) {
    logger.warn(`Already subscribed to ${symbol}`, "Subscription");
    return;
  }

  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot subscribe to ${symbol}`, "Subscription");
    return;
  }

  activeSubs.add(symbol);

  // ✅ FIXED: Correct Upstox v3 API format
  const payload = {
    guid: "sub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    method: "sub",
    data: {
      mode: "full_d30",  // ✅ underscore, lowercase, no space
      instrumentKeys: [symbol]  // ✅ instrumentKeys (not instrumentsKeys)
    }
  };

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    logger.info(`✅ Subscribed → ${symbol} | Mode: full_d30`, "Subscription");
    logger.system(`Subscription payload: ${message}`, "Subscription");
  } catch (error) {
    activeSubs.delete(symbol); // Remove if send failed
    logger.error(`Failed to send subscription for ${symbol}: ${error}`, "Subscription");
  }
}

/**
 * Unsubscribe from instrument
 */
export function unsubscribe(symbol: string, ws: WS) {
  if (!activeSubs.has(symbol)) {
    logger.warn(`Not subscribed to ${symbol}`, "Subscription");
    return;
  }

  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot unsubscribe from ${symbol}`, "Subscription");
    return;
  }

  activeSubs.delete(symbol);

  // ✅ FIXED: Correct unsubscribe format
  const payload = {
    guid: "unsub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    method: "unsub",
    data: {
      mode: "full_d30",
      instrumentKeys: [symbol]  // ✅ Same format as subscribe
    }
  };

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    logger.warn(`❌ Unsubscribed → ${symbol}`, "Subscription");
    logger.system(`Unsubscription payload: ${message}`, "Subscription");
  } catch (error) {
    logger.error(`Failed to send unsubscription for ${symbol}: ${error}`, "Subscription");
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