import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import { Renderer, JSONUIProvider } from "@json-render/ink";
import { connectClient, type SpecMessage } from "./ipc.js";

interface SpecEntry {
  spec: SpecMessage["spec"];
  state: Record<string, unknown>;
}

function App() {
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 60;
    const retryDelay = 1000;

    function connect() {
      connectClient((message) => {
        const entry: SpecEntry = {
          spec: message.spec,
          state: message.state ?? {},
        };
        const mode = message.mode ?? "replace";

        if (mode === "clear") {
          setSpecs([]);
        } else if (mode === "append") {
          setSpecs((prev) => [...prev, entry]);
        } else {
          setSpecs([entry]);
        }
        setError(null);
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
  }, []);

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
      {specs.map((entry, i) => (
        <JSONUIProvider key={i} initialState={entry.state}>
          <Renderer spec={entry.spec} />
        </JSONUIProvider>
      ))}
    </Box>
  );
}

// Keep process alive — Ink alone may exit if there's no stdin interaction
setInterval(() => {}, 60_000);

render(<App />);
