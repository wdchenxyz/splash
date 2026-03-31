import React from "react";

interface Series {
  data: number[];
  label?: string | null;
  color?: string | null;
  fill?: boolean | null;
}

interface LineChartProps {
  props: {
    data?: number[] | null;
    series?: Series[] | null;
    width?: number | null;
    height?: number | null;
    label?: string | null;
    color?: string | null;
    showAxis?: boolean | null;
    fill?: boolean | null;
    xLabels?: string[] | null;
    maxXLabels?: number | null;
  };
}

const DEFAULT_COLORS = ["#22c55e", "#06b6d4", "#eab308", "#d946ef", "#ef4444", "#3b82f6", "#9ca3af"];

function resample(data: number[], count: number): number[] {
  if (data.length <= 1) return data;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (i / (count - 1)) * (data.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, data.length - 1);
    const t = idx - lo;
    result.push(data[lo] * (1 - t) + data[hi] * t);
  }
  return result;
}

export function LineChart({ props }: LineChartProps) {
  const p = props;
  const svgWidth = (p.width ?? 60) * 8;
  const svgHeight = (p.height ?? 12) * 16;
  const showAxis = p.showAxis !== false;
  const hasXLabels = p.xLabels && p.xLabels.length > 0;
  const hasLegend = (p.series?.length ?? 0) > 1;
  const bottomPad = hasXLabels && hasLegend ? 58 : hasXLabels ? 44 : hasLegend ? 40 : 28;
  const padding = { top: 24, right: hasXLabels ? 30 : 12, bottom: bottomPad, left: showAxis ? 60 : 12 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  const seriesList: Series[] = p.series
    ? p.series
    : p.data
      ? [{ data: p.data, label: p.label, color: p.color, fill: p.fill }]
      : [];

  if (seriesList.length === 0 || seriesList.every((s) => !s.data?.length)) return null;

  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of seriesList) {
    for (const v of s.data) {
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    }
  }
  const range = globalMax - globalMin || 1;

  const pointCount = Math.min(plotW, 200);

  function toPath(data: number[]): string {
    const resampled = resample(data, pointCount);
    return resampled
      .map((v, i) => {
        const x = padding.left + (i / (pointCount - 1)) * plotW;
        const y = padding.top + (1 - (v - globalMin) / range) * plotH;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  function toFillPath(data: number[]): string {
    const resampled = resample(data, pointCount);
    const line = resampled
      .map((v, i) => {
        const x = padding.left + (i / (pointCount - 1)) * plotW;
        const y = padding.top + (1 - (v - globalMin) / range) * plotH;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
    const bottomRight = `L${padding.left + plotW},${padding.top + plotH}`;
    const bottomLeft = `L${padding.left},${padding.top + plotH}`;
    return `${line} ${bottomRight} ${bottomLeft} Z`;
  }

  const yDecimals = range < 0.1 ? 3 : range < 1 ? 2 : range < 10 ? 1 : 0;
  const tickCount = 5;

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: "100%", maxWidth: svgWidth, fontFamily: "monospace" }}>
      {p.label && (
        <text x={svgWidth / 2} y={14} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#e5e7eb">
          {p.label}
        </text>
      )}

      {showAxis &&
        Array.from({ length: tickCount }, (_, i) => {
          const val = globalMax - (i / (tickCount - 1)) * range;
          const y = padding.top + (i / (tickCount - 1)) * plotH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y} stroke="#374151" strokeWidth={0.5} />
              <text x={padding.left - 4} y={y + 4} textAnchor="end" fontSize="14" fill="#9ca3af">
                {val.toFixed(yDecimals)}
              </text>
            </g>
          );
        })}

      {seriesList.map((s, i) => {
        const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return (
          <g key={i}>
            {(s.fill ?? false) && <path d={toFillPath(s.data)} fill={color} opacity={0.15} />}
            <path d={toPath(s.data)} fill="none" stroke={color} strokeWidth={1.5} />
          </g>
        );
      })}

      {hasXLabels && (() => {
        const allLabels = p.xLabels!;
        const n = allLabels.length;
        // Auto-thin: estimate how many labels fit without overlapping
        // Each label needs its full text width + generous gap to avoid crowding
        const charPx = 9;
        const labelGapPx = 24;
        const maxLabelPx = Math.max(...allLabels.map((l) => l.length)) * charPx + labelGapPx;
        const fitCount = Math.max(2, Math.floor(plotW / maxLabelPx));
        const maxLabels = p.maxXLabels ? Math.min(p.maxXLabels, n) : Math.min(fitCount, n);
        // Always include first and last; evenly sample the rest
        const step = n <= maxLabels ? 1 : (n - 1) / (maxLabels - 1);
        const indices = n <= maxLabels
          ? Array.from({ length: n }, (_, i) => i)
          : Array.from({ length: maxLabels }, (_, i) =>
              i === maxLabels - 1 ? n - 1 : Math.round(i * step)
            );

        return indices.map((idx) => {
          const x = n === 1
            ? padding.left + plotW / 2
            : padding.left + (idx / (n - 1)) * plotW;
          return (
            <text
              key={`xlabel-${idx}`}
              x={x}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              fontSize="14"
              fill="#9ca3af"
            >
              {allLabels[idx]}
            </text>
          );
        });
      })()}

      {seriesList.length > 1 && (() => {
        const labeled = seriesList.filter((s) => s.label);
        let xOffset = padding.left;
        return (
          <g>
            {labeled.map((s, i) => {
              const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const x = xOffset;
              xOffset += 20 + (s.label?.length ?? 0) * 9 + 16;
              return (
                <g key={i} transform={`translate(${x}, ${svgHeight - 6})`}>
                  <line x1={0} y1={-4} x2={12} y2={-4} stroke={color} strokeWidth={2} />
                  <text x={16} y={0} fontSize="14" fill="#9ca3af">
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}
