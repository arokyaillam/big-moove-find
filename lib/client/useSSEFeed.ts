"use client";
import { useEffect } from "react";
import { useAddAlert, useSetStatus } from "@/lib/stores/useFeedStore";
import { logger } from "@/lib/logger";

export function useSSEFeed() {
  const addAlert = useAddAlert();
  const setStatus = useSetStatus();

  useEffect(() => {
    const es = new EventSource("/api/stream");
    logger.system("Connecting SSE...", "FeedClient");
    es.onopen = () => setStatus("connected");
    es.onerror = () => setStatus("disconnected");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log("[SSE-RECEIVED]", data.type, data.symbol || "no-symbol", data.score || "no-score");

        // Handle connection confirmations
        if (data.type === "connected") {
          logger.system(`SSE connected: ${data.id}`, "FeedClient");
          setStatus("connected");
          return;
        }

        // Handle complete feed data (for comprehensive market data output)
        if (data.type === "live_feed" && data.feeds) {
          logger.system(`Complete feed data received: ${Object.keys(data.feeds).length} instruments`, "FeedClient");

          // Process each instrument in the feed
          for (const [symbol, feedValue] of Object.entries(data.feeds)) {
            if (feedValue && typeof feedValue === 'object') {
              const fv = feedValue as Record<string, unknown>; // Type assertion for dynamic access

              // Extract LTP for display
              const ltp = Number((((fv?.fullFeed as Record<string, unknown>)?.marketFF as Record<string, unknown>)?.ltpc as Record<string, unknown>)?.ltp) || 0;

              // Create alert object from complete feed data
              const alertData = {
                symbol,
                alertLevel: "NORMAL" as const,
                score: 0,
                metrics: {
                  ltp: ltp,
                  volumeRatio: Number((((fv?.fullFeed as Record<string, unknown>)?.marketFF as Record<string, unknown>)?.vtt)) || 0,
                  priceRange: 0,
                  obRatio: (((fv?.fullFeed as Record<string, unknown>)?.marketFF as Record<string, unknown>)?.tbq) && (((fv?.fullFeed as Record<string, unknown>)?.marketFF as Record<string, unknown>)?.tsq)
                    ? Number((((fv.fullFeed as Record<string, unknown>).marketFF as Record<string, unknown>).tbq)) / Number((((fv.fullFeed as Record<string, unknown>).marketFF as Record<string, unknown>).tsq))
                    : 0
                },
                timestamp: data.currentTs || new Date().toISOString(),
                type: "live_feed",
                feedValue: fv,
                fullFeed: fv?.fullFeed as Record<string, unknown>,
                ltpc: fv?.ltpc as Record<string, unknown>,
                firstLevelWithGreeks: fv?.firstLevelWithGreeks as Record<string, unknown>
              };
              addAlert(alertData);
            }
          }
          return;
        }

        // Handle individual tick/alert data
        if (data.symbol && data.timestamp) {
          // Ensure required fields exist
          const alertData = {
            symbol: data.symbol,
            alertLevel: data.alertLevel || "NORMAL",
            score: data.score || 0,
            metrics: data.metrics || {
              ltp: data.ltp || 0,
              volumeRatio: 0,
              priceRange: 0,
              obRatio: 0
            },
            timestamp: data.timestamp,
            type: data.type || "market_update",
            feedValue: data.feedValue,
            fullFeed: data.fullFeed,
            ltpc: data.ltpc,
            firstLevelWithGreeks: data.firstLevelWithGreeks
          };
          addAlert(alertData);
        } else {
          logger.warn(`Invalid tick data received: ${JSON.stringify(data)}`, "FeedClient");
        }
      } catch (err) {
        logger.error(`SSE parse error: ${(err as Error).message}`, "FeedClient");
      }
    };

    return () => {
      es.close();
      setStatus("disconnected");
    };
  }, [addAlert, setStatus]);
}
