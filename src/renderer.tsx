import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text } from "ink";
import { Renderer, JSONUIProvider } from "@json-render/ink";
import { registry } from "./catalog.js";
import {
  connectClient,
  type SpecMessage,
  type SeriesData,
} from "./ipc.js";

interface ElementDef {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

interface Spec {
  root: string;
  elements: Record<string, ElementDef>;
}

interface SpecEntry {
  id: string;
  spec: Spec;
  state: Record<string, unknown>;
}

let entryCounter = 0;

function addSeriesToSpec(spec: Spec, series: SeriesData): Spec {
  const elements = { ...spec.elements };
  for (const [key, el] of Object.entries(elements)) {
    if (el.type === "LineChart") {
      const props = { ...el.props };
      const existing = props.series as SeriesData[] | undefined;
      if (!existing) {
        props.series = props.data
          ? [{ data: props.data as number[], label: props.label as string, color: props.color as string, fill: props.fill as boolean }]
          : [];
        delete props.data;
      } else {
        props.series = [...existing];
      }
      (props.series as SeriesData[]).push(series);
      elements[key] = { ...el, props };
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
    if (message.type === "add_series") {
      setSpecs((prev) => {
        const idx = message.chartId
          ? prev.findIndex((e) => e.id === message.chartId)
          : prev.length - 1;
        if (idx < 0) return prev;

        const entry = prev[idx];
        const updated = [...prev];
        updated[idx] = { ...entry, spec: addSeriesToSpec(entry.spec, message.series) };
        return updated;
      });
      return;
    }

    const mode = message.mode ?? "replace";
    if (mode === "clear") {
      setSpecs([]);
      return;
    }

    const entry: SpecEntry = {
      id: message.chartId ?? `spec-${entryCounter++}`,
      spec: message.spec as Spec,
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
