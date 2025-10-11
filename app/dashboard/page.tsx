"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setAlerts((prev) => [data, ...prev].slice(0, 30));
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-bold">⚡ Big Move Alerts</h1>
      <div className="grid gap-3">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={`p-4 border-l-4 rounded-md ${
              a.alertLevel === "CRITICAL" ? "border-red-500 bg-red-100/10"
              : a.alertLevel === "WARNING" ? "border-yellow-400 bg-yellow-100/10"
              : a.alertLevel === "WATCH" ? "border-blue-400 bg-blue-100/10"
              : "border-gray-700"
            }`}
          >
            <div className="flex justify-between">
              <div className="font-semibold">{a.symbol}</div>
              <div className="text-sm opacity-70">{Number(a.score).toFixed(2)}</div>
            </div>
            <div className="text-xs opacity-70">{a.alertLevel}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
