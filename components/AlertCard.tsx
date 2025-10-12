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
    CRITICAL: "border-red-500/80 bg-red-500/15 hover:bg-red-500/20",
    WARNING: "border-yellow-400/80 bg-yellow-500/15 hover:bg-yellow-500/20",
    WATCH: "border-blue-400/80 bg-blue-500/15 hover:bg-blue-500/20",
    NORMAL: "border-gray-600/80 bg-gray-500/10 hover:bg-gray-500/15",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`p-4 rounded-xl border-l-4 transition-colors ${colors[alertLevel]}`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg text-white">{symbol}</h3>
        <span className="text-sm opacity-70 text-white/80">{new Date(timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="text-xs uppercase opacity-80 text-white/90 mb-3 font-semibold">
        {alertLevel} • Score {score.toFixed(2)}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-white/80">
        <div className="bg-black/20 p-2 rounded">
          <div className="opacity-70">LTP</div>
          <div className="font-semibold">{metrics.ltp.toFixed(2)}</div>
        </div>
        <div className="bg-black/20 p-2 rounded">
          <div className="opacity-70">Vol</div>
          <div className="font-semibold">×{metrics.volumeRatio.toFixed(2)}</div>
        </div>
        <div className="bg-black/20 p-2 rounded">
          <div className="opacity-70">Range</div>
          <div className="font-semibold">{metrics.priceRange.toFixed(2)}%</div>
        </div>
        <div className="bg-black/20 p-2 rounded">
          <div className="opacity-70">OB</div>
          <div className="font-semibold">{metrics.obRatio.toFixed(2)}</div>
        </div>
      </div>
    </motion.div>
  );
}
