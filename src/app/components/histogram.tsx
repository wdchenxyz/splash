import React, { useRef, useEffect } from "react";
import { createChart, HistogramSeries } from "lightweight-charts";
import { DARK_THEME } from "./lw-chart.js";

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

function computeBins(data: number[], binCount: number) {
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

  const decimals = range < 1 ? 3 : range < 10 ? 2 : range < 100 ? 1 : 0;
  const fmt = (v: number) => v.toFixed(decimals);

  const bars = counts.map((count, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    return {
      time: i as unknown as string,
      value: count,
      label: `${fmt(lo)}–${fmt(hi)}`,
    };
  });

  return { bars, min, max };
}

function computeStats(data: number[]) {
  const n = data.length;
  let sum = 0;
  for (const v of data) sum += v;
  const mean = sum / n;
  let sqDiffSum = 0;
  for (const v of data) sqDiffSum += (v - mean) ** 2;
  const stddev = Math.sqrt(sqDiffSum / n);

  const range = Math.max(...data) - Math.min(...data);
  const decimals = range < 1 ? 3 : range < 10 ? 2 : range < 100 ? 1 : 0;
  const fmt = (v: number) => v.toFixed(decimals);

  return `n=${n}  μ=${fmt(mean)}  σ=${fmt(stddev)}`;
}

export function Histogram({ props: p }: HistogramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const data = p.data ?? [];
  const binCount = p.bins ?? 15;
  const width = (p.width ?? 40) * 10;
  const height = (p.height ?? 12) * 16;
  const color = p.color ?? "#22c55e";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const { bars } = computeBins(data, binCount);

    const chart = createChart(container, {
      width,
      height,
      ...DARK_THEME,
      rightPriceScale: {
        ...DARK_THEME.rightPriceScale,
        visible: true,
      },
      timeScale: {
        ...DARK_THEME.timeScale,
        visible: true,
        tickMarkFormatter: (time: number) => {
          return bars[time]?.label ?? "";
        },
      },
    });

    const series = chart.addSeries(HistogramSeries, {
      color,
    });

    series.setData(
      bars.map((b) => ({
        time: b.time as any,
        value: b.value,
      }))
    );

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, binCount, width, height, color]);

  if (data.length === 0) return null;

  const stats = computeStats(data);

  return (
    <div>
      {p.label && (
        <div
          style={{
            color: "#e5e7eb",
            fontWeight: "bold",
            fontSize: 16,
            marginBottom: 4,
            fontFamily: "monospace",
          }}
        >
          {p.label}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} />
      <div
        style={{
          color: "#6b7280",
          fontSize: 14,
          fontFamily: "monospace",
          textAlign: "center",
          marginTop: 4,
          width,
        }}
      >
        {stats}
      </div>
    </div>
  );
}
