// lib/feed/server-ws.ts - Production Optimized

import WS, { RawData } from "ws";
import EventEmitter from "events";
import { logger } from "@/lib/logger";
import { decodeMessageBinary, loadProto } from "./decode";
import { BigMoveDetector } from "@/lib/analytics/BigMoveDetector";
import type { FeedResponseShape, FeedValue } from "./types";

async function getAuthorizedWssUrl(): Promise<string> {
  if (!process.env.UPSTOX_TOKEN) {
    throw new Error("UPSTOX_TOKEN environment variable is not set");
  }

  const res = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", {
    headers: { Authorization: `Bearer ${process.env.UPSTOX_TOKEN}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Authorize failed ${res.status}: ${errorText}`);
  }

  const j = await res.json();
  const url = j?.data?.authorized_redirect_uri;

  if (!url) throw new Error("No authorized_redirect_uri in response");
  return url;
}

export class SmartFeedManager extends EventEmitter {
  ws: WS | null = null;
  detector = new BigMoveDetector();
  cache: Record<string, { ltp: number; lastUpdate: number }> = {};
  private stats = { connectedAt: 0, lastPacketAt: 0, messages: 0 };
  private connectionPromise: Promise<void> | null = null;
  public isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageBuffer: any[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  getStatus() {
    return {
      wsState: this.ws?.readyState ?? -1,
      isConnecting: this.isConnecting,
      cacheSize: Object.keys(this.cache).length,
      ...this.stats,
      subs: (global as any).__activeSubs ? Array.from((global as any).__activeSubs) : []
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WS.OPEN;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;

    // Load protobuf schema
    try {
      await loadProto();
      logger.system("Protobuf loaded", "SmartFeed");
    } catch (error) {
      this.isConnecting = false;
      throw new Error(`Protobuf failed: ${error}`);
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        this.isConnecting = false;
        this.cleanup();
        reject(new Error("Connection timeout"));
      }, 15000);

      getAuthorizedWssUrl()
        .then(wssUrl => {
          this.ws = new WS(wssUrl, {
            headers: { Origin: "https://api.upstox.com" },
            handshakeTimeout: 10000
          });
          this.ws.binaryType = "arraybuffer";

          this.ws.on("open", () => {
            clearTimeout(connectTimeout);
            this.stats.connectedAt = Date.now();
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            logger.system("✅ Connected to Upstox", "SmartFeed");
            this.emit("ready");
            resolve();
          });

          this.ws.on("message", async (msg: RawData) => {
            try {
              const bytes = this.convertToUint8Array(msg);
              if (!bytes) return;

              this.stats.messages++;
              this.stats.lastPacketAt = Date.now();

              // Decode message
              const decoded = await decodeMessageBinary(bytes);
              
              // Process and emit
              this.processMessage(decoded);

            } catch (e: any) {
              logger.error(`Message error: ${e.message}`, "SmartFeed");
            }
          });

          this.ws.on("close", () => {
            logger.warn("Feed closed", "SmartFeed");
            this.handleReconnect();
          });

          this.ws.on("error", (err) => {
            clearTimeout(connectTimeout);
            logger.error(`WS error: ${err}`, "SmartFeed");
            this.isConnecting = false;
            this.cleanup();
            
            if (String(err).includes("403")) {
              reject(new Error("Token expired"));
            } else {
              this.handleReconnect();
              reject(err);
            }
          });
        })
        .catch(error => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.cleanup();
          reject(error);
        });
    });

    try {
      await this.connectionPromise;
    } catch (e: any) {
      logger.error(`Connect failed: ${e.message}`, "SmartFeed");
      throw e;
    }
  }

  private convertToUint8Array(msg: RawData): Uint8Array | null {
    if (msg instanceof Buffer) {
      return new Uint8Array(msg);
    } else if (msg instanceof ArrayBuffer) {
      return new Uint8Array(msg);
    } else if (Array.isArray(msg)) {
      const total = msg.reduce((n, b) => n + b.byteLength, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const b of msg) {
        const v = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
        out.set(v, offset);
        offset += v.byteLength;
      }
      return out;
    }
    return null;
  }

  private processMessage(decoded: FeedResponseShape) {
    const feeds = decoded.feeds as Record<string, FeedValue> | undefined;
    
    if (!feeds || Object.keys(feeds).length === 0) {
      return;
    }

    const now = Date.now();
    const processedData: any = {
      type: decoded.type || "live_feed",
      feeds: {},
      currentTs: new Date().toISOString()
    };

    for (const [symbol, feedValue] of Object.entries(feeds)) {
      // Extract LTP
      const ltp = Number(
        feedValue?.fullFeed?.marketFF?.ltpc?.ltp ??
        feedValue?.ltpc?.ltp ??
        feedValue?.firstLevelWithGreeks?.ltpc?.ltp ??
        0
      );

      // Update cache with throttling
      const cached = this.cache[symbol];
      if (!cached || now - cached.lastUpdate > 1000) { // 1 second throttle
        this.cache[symbol] = { ltp, lastUpdate: now };

        // Add to processed data
        processedData.feeds[symbol] = feedValue;

        // Run big move detection
        if (feedValue?.fullFeed?.marketFF) {
          const result = this.detector.analyze(symbol, feedValue);
          if (result && result.score >= 35) {
            this.emit("tick", {
              symbol,
              ...result,
              ltp,
              timestamp: new Date().toISOString(),
              type: "big_move_alert",
              feedValue
            });
          }
        }
      }
    }

    // Emit processed data if not empty
    if (Object.keys(processedData.feeds).length > 0) {
      this.emitWithBuffer(processedData);
    }
  }

  private emitWithBuffer(data: any) {
    // Add to buffer
    this.messageBuffer.push(data);
    
    // Keep buffer size limited
    if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
      this.messageBuffer.shift();
    }

    // Emit
    this.emit("tick", data);
  }

  private handleReconnect() {
    this.isConnecting = false;
    this.cleanup();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnect attempts reached", "SmartFeed");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.system(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`, "SmartFeed");
    setTimeout(() => this.connect().catch(e => logger.error(`Reconnect failed: ${e}`, "SmartFeed")), delay);
  }

  private cleanup() {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WS.OPEN || this.ws.readyState === WS.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  public destroy() {
    this.cleanup();
    this.removeAllListeners();
    this.messageBuffer = [];
    this.cache = {};
  }

  /**
   * Emit initial/cached data for a symbol immediately
   * @param symbol - The symbol to emit data for
   */
  emitInitialData(symbol: string): void {
    const cached = this.cache[symbol];
    if (cached && cached.ltp > 0) {
      const initialData = {
        type: "initial_data",
        symbol: symbol,
        alertLevel: "NORMAL" as const,
        score: 0,
        metrics: {
          ltp: cached.ltp,
          volumeRatio: 0,
          priceRange: 0,
          obRatio: 0
        },
        timestamp: new Date().toISOString(),
        message: `Initial data for ${symbol}: LTP ${cached.ltp}`,
        ltp: cached.ltp
      };
      
      this.emit("tick", initialData);
      logger.system(`📡 Emitted initial data for ${symbol}: LTP ${cached.ltp}`, "SmartFeed");
    } else {
      // Emit a "waiting for data" message if no cached data
      const waitingData = {
        type: "waiting_for_data",
        symbol: symbol,
        alertLevel: "NORMAL" as const,
        score: 0,
        metrics: {
          ltp: 0,
          volumeRatio: 0,
          priceRange: 0,
          obRatio: 0
        },
        timestamp: new Date().toISOString(),
        message: `Subscribed to ${symbol} - waiting for live data...`
      };
      
      this.emit("tick", waitingData);
      logger.system(`📡 Emitted waiting-for-data message for ${symbol}`, "SmartFeed");
    }
  }
  
}

// Singleton management
let smartFeed: SmartFeedManager | null = null;
let initPromise: Promise<SmartFeedManager> | null = null;

export async function getSmartFeed(): Promise<SmartFeedManager> {
  if (smartFeed?.isConnected()) {
    return smartFeed;
  }

  if (smartFeed?.isConnecting && initPromise) {
    return await initPromise;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const feed = new SmartFeedManager();
      await feed.connect();
      smartFeed = feed;
      return feed;
    })().catch(error => {
      initPromise = null;
      throw error;
    });
  }

  return await initPromise;
}

export function resetSmartFeed(): void {
  if (smartFeed) {
    smartFeed.destroy();
    smartFeed = null;
  }
  initPromise = null;
}