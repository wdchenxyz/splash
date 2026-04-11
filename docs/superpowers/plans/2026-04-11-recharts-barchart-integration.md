# Recharts/shadcn BarChart Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-crafted div-based BarChart with a recharts-powered component wrapped in shadcn chart primitives, supporting multi-series, tooltips, both orientations, and responsive sizing.

**Architecture:** Add recharts as a dependency. Create minimal shadcn chart primitives (ChartContainer, ChartTooltip, ChartTooltipContent) in `src/app/components/ui/chart.tsx`. Build a new BarChart component in `src/app/components/bar-chart.tsx` using recharts + these primitives. Update the data resolver to produce recharts-native data shapes with auto-detection of multiple series from CSV/JSON columns.

**Tech Stack:** recharts, React 19, shadcn chart primitives (in-tree), TypeScript, tsup (IIFE browser bundle)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/ui/chart.tsx` | shadcn chart primitives: ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig type |
| Create | `src/app/components/bar-chart.tsx` | New recharts-based BarChart component |
| Modify | `src/app/components/standard.tsx` | Remove old BarChart export |
| Modify | `src/app/index.tsx` | Import new BarChart, remove old import |
| Modify | `src/browser-server.ts:74-95` | Add `--chart-1` through `--chart-5` CSS variables |
| Modify | `src/resolve-data.ts:56-79` | Update resolveBarChart for recharts-native shape |
| Modify | `src/data-file.test.ts:100-121,218-233` | Update BarChart resolver tests for new data shape |

---

### Task 1: Install recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

```bash
pnpm add recharts
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls recharts
```

Expected: recharts version listed in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add recharts dependency for BarChart integration"
```

---

### Task 2: Add chart color CSS variables

**Files:**
- Modify: `src/browser-server.ts:74-95`

- [ ] **Step 1: Add `--chart-*` variables to the dark theme CSS block**

In `src/browser-server.ts`, inside the `.dark { ... }` CSS block (after `--radius: 0.625rem;` on line 94), add the standard shadcn chart color palette:

```css
      --chart-1: oklch(0.488 0.243 264.376);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.769 0.188 70.08);
      --chart-4: oklch(0.627 0.265 303.9);
      --chart-5: oklch(0.645 0.246 16.439);
```

The edit target in `src/browser-server.ts`:

```typescript
// Find this line:
      --radius: 0.625rem;

// Replace with:
      --radius: 0.625rem;
      --chart-1: oklch(0.488 0.243 264.376);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.769 0.188 70.08);
      --chart-4: oklch(0.627 0.265 303.9);
      --chart-5: oklch(0.645 0.246 16.439);
```

- [ ] **Step 2: Commit**

```bash
git add src/browser-server.ts
git commit -m "feat: add shadcn chart color CSS variables to browser shell"
```

---

### Task 3: Create shadcn chart primitives

**Files:**
- Create: `src/app/components/ui/chart.tsx`

- [ ] **Step 1: Create the chart primitives file**

Create `src/app/components/ui/chart.tsx` with these components:

```tsx
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
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit src/app/components/ui/chart.tsx
```

If this errors due to project config, just ensure `pnpm run build` works after Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ui/chart.tsx
git commit -m "feat: add shadcn chart primitives (ChartContainer, ChartTooltip, ChartTooltipContent)"
```

---

### Task 4: Create new BarChart component

**Files:**
- Create: `src/app/components/bar-chart.tsx`

- [ ] **Step 1: Create the recharts-based BarChart component**

Create `src/app/components/bar-chart.tsx`:

```tsx
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
                width={100}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/bar-chart.tsx
