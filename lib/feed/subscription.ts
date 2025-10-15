// lib/feed/subscription.ts
import { logger } from "@/lib/logger";
import WS from "ws";

const activeSubs = new Set<string>();
(global as any).__activeSubs = activeSubs;
const MAX_SUBS = 500;

export function subscribe(symbol: string, ws: WS, feedManager?: any) {
  if (activeSubs.has(symbol)) {
    logger.warn(`Already subscribed to ${symbol}`, "Subscription");
    if (feedManager) {
      feedManager.emit("tick", {
        type: "subscription_status",
        symbol,
        status: "already_active",
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }
  if (activeSubs.size >= MAX_SUBS) {
    logger.warn(`Subscription limit reached: ${symbol}`, "Subscription");
    return;
  }
  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot subscribe to ${symbol}`, "Subscription");
    return;
  }

  activeSubs.add(symbol);
  const payload = {
    guid: "sub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    method: "sub",
    data: { mode: "full_d30", instrumentKeys: [symbol] },
  };
  try {
    ws.send(JSON.stringify(payload));
    logger.info(`✅ Subscribed → ${symbol} | Mode: full_d30`, "Subscription");
    if (feedManager) {
      feedManager.emit("tick", {
        type: "subscription_confirmed",
        symbol,
        alertLevel: "NORMAL",
        score: 0,
        metrics: { ltp: 0, volumeRatio: 0, priceRange: 0, obRatio: 0 },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    activeSubs.delete(symbol);
    logger.error(`Failed to subscribe to ${symbol}: ${error}`, "Subscription");
  }
}

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
    data: { mode: "full_d30", instrumentKeys: [symbol] },
  };
  try {
    ws.send(JSON.stringify(payload));
    logger.warn(`❌ Unsubscribed → ${symbol}`, "Subscription");
    if (feedManager) {
      feedManager.emit("tick", {
        type: "unsubscription_confirmed",
        symbol,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error(`Failed to unsubscribe from ${symbol}: ${error}`, "Subscription");
  }
}

export function getSubscriptions(): string[] {
  return Array.from(activeSubs);
}

export function isSubscribed(symbol: string): boolean {
  return activeSubs.has(symbol);
}

export function clearSubscriptions(): void {
  activeSubs.clear();
  logger.system("All subscriptions cleared", "Subscription");
}