# Migrate Custom Browser Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom from-scratch SVG browser charts (Sparkline, Histogram) with richer library-backed implementations — recharts for Sparkline, lightweight-charts HistogramSeries for Histogram. Heatmap stays as-is.

**Architecture:** Sparkline moves from a custom SVG `<polyline>` in `standard.tsx` to a recharts `LineChart` wrapped in shadcn `ChartContainer` with all axes/grid/tooltip hidden — matching the existing BarChart integration pattern. Histogram moves from custom SVG `<rect>` bars to lightweight-charts `HistogramSeries` — matching the existing `lw-chart.tsx` pattern. Both migrations preserve the exact same props API so no changes are needed to the MCP server, data resolution, or component registry types.

**Tech Stack:** recharts 3.8.1 (already installed), lightweight-charts 5.1.0 (already installed), shadcn ChartContainer (already in use)

---

### Task 1: Migrate Sparkline to recharts

**Files:**
- Create: `src/app/components/sparkline.tsx`
- Modify: `src/app/components/standard.tsx` (remove Sparkline export)
- Modify: `src/app/index.tsx` (update import)

- [ ] **Step 1: Create `src/app/components/sparkline.tsx`**

```tsx
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
```

Note: We use recharts `LineChart` directly with `ResponsiveContainer` rather than `ChartContainer` because Sparkline is a minimal widget — no tooltip, no axes, no legend. `ChartContainer` adds overhead (CSS variable injection, config) that isn't needed here. If `domain` for min/max is needed, a `YAxis hide domain={[min, max]}` can be added.

- [ ] **Step 2: Remove Sparkline from `standard.tsx`**

Delete the entire `Sparkline` function (lines 256–283) and the comment `// -- Data Visualization --` above it from `src/app/components/standard.tsx`.

- [ ] **Step 3: Update import in `src/app/index.tsx`**

Change:
```tsx
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline, Sparkline,
} from "./components/standard.js";
```
to:
```tsx
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline,
} from "./components/standard.js";
import { Sparkline } from "./components/sparkline.js";
```

No changes to the `components` registry object — `Sparkline` key stays the same.

- [ ] **Step 4: Build and verify**

Run: `cd /Users/wdchen/Workspace/splash && pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 5: Visual verification**

Use the splash MCP `render-browser` tool to render a Sparkline and confirm it looks correct:

```json
{
  "spec": {
    "root": "layout",
    "elements": {
      "layout": {
        "type": "Box",
        "props": { "flexDirection": "column", "gap": 2 },
        "children": ["s1", "s2"]
      },
      "s1": {
        "type": "Sparkline",
        "props": { "data": [1, 4, 2, 8, 5, 7, 3, 9, 6, 4], "label": "CPU %" },
        "children": []
      },
      "s2": {
        "type": "Sparkline",
        "props": { "data": [10, 25, 30, 45, 40, 35, 50, 55, 60, 58], "label": "Memory %", "color": "#06b6d4" },
        "children": []
      }
    }
  }
}
```

Verify: smooth line renders, label appears above, color is correct, no axes/grid/tooltip visible.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/sparkline.tsx src/app/components/standard.tsx src/app/index.tsx
git commit -m "refactor: migrate Sparkline from custom SVG to recharts LineChart"
```

---

### Task 2: Migrate Histogram to lightweight-charts

**Files:**
- Modify: `src/app/components/histogram.tsx` (full rewrite)

The current Histogram uses custom SVG with horizontal bars. The new version uses lightweight-charts `HistogramSeries` which renders vertical bars — this is the conventional orientation for frequency histograms. The stats overlay (n, μ, σ) moves from an SVG `<text>` element to a positioned HTML div below the chart.

- [ ] **Step 1: Rewrite `src/app/components/histogram.tsx`**

```tsx
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
```

Key differences from the old implementation:
- Vertical bars (conventional histogram orientation) instead of horizontal
- Interactive: crosshair shows bin value on hover
- Uses the same `DARK_THEME` as all other lwc charts for visual consistency
- Stats line rendered as HTML div below the chart
- `tickMarkFormatter` displays bin range labels on the time axis

