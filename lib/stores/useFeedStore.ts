"use client";
import { create } from "zustand";

type Alert = {
  symbol: string;
  alertLevel: "NORMAL" | "WATCH" | "WARNING" | "CRITICAL";
  score: number;
  metrics: { ltp: number; volumeRatio: number; priceRange: number; obRatio: number; gamma?: number; delta?: number; iv?: number };
  timestamp: string;
  type?: string;
  feedValue?: any;
  fullFeed?: any;
  ltpc?: any;
  firstLevelWithGreeks?: any;
};

type FeedStore = {
  alerts: Alert[];
  status: "connecting" | "connected" | "disconnected";
  history: Record<string, Array<{ t: number; score: number }>>;
  addAlert: (a: Alert) => void;
  setStatus: (s: FeedStore["status"]) => void;
  clear: () => void;
};

const MAX_ALERTS = 200;
const MAX_POINTS_PER_SYMBOL = 60; // ~ latest 60 ticks per symbol

export const useFeedStore = create<FeedStore>((set, get) => ({
  alerts: [],
  status: "connecting",
  history: {},
  addAlert: (newAlert) =>
    set((state) => {
      // Check if alert for this symbol already exists
      const existingIndex = state.alerts.findIndex(alert => alert.symbol === newAlert.symbol);

      let alerts: Alert[];
      if (existingIndex >= 0) {
        // Update existing alert in place (for smoother animations)
        alerts = [...state.alerts];
        const oldAlert = alerts[existingIndex];
        alerts[existingIndex] = { ...newAlert, timestamp: new Date().toISOString() };
        console.log(`🔄 Updated ${newAlert.symbol}: Score ${oldAlert.score.toFixed(2)} → ${newAlert.score.toFixed(2)}`);
      } else {
        // Add new alert at the beginning (FIFO)
        alerts = [newAlert, ...state.alerts].slice(0, MAX_ALERTS);
        console.log(`🆕 Added new alert for ${newAlert.symbol} (Score: ${newAlert.score.toFixed(2)})`);
      }

      // history (per symbol) - always add new data point
      const t = Date.now();
      const prevSeries = state.history[newAlert.symbol] ?? [];
      const series = [{ t, score: newAlert.score }, ...prevSeries].slice(0, MAX_POINTS_PER_SYMBOL);

      return {
        alerts,
        history: { ...state.history, [newAlert.symbol]: series },
      };
    }),
  setStatus: (s) => set({ status: s }),
  clear: () => set({ alerts: [], history: {} }),
}));

// Memoized selectors to prevent unnecessary re-renders
export const useAddAlert = () => useFeedStore((s) => s.addAlert);
export const useSetStatus = () => useFeedStore((s) => s.setStatus);
export const useClearAlerts = () => useFeedStore((s) => s.clear);
