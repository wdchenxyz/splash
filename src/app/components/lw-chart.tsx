import React, { useRef, useEffect } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  BaselineSeries,
  type DeepPartial,
  type ChartOptions,
} from "lightweight-charts";

// -- Shared wrapper --

const DARK_THEME: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: "transparent" },
    textColor: "#9ca3af",
    fontFamily: "monospace",
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: "#1f2937" },
    horzLines: { color: "#1f2937" },
  },
  crosshair: {
    vertLine: { color: "#6b7280", labelBackgroundColor: "#374151" },
    horzLine: { color: "#6b7280", labelBackgroundColor: "#374151" },
  },
  timeScale: {
    borderColor: "#374151",
    timeVisible: true,
  },
  rightPriceScale: {
    borderColor: "#374151",
  },
};

function normalizeTime(t: unknown): string | number {
  if (typeof t === "number") return t;
  return String(t);
}

// -- CandlestickChart --

interface OHLCPoint {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  props: {
    data?: OHLCPoint[] | null;
    width?: number | null;
    height?: number | null;
    label?: string | null;
    upColor?: string | null;
    downColor?: string | null;
  };
}

export function CandlestickChart({ props: p }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = (p.width ?? 60) * 8;
  const height = (p.height ?? 16) * 16;
  const data = p.data;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data?.length) return;

    const chart = createChart(container, { width, height, ...DARK_THEME });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: p.upColor ?? "#22c55e",
      downColor: p.downColor ?? "#ef4444",
      borderUpColor: p.upColor ?? "#22c55e",
      borderDownColor: p.downColor ?? "#ef4444",
      wickUpColor: p.upColor ?? "#22c55e",
      wickDownColor: p.downColor ?? "#ef4444",
    });

    series.setData(
      data.map((d) => ({
        time: normalizeTime(d.time) as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, p.upColor, p.downColor]);

  if (!data?.length) return null;

  return (
    <div>
      {p.label && (
        <div style={{ color: "#e5e7eb", fontWeight: "bold", fontSize: 16, marginBottom: 4, fontFamily: "monospace" }}>
          {p.label}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}

// -- AreaChart --

interface TimeValuePoint {
  time: string | number;
  value: number;
}

interface AreaChartProps {
  props: {
    data?: number[] | TimeValuePoint[] | null;
    width?: number | null;
    height?: number | null;
    label?: string | null;
    color?: string | null;
    lineColor?: string | null;
  };
}

function toTimeValueData(data: (number | TimeValuePoint)[]): TimeValuePoint[] {
  if (data.length === 0) return [];
  if (typeof data[0] === "number") {
    return (data as number[]).map((value, i) => ({ time: i as any, value }));
  }
  return data as TimeValuePoint[];
}

export function AreaChart({ props: p }: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = (p.width ?? 60) * 8;
  const height = (p.height ?? 12) * 16;
  const data = p.data;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data?.length) return;

    const chart = createChart(container, { width, height, ...DARK_THEME });
    const color = p.color ?? "#22c55e";

    const series = chart.addSeries(AreaSeries, {
      lineColor: p.lineColor ?? color,
      topColor: color + "80",
      bottomColor: color + "10",
      lineWidth: 2,
    });

    const tvData = toTimeValueData(data);
    series.setData(
      tvData.map((d) => ({
        time: normalizeTime(d.time) as any,
        value: d.value,
      }))
    );

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, p.color, p.lineColor]);

  if (!data?.length) return null;

  return (
    <div>
      {p.label && (
        <div style={{ color: "#e5e7eb", fontWeight: "bold", fontSize: 16, marginBottom: 4, fontFamily: "monospace" }}>
          {p.label}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}

// -- BaselineChart --

interface BaselineChartProps {
  props: {
    data?: number[] | TimeValuePoint[] | null;
    width?: number | null;
    height?: number | null;
    label?: string | null;
    baseValue?: number | null;
    topLineColor?: string | null;
    bottomLineColor?: string | null;
  };
}

export function BaselineChart({ props: p }: BaselineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = (p.width ?? 60) * 8;
  const height = (p.height ?? 12) * 16;
  const data = p.data;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data?.length) return;

    const chart = createChart(container, { width, height, ...DARK_THEME });

    const tvData = toTimeValueData(data);
    const baseValue = p.baseValue ?? tvData.reduce((s, d) => s + d.value, 0) / tvData.length;
    const topColor = p.topLineColor ?? "#22c55e";
    const bottomColor = p.bottomLineColor ?? "#ef4444";

    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: baseValue },
      topLineColor: topColor,
      topFillColor1: topColor + "40",
      topFillColor2: topColor + "10",
      bottomLineColor: bottomColor,
      bottomFillColor1: bottomColor + "10",
      bottomFillColor2: bottomColor + "40",
      lineWidth: 2,
    });

    series.setData(
      tvData.map((d) => ({
        time: normalizeTime(d.time) as any,
        value: d.value,
      }))
    );

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, p.baseValue, p.topLineColor, p.bottomLineColor]);

  if (!data?.length) return null;

  return (
    <div>
      {p.label && (
        <div style={{ color: "#e5e7eb", fontWeight: "bold", fontSize: 16, marginBottom: 4, fontFamily: "monospace" }}>
          {p.label}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}
