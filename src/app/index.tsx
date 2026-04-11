import React, { useState, useEffect, useCallback, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { shadcnComponents } from "@json-render/shadcn";
import { ShadcnBadge, ShadcnImage, ShadcnProgress, ShadcnTable } from "./components/shadcn-adapters.js";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";
import { CandlestickChart, AreaChart, BaselineChart } from "./components/lw-chart.js";
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline, Sparkline,
} from "./components/standard.js";
import { BarChart } from "./components/bar-chart.js";
import { applySpecMessage, type SpecEntry } from "../render-session.js";
import type { Spec, SpecMessage } from "../render-contract.js";

// -- Direct renderer (no @json-render/react dependency) --

const components: Record<string, (p: { props: Record<string, unknown>; children?: ReactNode }) => ReactNode> = {
  // shadcn components (direct or adapted)
  Card: shadcnComponents.Card,
  Heading: shadcnComponents.Heading,
  Spinner: shadcnComponents.Spinner,
  Image: ShadcnImage,
  Table: ShadcnTable,
  Badge: ShadcnBadge,
  ProgressBar: ShadcnProgress,

  // kept custom components
  Box, Spacer,
  Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  List: ListComponent, ListItem, Timeline,
  Sparkline, BarChart,

  // custom charts
  LineChart, Histogram, Heatmap,
  CandlestickChart, AreaChart, BaselineChart,
};

function RenderElement({ id, spec }: { id: string; spec: Spec }) {
  const el = spec.elements[id];
  if (!el) return null;

  const Component = components[el.type];
  if (!Component) {
    return <div style={{ color: "#f87171", fontSize: 12 }}>Unknown: {el.type}</div>;
  }

  const children = el.children?.length
    ? el.children.map((childId) => <RenderElement key={childId} id={childId} spec={spec} />)
    : undefined;

  return <Component props={el.props} children={children} />;
}

function RenderSpec({ spec }: { spec: Spec }) {
  return <RenderElement id={spec.root} spec={spec} />;
}

// -- WebSocket hook --

function useWebSocketSpec() {
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((msg: SpecMessage) => {
    setSpecs((prev) => applySpecMessage(prev, msg));
  }, []);

  useEffect(() => {
    const wsUrl = `ws://${window.location.host}`;
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retryTimer = setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data));
        } catch { /* ignore */ }
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [handleMessage]);

  return { specs, connected };
}

// -- App --

function App() {
  const { specs, connected } = useWebSocketSpec();

  return (
    <div style={{ padding: 16, minHeight: "100vh" }}>
      {!connected && (
        <div style={{ color: "#fbbf24", padding: 8, marginBottom: 8, fontSize: 13 }}>
          Disconnected — reconnecting...
        </div>
      )}
      {specs.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14, padding: 16 }}>Waiting for data...</div>
      ) : (
        specs.map((entry) => (
          <div key={entry.id} style={{ marginBottom: 16 }}>
            <RenderSpec spec={entry.spec} />
          </div>
        ))
      )}
    </div>
  );
}

// Ensure chart CSS variables exist (the HTML shell defines them, but this
// covers cases where the app bundle is newer than the running server's template).
const _chartFallbacks: Record<string, string> = {
  "--chart-1": "#2563eb", "--chart-2": "#16a34a", "--chart-3": "#eab308",
  "--chart-4": "#a855f7", "--chart-5": "#ef4444",
};
for (const [k, v] of Object.entries(_chartFallbacks)) {
  if (!getComputedStyle(document.documentElement).getPropertyValue(k).trim()) {
    document.documentElement.style.setProperty(k, v);
  }
}

try {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message + "\n" + e.stack : String(e);
  document.getElementById("root")!.innerHTML = `<pre style="color:#f87171;padding:16px">${msg}</pre>`;
}
