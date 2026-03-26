import React from "react";
import { Box, Text } from "ink";

const BRAILLE_BASE = 0x2800;
const LEFT_DOTS = [0x40, 0x04, 0x02, 0x01]; // bottom to top
const RIGHT_DOTS = [0x80, 0x20, 0x10, 0x08]; // bottom to top

const DEFAULT_COLORS = ["green", "cyan", "yellow", "magenta", "red", "blue", "white"];

interface Series {
  data: number[];
  label?: string;
  color?: string;
  fill?: boolean;
}

interface LineChartProps {
  element: {
    props: {
      // Single series (backwards compatible)
      data?: number[];
      // Multi series
      series?: Series[];
      width?: number;
      height?: number;
      label?: string;
      color?: string;
      showAxis?: boolean;
      fill?: boolean;
    };
  };
}

function resample(data: number[], totalXSlots: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < totalXSlots; i++) {
    const idx = (i / (totalXSlots - 1)) * (data.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, data.length - 1);
    const t = idx - lo;
    result.push(data[lo] * (1 - t) + data[hi] * t);
  }
  return result;
}

function plotSeries(
  grid: number[][],
  yPositions: number[],
  totalXSlots: number,
  chartHeight: number,
  fill: boolean
) {
  for (let x = 0; x < totalXSlots; x++) {
    const col = Math.floor(x / 2);
    const isRight = x % 2 === 1;
    const dots = isRight ? RIGHT_DOTS : LEFT_DOTS;

    if (fill) {
      for (let y = 0; y <= yPositions[x]; y++) {
        const row = chartHeight - 1 - Math.floor(y / 4);
        const subRow = y % 4;
        if (row >= 0 && row < chartHeight) {
          grid[row][col] |= dots[subRow];
        }
      }
    } else {
      const y = yPositions[x];
      const row = chartHeight - 1 - Math.floor(y / 4);
      const subRow = y % 4;
      if (row >= 0 && row < chartHeight) {
        grid[row][col] |= dots[subRow];
      }

      if (x < totalXSlots - 1) {
        const nextY = yPositions[x + 1];
        const step = nextY > y ? 1 : -1;
        for (let midY = y; midY !== nextY; midY += step) {
          const mRow = chartHeight - 1 - Math.floor(midY / 4);
          const mSubRow = midY % 4;
          if (mRow >= 0 && mRow < chartHeight) {
            grid[mRow][col] |= dots[mSubRow];
          }
        }
      }
    }
  }
}

export function LineChart({ element }: LineChartProps) {
  const p = element.props;

  // Normalize to series array
  const seriesList: Series[] = p.series
    ? p.series
    : p.data
      ? [{ data: p.data, label: p.label, color: p.color, fill: p.fill }]
      : [];

  if (seriesList.length === 0 || seriesList.every((s) => !s.data?.length))
    return null;

  const chartWidth = p.width ?? 60;
  const chartHeight = p.height ?? 12;
  const showAxis = p.showAxis !== false;
  const totalXSlots = chartWidth * 2;
  const totalYSlots = chartHeight * 4;

  // Compute global min/max across all series
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of seriesList) {
    for (const v of s.data) {
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    }
  }
  const range = globalMax - globalMin || 1;

  // Each series gets its own grid (for per-series coloring)
  const grids: { grid: number[][]; color: string }[] = [];

  for (let si = 0; si < seriesList.length; si++) {
    const s = seriesList[si];
    const resampled = resample(s.data, totalXSlots);
    const yPositions = resampled.map((v) =>
      Math.round(((v - globalMin) / range) * (totalYSlots - 1))
    );

    const grid: number[][] = [];
    for (let r = 0; r < chartHeight; r++) {
      grid.push(new Array(chartWidth).fill(0));
    }

    plotSeries(grid, yPositions, totalXSlots, chartHeight, s.fill ?? false);
    grids.push({
      grid,
      color: s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length],
    });
  }

  // Determine Y-axis label precision based on data range
  const yDecimals = range < 0.1 ? 3 : range < 1 ? 2 : range < 10 ? 1 : 0;
  const fmtY = (v: number) => v.toFixed(yDecimals);
  const yLabelWidth = Math.max(fmtY(globalMax).length, fmtY(globalMin).length);

  // Build legend
  const legend = seriesList
    .map((s, i) => ({ label: s.label, color: s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }))
    .filter((l) => l.label);

  return (
    <Box flexDirection="column">
      {p.label && <Text bold>{p.label}</Text>}
      {legend.length > 1 && (
        <Box gap={2}>
          {legend.map((l, i) => (
            <Text key={i}>
              <Text color={l.color}>━</Text> <Text dimColor>{l.label}</Text>
            </Text>
          ))}
        </Box>
      )}
      {Array.from({ length: chartHeight }, (_, r) => {
        const yVal = globalMax - (r / (chartHeight - 1)) * range;
        const axisLabel = showAxis
          ? fmtY(yVal).padStart(yLabelWidth) + " ┤"
          : "";

        return (
          <Text key={r}>
            {showAxis && <Text dimColor>{axisLabel}</Text>}
            {Array.from({ length: chartWidth }, (_, c) => {
              // Find which series contribute dots to this cell
              let combined = 0;
              let topColor = grids[0].color;
              for (const g of grids) {
                if (g.grid[r][c] !== 0) {
                  combined |= g.grid[r][c];
                  topColor = g.color;
                }
              }
              if (combined === 0 && grids.length === 1) {
                return (
                  <Text key={c} color={grids[0].color}>
                    {String.fromCharCode(BRAILLE_BASE)}
                  </Text>
                );
              }
              // For multi-series: if multiple series share a cell, show combined dots
              // Color goes to the last series that contributed
              return (
                <Text key={c} color={topColor}>
                  {String.fromCharCode(BRAILLE_BASE + combined)}
                </Text>
              );
            })}
          </Text>
        );
      })}
      {showAxis && (
        <Text dimColor>
          {"".padStart(yLabelWidth + 2)}
          {"└" + "─".repeat(chartWidth)}
        </Text>
      )}
    </Box>
  );
}
