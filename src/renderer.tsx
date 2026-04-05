import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text } from "ink";
import { Renderer, JSONUIProvider } from "@json-render/ink";
import { registry } from "./catalog.js";
import { connectClient, type SpecMessage } from "./ipc.js";
import { applySpecMessage, type SpecEntry } from "./render-session.js";

function App() {
  const [specs, setSpecs] = useState<SpecEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((message: SpecMessage) => {
    setSpecs((prev) => applySpecMessage(prev, message));
  }, []);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 60;
    const retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      connectClient(
        (message) => { handleMessage(message); },
        undefined,
        () => {
          // Post-connect disconnect — schedule reconnect
          if (destroyed) return;
          setConnected(false);
          retries = 0; // Reset retries for reconnection
          retryTimer = setTimeout(connect, retryDelay);
        }
      )
        .then(() => {
          setConnected(true);
          setError(null);
          retries = 0;
        })
        .catch(() => {
          if (destroyed) return;
          if (retries < maxRetries) {
            retries++;
            retryTimer = setTimeout(connect, retryDelay);
          } else {
            setError("Failed to connect after retries. Restart the pane.");
          }
        });
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
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
