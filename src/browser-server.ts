import http from "node:http";
import fs from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import type { SpecMessage } from "./ipc.js";

const DEFAULT_PORT = 3456;
const MAX_PORT_RETRIES = 10;

export function createBrowserServer(port = DEFAULT_PORT) {
  let server: http.Server | null = null;
  let wss: WebSocketServer | null = null;
  let boundPort: number | null = null;
  const clients = new Set<WebSocket>();
  let appJs: string | null = null;
  let lastMessage: string | null = null;

  function loadAppJs(): string {
    if (appJs) return appJs;
    const appJsPath = new URL("./app.global.js", import.meta.url);
    appJs = fs.readFileSync(appJsPath, "utf-8");
    return appJs;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Splash</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0e17; color: #e5e7eb; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>`;

  function tryListen(srv: http.Server, p: number): Promise<number> {
    return new Promise((resolve, reject) => {
      srv.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && p - port < MAX_PORT_RETRIES) {
          resolve(tryListen(srv, p + 1));
        } else {
          reject(err);
        }
      });
      srv.listen(p, () => resolve(p));
    });
  }

  async function start(): Promise<string> {
    if (server && boundPort) return `http://localhost:${boundPort}`;

    loadAppJs();

    server = http.createServer((req, res) => {
      if (req.url === "/app.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(appJs);
      } else {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      }
    });

    wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      clients.add(ws);
      if (lastMessage) ws.send(lastMessage);
      ws.on("close", () => clients.delete(ws));
      ws.on("error", () => clients.delete(ws));
    });

    boundPort = await tryListen(server, port);
    return `http://localhost:${boundPort}`;
  }

  function sendSpec(message: SpecMessage): boolean {
    const data = JSON.stringify(message);
    lastMessage = data;
    let sent = false;
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent = true;
      }
    }
    return sent;
  }

  function hasClients(): boolean {
    return clients.size > 0;
  }

  function close() {
    for (const client of clients) {
      client.close();
    }
    clients.clear();
    wss?.close();
    server?.close();
    wss = null;
    server = null;
    boundPort = null;
  }

  return { start, sendSpec, hasClients, close };
}
