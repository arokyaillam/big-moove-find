"use client";
import { useFeedStore } from "@/lib/stores/useFeedStore";
import { useSSEFeed } from "@/lib/client/useSSEFeed";
import { AlertCard } from "@/components/AlertCard";
import { HeatmapGrid } from "@/components/HeatmapGrid";
import { SummaryBoard } from "@/components/SummaryBoard"; // your existing

export default function DashboardPage() {
  useSSEFeed();
  const alerts = useFeedStore((s) => s.alerts);
  const status = useFeedStore((s) => s.status);
  const clear = useFeedStore((s) => s.clear);

  return (
    <main className="min-h-screen bg-gray-900 p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">⚡ Big Move Dashboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-3 py-2 rounded-lg font-semibold text-white ${
              status === "connected"
                ? "bg-green-600/80"
                : status === "connecting"
                ? "bg-yellow-500/80"
                : "bg-red-600/80"
            }`}
          >
            {status}
          </span>
          <button
            onClick={clear}
            className="text-xs bg-gray-800/80 text-white px-3 py-2 rounded-lg hover:bg-gray-700/80 transition-colors font-semibold"
          >
            Clear
          </button>
        </div>
      </header>

      <SummaryBoard />

      <section>
        <h2 className="text-lg font-semibold mb-4 text-white">Heatmap (Top movers)</h2>
        <HeatmapGrid />
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Live Alerts</h2>
          <div className="flex items-center gap-2">
            <div className="text-xs text-white/60 bg-black/20 px-2 py-1 rounded">
              {alerts.length} alerts • {new Set(alerts.map(a => a.symbol)).size} symbols
            </div>
            <div className="flex items-center gap-1 text-xs text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>LIVE</span>
            </div>
          </div>
        </div>
        {alerts.length === 0 && (
          <div className="opacity-70 text-sm text-white/80 text-center py-8">
            No alerts yet…
          </div>
        )}
        {alerts.map((a) => (
          <AlertCard key={a.symbol} {...a} />
        ))}
      </section>
    </main>
  );
}
