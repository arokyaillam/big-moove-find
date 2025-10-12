"use client";
import { useFeedStore } from "@/lib/stores/useFeedStore";

export function SummaryBoard() {
  const alerts = useFeedStore((s) => s.alerts);

  const critical = alerts.filter(a => a.alertLevel === "CRITICAL").length;
  const warning = alerts.filter(a => a.alertLevel === "WARNING").length;
  const watch   = alerts.filter(a => a.alertLevel === "WATCH").length;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40">
        🔴 Critical<br/><span className="text-lg font-bold">{critical}</span>
      </div>
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40">
        🟡 Warning<br/><span className="text-lg font-bold">{warning}</span>
      </div>
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/40">
        🔵 Watch<br/><span className="text-lg font-bold">{watch}</span>
      </div>
    </div>
  );
}
