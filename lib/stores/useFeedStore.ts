"use client";
import { create } from "zustand";

type Alert = {
  symbol: string;
  alertLevel: "NORMAL" | "WATCH" | "WARNING" | "CRITICAL";
  score: number;
  metrics: { ltp: number; volumeRatio: number; priceRange: number; obRatio: number };
  timestamp: string;
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
  addAlert: (a) =>
    set((state) => {
      // alerts (FIFO cap)
      const alerts = [a, ...state.alerts].slice(0, MAX_ALERTS);

      // history (per symbol)
      const t = Date.now();
      const prevSeries = state.history[a.symbol] ?? [];
      const series = [{ t, score: a.score }, ...prevSeries].slice(0, MAX_POINTS_PER_SYMBOL);

      return {
        alerts,
        history: { ...state.history, [a.symbol]: series },
      };
    }),
  setStatus: (s) => set({ status: s }),
  clear: () => set({ alerts: [], history: {} }),
}));

// Memoized selectors to prevent unnecessary re-renders
export const useAddAlert = () => useFeedStore((s) => s.addAlert);
export const useSetStatus = () => useFeedStore((s) => s.setStatus);
export const useClearAlerts = () => useFeedStore((s) => s.clear);
