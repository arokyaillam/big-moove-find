// lib/feed/server-ws.ts
import WebSocket, { RawData } from "ws";
import EventEmitter from "events";
import { decodeMessageBinary } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import { logger } from "@/lib/logger";

// 1) fetch authorized wss url using REST
async function getAuthorizedWssUrl(): Promise<string> {
  const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Authorize failed ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const url = json?.data?.authorized_redirect_uri;
  if (!url) throw new Error("No authorized_redirect_uri in response");
  return url;
}

function rawDataToUint8Array(msg: RawData): Uint8Array {
  if (msg instanceof ArrayBuffer) return new Uint8Array(msg);
  if (Array.isArray(msg)) {
    const total = msg.reduce((n, b) => n + b.byteLength, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const b of msg) {
      const view = b instanceof ArrayBuffer ? new Uint8Array(b)
        : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      out.set(view, off); off += view.byteLength;
    }
    return out;
  }
  const buf = msg as Buffer;
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export class SmartFeedManager extends EventEmitter {
  ws: WebSocket | null = null;
  cache: Record<string, { ltp: number }> = {};
  detector = new BigMoveDetector();
  reconnectTimer: NodeJS.Timeout | null = null;

  async connect() {
    try {
      const wssUrl = await getAuthorizedWssUrl();
      logger.system("Got authorized WSS url", "SmartFeed");

      // 2) connect to the authorized wss url
      this.ws = new WebSocket(wssUrl, {
        // Node ws follows redirects by default in modern versions; if not, use:
        // followRedirects: true as any
        headers: {
          // Usually no extra auth headers needed once authorized URL is used
          // Keep Origin minimal; some stacks require a valid Origin:
          Origin: "https://api.upstox.com",
        },
      });
      this.ws.binaryType = "arraybuffer";

      this.ws.on("open", () => logger.system("Connected to Upstox (v3)", "SmartFeed"));

      this.ws.on("message", async (msg: RawData) => {
        try {
          logger.system(`Raw packet received: ${msg instanceof Buffer ? msg.byteLength : 'unknown'} bytes`, "FeedRaw");  
          const bytes = rawDataToUint8Array(msg);
          const decoded = await decodeMessageBinary(bytes);
          const feeds = decoded.feeds as Record<string, any> | undefined;
          if (!feeds) return;

          for (const [symbol, feedValue] of Object.entries(feeds)) {
            const ltp =
              Number(feedValue?.ltpc?.ltp ??
                     feedValue?.firstLevelWithGreeks?.ltpc?.ltp ?? 0);
            const prev = this.cache[symbol]?.ltp ?? 0;
            if (Math.abs(ltp - prev) <= 0.05) continue;

            this.cache[symbol] = { ltp };
            const result = this.detector.analyze(symbol, feedValue);
            if (result) this.emit("tick", { symbol, ...result, timestamp: new Date().toISOString() });
          }
        } catch (e: any) {
          logger.error(`Decode error: ${e.message}`, "SmartFeed");
        }
      });

      this.ws.on("close", () => {
        logger.warn("Feed closed, reconnecting…", "SmartFeed");
        this.scheduleReconnect();
      });
      this.ws.on("error", (err) => {
        logger.error(`WS error: ${(err as any)?.message ?? String(err)}`, "SmartFeed");
        this.ws?.close();
      });
    } catch (e: any) {
      logger.error(`Connect failed: ${e.message}`, "SmartFeed");
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }
}

let smartFeed: SmartFeedManager | null = null;
export function getSmartFeed() {
  if (!smartFeed) {
    smartFeed = new SmartFeedManager();
    smartFeed.connect();
  }
  return smartFeed;
}
