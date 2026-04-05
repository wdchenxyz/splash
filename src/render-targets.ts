import { createIPCServer, type SpecMessage } from "./ipc.js";
import type { Spec, SpecElement } from "./render-contract.js";
import { createBrowserServer } from "./browser-server.js";
import { ensurePane, closePane } from "./tmux-manager.js";

// -- Shared wait helper --

export async function waitForReady(
  check: () => boolean,
  timeoutMs: number,
  pollMs = 200
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return check();
}

// -- Render target interface --

export interface RenderTarget {
  prepare(): Promise<{ ready: boolean; url?: string }>;
  send(message: SpecMessage): boolean;
  hasClients(): boolean;
  close(): void;
}

// -- Tmux target --

let ipc: ReturnType<typeof createIPCServer> | null = null;

async function getIPC() {
  if (!ipc) {
    ipc = createIPCServer();
    await ipc.listening;
  }
  return ipc;
}

export function getTmuxIPC() {
  return ipc;
}

export async function createTmuxTarget(options?: {
  position?: "right" | "bottom";
  size?: number;
}): Promise<RenderTarget> {
  const ipcServer = await getIPC();
  await ensurePane({ ...options, socketPath: ipcServer.socketPath });

  return {
    async prepare() {
      const ready = await waitForReady(() => ipcServer.hasClients(), 10000);
      return { ready };
    },
    send(message) {
      return ipcServer.sendSpec(message);
    },
    hasClients() {
      return ipcServer.hasClients();
    },
    close() {
      ipcServer.close();
      ipc = null;
    },
  };
}

// -- Browser target --

let browser: ReturnType<typeof createBrowserServer> | null = null;

function getBrowser() {
  if (!browser) {
    browser = createBrowserServer();
  }
  return browser;
}

export function getBrowserServer() {
  return browser;
}

export async function createBrowserTarget(): Promise<RenderTarget & { url: string; port: number }> {
  const srv = getBrowser();
  const url = await srv.start();
  const port = srv.getPort()!;

  return {
    url,
    port,
    async prepare() {
      if (!srv.hasClients()) {
        const { exec } = await import("node:child_process");
        exec(`open -a "Google Chrome" "${url}" 2>/dev/null || open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || true`);
        const ready = await waitForReady(() => srv.hasClients(), 15000);
        return { ready, url };
      }
      return { ready: true, url };
    },
    send(message) {
      return srv.sendSpec(message);
    },
    hasClients() {
      return srv.hasClients();
    },
    close() {
      srv.close();
      browser = null;
    },
  };
}

// -- Shared dispatch --

export function rewriteImagePaths(spec: Spec, port: number): Spec {
  const elements = { ...spec.elements };
  for (const [id, el] of Object.entries(elements)) {
    if (el.type === "Image" && typeof el.props?.src === "string" && el.props.src.startsWith("/")) {
      const encoded = Buffer.from(el.props.src).toString("base64url");
      elements[id] = {
        ...el,
        props: { ...el.props, src: `http://localhost:${port}/files/${encoded}` },
      };
    }
  }
  return { ...spec, elements };
}

export { closePane };
