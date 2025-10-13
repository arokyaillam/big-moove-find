import WS, { RawData } from "ws";
import EventEmitter from "events";
import { logger } from "@/lib/logger";
import { decodeMessageBinary } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import type { FeedResponseShape, FeedValue } from "./types";
import { loadProto } from "./decode";

async function getAuthorizedWssUrl(): Promise<string> {
  try {
    if (!process.env.UPSTOX_TOKEN) {
      throw new Error("UPSTOX_TOKEN environment variable is not set");
    }

    logger.system("Authorizing WebSocket connection", "SmartFeed");
    const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
      headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`Authorization failed: ${res.status} - ${errorText}`, "SmartFeed");
      throw new Error(`Authorize failed ${res.status}: ${errorText}`);
    }

    const j = await res.json();
    const url = j?.data?.authorized_redirect_uri;

    if (!url) {
      logger.error("No authorized_redirect_uri in response", "SmartFeed");
      throw new Error("No authorized_redirect_uri in response");
    }

    logger.system("WebSocket authorization successful", "SmartFeed");
    return url;
  } catch (error) {
    logger.error(`getAuthorizedWssUrl error: ${error}`, "SmartFeed");
    throw error;
  }
}

export class SmartFeedManager extends EventEmitter {
  ws: WS | null = null;
  detector = new BigMoveDetector();
  cache: Record<string, { ltp: number }> = {};
  private stats = { connectedAt: 0, lastPacketAt: 0, bytesSeen: 0, messages: 0 };
  private connectionPromise: Promise<void> | null = null;
  public isConnecting = false;

  getStatus() {
    return {
      wsState: this.ws?.readyState ?? -1,
      isConnecting: this.isConnecting,
      ...this.stats,
      subs: (global as any).__activeSubs ? Array.from((global as any).__activeSubs) : []
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === 1;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      logger.warn("Connection already in progress", "SmartFeed");
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;

    // Load protobuf schema first
    try {
      await loadProto();
      logger.system("Protobuf schema loaded successfully", "SmartFeed");
    } catch (error) {
      logger.error(`Failed to load protobuf schema: ${error}`, "SmartFeed");
      this.isConnecting = false;
      throw new Error(`Protobuf loading failed: ${error}`);
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        logger.error("Connection timeout after 10 seconds", "SmartFeed");
        this.isConnecting = false;
        this.cleanup();
        reject(new Error("Connection timeout"));
      }, 10000);

      getAuthorizedWssUrl()
        .then(wssUrl => {
          logger.system("Got authorized WSS url", "SmartFeed");
          this.ws = new WS(wssUrl, { headers: { Origin: "https://api.upstox.com" } });
          this.ws.binaryType = "arraybuffer";

          this.ws.on("open", () => {
            clearTimeout(connectTimeout);
            this.stats.connectedAt = Date.now();
            this.isConnecting = false;
            logger.system("Connected to Upstox (v3)", "SmartFeed");
            this.emit("ready");
            resolve();
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

              if (process.env.FEED_DECODE === "off") {
                logger.system(`[FeedDecode] Decode disabled, skipping message processing`, "SmartFeed");
                return;
              }

              let decoded: FeedResponseShape;
              try {
                decoded = await decodeMessageBinary(bytes);
                logger.system(`[FeedDecode] Keys: ${Object.keys(decoded ?? {}).join(", ")}`, "SmartFeed");
              } catch (decodeError) {
                logger.error(`Decode error: ${decodeError}`, "SmartFeed");
                return; // Skip this message if decode fails
              }

              // Handle different message types from Upstox v3 API
              if (decoded.type === "marketInfo") {
                logger.system(`[FeedDecode] Market info received: ${JSON.stringify(decoded)}`, "SmartFeed");
              }

              const feeds = decoded.feeds as Record<string, FeedValue> | undefined;
              
              // Directly emit the decoded JSON data to the stream
              if (decoded) {
                logger.system(`[FeedEmit] Emitting raw JSON data: ${JSON.stringify(decoded).substring(0, 200)}...`, "SmartFeed");
                this.emit("tick", decoded);
              }

              // Extract LTP for cache if feeds exist
              if (feeds) {
                for (const [symbol, feedValue] of Object.entries(feeds)) {
                  const ltp = Number(
                    feedValue?.fullFeed?.marketFF?.ltpc?.ltp ??
                    feedValue?.ltpc?.ltp ??
                    feedValue?.firstLevelWithGreeks?.ltpc?.ltp ??
                    0
                  );
                  this.cache[symbol] = { ltp };
                }
              }
            } catch (e: any) {
              logger.error(`Decode error: ${e.message}`, "SmartFeed");
            }
          });

          this.ws.on("close", () => {
            logger.warn("Feed closed, reconnecting…", "SmartFeed");
            this.isConnecting = false;
            this.cleanup();
            setTimeout(() => this.connect(), 5000);
          });

          this.ws.on("error", (err) => {
            clearTimeout(connectTimeout);
            const msg = (err as any)?.message ?? String(err);
            logger.error(`WS error: ${msg}`, "SmartFeed");
            this.isConnecting = false;
            this.cleanup();
            if (String(msg).includes("403")) {
              logger.error("Token probably expired – stop auto-retry until refreshed", "SmartFeed");
            } else {
              setTimeout(() => this.connect(), 5000);
            }
            reject(new Error(`WebSocket error: ${msg}`));
          });
        })
        .catch(error => {
          clearTimeout(connectTimeout);
          logger.error(`Failed to get WSS URL: ${error}`, "SmartFeed");
          this.isConnecting = false;
          this.cleanup();
          reject(new Error(`Failed to authorize WebSocket connection: ${error}`));
        });
    });

    try {
      await this.connectionPromise;
    } catch (e: any) {
      logger.error(`Connect failed: ${e.message}`, "SmartFeed");
      throw e;
    }
  }

  private cleanup() {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === this.ws.OPEN || this.ws.readyState === this.ws.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  public destroy() {
    this.cleanup();
    this.removeAllListeners();
  }
}



