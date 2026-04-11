# Lightweight Charts Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate TradingView lightweight-charts into the Splash browser renderer, adding CandlestickChart, AreaChart, and BaselineChart component types with dataFile support.

**Architecture:** CandlestickChart is browser-only (no tmux fallback). AreaChart and BaselineChart get tmux fallbacks by aliasing to the existing LineChart. All three use lightweight-charts (HTML5 Canvas) in the browser renderer. The existing `resolveDataFiles` pipeline is extended to handle OHLC data. Existing charts (LineChart, Histogram, Heatmap) are untouched.

**Tech Stack:** lightweight-charts v5, React 19, tsup (IIFE bundle), Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/lw-chart.tsx` | Shared lightweight-charts React wrapper + all 3 chart components |
| Modify | `src/app/index.tsx:5-37` | Register CandlestickChart, AreaChart, BaselineChart in browser |
| Modify | `src/catalog.ts:1-13` | Alias AreaChart/BaselineChart to LineChart for tmux (no CandlestickChart tmux support) |
| Modify | `src/resolve-data.ts:12,149-179` | Add OHLC resolver for CandlestickChart; register AreaChart/BaselineChart as numeric array types |
| Modify | `src/data-file.test.ts` | Add tests for OHLC and time-series data resolution |
| Modify | `package.json:14` | Add lightweight-charts dependency |

---

### Task 1: Add lightweight-charts dependency

**Files:**
- Modify: `package.json:14`

- [ ] **Step 1: Install lightweight-charts**

```bash
cd /Users/wdchen/Workspace/splash && pnpm add lightweight-charts
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd /Users/wdchen/Workspace/splash && pnpm build
```

Expected: all 3 tsup entries compile without errors. The browser IIFE bundle (`dist/app.global.js`) will grow by ~40kB gzipped due to the new dependency, but it's only bundled if imported.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add lightweight-charts dependency"
```

---

### Task 2: Create shared lightweight-charts React wrapper and chart components

This file contains:
1. `LWChartWrapper` — a React component that manages the lightweight-charts lifecycle (mount, resize, destroy, dark theme)
2. `CandlestickChart` — browser component using CandlestickSeries
3. `AreaChart` — browser component using AreaSeries
4. `BaselineChart` — browser component using BaselineSeries

All four live in one file because they share the wrapper and are tightly coupled.

**Files:**
- Create: `src/app/components/lw-chart.tsx`

- [ ] **Step 1: Create `src/app/components/lw-chart.tsx`**

```tsx
import React, { useRef, useEffect } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  BaselineSeries,
  type IChartApi,
  type DeepPartial,
  type ChartOptions,
} from "lightweight-charts";

// -- Shared wrapper --

const DARK_THEME: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: "transparent" },
    textColor: "#9ca3af",
    fontFamily: "monospace",
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

function useChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
): IChartApi | null {
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width,
      height,
      ...DARK_THEME,
    });
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [containerRef, width, height]);

  return chartRef.current;
}

// -- Time normalization --
// Lightweight-charts needs time as 'YYYY-MM-DD' string or unix timestamp.
// Splash specs may pass string dates or numbers. This normalizes them.

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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wdchen/Workspace/splash && pnpm build
```

Expected: compiles successfully. The browser bundle now includes lightweight-charts.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/lw-chart.tsx
git commit -m "feat: add lightweight-charts wrapper and CandlestickChart, AreaChart, BaselineChart browser components"
```

---

### Task 3: Register new chart types in browser renderer

**Files:**
- Modify: `src/app/index.tsx:5-37`

- [ ] **Step 1: Add imports and register components**

Add the import after the existing chart imports (after line 7):

```typescript
import { CandlestickChart, AreaChart, BaselineChart } from "./components/lw-chart.js";
```

Add entries to the `components` record (after line 36, inside the object, after `Heatmap`):

```typescript
  CandlestickChart, AreaChart, BaselineChart,
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wdchen/Workspace/splash && pnpm build
```

Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat: register CandlestickChart, AreaChart, BaselineChart in browser renderer"
```

---

### Task 4: Register tmux fallbacks in catalog

