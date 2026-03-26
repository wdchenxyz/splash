import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text } from "ink";
import { Renderer, JSONUIProvider } from "@json-render/ink";
import { connectClient, type SpecMessage } from "./ipc.js";

function App() {
  const [spec, setSpec] = useState<SpecMessage["spec"] | null>(null);
  const [state, setState] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 60;
    const retryDelay = 1000;

    function connect() {
      connectClient((message) => {
        setSpec(message.spec);
        if (message.state) {
          setState(message.state);
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

  if (!spec) {
    return (
      <Box padding={1}>
        <Text color="gray">Waiting for data...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <JSONUIProvider initialState={state}>
        <Renderer spec={spec} />
      </JSONUIProvider>
    </Box>
  );
}

// Keep process alive — Ink alone may exit if there's no stdin interaction
setInterval(() => {}, 60_000);

render(<App />);
