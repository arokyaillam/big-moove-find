"use client";
import { useMemo, memo } from "react";
import { useFeedStore } from "@/lib/stores/useFeedStore";
import { Sparkline } from "./Sparkline";

function colorForScore(score: number) {
  // 0..100 → blue .. red
  if (score >= 70) return "bg-red-600/60 border-2 border-red-500/80 hover:bg-red-600/70";
  if (score >= 50) return "bg-yellow-600/50 border-2 border-yellow-500/70 hover:bg-yellow-600/60";
  if (score >= 35) return "bg-blue-600/50 border-2 border-blue-500/70 hover:bg-blue-600/60";
  return "bg-gray-800/70 border-2 border-gray-600/80 hover:bg-gray-800/80";
}

export const HeatmapGrid = memo(function HeatmapGrid() {
  const alerts = useFeedStore((s) => s.alerts);
  const history = useFeedStore((s) => s.history);

  // latest score per symbol
  const latest = useMemo(() => {
    const map = new Map<string, { score: number; when: number }>();
    for (const a of alerts) {
      const ts = new Date(a.timestamp).getTime();
      const prev = map.get(a.symbol);
      if (!prev || ts > prev.when) {
        map.set(a.symbol, { score: a.score, when: ts });
      }
    }
    const result = Array.from(map.entries())
      .map(([symbol, v]) => ({ symbol, score: v.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30); // top 30 tiles

    console.log("HeatmapGrid latest symbols:", result.length, "total alerts:", alerts.length);
    return result;
  }, [alerts]);

  if (latest.length === 0) {
    return <div className="text-sm opacity-70">No symbols yet…</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {latest.map(({ symbol, score }) => {
        const series = history[symbol] ?? [];
        const right = symbol.split("|")[1] ?? symbol;
        return (
          <div
            key={symbol}
            className={`rounded-xl p-3 flex flex-col gap-2 transition-all duration-200 ${colorForScore(score)}`}
          >
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold truncate text-white">{right}</div>
              <div className="text-xs font-bold text-white/90 bg-black/20 px-2 py-1 rounded">
                {score.toFixed(1)}
              </div>
            </div>
            <div className="text-[10px] opacity-80 text-white/80">
              trend (last {series.length})
            </div>
            <div className="text-gray-100">
              <Sparkline points={series} />
            </div>
          </div>
        );
      })}
    </div>
  );
});
