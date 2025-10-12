"use client";
import { useMemo, memo } from "react";
import { useFeedStore } from "@/lib/stores/useFeedStore";

export const SummaryBoard = memo(function SummaryBoard() {
  const alerts = useFeedStore((s) => s.alerts);

  const { critical, warning, watch } = useMemo(() => {
    const counts = {
      critical: alerts.filter(a => a.alertLevel === "CRITICAL").length,
      warning: alerts.filter(a => a.alertLevel === "WARNING").length,
      watch: alerts.filter(a => a.alertLevel === "WATCH").length,
    };
    console.log("SummaryBoard counts:", counts, "total alerts:", alerts.length);
    return counts;
  }, [alerts]);

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-4 rounded-lg bg-red-500/20 border-2 border-red-500/60 hover:bg-red-500/30 transition-colors">
        <div className="text-2xl mb-1">🔴</div>
        <div className="text-sm opacity-90">Critical</div>
        <div className="text-xl font-bold text-red-100">{critical}</div>
      </div>
      <div className="p-4 rounded-lg bg-yellow-500/20 border-2 border-yellow-500/60 hover:bg-yellow-500/30 transition-colors">
        <div className="text-2xl mb-1">🟡</div>
        <div className="text-sm opacity-90">Warning</div>
        <div className="text-xl font-bold text-yellow-100">{warning}</div>
      </div>
      <div className="p-4 rounded-lg bg-blue-500/20 border-2 border-blue-500/60 hover:bg-blue-500/30 transition-colors">
        <div className="text-2xl mb-1">🔵</div>
        <div className="text-sm opacity-90">Watch</div>
        <div className="text-xl font-bold text-blue-100">{watch}</div>
      </div>
    </div>
  );
});
