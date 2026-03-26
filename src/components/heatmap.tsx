import React from "react";
import { Box, Text } from "ink";

// Block shading characters from empty to full
const SHADE_CHARS = [" ", "░", "▒", "▓", "█"];

interface HeatmapProps {
  element: {
    props: {
      // 2D array of numbers, rows x cols
      data: number[][];
      // Optional labels
      xLabels?: string[];
      yLabels?: string[];
      label?: string;
      // Color theme
      color?: "green" | "red" | "blue" | "yellow" | "cyan" | "magenta" | "white";
      // Show values in cells
      showValues?: boolean;
      // Cell width in characters
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

function getShade(value: number): string {
  const idx = Math.min(SHADE_CHARS.length - 1, Math.round(value * (SHADE_CHARS.length - 1)));
  return SHADE_CHARS[idx];
}

function formatVal(v: number, range: number): string {
  if (range < 1) return v.toFixed(2);
  if (range < 10) return v.toFixed(1);
  return Math.round(v).toString();
}

export function Heatmap({ element }: HeatmapProps) {
  const p = element.props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const color = p.color ?? "green";
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
            const shade = getShade(val);
            const cell = showValues
              ? formatVal(data[ri][ci], range).padStart(cellWidth - 1) + " "
              : shade.repeat(cellWidth);
            return (
              <Text
                key={ci}
                color={val > 0.5 ? "white" : color}
                backgroundColor={val > 0.7 ? color : undefined}
                dimColor={val < 0.3}
              >
                {cell}
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
        <Text dimColor>
          {formatVal(min, range)} </Text>
        {SHADE_CHARS.map((ch, i) => (
          <Text key={i} color={color} dimColor={i < 2}>
            {ch === " " ? "·" : ch}
          </Text>
        ))}
        <Text dimColor> {formatVal(max, range)}</Text>
      </Box>
    </Box>
  );
}
