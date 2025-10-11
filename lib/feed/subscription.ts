import { logger } from "@/lib/logger";
import WS from "ws";

const activeSubs = new Set<string>();
// optional global exposure for health
(global as any).__activeSubs = activeSubs;

export function subscribe(symbol: string, ws: WS) {
  if (activeSubs.has(symbol)) return;
  activeSubs.add(symbol);

  const payload = { guid: "sub_" + Date.now(), method: "sub", data: { instruments: [symbol], mode: "full" } };
  ws.send(JSON.stringify(payload));
  logger.info(`Subscribed → ${symbol}`, "Subscription");
}

export function unsubscribe(symbol: string, ws: WS) {
  if (!activeSubs.has(symbol)) return;
  activeSubs.delete(symbol);

  const payload = { guid: "unsub_" + Date.now(), method: "unsub", data: { instruments: [symbol] } };
  ws.send(JSON.stringify(payload));
  logger.warn(`Unsubscribed → ${symbol}`, "Subscription");
}

export function getSubscriptions() { return Array.from(activeSubs); }
