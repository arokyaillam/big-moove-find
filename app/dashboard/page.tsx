"use client";
import { useFeedStore } from "@/lib/stores/useFeedStore";
import { useSSEFeed } from "@/lib/client/useSSEFeed";
import { AlertCard } from "@/components/AlertCard";
import { HeatmapGrid } from "@/components/HeatmapGrid";
import { SummaryBoard } from "@/components/SummaryBoard"; // your existing

export default function DashboardPage() {
  useSSEFeed();
  const { alerts, status, clear } = useFeedStore();

  return (
    <main className="p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">⚡ Big Move Dashboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded ${
              status === "connected"
                ? "bg-green-600"
                : status === "connecting"
                ? "bg-yellow-500"
                : "bg-red-600"
            }`}
          >
            {status}
          </span>
          <button onClick={clear} className="text-xs bg-gray-800 px-2 py-1 rounded hover:bg-gray-700">
            Clear
          </button>
        </div>
      </header>

      <SummaryBoard />

      <section>
        <h2 className="text-sm font-semibold mb-2 opacity-80">Heatmap (Top movers)</h2>
        <HeatmapGrid />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold opacity-80">Live Alerts</h2>
        {alerts.length === 0 && <div className="opacity-70 text-sm">No alerts yet…</div>}
        {alerts.map((a, i) => (
          <AlertCard key={i} {...a} />
        ))}
      </section>
    </main>
  );
}
