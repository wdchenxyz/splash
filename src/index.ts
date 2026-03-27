import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createIPCServer, type RenderMessage, type AddSeriesMessage } from "./ipc.js";
import { createBrowserServer } from "./browser-server.js";
import { ensurePane, closePane } from "./tmux-manager.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const server = new McpServer({
  name: "splash",
  version: "0.1.0",
});

// -- Shared spec schema --

const specSchema = z.object({
  root: z.string().describe("ID of the root element"),
  elements: z
    .record(z.string(), z.unknown())
    .describe("Map of element IDs to element definitions"),
});

const stateSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe("Dynamic state values referenced by $state in the spec");

const modeSchema = z
  .enum(["replace", "append", "clear"])
  .optional()
  .describe("replace (default): replace current content. append: add below existing. clear: remove all content.");

const chartIdSchema = z
  .string()
  .optional()
  .describe("Optional ID for the chart, used to target it with add_series later.");

// -- Tmux renderer --

let ipc: ReturnType<typeof createIPCServer> | null = null;

async function getIPC() {
  if (!ipc) {
    ipc = createIPCServer();
    await ipc.listening;
  }
  return ipc;
}

async function waitForClient(ipc: ReturnType<typeof createIPCServer>, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (ipc.hasClients()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return ipc.hasClients();
}

server.tool(
  "render-tmux",
  "Render a json-render spec in a tmux pane. Displays charts, tables, and dashboards in the terminal using braille/block characters.",
  {
    spec: specSchema,
    state: stateSchema,
    title: z.string().optional().describe("Title for the pane"),
    position: z
      .enum(["right", "bottom"])
      .optional()
      .describe("Pane position (default: right)"),
    size: z
      .number()
      .optional()
      .describe("Pane size as percentage (default: 40)"),
    mode: modeSchema,
    chartId: chartIdSchema,
  },
  async ({ spec, state, title, position, size, mode, chartId }) => {
    try {
      const ipcServer = await getIPC();
      await ensurePane({ position, size, socketPath: ipcServer.socketPath });

      if (!(await waitForClient(ipcServer))) {
        return err("Renderer failed to connect within timeout. Is the tmux pane running?");
      }

      const message: RenderMessage = {
        type: "render",
        spec,
        mode: mode ?? "replace",
        ...(state && { state }),
        ...(chartId && { chartId }),
      };

      if (!ipcServer.sendSpec(message)) {
        return err("No renderer connected. The tmux pane may have crashed.");
      }

      return ok(`Rendered successfully${title ? `: ${title}` : ""}.`);
    } catch (error) {
      return err(`Error: ${toErrorMessage(error)}`);
    }
  }
);

server.tool(
  "close-tmux",
  "Close the tmux rendering pane.",
  async () => {
    try {
      await closePane();
      return ok("Render pane closed.");
    } catch (error) {
      return err(`Error closing pane: ${toErrorMessage(error)}`);
    }
  }
);

// -- Browser renderer --

let browser: ReturnType<typeof createBrowserServer> | null = null;

function getBrowser() {
  if (!browser) {
    browser = createBrowserServer();
  }
  return browser;
}

async function waitForBrowserClient(srv: ReturnType<typeof createBrowserServer>, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (srv.hasClients()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return srv.hasClients();
}

server.tool(
  "render-browser",
  "Render a json-render spec in a browser page at localhost:3456. Opens charts, tables, and dashboards with SVG rendering in a local browser window.",
  {
    spec: specSchema,
    state: stateSchema,
    title: z.string().optional().describe("Title for the visualization"),
    mode: modeSchema,
    chartId: chartIdSchema,
  },
  async ({ spec, state, title, mode, chartId }) => {
    try {
      const srv = getBrowser();
      const url = await srv.start();

      const message: RenderMessage = {
        type: "render",
        spec,
        mode: mode ?? "replace",
        ...(state && { state }),
        ...(chartId && { chartId }),
      };

      if (!srv.hasClients()) {
        const { exec } = await import("node:child_process");
        exec(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || true`);

        if (!(await waitForBrowserClient(srv))) {
          srv.sendSpec(message);
          return ok(`Browser opened at ${url}. Waiting for connection — refresh if needed.`);
        }
      }

      if (!srv.sendSpec(message)) {
        return err("No browser connected. Open " + url + " in your browser.");
      }

      return ok(`Rendered in browser${title ? `: ${title}` : ""} at ${url}`);
    } catch (error) {
      return err(`Error: ${toErrorMessage(error)}`);
    }
  }
);

server.tool(
  "close-browser",
  "Stop the browser rendering server.",
  async () => {
    try {
      browser?.close();
      browser = null;
      return ok("Browser server stopped.");
    } catch (error) {
      return err(`Error: ${toErrorMessage(error)}`);
    }
  }
);

// -- Shared tools --

server.tool(
  "add-series",
  "Add a data series to an existing LineChart. Broadcasts to all active renderers (tmux and browser).",
  {
    chartId: z
      .string()
      .optional()
      .describe("ID of the chart to add to. If omitted, adds to the last rendered chart."),
    data: z
      .array(z.number())
      .describe("Array of numeric data points for the new series."),
    label: z.string().optional().describe("Legend label for the series."),
    color: z
      .string()
      .optional()
      .describe("Color for the series (e.g. cyan, yellow, red, magenta)."),
    fill: z
      .boolean()
      .optional()
      .describe("Whether to fill below the line."),
  },
  async ({ chartId, data, label, color, fill }) => {
    try {
      const message: AddSeriesMessage = {
        type: "add_series",
        chartId,
        series: { data, label, color, fill },
      };

      let sent = false;

      if (ipc?.hasClients()) {
        sent = ipc.sendSpec(message) || sent;
      }

      if (browser?.hasClients()) {
        sent = browser.sendSpec(message) || sent;
      }

      if (!sent) {
        return err("No renderer connected. Render a chart first.");
      }

      return ok(`Added series${label ? ` "${label}"` : ""} to chart${chartId ? ` "${chartId}"` : ""}.`);
    } catch (error) {
      return err(`Error: ${toErrorMessage(error)}`);
    }
  }
);

// -- Lifecycle --

async function cleanup() {
  ipc?.close();
  browser?.close();
  await closePane();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("splash MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
