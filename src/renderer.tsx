import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text } from "ink";
import { Renderer, JSONUIProvider } from "@json-render/ink";
import { registry } from "./catalog.js";
import { connectClient, type SpecMessage } from "./ipc.js";

interface Spec {
  root: string;
  elements: Record<string, any>;
}

interface SpecEntry {
  id: string;
  spec: Spec;
  state: Record<string, unknown>;
}

let entryCounter = 0;

function addSeriesToSpec(spec: Spec, series: SpecMessage["series"]): Spec {
  if (!series) return spec;

  // Find the LineChart element in the spec
  const elements = { ...spec.elements };
  for (const [key, el] of Object.entries(elements)) {
    if ((el as any).type === "LineChart") {
      const props = { ...(el as any).props };
      // Initialize series array if using single-data format
      if (!props.series) {
        props.series = props.data
          ? [{ data: props.data, label: props.label, color: props.color, fill: props.fill }]
          : [];
        delete props.data;
      } else {
        props.series = [...props.series];
      }
      props.series.push(series);
      elements[key] = { ...(el as any), props };
      break;
    }
  }

  return { ...spec, elements };
}

function App() {
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((message: SpecMessage) => {
    const msgType = message.type ?? "render";

    if (msgType === "add_series") {
      setSpecs((prev) => {
        const chartId = message.chartId;
        // Find the spec entry containing the chart
        // If chartId given, match by id; otherwise update the last spec
        const idx = chartId
          ? prev.findIndex((e) => e.id === chartId)
          : prev.length - 1;

        if (idx < 0) return prev;

        const entry = prev[idx];
        const newSpec = addSeriesToSpec(entry.spec, message.series);
        const updated = [...prev];
        updated[idx] = { ...entry, spec: newSpec };
        return updated;
      });
      return;
    }

    // type: "render"
    const mode = message.mode ?? "replace";
    if (mode === "clear") {
      setSpecs([]);
      return;
    }

    if (!message.spec) return;

    const entry: SpecEntry = {
      id: message.chartId ?? `spec-${entryCounter++}`,
      spec: message.spec,
      state: message.state ?? {},
    };

    if (mode === "append") {
      setSpecs((prev) => [...prev, entry]);
    } else {
      setSpecs([entry]);
    }
  }, []);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 60;
    const retryDelay = 1000;

    function connect() {
      connectClient((message) => {
        handleMessage(message);
      })
        .then(() => {
          setConnected(true);
          setError(null);
        })
        .catch((err) => {
          if (retries < maxRetries) {
            retries++;
            setTimeout(connect, retryDelay);
          } else {
            setError(`Failed to connect: ${err.message}`);
          }
        });
    }

    connect();
  }, [handleMessage]);

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!connected) {
    return (
      <Box padding={1}>
        <Text color="yellow">Connecting...</Text>
      </Box>
    );
  }

  if (specs.length === 0) {
    return (
      <Box padding={1}>
        <Text color="gray">Waiting for data...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {specs.map((entry) => (
        <JSONUIProvider key={entry.id} initialState={entry.state}>
          <Renderer spec={entry.spec} registry={registry} />
        </JSONUIProvider>
      ))}
    </Box>
  );
}

// Keep process alive
setInterval(() => {}, 60_000);

render(<App />);
