import net from "node:net";
import fs from "node:fs";

export type { SeriesData, RenderMessage, AddSeriesMessage, SpecMessage } from "./render-contract.js";
import type { SpecMessage } from "./render-contract.js";

const SOCKET_PATH = process.env.SPLASH_SOCKET ?? `/tmp/splash-${process.pid}.sock`;

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
  socketPath = SOCKET_PATH,
  onDisconnect?: () => void
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

    let resolved = false;
    socket.on("connect", () => { resolved = true; });

    socket.on("close", () => {
      if (resolved && onDisconnect) {
        onDisconnect();
      }
    });

    socket.on("error", (err) => {
      if (!resolved) {
        reject(err);
      }
      // post-connect errors will trigger close event
    });
  });
}
