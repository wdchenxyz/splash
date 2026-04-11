import React, { useRef, useEffect } from "react";
import {
  createChart,
  LineSeries,
  AreaSeries,
} from "lightweight-charts";
import { DARK_THEME, normalizeTime, toTimeValueData } from "./lw-chart.js";

const DEFAULT_COLORS = ["#22c55e", "#06b6d4", "#eab308", "#d946ef", "#ef4444", "#3b82f6", "#9ca3af"];

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

export function LineChart({ props: p }: LineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = (p.width ?? 60) * 8;
  const height = (p.height ?? 12) * 16;

  // Normalize to series array (for legend rendering outside useEffect)
  const seriesList: Series[] = p.series
    ? p.series
    : p.data
      ? [{ data: p.data, label: p.label, color: p.color, fill: p.fill }]
      : [];

  const hasData = seriesList.length > 0 && seriesList.some((s) => s.data?.length);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasData) return;

    const series: Series[] = p.series
      ? p.series
      : p.data
        ? [{ data: p.data, label: p.label, color: p.color, fill: p.fill }]
        : [];

    const chart = createChart(container, {
      width,
      height,
      ...DARK_THEME,
      rightPriceScale: {
        ...DARK_THEME.rightPriceScale,
        visible: p.showAxis !== false,
      },
    });

    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (!s.data?.length) continue;

      const color = (s.color as string) ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const tvData = toTimeValueData(s.data);
      const mapped = tvData.map((d) => ({
        time: normalizeTime(d.time) as any,
        value: d.value,
      }));

      if (s.fill) {
        const lwSeries = chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: color + "80",
          bottomColor: color + "10",
          lineWidth: 2,
        });
        lwSeries.setData(mapped);
      } else {
        const lwSeries = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
        });
        lwSeries.setData(mapped);
      }
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [p.data, p.series, p.color, p.fill, p.label, width, height, p.showAxis, hasData]);

  if (!hasData) return null;

  // Build legend for multi-series
  const labeled = seriesList
    .map((s, i) => ({ label: s.label, color: (s.color as string) ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }))
    .filter((l) => l.label);

  return (
    <div>
      {p.label && (
        <div style={{ color: "#e5e7eb", fontWeight: "bold", fontSize: 16, marginBottom: 4, fontFamily: "monospace" }}>
          {p.label}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} />
      {labeled.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>
          {labeled.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 2, backgroundColor: l.color }} />
              <span style={{ color: "#9ca3af" }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