git commit -m "feat: add recharts-based BarChart component with multi-series and dual orientation"
```

---

### Task 5: Wire up new BarChart in app registry

**Files:**
- Modify: `src/app/index.tsx:10-13,34`
- Modify: `src/app/components/standard.tsx:285-311`

- [ ] **Step 1: Update imports in `src/app/index.tsx`**

Replace the BarChart import from standard with the new bar-chart module.

Find:
```typescript
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline, Sparkline, BarChart,
} from "./components/standard.js";
```

Replace with:
```typescript
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline, Sparkline,
} from "./components/standard.js";
import { BarChart } from "./components/bar-chart.js";
```

- [ ] **Step 2: Remove old BarChart from `src/app/components/standard.tsx`**

Delete the entire `BarChart` function (lines 285-311):

```typescript
export function BarChart({ props }: { props: Record<string, unknown> }) {
  const data = (props.data as Array<{ label: string; value: number; color?: string }>) ?? [];
  // ... entire function through closing brace
}
```

- [ ] **Step 3: Build to verify wiring**

```bash
pnpm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/index.tsx src/app/components/standard.tsx
git commit -m "refactor: wire new recharts BarChart into app registry, remove old div-based BarChart"
```

---

### Task 6: Update resolveBarChart tests for new data shape

**Files:**
- Modify: `src/data-file.test.ts:100-121,218-233`

- [ ] **Step 1: Update the explicit-columns test**

Find the test at line 100:

```typescript
  it("resolves BarChart with labelColumn and valueColumn", () => {
    const f = tmpFile("bar.json", JSON.stringify([
      { service: "api", latency: 45 },
      { service: "web", latency: 30 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: {
          type: "BarChart",
          props: { dataFile: f, labelColumn: "service", valueColumn: "latency" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { label: "api", value: 45 },
      { label: "web", value: 30 },
    ]);
  });
```

Replace with:

```typescript
  it("resolves BarChart with explicit categoryKey", () => {
    const f = tmpFile("bar.json", JSON.stringify([
      { service: "api", latency: 45 },
      { service: "web", latency: 30 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: {
          type: "BarChart",
          props: { dataFile: f, categoryKey: "service" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.categoryKey).toBe("service");
    expect(props.data).toEqual([
      { service: "api", latency: 45 },
      { service: "web", latency: 30 },
    ]);
    expect(props.series).toEqual([
      { dataKey: "latency", color: "var(--chart-1)", label: "latency" },
    ]);
    expect(props.dataFile).toBeUndefined();
  });
```

- [ ] **Step 2: Update the auto-detect test**

Find the test at line 218:

```typescript
  it("auto-detects value column from CSV for BarChart", () => {
    const f = tmpFile("bar-csv.csv", "service,latency\napi,45\nweb,30\ndb,12\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "BarChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { label: "api", value: 45 },
      { label: "web", value: 30 },
      { label: "db", value: 12 },
    ]);
  });
```

Replace with:

```typescript
  it("auto-detects categoryKey and series from CSV for BarChart", () => {
    const f = tmpFile("bar-csv.csv", "service,latency\napi,45\nweb,30\ndb,12\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "BarChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.categoryKey).toBe("service");
    expect(props.data).toEqual([
      { service: "api", latency: 45 },
      { service: "web", latency: 30 },
      { service: "db", latency: 12 },
    ]);
    expect(props.series).toEqual([
      { dataKey: "latency", color: "var(--chart-1)", label: "latency" },
    ]);
  });
```

- [ ] **Step 3: Add a multi-series auto-detect test**

Add after the updated auto-detect test:

```typescript
  it("auto-detects multiple numeric series from CSV for BarChart", () => {
    const f = tmpFile("bar-multi.csv", "month,desktop,mobile\nJan,186,80\nFeb,305,200\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "BarChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.categoryKey).toBe("month");
    expect(props.data).toEqual([
      { month: "Jan", desktop: 186, mobile: 80 },
      { month: "Feb", desktop: 305, mobile: 200 },
    ]);
    expect(props.series).toHaveLength(2);
    expect(props.series[0]).toEqual({ dataKey: "desktop", color: "var(--chart-1)", label: "desktop" });
    expect(props.series[1]).toEqual({ dataKey: "mobile", color: "var(--chart-2)", label: "mobile" });
  });
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pnpm test
```

Expected: The two updated BarChart tests and the new multi-series test FAIL (resolveBarChart still produces old `{label, value}` shape). All other tests should still pass.

- [ ] **Step 5: Commit**

```bash
git add src/data-file.test.ts
git commit -m "test: update BarChart resolver tests for recharts-native data shape"
```

---

### Task 7: Update resolveBarChart implementation

**Files:**
- Modify: `src/resolve-data.ts:56-79`

- [ ] **Step 1: Add CHART_COLORS constant**

Add at the top of the file, after the `NUMERIC_ARRAY_TYPES` constant (line 12):

```typescript
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
```

- [ ] **Step 2: Replace resolveBarChart function**

Find the existing function (lines 56-79):

```typescript
function resolveBarChart(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, labelColumn, valueColumn, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("BarChart dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const lCol = (labelColumn as string) ?? Object.keys(rows[0]).find((k) => typeof rows[0][k] === "string");
  const vCol = (valueColumn as string) ?? Object.keys(rows[0]).find((k) => isNumericValue(rows[0][k]));

  if (!lCol || !vCol) throw new Error("BarChart: cannot auto-detect label/value columns. Specify labelColumn and valueColumn.");

  return {
    ...rest,
    data: rows.map((r) => ({
      label: String(r[lCol]),
      value: Number(r[vCol]),
    })),
  };
}
```

Replace with:

```typescript
function resolveBarChart(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, categoryKey: explicitCategoryKey, series: explicitSeries, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("BarChart dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const keys = Object.keys(rows[0]);

  const categoryKey =
    (explicitCategoryKey as string) ??
    keys.find((k) => typeof rows[0][k] === "string");
  if (!categoryKey) {
    throw new Error("BarChart: cannot auto-detect categoryKey. Specify categoryKey.");
  }

  let series: Array<{ dataKey: string; color: string; label: string }>;
  if (explicitSeries) {
    series = explicitSeries as typeof series;
  } else {
    const numericKeys = keys.filter(
      (k) => k !== categoryKey && isNumericValue(rows[0][k])
    );
    if (numericKeys.length === 0) {
      throw new Error(
        "BarChart: no numeric columns found for series. Specify series."
      );
    }
    series = numericKeys.map((k, i) => ({
      dataKey: k,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: k,
    }));
  }

  // Cast numeric values and preserve category as string
  const castData = rows.map((row) => {
    const out: Record<string, unknown> = {
      [categoryKey]: String(row[categoryKey]),
    };
    for (const s of series) {
      out[s.dataKey] = Number(row[s.dataKey]);
    }
    return out;
  });

  return { ...rest, data: castData, categoryKey, series };
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass, including the three BarChart resolver tests.

- [ ] **Step 4: Commit**

```bash
git add src/resolve-data.ts
git commit -m "feat: update resolveBarChart to produce recharts-native data shape with multi-series auto-detection"
```

---

### Task 8: Build and manual verification

- [ ] **Step 1: Full build**

```bash
pnpm run build
```

Expected: All three bundles (index, renderer, app) build successfully.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Manual smoke test — vertical bars (default orientation would be horizontal, so test vertical explicitly)**

Start the MCP server and send a BarChart spec via the `render-browser` tool with vertical layout:

```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "BarChart",
        "props": {
          "data": [
            { "month": "Jan", "desktop": 186, "mobile": 80 },
            { "month": "Feb", "desktop": 305, "mobile": 200 },
            { "month": "Mar", "desktop": 237, "mobile": 120 }
          ],
          "categoryKey": "month",
          "series": [
            { "dataKey": "desktop", "color": "var(--chart-1)", "label": "Desktop" },
            { "dataKey": "mobile", "color": "var(--chart-2)", "label": "Mobile" }
          ],
          "layout": "vertical",
          "label": "Monthly Traffic"
        },
        "children": []
      }
    }
  }
}
```

Verify in browser: vertical grouped bars, tooltip on hover, chart title visible.

- [ ] **Step 4: Manual smoke test — horizontal bars (default)**

```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "BarChart",
        "props": {
          "data": [
            { "service": "API", "latency": 45 },
            { "service": "Web", "latency": 30 },
            { "service": "DB", "latency": 12 }
          ],
          "categoryKey": "service",
          "label": "Service Latency (ms)"
        },
        "children": []
      }
    }
  }
}
```

Verify in browser: horizontal bars (labels on left, bars going right), single-series auto-detected, tooltip on hover.

- [ ] **Step 5: Final commit (if any manual fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
