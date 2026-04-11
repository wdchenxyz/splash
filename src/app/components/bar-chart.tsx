import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart.js";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SeriesConfig {
  dataKey: string;
  color?: string;
  label?: string;
}

interface BarChartProps {
  props: Record<string, unknown>;
}

export function BarChart({ props: p }: BarChartProps) {
  const data = (p.data as Record<string, unknown>[]) ?? [];
  if (data.length === 0) return null;

  const categoryKey = (p.categoryKey as string) ?? Object.keys(data[0])[0];

  // Resolve series: explicit or auto-detect from first data row
  const series: SeriesConfig[] =
    (p.series as SeriesConfig[] | undefined) ??
    Object.keys(data[0])
      .filter((k) => k !== categoryKey && typeof data[0][k] === "number")
      .map((k, i) => ({
        dataKey: k,
        color: CHART_COLORS[i % CHART_COLORS.length],
        label: k,
      }));

  if (series.length === 0) return null;

  const showTooltip = (p.showTooltip as boolean) !== false;

  // layout prop: "horizontal" = horizontal bars (recharts "vertical"),
  //              "vertical"   = vertical bars   (recharts default)
  const isHorizontalBars = (p.layout as string ?? "horizontal") === "horizontal";

  // Build ChartConfig from series for CSS variable injection + tooltip labels
  const chartConfig: ChartConfig = {};
  for (const s of series) {
    chartConfig[s.dataKey] = {
      label: s.label ?? s.dataKey,
      color: s.color ?? CHART_COLORS[Object.keys(chartConfig).length % CHART_COLORS.length],
    };
  }

  // Sizing: multiplier system if explicit, else responsive
  const explicitWidth = p.width ? (p.width as number) * 8 : undefined;
  const explicitHeight = p.height ? (p.height as number) * 16 : undefined;

  const containerStyle: React.CSSProperties = {
    height: explicitHeight ?? 300,
  };
  if (explicitWidth) containerStyle.maxWidth = explicitWidth;

  return (
    <div>
      {p.label && (
        <div
          style={{
            color: "#e5e7eb",
            fontWeight: "bold",
            fontSize: 16,
            marginBottom: 4,
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          }}
        >
          {p.label as string}
        </div>
      )}
      <ChartContainer config={chartConfig} style={containerStyle}>
        <RechartsBarChart
          accessibilityLayer
          data={data as Record<string, unknown>[]}
          layout={isHorizontalBars ? "vertical" : undefined}
        >
          <CartesianGrid
            horizontal={isHorizontalBars}
            vertical={!isHorizontalBars}
            stroke="#1f2937"
          />

          {isHorizontalBars ? (
            <>
              <XAxis type="number" hide />
              <YAxis
                dataKey={categoryKey}
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                width={Math.max(100, ...data.map(d => String(d[categoryKey] ?? "").length * 7.5 + 16))}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={categoryKey}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
              />
            </>
          )}

          {showTooltip && (
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
          )}

          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              fill={`var(--color-${s.dataKey})`}
              radius={4}
            />
          ))}
        </RechartsBarChart>
      </ChartContainer>
    </div>
  );
}
