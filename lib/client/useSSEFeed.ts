"use client";
import { useEffect } from "react";
import { useFeedStore } from "@/lib/stores/useFeedStore";
import { logger } from "@/lib/logger";

export function useSSEFeed() {
  const addAlert = useFeedStore((s) => s.addAlert);
  const setStatus = useFeedStore((s) => s.setStatus);

  useEffect(() => {
    const es = new EventSource("/api/test-feed");
    logger.system("Connecting SSE...", "FeedClient");
    es.onopen = () => setStatus("connected");
    es.onerror = () => setStatus("disconnected");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        addAlert(data);
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
