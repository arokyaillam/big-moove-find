import { logger } from "@/lib/logger";
import type { WebSocket as NodeWebSocket } from "ws";

const activeSubs = new Set<string>();

export function subscribe(symbol: string, ws: NodeWebSocket) {
  if (activeSubs.has(symbol)) return;
  activeSubs.add(symbol);

  ws.send(JSON.stringify({
    guid: "sub_" + Date.now(),
    method: "sub",
    data: { instruments: [symbol], mode: "full" },
  }));
  logger.info(`Subscribed → ${symbol}`, "Subscription");
}

export function unsubscribe(symbol: string, ws: NodeWebSocket) {
  if (!activeSubs.has(symbol)) return;
  activeSubs.delete(symbol);

  ws.send(JSON.stringify({
    guid: "unsub_" + Date.now(),
    method: "unsub",
    data: { instruments: [symbol] },
  }));
  logger.warn(`Unsubscribed → ${symbol}`, "Subscription");
}

export function getSubscriptions() {
  return Array.from(activeSubs);
}
