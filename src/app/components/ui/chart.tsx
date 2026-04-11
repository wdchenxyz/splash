import React, { createContext, useContext } from "react";
import { Tooltip, ResponsiveContainer } from "recharts";

/* ------------------------------------------------------------------ */
/*  ChartConfig                                                       */
/* ------------------------------------------------------------------ */

export type ChartConfig = Record<
  string,
  { label?: string; color?: string }
>;

/* ------------------------------------------------------------------ */
/*  ChartContext                                                      */
/* ------------------------------------------------------------------ */

type ChartContextProps = { config: ChartConfig };

const ChartContext = createContext<ChartContextProps | null>(null);

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer />");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  ChartContainer                                                    */
/* ------------------------------------------------------------------ */

interface ChartContainerProps {
  config: ChartConfig;
  children: React.ReactElement;
  style?: React.CSSProperties;
}

export function ChartContainer({ config, children, style }: ChartContainerProps) {
  const cssVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value.color) cssVars[`--color-${key}`] = value.color;
  }

  return (
    <ChartContext.Provider value={{ config }}>
      <div style={{ ...cssVars, width: "100%", ...style } as React.CSSProperties}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  ChartTooltip                                                      */
/* ------------------------------------------------------------------ */

export const ChartTooltip = Tooltip;

/* ------------------------------------------------------------------ */
/*  ChartTooltipContent                                               */
/* ------------------------------------------------------------------ */

interface TooltipPayloadEntry {
  name: string;
  value: number;
  dataKey: string | number;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  hideLabel?: boolean;
  indicator?: "dot" | "line" | "dashed";
}

const tooltipWrapperStyle: React.CSSProperties = {
  backgroundColor: "oklch(0.145 0 0)",
  color: "oklch(0.985 0 0)",
  border: "1px solid oklch(0.269 0 0)",
  borderRadius: "0.5rem",
  padding: "8px 12px",
  fontSize: 12,
  fontFamily:
    "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  indicator = "dot",
}: ChartTooltipContentProps) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div style={tooltipWrapperStyle}>
      {!hideLabel && label != null && (
        <div style={{ marginBottom: 4, fontWeight: 500 }}>{label}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {payload.map((entry, i) => {
          const key = String(entry.dataKey);
          const itemConfig = config[key];
          const displayName = itemConfig?.label ?? entry.name;
          const color = entry.color || entry.fill || "#9ca3af";

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {indicator === "dot" && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
              )}
              {indicator === "line" && (
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 2,
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
              )}
              {indicator === "dashed" && (
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 0,
                    borderTop: `2px dashed ${color}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ color: "oklch(0.708 0 0)" }}>
                {displayName}
              </span>
              <span style={{ fontWeight: 600, marginLeft: "auto" }}>
                {typeof entry.value === "number"
                  ? entry.value.toLocaleString()
                  : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