- [ ] **Step 2: Build and verify**

Run: `cd /Users/wdchen/Workspace/splash && pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 3: Visual verification**

Use the splash MCP `render-browser` tool to render a Histogram:

```json
{
  "spec": {
    "root": "h",
    "elements": {
      "h": {
        "type": "Histogram",
        "props": {
          "data": [2.1, 3.5, 3.8, 4.2, 4.5, 4.7, 5.0, 5.1, 5.3, 5.5, 5.8, 6.0, 6.2, 6.5, 6.8, 7.0, 7.3, 7.5, 8.0, 9.1],
          "bins": 8,
          "label": "Response Time (ms)"
        },
        "children": []
      }
    }
  }
}
```

Verify: vertical bars render, bin range labels appear on X-axis, count on Y-axis, stats line (n, μ, σ) below chart, crosshair works on hover.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/histogram.tsx
git commit -m "refactor: migrate Histogram from custom SVG to lightweight-charts HistogramSeries"
```

---

### Task 3: Update splash skill documentation

**Files:**
- Modify: `/Users/wdchen/.claude/skills/splash/components.md`

- [ ] **Step 1: Update the components.md sections**

Move `Sparkline` from the "Static SVG Charts" section into a new "Recharts Charts" row alongside BarChart. Move `Histogram` from "Static SVG Charts" into the "Interactive Canvas Charts" section alongside the other lwc charts.

The "Static SVG Charts" section header becomes just for Heatmap:

```markdown
## Interactive Canvas Charts (browser — TradingView lightweight-charts)

These render with HTML5 Canvas in the browser and support **interactive crosshair**, **zoom** (mouse wheel), and **pan** (click+drag). In tmux, AreaChart and BaselineChart fall back to LineChart; CandlestickChart and Histogram have no tmux fallback.

| Component | Key Props |
|-----------|-----------|
| `LineChart` | `data?: number[], series?: {data: number[], label?: string, color?: string, fill?: boolean}[], width?, height?, label?, color?, showAxis? (default true), fill?`. Multi-series via `series` array. |
| `CandlestickChart` | `data: {time: string\|number, open: number, high: number, low: number, close: number}[], width?, height?, label?, upColor? (default "#22c55e"), downColor? (default "#ef4444")`. **Browser-only.** |
| `AreaChart` | `data: number[] \| {time: string\|number, value: number}[], width?, height?, label?, color?, lineColor?`. Gradient fill below line. Tmux: falls back to LineChart. |
| `BaselineChart` | `data: number[] \| {time: string\|number, value: number}[], width?, height?, label?, baseValue? (default: mean), topLineColor? (default "#22c55e"), bottomLineColor? (default "#ef4444")`. Green above baseline, red below. Tmux: falls back to LineChart. |
| `Histogram` | `data: number[], bins? (default 15), width?, height?, label?, color?, showValues? (default true)`. Vertical bars, interactive crosshair. **Browser-only.** |

## Recharts Charts (browser — recharts + shadcn chart primitives)

Interactive SVG charts with tooltips, rendered via recharts wrapped in shadcn `ChartContainer`. Browser-only.

| Component | Key Props |
|-----------|-----------|
| `BarChart` | `data: Record<string, unknown>[], categoryKey?: string, series?: {dataKey: string, color?: string, label?: string}[], layout? ("horizontal"\|"vertical", default "horizontal"), label?, showTooltip? (default true), width?, height?`. Multi-series auto-detected from data keys. |
| `Sparkline` | `data: number[], width?, label?, color?, min?, max?`. Compact inline chart, no axes/grid/tooltip. |

## Static SVG Charts (browser and tmux)

| Component | Key Props |
|-----------|-----------|
| `Heatmap` | `data: number[][], xLabels?: string[], yLabels?: string[], label?, color? ("green"\|"red"\|"blue"\|"yellow"\|"cyan"\|"magenta"\|"white"), showValues? (default false), cellWidth?` |
```

- [ ] **Step 2: Commit**

```bash
git add /Users/wdchen/.claude/skills/splash/components.md
git commit -m "docs: update components.md to reflect Sparkline and Histogram migrations"
```
