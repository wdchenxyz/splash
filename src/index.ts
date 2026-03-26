import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createIPCServer, type RenderMessage, type AddSeriesMessage } from "./ipc.js";
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
  "render",
  "Render a json-render spec in a tmux pane. Use this to display charts, tables, sparklines, and other data visualizations in the terminal.",
  {
    spec: z.object({
      root: z.string().describe("ID of the root element"),
      elements: z
        .record(z.string(), z.unknown())
        .describe("Map of element IDs to element definitions"),
    }),
    state: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Dynamic state values referenced by $state in the spec"),
    title: z.string().optional().describe("Title for the pane"),
    position: z
      .enum(["right", "bottom"])
      .optional()
      .describe("Pane position (default: right)"),
    size: z
      .number()
      .optional()
      .describe("Pane size as percentage (default: 40)"),
    mode: z
      .enum(["replace", "append", "clear"])
      .optional()
      .describe("replace (default): replace current content. append: add below existing. clear: remove all content."),
    chartId: z
      .string()
      .optional()
      .describe("Optional ID for the chart, used to target it with add_series later."),
  },
  async ({ spec, state, title, position, size, mode, chartId }) => {
    try {
      const ipcServer = await getIPC();
      await ensurePane({ position, size });

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
  "add_series",
  "Add a data series to an existing LineChart in the render pane. No need to resend existing data.",
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
      const ipcServer = await getIPC();

      if (!ipcServer.hasClients()) {
        return err("No renderer connected. Render a chart first.");
      }

      const message: AddSeriesMessage = {
        type: "add_series",
        chartId,
        series: { data, label, color, fill },
      };

      if (!ipcServer.sendSpec(message)) {
        return err("Failed to send to renderer.");
      }

      return ok(`Added series${label ? ` "${label}"` : ""} to chart${chartId ? ` "${chartId}"` : ""}.`);
    } catch (error) {
      return err(`Error: ${toErrorMessage(error)}`);
    }
  }
);

server.tool(
  "close_render",
  "Close the terminal rendering pane.",
  async () => {
    try {
      await closePane();
      return ok("Render pane closed.");
    } catch (error) {
      return err(`Error closing pane: ${toErrorMessage(error)}`);
    }
  }
);

async function cleanup() {
  ipc?.close();
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
