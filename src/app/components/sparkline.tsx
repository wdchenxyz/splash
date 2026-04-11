import React from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";

interface SparklineProps {
  props: Record<string, unknown>;
}

export function Sparkline({ props: p }: SparklineProps) {
  const data = (p.data as number[]) ?? [];
  if (data.length === 0) return null;

  const maxWidth = p.width ? ((p.width as number) * 6) : undefined;
  const height = 36;
  const color = (p.color as string) ?? "#22c55e";
  const min = p.min != null ? (p.min as number) : "dataMin";
  const max = p.max != null ? (p.max as number) : "dataMax";

  const chartData = data.map((value) => ({ value }));

  return (
    <div>
      {p.label && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>
          {p.label as string}
        </div>
      )}
      <div style={{ width: "100%", maxWidth, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <YAxis hide domain={[min, max]} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
