"use client";
import { motion } from "framer-motion";

export interface AlertCardProps {
  symbol: string;
  alertLevel: string;
  score: number;
  metrics: { ltp: number; volumeRatio: number; priceRange: number; obRatio: number };
  timestamp: string;
}

export function AlertCard({ symbol, alertLevel, score, metrics, timestamp }: AlertCardProps) {
  const colors: Record<string, string> = {
    CRITICAL: "border-red-500 bg-red-100/10",
    WARNING: "border-yellow-400 bg-yellow-100/10",
    WATCH: "border-blue-400 bg-blue-100/10",
    NORMAL: "border-gray-600",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-xl border-l-4 ${colors[alertLevel]}`}
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-semibold text-lg">{symbol}</h3>
        <span className="text-sm opacity-70">{new Date(timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="text-xs uppercase opacity-70 mb-2">{alertLevel} • Score {score.toFixed(2)}</div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>LTP {metrics.ltp.toFixed(2)}</div>
        <div>Vol ×{metrics.volumeRatio.toFixed(2)}</div>
        <div>Range {metrics.priceRange.toFixed(2)}%</div>
        <div>OB {metrics.obRatio.toFixed(2)}</div>
      </div>
    </motion.div>
  );
}
