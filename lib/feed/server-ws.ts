import WS, { RawData } from "ws";
import EventEmitter from "events";
import { logger } from "@/lib/logger";
import { decodeMessageBinary } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import type { FeedResponseShape, FeedValue } from "./types";

async function getAuthorizedWssUrl(): Promise<string> {
  const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
    headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN!}` }
  });
  if (!res.ok) throw new Error(`Authorize failed ${res.status}: ${await res.text()}`);
  const j = await res.json(); const url = j?.data?.authorized_redirect_uri;
  if (!url) throw new Error("No authorized_redirect_uri in response");
  return url;
}

export class SmartFeedManager extends EventEmitter {
  ws: WS | null = null;
  detector = new BigMoveDetector();
  cache: Record<string, { ltp: number }> = {};
  private stats = { connectedAt: 0, lastPacketAt: 0, bytesSeen: 0, messages: 0 };

  getStatus() { return { wsState: this.ws?.readyState ?? -1, ...this.stats, subs: (global as any).__activeSubs ? Array.from((global as any).__activeSubs) : [] }; }

  async connect() {
    try {
      const wssUrl = await getAuthorizedWssUrl();
      logger.system("Got authorized WSS url", "SmartFeed");
      this.ws = new WS(wssUrl, { headers: { Origin: "https://api.upstox.com" } });
      this.ws.binaryType = "arraybuffer";

      this.ws.on("open", () => {
        this.stats.connectedAt = Date.now();
        logger.system("Connected to Upstox (v3)", "SmartFeed");
        this.emit("ready");
      });

      this.ws.on("message", async (msg: RawData) => {
        try {
          let bytes: Uint8Array;
          if (msg instanceof Buffer) {
            bytes = new Uint8Array(msg);
            logger.system(`[FeedRaw] Buffer: ${msg.byteLength} bytes`, "SmartFeed");
            this.stats.bytesSeen += msg.byteLength;
          } else if (msg instanceof ArrayBuffer) {
            const len = (msg as ArrayBuffer).byteLength;
            bytes = new Uint8Array(msg as ArrayBuffer);
            logger.system(`[FeedRaw] ArrayBuffer: ${len} bytes`, "SmartFeed");
            this.stats.bytesSeen += len;
          } else if (Array.isArray(msg)) {
            const total = msg.reduce((n, b) => n + b.byteLength, 0);
            const out = new Uint8Array(total); let off = 0;
            for (const b of msg) { const v = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength); out.set(v, off); off += v.byteLength; }
            bytes = out;
            logger.system(`[FeedRaw] Array<Uint8Array>: ${total} bytes`, "SmartFeed");
            this.stats.bytesSeen += total;
          } else {
            logger.warn(`[FeedRaw] Unknown msg type: ${typeof msg}`, "SmartFeed");
            return;
          }

          this.stats.messages += 1;
          this.stats.lastPacketAt = Date.now();

          if (process.env.FEED_DECODE === "off") return;

          const decoded: FeedResponseShape = await decodeMessageBinary(bytes);
          logger.system(`[FeedDecode] Keys: ${Object.keys(decoded ?? {}).join(", ")}`, "SmartFeed");
          console.log(JSON.stringify(decoded, null, 2));


          const feeds = decoded.feeds as Record<string, FeedValue> | undefined;
          if (!feeds) return;

          for (const [symbol, feedValue] of Object.entries(feeds)) {
            const ltp = Number(
              feedValue?.ltpc?.ltp ??
              feedValue?.firstLevelWithGreeks?.ltpc?.ltp ??
              0
            );
            const prev = this.cache[symbol]?.ltp ?? 0;
            if (Math.abs(ltp - prev) <= 0.05) continue;

            this.cache[symbol] = { ltp };
            const result = this.detector.analyze(symbol, feedValue);
            if (result) {
              logger.info(`Emit tick ${symbol} | LTP=${ltp} | score=${result.score.toFixed(2)}`, "SmartFeed");
              this.emit("tick", { symbol, ...result, timestamp: new Date().toISOString() });
            }
          }
        } catch (e: any) {
          logger.error(`Decode error: ${e.message}`, "SmartFeed");
        }
      });

      this.ws.on("close", () => {
        logger.warn("Feed closed, reconnecting…", "SmartFeed");
        setTimeout(() => this.connect(), 5000);
      });
      this.ws.on("error", (err) => {
        const msg = (err as any)?.message ?? String(err);
        logger.error(`WS error: ${msg}`, "SmartFeed");
        if (String(msg).includes("403")) {
          logger.error("Token probably expired – stop auto-retry until refreshed", "SmartFeed");
        }
      });
    } catch (e: any) {
      logger.error(`Connect failed: ${e.message}`, "SmartFeed");
    }
  }
}



let smartFeed: SmartFeedManager | null = null;


export function getSmartFeed() {
  if (!smartFeed) { smartFeed = new SmartFeedManager(); smartFeed.connect(); }
  return smartFeed;
}
