// lib/feed/subscription.ts
import { logger } from "@/lib/logger";
import WS from "ws";
import { encodeSubscribeRequest, encodeUnsubscribeRequest } from "./decode";

const activeSubs = new Set<string>();
(global as Record<string, unknown>).__activeSubs = activeSubs;
const MAX_SUBS = 500;

// CHANGED: Made async to handle protobuf encoding
export async function subscribe(symbol: string, ws: WS, feedManager?: { emit?: (event: string, data: unknown) => void }) {
  if (activeSubs.has(symbol)) {
    logger.warn(`Already subscribed to ${symbol}`, "Subscription");
    if (feedManager) {
      feedManager.emit?.("tick", {
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

  try {
    // CHANGED: Use protobuf encoding
    const binaryReq = await encodeSubscribeRequest([symbol]);
    ws.send(binaryReq); // Send as binary, not JSON
    logger.info(`✅ Subscribed → ${symbol} | Mode: full`, "Subscription");
    if (feedManager) {
      feedManager.emit?.("tick", {
        type: "subscription_confirmed",
        symbol,
        alertLevel: "NORMAL",
        score: 0,
        metrics: { ltp: 0, volumeRatio: 0, priceRange: 0, obRatio: 0 },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    activeSubs.delete(symbol); // Remove from local state on send failure
    logger.error(`Failed to subscribe to ${symbol}: ${error}`, "Subscription");
  }
}

// CHANGED: Made async to handle protobuf encoding
export async function unsubscribe(symbol: string, ws: WS, feedManager?: { emit?: (event: string, data: unknown) => void }) {
  if (!activeSubs.has(symbol)) {
    logger.warn(`Not subscribed to ${symbol}`, "Subscription");
    return;
  }
  if (ws.readyState !== ws.OPEN) {
    logger.error(`WebSocket not open (state: ${ws.readyState}), cannot unsubscribe from ${symbol}`, "Subscription");
    return;
  }
  activeSubs.delete(symbol);

  try {
    // CHANGED: Use protobuf encoding
    const binaryReq = await encodeUnsubscribeRequest([symbol]);
    ws.send(binaryReq); // Send as binary, not JSON
    logger.warn(`❌ Unsubscribed → ${symbol}`, "Subscription");
    if (feedManager) {
      feedManager.emit?.("tick", {
        type: "unsubscription_confirmed",
        symbol,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    activeSubs.add(symbol); // Restore to local state on send failure
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