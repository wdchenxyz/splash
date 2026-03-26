import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const SOCKET_PATH = "/tmp/splash.sock";

export interface SpecMessage {
  type?: "render" | "add_series";
  // For type: "render"
  spec?: {
    root: string;
    elements: Record<string, unknown>;
  };
  state?: Record<string, unknown>;
  mode?: "replace" | "append" | "clear";
  // For type: "add_series"
  chartId?: string;
  series?: {
    data: number[];
    label?: string;
    color?: string;
    fill?: boolean;
  };
}

/**
 * Server side — used by the MCP server to send specs to the renderer.
 */
export function createIPCServer(socketPath = SOCKET_PATH) {
  // Clean up stale socket
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // ignore
  }

  const clients = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });

  const listening = new Promise<void>((resolve, reject) => {
    server.listen(socketPath, () => resolve());
    server.on("error", reject);
  });

  function sendSpec(message: SpecMessage): boolean {
    const data = JSON.stringify(message) + "\n";
    let sent = false;
    for (const client of clients) {
      if (!client.destroyed) {
        client.write(data);
        sent = true;
      }
    }
    return sent;
  }

  function close() {
    for (const client of clients) {
      client.destroy();
    }
    clients.clear();
    server.close();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // ignore
    }
  }

  function hasClients(): boolean {
    return clients.size > 0;
  }

  return { server, sendSpec, close, hasClients, socketPath, listening };
}

/**
 * Client side — used by the renderer to receive specs.
 */
export function connectClient(
  onSpec: (message: SpecMessage) => void,
  socketPath = SOCKET_PATH
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      resolve(socket);
    });

    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.trim()) {
          try {
            onSpec(JSON.parse(line));
          } catch {
            // ignore malformed messages
          }
        }
      }
    });

    socket.on("error", reject);
  });
}

export { SOCKET_PATH };
