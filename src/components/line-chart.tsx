import React from "react";
import { Box, Text } from "ink";

const BRAILLE_BASE = 0x2800;
// Braille dot positions: each cell is 2 wide x 4 tall
// Left column:  dot1=0x01, dot2=0x02, dot3=0x04, dot7=0x40
// Right column: dot4=0x08, dot5=0x10, dot6=0x20, dot8=0x80
const LEFT_DOTS = [0x40, 0x04, 0x02, 0x01]; // bottom to top
const RIGHT_DOTS = [0x80, 0x20, 0x10, 0x08]; // bottom to top

interface LineChartProps {
  element: {
    props: {
      data: number[];
      width?: number;
      height?: number;
      label?: string;
      color?: string;
      showAxis?: boolean;
      fill?: boolean;
    };
  };
}

export function LineChart({ element }: LineChartProps) {
  const p = element.props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const chartWidth = p.width ?? 60; // in terminal columns (each = 2 data points in braille)
  const chartHeight = p.height ?? 12; // in terminal rows (each = 4 data points in braille)
  const color = p.color ?? "green";
  const showAxis = p.showAxis !== false;
  const fill = p.fill ?? false;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  // Resample data to fit chartWidth * 2 points (2 x-positions per braille cell)
  const totalXSlots = chartWidth * 2;
  const resampled: number[] = [];
  for (let i = 0; i < totalXSlots; i++) {
    const idx = (i / (totalXSlots - 1)) * (data.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, data.length - 1);
    const t = idx - lo;
    resampled.push(data[lo] * (1 - t) + data[hi] * t);
  }

  // Map values to y positions in braille grid (chartHeight * 4 rows)
  const totalYSlots = chartHeight * 4;
  const yPositions = resampled.map(
    (v) => Math.round(((v - minVal) / range) * (totalYSlots - 1))
  );

  // Build braille grid: grid[row][col], row 0 = top
  const grid: number[][] = [];
  for (let r = 0; r < chartHeight; r++) {
    grid.push(new Array(chartWidth).fill(0));
  }

  for (let x = 0; x < totalXSlots; x++) {
    const col = Math.floor(x / 2);
    const isRight = x % 2 === 1;
    const dots = isRight ? RIGHT_DOTS : LEFT_DOTS;

    if (fill) {
      // Fill from bottom up to the data point
      for (let y = 0; y <= yPositions[x]; y++) {
        const row = chartHeight - 1 - Math.floor(y / 4);
        const subRow = y % 4;
        if (row >= 0 && row < chartHeight) {
          grid[row][col] |= dots[subRow];
        }
      }
    } else {
      // Just plot the point
      const y = yPositions[x];
      const row = chartHeight - 1 - Math.floor(y / 4);
      const subRow = y % 4;
      if (row >= 0 && row < chartHeight) {
        grid[row][col] |= dots[subRow];
      }

      // Connect to next point with intermediate dots for smooth lines
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

  // Render braille characters
  const lines: string[] = [];
  for (let r = 0; r < chartHeight; r++) {
    let line = "";
    for (let c = 0; c < chartWidth; c++) {
      line += String.fromCharCode(BRAILLE_BASE + grid[r][c]);
    }
    lines.push(line);
  }

  // Y-axis labels
  const yLabelWidth = Math.max(
    maxVal.toFixed(0).length,
    minVal.toFixed(0).length
  );

  return (
    <Box flexDirection="column">
      {p.label && <Text bold>{p.label}</Text>}
      {lines.map((line, i) => {
        const yVal =
          maxVal - (i / (chartHeight - 1)) * range;
        const label = showAxis
          ? yVal.toFixed(0).padStart(yLabelWidth) + " ┤"
          : "";
        return (
          <Text key={i}>
            {showAxis && <Text dimColor>{label}</Text>}
            <Text color={color}>{line}</Text>
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
