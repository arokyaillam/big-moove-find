"use client";

type SparkProps = {
  points: Array<{ t: number; score: number }>;
  width?: number;
  height?: number;
};

export function Sparkline({ points, width = 120, height = 36 }: SparkProps) {
  if (!points || points.length < 2) {
    return <svg width={width} height={height} />;
  }

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.score);

  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 2;

  const scaleX = (i: number) =>
    pad + ((width - pad * 2) * (xs.length - 1 - i)) / (xs.length - 1);
  const scaleY = (y: number) =>
    height - pad - ((height - pad * 2) * (y - minY)) / Math.max(1e-6, maxY - minY);

  const d = xs
    .map((i, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(ys[i])}`)
    .join(" ");

  const last = points[0];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* last point */}
      <circle cx={scaleX(0)} cy={scaleY(last.score)} r="2" />
    </svg>
  );
}
