import React from "react";

interface HistogramProps {
  props: {
    data: number[];
    bins?: number | null;
    width?: number | null;
    height?: number | null;
    label?: string | null;
    color?: string | null;
    showValues?: boolean | null;
  };
}

export function Histogram({ props }: HistogramProps) {
  const p = props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const binCount = p.bins ?? 15;
  const svgWidth = (p.width ?? 40) * 10;
  const svgHeight = (p.height ?? binCount) * 16 + 40;
  const color = p.color ?? "#22c55e";
  const showValues = p.showValues !== false;

  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const binWidth = range / binCount;

  const counts = new Array(binCount).fill(0);
  for (const v of data) {
    let bin = Math.floor((v - min) / binWidth);
    if (bin >= binCount) bin = binCount - 1;
    counts[bin]++;
  }

  const maxCount = Math.max(...counts);
  const decimals = range < 1 ? 3 : range < 10 ? 2 : range < 100 ? 1 : 0;
  const fmt = (v: number) => v.toFixed(decimals);

  const n = data.length;
  let sum = 0;
  for (const v of data) sum += v;
  const mean = sum / n;
  let sqDiffSum = 0;
  for (const v of data) sqDiffSum += (v - mean) ** 2;
  const stddev = Math.sqrt(sqDiffSum / n);

  const padding = { top: 24, right: 12, bottom: 32, left: 64 };
  const plotW = svgWidth - padding.left - padding.right;
  const barH = Math.max(12, (svgHeight - padding.top - padding.bottom) / binCount - 2);
  const totalH = padding.top + binCount * (barH + 2) + padding.bottom;

  return (
    <svg viewBox={`0 0 ${svgWidth} ${totalH}`} style={{ width: "100%", fontFamily: "monospace" }}>
      {p.label && (
        <text x={svgWidth / 2} y={16} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#e5e7eb">
          {p.label}
        </text>
      )}

      {counts.map((count, i) => {
        const lo = min + i * binWidth;
        const hi = lo + binWidth;
        const label = `${fmt(lo)}–${fmt(hi)}`;
        const y = padding.top + i * (barH + 2);
        const w = maxCount > 0 ? (count / maxCount) * plotW : 0;

        return (
          <g key={i}>
            <text x={padding.left - 4} y={y + barH / 2 + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
              {label}
            </text>
            <rect x={padding.left} y={y} width={w} height={barH} fill={color} rx={2} />
            {showValues && count > 0 && (
              <text x={padding.left + w + 4} y={y + barH / 2 + 4} fontSize="9" fill="#9ca3af">
                {count}
              </text>
            )}
          </g>
        );
      })}

      <text x={svgWidth / 2} y={totalH - 8} textAnchor="middle" fontSize="9" fill="#6b7280">
        n={n} {"\u03BC"}={fmt(mean)} {"\u03C3"}={fmt(stddev)}
      </text>
    </svg>
  );
}
