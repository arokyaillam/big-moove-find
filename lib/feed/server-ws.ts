// lib/feed/server-ws.ts
import WS, { RawData } from "ws";
import EventEmitter from "events";
import { logger } from "@/lib/logger";
import { decodeMessageBinary, loadProto } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import type { FeedResponseShape } from "./types";

async function getAuthorizedWssUrl(): Promise<string> {
  if (!process.env.UPSTOX_TOKEN) throw new Error("UPSTOX_TOKEN not set");
  const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", { // Removed trailing spaces
    headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const j = await res.json();
  const url = j?.data?.authorized_redirect_uri;
  if (!url) throw new Error("No authorized URL");
  return url;
}

export class SmartFeedManager extends EventEmitter {
  ws: WS | null = null;
  detector = new BigMoveDetector();
  cache: Record<string, { ltp: number }> = {};
  private stats = { connectedAt: 0, messages: 0 };
  public isConnecting = false;

  isConnected() {
    return this.ws?.readyState === WS.OPEN;
  }

  async connect() {
    if (this.isConnecting || this.isConnected()) return;
    this.isConnecting = true;
    await loadProto();
    logger.system("Protobuf loaded", "SmartFeed");

    const url = await getAuthorizedWssUrl();
    // Removed trailing spaces from Origin header
    this.ws = new WS(url, { headers: { Origin: "https://api.upstox.com" } });
    this.ws.binaryType = "arraybuffer";

    this.ws.on("open", () => {
      this.stats.connectedAt = Date.now();
      this.isConnecting = false;
      logger.system("✅ Connected to Upstox", "SmartFeed");
      this.emit("ready");
    });

    this.ws.on("message", async (msg: RawData) => {
      try {
        let bytes: Uint8Array;
        if (msg instanceof Buffer) bytes = new Uint8Array(msg);
        else if (msg instanceof ArrayBuffer) bytes = new Uint8Array(msg);
        else if (Array.isArray(msg)) {
          const total = msg.reduce((n, b) => n + b.byteLength, 0);
          bytes = new Uint8Array(total);
          let offset = 0;
          for (const b of msg) {
            const v = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer);
            bytes.set(v, offset);
            offset += v.byteLength;
          }
        } else return;

        this.stats.messages++;
        const decoded: FeedResponseShape = await decodeMessageBinary(bytes);
        logger.system(`[Decoded] Type: ${decoded.type}, Feeds: ${Object.keys(decoded.feeds || {}).length}`, "SmartFeed");

        // Slim tick – only fields that exist in your proto
        for (const [symbol, feedValue] of Object.entries(decoded.feeds || {})) {
          const ltp = Number(
            feedValue?.fullFeed?.marketFF?.ltpc?.ltp ??
            feedValue?.ltpc?.ltp ??
            feedValue?.firstLevelWithGreeks?.ltpc?.ltp ??
            0
          );
          this.cache[symbol] = { ltp };

          const volume = Number(feedValue?.fullFeed?.marketFF?.vtt ?? 0);
          const bid = Number(feedValue?.fullFeed?.marketFF?.marketLevel?.bidAskQuote?.[0]?.bidP ?? 0);
          const ask = Number(feedValue?.fullFeed?.marketFF?.marketLevel?.bidAskQuote?.[0]?.askP ?? 0);

          this.emit("tick", {
            type: "tick",
            symbol,
            ltp,
            volume,
            bid,
            ask,
            timestamp: new Date().toISOString(),
          });
        }

        // Big-move alert (slim)
        for (const [symbol, feedValue] of Object.entries(decoded.feeds || {})) {
          if (feedValue?.fullFeed?.marketFF) {
            const result = this.detector.analyze(symbol, feedValue as Record<string, unknown>);
            if (result && result.score >= 35) {
              logger.info(`Big move: ${symbol} score=${result.score}`, "SmartFeed");
              this.emit("tick", {
                type: "big_move_alert",
                symbol,
                ...result,
                ltp: this.cache[symbol]?.ltp ?? 0,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.error(`Message error: ${errorMessage}`, "SmartFeed");
      }
    });

    this.ws.on("close", () => {
      logger.warn("Feed closed, reconnecting...", "SmartFeed");
      this.isConnecting = false;
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on("error", (err) => {
      logger.error(`WS error: ${err}`, "SmartFeed");
      this.isConnecting = false;
    });
  }

  // ADDED: Method to emit initial data to an SSE stream writer
  async emitInitialData(writer: WritableStreamDefaultWriter) {
    const encoder = new TextEncoder();
    // Respect backpressure for each symbol if possible
    for (const [symbol, data] of Object.entries(this.cache)) {
      const payload = {
        type: "cached_data",
        symbol,
        alertLevel: "NORMAL" as const,
        score: 0,
        metrics: { ltp: data.ltp, volumeRatio: 0, priceRange: 0, obRatio: 0 },
        timestamp: new Date().toISOString(),
      };
      await writer.ready; // Wait if the writer is not ready (backpressure)
      await writer.write(encoder.encode(` ${JSON.stringify(payload)}\n\n`));
    }
    // Send a final comment to signal end of initial data batch (optional)
    await writer.ready;
    await writer.write(encoder.encode(":\n\n"));
  }


  getStatus() {
    return {
      wsState: this.ws?.readyState ?? -1,
      isConnecting: this.isConnecting,
      ...this.stats,
      subs: (global as Record<string, unknown>).__activeSubs ? Array.from((global as Record<string, unknown>).__activeSubs as Set<string>) : [],
    };
  }
}

// Singleton with crash-on-startup so docker/pm2 restarts
if (!(global as Record<string, unknown>).__smartFeedSingleton) {
  (global as Record<string, unknown>).__smartFeedSingleton = new SmartFeedManager();
  ((global as Record<string, unknown>).__smartFeedSingleton as SmartFeedManager).connect().catch((err: Error) => {
    logger.error(`Initial connect failed: ${err}`, "SmartFeed");
    process.exit(1); // Crash if initial connect fails
  });
}

export function getSmartFeed(): SmartFeedManager {
  return (global as Record<string, unknown>).__smartFeedSingleton as SmartFeedManager;
}