AreaChart and BaselineChart reuse the existing tmux LineChart (the baseline concept doesn't translate to braille, and area maps to a filled line chart). CandlestickChart has no tmux support — it is browser-only.

**Files:**
- Modify: `src/catalog.ts:1-13`

- [ ] **Step 1: Add aliases to the registry**

Add entries to the `registry` object (after line 12, before the closing `}`):

```typescript
  AreaChart: LineChart,
  BaselineChart: LineChart,
```

The LineChart import already exists on line 2 — it will handle AreaChart/BaselineChart props gracefully since it reads `data` from `element.props` (AreaChart/BaselineChart pass `data: number[]` which LineChart already supports).

- [ ] **Step 2: Verify build**

```bash
cd /Users/wdchen/Workspace/splash && pnpm build
```

Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add src/catalog.ts
git commit -m "feat: alias AreaChart and BaselineChart to LineChart in tmux catalog"
```

---

### Task 5: Add OHLC data file resolution

The `resolveDataFiles` pipeline needs to handle CandlestickChart's OHLC format (objects with time/open/high/low/close fields). AreaChart and BaselineChart use the existing numeric array resolution plus time-value pair support.

**Files:**
- Modify: `src/resolve-data.ts:12,149-179`
- Modify: `src/data-file.test.ts` (add tests)

- [ ] **Step 1: Write failing tests for OHLC resolution**

Add the following tests to the end of the `resolveDataFiles` describe block in `src/data-file.test.ts` (before the final `});`):

```typescript
  it("resolves CandlestickChart dataFile from JSON objects", () => {
    const f = tmpFile("ohlc.json", JSON.stringify([
      { time: "2024-01-01", open: 100, high: 105, low: 98, close: 103 },
      { time: "2024-01-02", open: 103, high: 110, low: 101, close: 108 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: { type: "CandlestickChart", props: { dataFile: f, label: "AAPL" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { time: "2024-01-01", open: 100, high: 105, low: 98, close: 103 },
      { time: "2024-01-02", open: 103, high: 110, low: 101, close: 108 },
    ]);
    expect(props.dataFile).toBeUndefined();
    expect(props.label).toBe("AAPL");
  });

  it("resolves CandlestickChart dataFile from CSV", () => {
    const f = tmpFile("ohlc.csv", "time,open,high,low,close\n2024-01-01,100,105,98,103\n2024-01-02,103,110,101,108\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "CandlestickChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toHaveLength(2);
    expect(props.data[0].open).toBe(100);
    expect(props.data[0].time).toBe("2024-01-01");
  });

  it("resolves AreaChart and BaselineChart via numeric array path", () => {
    const f = tmpFile("area.json", "[10, 20, 30, 40]");
    for (const type of ["AreaChart", "BaselineChart"]) {
      const spec = {
        root: "c",
        elements: {
          c: { type, props: { dataFile: f }, children: [] },
        },
      };
      const resolved = resolveDataFiles(spec);
      const props = (resolved.elements.c as any).props;
      expect(props.data).toEqual([10, 20, 30, 40]);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/wdchen/Workspace/splash && pnpm test
```

Expected: the 3 new tests FAIL — CandlestickChart is not handled in `resolveDataFiles`, and AreaChart/BaselineChart are not in `NUMERIC_ARRAY_TYPES`.

- [ ] **Step 3: Implement OHLC resolver and register new types**

In `src/resolve-data.ts`, update the `NUMERIC_ARRAY_TYPES` set (line 12) to include AreaChart and BaselineChart:

```typescript
const NUMERIC_ARRAY_TYPES = new Set(["LineChart", "Sparkline", "Histogram", "AreaChart", "BaselineChart"]);
```

Add the OHLC resolver function before the `resolveDataFiles` export (before line 149):

```typescript
function resolveCandlestick(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("CandlestickChart dataFile must contain an array of objects with time/open/high/low/close fields");
  }

  const rows = data as Record<string, unknown>[];
  const required = ["open", "high", "low", "close"];
  for (const key of required) {
    if (!(key in rows[0])) throw new Error(`CandlestickChart: missing required field "${key}"`);
  }

  const timeKey = Object.keys(rows[0]).find((k) => !required.includes(k)) ?? "time";

  return {
    ...rest,
    data: rows.map((r) => ({
      time: r[timeKey] != null ? String(r[timeKey]) : "",
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    })),
  };
}
```

Add the CandlestickChart branch in `resolveDataFiles` (after the `NUMERIC_ARRAY_TYPES` check, before the `BarChart` check — between the current lines 162 and 163):

```typescript
    } else if (el.type === "CandlestickChart") {
      resolvedProps = resolveCandlestick(data, el.props);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/wdchen/Workspace/splash && pnpm test
```

Expected: all tests PASS, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/resolve-data.ts src/data-file.test.ts
git commit -m "feat: add OHLC data resolver for CandlestickChart; register AreaChart and BaselineChart in numeric array types"
```

---

### Task 6: Build verification and manual test

**Files:** (none modified)

- [ ] **Step 1: Full build and test suite**

```bash
cd /Users/wdchen/Workspace/splash && pnpm build && pnpm test
```

Expected: clean build, all tests pass.

- [ ] **Step 2: Verify browser bundle includes lightweight-charts**

```bash
ls -lh /Users/wdchen/Workspace/splash/dist/app.global.js
```

Expected: file size has increased (from ~300-400kB to ~500-600kB due to lightweight-charts inclusion).

- [ ] **Step 3: Manual smoke test with MCP render-browser**

Use the splash MCP `render-browser` tool with a CandlestickChart spec to verify end-to-end rendering:

```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "CandlestickChart",
        "props": {
          "label": "AAPL Daily",
          "data": [
            {"time": "2024-01-02", "open": 185.33, "high": 186.10, "low": 183.79, "close": 185.64},
            {"time": "2024-01-03", "open": 184.22, "high": 185.88, "low": 183.43, "close": 184.25},
            {"time": "2024-01-04", "open": 182.15, "high": 183.09, "low": 180.88, "close": 181.91},
            {"time": "2024-01-05", "open": 181.99, "high": 182.76, "low": 180.17, "close": 181.18},
            {"time": "2024-01-08", "open": 182.09, "high": 185.60, "low": 181.50, "close": 185.56}
          ]
        }
      }
    }
  }
}
```

Expected: browser opens showing interactive candlestick chart with green/red candles, crosshair on hover, and time axis.

- [ ] **Step 4: Test AreaChart and BaselineChart similarly**

AreaChart spec:
```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "AreaChart",
        "props": {
          "label": "Memory Usage",
          "data": [42, 45, 43, 48, 52, 55, 50, 47, 49, 53]
        }
      }
    }
  }
}
```

BaselineChart spec:
```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "BaselineChart",
        "props": {
          "label": "P&L",
          "data": [10, 15, 8, -2, -5, 3, 12, 7, -1, 4],
          "baseValue": 0
        }
      }
    }
  }
}
```

Expected: AreaChart shows filled gradient area. BaselineChart shows green above baseline, red below.

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -u
git commit -m "fix: address issues found during manual testing"
```

Only run this step if fixes were needed. Skip if everything passed cleanly.
