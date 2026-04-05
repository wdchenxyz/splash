import React, { useState, useEffect, useCallback, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { shadcnComponents } from "@json-render/shadcn";
import { ShadcnBadge, ShadcnImage, ShadcnProgress, ShadcnTable } from "./components/shadcn-adapters.js";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";
import {
  Box, Spacer, Newline, Divider, Text, StatusLine,
  KeyValue, Metric, Link, Markdown, Callout,
  ListComponent, ListItem, Timeline, Sparkline, BarChart,
} from "./components/standard.js";

import type { Spec, SpecElement, SpecMessage, SeriesData } from "../render-contract.js";

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

function addSeriesToSpec(spec: Spec, chartId: string | undefined, series: SeriesData | undefined): Spec {
  if (!series) return spec;

  const targetId = chartId ?? Object.keys(spec.elements).reverse().find(
    (k) => spec.elements[k]?.type === "LineChart"
  );
  if (!targetId) return spec;

  const el = spec.elements[targetId];
  if (el?.type !== "LineChart") return spec;

  const props = { ...el.props };
  let seriesList = (props.series as Array<Record<string, unknown>>) ?? [];
  if (props.data && seriesList.length === 0) {
    seriesList = [{ data: props.data, label: props.label, color: props.color, fill: props.fill }];
    delete props.data;
  }
  seriesList = [...seriesList, series];
  props.series = seriesList;

  return {
    ...spec,
    elements: { ...spec.elements, [targetId]: { ...el, props } },
  };
}

function useWebSocketSpec() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((msg: SpecMessage) => {
    if (msg.type === "add_series") {
      setSpecs((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const updated = addSeriesToSpec(last, msg.chartId, msg.series);
        return [...prev.slice(0, -1), updated];
      });
      return;
    }

    if (msg.mode === "clear") {
      setSpecs([]);
      return;
    }

    const spec = msg.spec!;

    if (msg.mode === "append") {
      setSpecs((prev) => [...prev, spec]);
    } else {
      setSpecs([spec]);
    }
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
        specs.map((spec, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <RenderSpec spec={spec} />
          </div>
        ))
      )}
    </div>
  );
}

try {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message + "\n" + e.stack : String(e);
  document.getElementById("root")!.innerHTML = `<pre style="color:#f87171;padding:16px">${msg}</pre>`;
}
