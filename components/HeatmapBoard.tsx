"use client";
import { useFeedStore } from "@/lib/stores/useFeedStore";

export function HeatmapBoard() {
  const alerts = useFeedStore((s) => s.alerts);

  // latest alert per symbol
  const latest = Object.values(
    alerts.reduce((acc: any, a) => {
      acc[a.symbol] = a;
      return acc;
    }, {})
  );

  const levelColor: Record<string, string> = {
    CRITICAL: "bg-red-600/80",
    WARNING: "bg-yellow-500/70",
    WATCH: "bg-blue-500/60",
    NORMAL: "bg-gray-500/50",
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {latest.map((a: any) => (
        <div
          key={a.symbol}
          className={`p-2 rounded text-xs text-center text-white ${levelColor[a.alertLevel]}`}
          title={`Score: ${a.score.toFixed(2)}  LTP: ${a.metrics.ltp}`}
        >
          {a.symbol.split("|")[1]}
        </div>
      ))}
    </div>
  );
}