let smartFeed: SmartFeedManager | null = null;
let initializationPromise: Promise<SmartFeedManager> | null = null;

/**
 * Get the singleton SmartFeedManager instance
 * Ensures only one WebSocket connection is maintained
 */
export async function getSmartFeed(): Promise<SmartFeedManager> {
  try {
    // If we already have an instance, return it
    if (smartFeed) {
      // If it's connected, return immediately
      if (smartFeed.isConnected()) {
        logger.system("Returning existing connected feed", "SmartFeed");
        return smartFeed;
      }

      // If it's connecting, wait for it
      if (smartFeed.isConnecting && initializationPromise) {
        logger.system("Waiting for existing connection", "SmartFeed");
        return await initializationPromise;
      }

      // If it's not connected and not connecting, try to reconnect
      if (!smartFeed.isConnecting) {
        logger.system("Attempting to reconnect existing feed", "SmartFeed");
        try {
          await smartFeed.connect();
          return smartFeed;
        } catch (error) {
          logger.error(`Failed to reconnect smart feed: ${error}`, "SmartFeed");
          throw error;
        }
      }
    }

    // Create new instance if none exists
    if (!initializationPromise) {
      logger.system("Creating new feed instance", "SmartFeed");
      initializationPromise = (async () => {
        try {
          const newFeed = new SmartFeedManager();
          await newFeed.connect();
          smartFeed = newFeed;
          return smartFeed;
        } catch (error) {
          logger.error(`Failed to initialize smart feed: ${error}`, "SmartFeed");
          initializationPromise = null;
          throw new Error(`Smart feed initialization failed: ${error}`);
        }
      })();
    }

    logger.system("Waiting for feed initialization", "SmartFeed");
    return await initializationPromise;
  } catch (error) {
    logger.error(`getSmartFeed error: ${error}`, "SmartFeed");
    throw error;
  }
}

/**
 * Reset the singleton instance (useful for testing or forced reconnection)
 */
export function resetSmartFeed(): void {
  if (smartFeed) {
    smartFeed.destroy();
    smartFeed = null;
  }
  initializationPromise = null;
}