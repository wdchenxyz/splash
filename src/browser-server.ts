import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { SpecMessage } from "./ipc.js";

const DEFAULT_PORT = 3456;
const MAX_PORT_RETRIES = 10;

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

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
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Splash</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwindcss.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
            popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
            primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
            secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
            muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
            accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
            destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
            border: 'var(--border)',
            input: 'var(--input)',
            ring: 'var(--ring)',
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
          },
        },
      },
    };
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; min-width: 0; }
    body { background: #0a0e17; color: #e5e7eb; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; }

    /* shadcn dark theme CSS variables */
    .dark {
      --background: oklch(0.145 0 0);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.145 0 0);
      --card-foreground: oklch(0.985 0 0);
      --popover: oklch(0.145 0 0);
      --popover-foreground: oklch(0.985 0 0);
      --primary: oklch(0.985 0 0);
      --primary-foreground: oklch(0.205 0 0);
      --secondary: oklch(0.269 0 0);
      --secondary-foreground: oklch(0.985 0 0);
      --muted: oklch(0.269 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --accent: oklch(0.269 0 0);
      --accent-foreground: oklch(0.985 0 0);
      --destructive: oklch(0.396 0.141 25.723);
      --destructive-foreground: oklch(0.637 0.237 25.331);
      --border: oklch(0.269 0 0);
      --input: oklch(0.269 0 0);
      --ring: oklch(0.556 0 0);
      --radius: 0.625rem;
      --chart-1: oklch(0.488 0.243 264.376);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.769 0.188 70.08);
      --chart-4: oklch(0.627 0.265 303.9);
      --chart-5: oklch(0.645 0.246 16.439);
    }
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
      } else if (req.url?.startsWith("/files/")) {
        const encoded = req.url.slice("/files/".length);
        let filePath: string;
        try {
          filePath = Buffer.from(encoded, "base64url").toString("utf-8");
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad request");
          return;
        }

        filePath = path.resolve(filePath);
        if (!path.isAbsolute(filePath)) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = IMAGE_MIME[ext];
        if (!mime) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: not an image type");
          return;
        }

        let data: Buffer;
        try {
          data = fs.readFileSync(filePath);
        } catch {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        });
        res.end(data);
      } else {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      }
    });

    // Listen first, then attach WebSocket — avoids WSS emitting
    // unhandled EADDRINUSE errors during port retry
    boundPort = await tryListen(server, port);

    wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      clients.add(ws);
      if (lastMessage) ws.send(lastMessage);
      ws.on("close", () => clients.delete(ws));
      ws.on("error", () => clients.delete(ws));
    });

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

  function getPort(): number | null {
    return boundPort;
  }

  return { start, sendSpec, hasClients, close, getPort };
}
