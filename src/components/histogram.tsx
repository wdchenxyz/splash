import React from "react";
import { Box, Text } from "ink";

interface HistogramProps {
  element: {
    props: {
      data: number[];
      bins?: number;
      width?: number;
      height?: number;
      label?: string;
      color?: string;
      showValues?: boolean;
    };
  };
}

const BLOCK_CHARS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

export function Histogram({ element }: HistogramProps) {
  const p = element.props;
  const data = p.data ?? [];
  if (data.length === 0) return null;

  const binCount = p.bins ?? 15;
  const barMaxWidth = p.width ?? 40;
  const color = p.color ?? "green";
  const showValues = p.showValues !== false;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const binWidth = range / binCount;

  // Count values per bin
  const counts = new Array(binCount).fill(0);
  for (const v of data) {
    let bin = Math.floor((v - min) / binWidth);
    if (bin >= binCount) bin = binCount - 1;
    counts[bin]++;
  }

  const maxCount = Math.max(...counts);

  // Format bin range labels
  const decimals = range < 1 ? 3 : range < 10 ? 2 : range < 100 ? 1 : 0;
  const fmt = (v: number) => v.toFixed(decimals);

  const labels = counts.map((_, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    return `${fmt(lo)}–${fmt(hi)}`;
  });
  const labelWidth = Math.max(...labels.map((l) => l.length));

  // Render fractional bars using 1/8th block characters
  function renderBar(count: number): string {
    if (maxCount === 0) return "";
    const fullWidth = (count / maxCount) * barMaxWidth;
    const full = Math.floor(fullWidth);
    const frac = Math.round((fullWidth - full) * 8);
    return "█".repeat(full) + (frac > 0 ? BLOCK_CHARS[frac] : "");
  }

  return (
    <Box flexDirection="column">
      {p.label && <Text bold>{p.label}</Text>}
      {counts.map((count, i) => (
        <Text key={i}>
          <Text dimColor>{labels[i].padStart(labelWidth)} ┤</Text>
          <Text color={color}>{renderBar(count)}</Text>
          {showValues && count > 0 && (
            <Text dimColor> {count}</Text>
          )}
        </Text>
      ))}
      <Text dimColor>
        {"".padStart(labelWidth + 1)}
        {"└" + "─".repeat(barMaxWidth)}
      </Text>
      <Text dimColor>
        {"".padStart(labelWidth + 2)}
        {"n=" + data.length}
        {"  μ=" + fmt(data.reduce((a, b) => a + b, 0) / data.length)}
        {"  σ=" + fmt(Math.sqrt(data.reduce((a, b) => a + (b - data.reduce((x, y) => x + y, 0) / data.length) ** 2, 0) / data.length))}
      </Text>
    </Box>
  );
}
