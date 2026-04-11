import React from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  props: Record<string, unknown>;
}

export function Sparkline({ props: p }: SparklineProps) {
  const data = (p.data as number[]) ?? [];
  if (data.length === 0) return null;

  const width = ((p.width as number) ?? 60) * 6;
  const height = 24;
  const color = (p.color as string) ?? "#22c55e";
  const min = p.min != null ? (p.min as number) : undefined;
  const max = p.max != null ? (p.max as number) : undefined;

  const chartData = data.map((value) => ({ value }));

  return (
    <div>
      {p.label && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>
          {p.label as string}
        </div>
      )}
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
