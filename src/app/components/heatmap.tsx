import React from "react";

interface HeatmapProps {
  props: {
    data: number[][];
    xLabels?: string[] | null;
    yLabels?: string[] | null;
    label?: string | null;
    color?: string | null;
    showValues?: boolean | null;
    cellWidth?: number | null;
  };
}

const GRADIENTS: Record<string, string[]> = {
  green: ["#0a2e0a", "#0f4f0f", "#1a7a1a", "#2eaa2e", "#50d050", "#80ff80"],
  red: ["#2e0a0a", "#4f0f0f", "#7a1a1a", "#aa2e2e", "#d05050", "#ff8080"],
  blue: ["#0a0a2e", "#0f0f4f", "#1a1a7a", "#2e2eaa", "#5050d0", "#8080ff"],
  yellow: ["#2e2e0a", "#4f4f0f", "#7a7a1a", "#aaaa2e", "#d0d050", "#ffff80"],
  cyan: ["#0a2e2e", "#0f4f4f", "#1a7a7a", "#2eaaaa", "#50d0d0", "#80ffff"],
  magenta: ["#2e0a2e", "#4f0f4f", "#7a1a7a", "#aa2eaa", "#d050d0", "#ff80ff"],
  white: ["#1a1a1a", "#333333", "#555555", "#888888", "#bbbbbb", "#eeeeee"],
};

function getColor(value: number, gradient: string[]): string {
  const idx = Math.min(gradient.length - 1, Math.round(value * (gradient.length - 1)));
  return gradient[idx];
}

export function Heatmap({ props }: HeatmapProps) {
  const p = props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const gradient = GRADIENTS[p.color ?? "green"] ?? GRADIENTS.green;
  const showValues = p.showValues ?? false;
  const cellSize = (p.cellWidth ?? (showValues ? 6 : 3)) * 8;
  const cols = Math.max(...data.map((r) => r.length));

  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;

  const padding = { top: p.label ? 24 : 8, left: p.yLabels ? 60 : 8, bottom: p.xLabels ? 24 : 8, right: 8 };
  const svgWidth = padding.left + cols * cellSize + padding.right;
  const svgHeight = padding.top + data.length * cellSize + padding.bottom + 24;

  const fmtVal = (v: number) => (range < 1 ? v.toFixed(2) : range < 10 ? v.toFixed(1) : Math.round(v).toString());

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: "100%", maxWidth: svgWidth, fontFamily: "monospace" }}>
      {p.label && (
        <text x={svgWidth / 2} y={16} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#e5e7eb">
          {p.label}
        </text>
      )}

      {data.map((row, ri) => (
        <g key={ri}>
          {p.yLabels?.[ri] && (
            <text x={padding.left - 4} y={padding.top + ri * cellSize + cellSize / 2 + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
              {p.yLabels[ri]}
            </text>
          )}
          {row.map((val, ci) => {
            const norm = (val - min) / range;
            const bg = getColor(norm, gradient);
            const x = padding.left + ci * cellSize;
            const y = padding.top + ri * cellSize;
            return (
              <g key={ci}>
                <rect x={x} y={y} width={cellSize - 1} height={cellSize - 1} fill={bg} rx={2} />
                {showValues && (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2 + 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill={norm > 0.5 ? "#000" : "#fff"}
                  >
                    {fmtVal(val)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}

      {p.xLabels &&
        p.xLabels.map((label, i) => (
          <text
            key={i}
            x={padding.left + i * cellSize + cellSize / 2}
            y={padding.top + data.length * cellSize + 14}
            textAnchor="middle"
            fontSize="9"
            fill="#9ca3af"
          >
            {label}
          </text>
        ))}

      {/* Legend */}
      <g transform={`translate(${padding.left}, ${svgHeight - 18})`}>
        <text x={-4} y={10} textAnchor="end" fontSize="9" fill="#9ca3af">
          {fmtVal(min)}
        </text>
        {gradient.map((c, i) => (
          <rect key={i} x={i * 16} y={0} width={16} height={12} fill={c} />
        ))}
        <text x={gradient.length * 16 + 4} y={10} fontSize="9" fill="#9ca3af">
          {fmtVal(max)}
        </text>
      </g>
    </svg>
  );
}
