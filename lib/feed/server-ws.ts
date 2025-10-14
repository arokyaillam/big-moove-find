// ✅ lib/feed/server-ws.ts
import WS, { RawData } from "ws";
import EventEmitter from "events";
import { logger } from "@/lib/logger";
import { decodeMessageBinary, loadProto } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import type { FeedResponseShape, FeedValue } from "./types";

// =============================
// 🔹 Authorize WebSocket URL
// =============================
async function getAuthorizedWssUrl(): Promise<string> {
  if (!process.env.UPSTOX_TOKEN) {
    throw new Error("UPSTOX_TOKEN environment variable is not set");
  }

  logger.system("Authorizing with Upstox Feed API", "SmartFeed");
  const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
    headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Authorize failed ${res.status}: ${errorText}`);
  }

  const j = await res.json();
  const url = j?.data?.authorized_redirect_uri;
  if (!url) throw new Error("No authorized_redirect_uri in response");

  logger.system("Authorized feed URL retrieved", "SmartFeed");
  return url;
}

// =============================
// 🔹 SmartFeedManager Class
// =============================
export class SmartFeedManager extends EventEmitter {
  ws: WS | null = null;
  detector = new BigMoveDetector();
  cache: Record<string, { ltp: number }> = {};
  private stats = { connectedAt: 0, lastPacketAt: 0, bytesSeen: 0, messages: 0 };
  public isConnecting = false;

  getStatus() {
    return {
      wsState: this.ws?.readyState ?? -1,
      ...this.stats,
      subs: (global as any).__activeSubs ? Array.from((global as any).__activeSubs) : [],
    };
  }

  isConnected() {
    return this.ws?.readyState === WS.OPEN;
  }

  // =============================
  // 🔹 Connect to Upstox Feed
  // =============================
  async connect() {
    if (this.isConnecting || this.isConnected()) return;
    this.isConnecting = true;

    await loadProto();

    const url = await getAuthorizedWssUrl();
    this.ws = new WS(url, { headers: { Origin: "https://api.upstox.com" } });
    this.ws.binaryType = "arraybuffer";

    this.ws.on("open", () => {
      this.stats.connectedAt = Date.now();
      this.isConnecting = false;
      logger.system("✅ Connected to Upstox Feed (v3)", "SmartFeed");
      this.emit("ready");
    });

    this.ws.on("message", async (msg: RawData) => {
      try {
        const bytes = msg instanceof Buffer ? new Uint8Array(msg) : new Uint8Array(msg as ArrayBuffer);
        const decoded: FeedResponseShape = await decodeMessageBinary(bytes);
        this.handleDecoded(decoded);
      } catch (e: any) {
        logger.error(`Decode error: ${e.message}`, "SmartFeed");
      }
    });

    this.ws.on("close", () => {
      logger.warn("Feed closed, attempting reconnect…", "SmartFeed");
      this.reconnect();
    });

    this.ws.on("error", (err) => {
      logger.error(`WebSocket error: ${String(err)}`, "SmartFeed");
      this.reconnect();
    });
  }

  private async reconnect() {
    this.isConnecting = false;
    setTimeout(() => this.connect(), 5000);
  }

  // =============================
  // 🔹 Decode Handler
  // =============================
  private handleDecoded(decoded: FeedResponseShape) {
    const feeds = decoded.feeds ?? {};
    for (const [symbol, feedValue] of Object.entries(feeds)) {
      const ltp =
        feedValue?.fullFeed?.marketFF?.ltpc?.ltp ??
        feedValue?.ltpc?.ltp ??
        feedValue?.firstLevelWithGreeks?.ltpc?.ltp ??
        0;

      this.cache[symbol] = { ltp: Number(ltp) };

      const result = this.detector.analyze(symbol, feedValue);
      if (result) {
        this.emit("tick", {
          symbol,
          ...result,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // =============================
  // 🔹 Emit Initial Data (for new stream clients)
  // =============================
  emitInitialData(writer: WritableStreamDefaultWriter) {
    for (const [symbol, data] of Object.entries(this.cache)) {
      const payload = { symbol, ltp: data.ltp, timestamp: new Date().toISOString() };
      writer.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
}

// =============================
// 🔹 Singleton Pattern
// =============================
if (!(global as any).__smartFeedSingleton) {
  (global as any).__smartFeedSingleton = new SmartFeedManager();
  (global as any).__smartFeedSingleton.connect().catch((err: Error) => {
    console.error("Feed connect error:", err);
  });
}

export function getSmartFeed() {
  return (global as any).__smartFeedSingleton as SmartFeedManager;
}
