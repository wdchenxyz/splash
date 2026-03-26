import React from "react";
import { Box, Text } from "ink";

// Color gradients: array of hex colors from low to high intensity
const GRADIENTS: Record<string, string[]> = {
  green:   ["#0a2e0a", "#0f4f0f", "#1a7a1a", "#2eaa2e", "#50d050", "#80ff80"],
  red:     ["#2e0a0a", "#4f0f0f", "#7a1a1a", "#aa2e2e", "#d05050", "#ff8080"],
  blue:    ["#0a0a2e", "#0f0f4f", "#1a1a7a", "#2e2eaa", "#5050d0", "#8080ff"],
  yellow:  ["#2e2e0a", "#4f4f0f", "#7a7a1a", "#aaaa2e", "#d0d050", "#ffff80"],
  cyan:    ["#0a2e2e", "#0f4f4f", "#1a7a7a", "#2eaaaa", "#50d0d0", "#80ffff"],
  magenta: ["#2e0a2e", "#4f0f4f", "#7a1a7a", "#aa2eaa", "#d050d0", "#ff80ff"],
  white:   ["#1a1a1a", "#333333", "#555555", "#888888", "#bbbbbb", "#eeeeee"],
};

interface HeatmapProps {
  element: {
    props: {
      data: number[][];
      xLabels?: string[];
      yLabels?: string[];
      label?: string;
      color?: string;
      showValues?: boolean;
      cellWidth?: number;
    };
  };
}

function normalize(data: number[][]): { normalized: number[][]; min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;
  const normalized = data.map((row) =>
    row.map((v) => (v - min) / range)
  );
  return { normalized, min, max };
}

function formatVal(v: number, range: number): string {
  if (range < 1) return v.toFixed(2);
  if (range < 10) return v.toFixed(1);
  return Math.round(v).toString();
}

function getColor(value: number, gradient: string[]): string {
  const idx = Math.min(
    gradient.length - 1,
    Math.round(value * (gradient.length - 1))
  );
  return gradient[idx];
}

export function Heatmap({ element }: HeatmapProps) {
  const p = element.props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const colorName = p.color ?? "green";
  const gradient = GRADIENTS[colorName] ?? GRADIENTS.green;
  const showValues = p.showValues ?? false;
  const cellWidth = p.cellWidth ?? (showValues ? 6 : 2);
  const { normalized, min, max } = normalize(data);
  const range = max - min || 1;

  const yLabels = p.yLabels ?? [];
  const xLabels = p.xLabels ?? [];
  const yLabelWidth = yLabels.length > 0
    ? Math.max(...yLabels.map((l) => l.length))
    : 0;

  return (
    <Box flexDirection="column">
      {p.label && <Text bold>{p.label}</Text>}
      {normalized.map((row, ri) => (
        <Text key={ri}>
          {yLabelWidth > 0 && (
            <Text dimColor>
              {(yLabels[ri] ?? "").padStart(yLabelWidth)} │
            </Text>
          )}
          {row.map((val, ci) => {
            const bg = getColor(val, gradient);
            if (showValues) {
              const textColor = val > 0.5 ? "#000000" : "#ffffff";
              return (
                <Text key={ci} backgroundColor={bg} color={textColor}>
                  {formatVal(data[ri][ci], range).padStart(cellWidth - 1) + " "}
                </Text>
              );
            }
            return (
              <Text key={ci} backgroundColor={bg}>
                {" ".repeat(cellWidth)}
              </Text>
            );
          })}
        </Text>
      ))}
      {xLabels.length > 0 && (
        <Text>
          {yLabelWidth > 0 && (
            <Text dimColor>{"".padStart(yLabelWidth + 1)}</Text>
          )}
          {xLabels.map((label, i) => (
            <Text key={i} dimColor>
              {label.slice(0, cellWidth).padStart(cellWidth)}
            </Text>
          ))}
        </Text>
      )}
      {/* Legend */}
      <Box marginTop={1}>
        <Text dimColor>{formatVal(min, range)} </Text>
        {gradient.map((c, i) => (
          <Text key={i} backgroundColor={c}>{"  "}</Text>
        ))}
        <Text dimColor> {formatVal(max, range)}</Text>
      </Box>
    </Box>
  );
}
