import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createIPCServer, type SpecMessage } from "./ipc.js";
import { ensurePane, closePane } from "./tmux-manager.js";

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

// Wait for the renderer to connect after spawning a pane
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

      // Ensure tmux pane is running
      ensurePane({ position, size });

      // Wait for the renderer to connect
      const connected = await waitForClient(ipcServer);
      if (!connected) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Renderer failed to connect within timeout. Is the tmux pane running?",
            },
          ],
          isError: true,
        };
      }

      // Send the spec
      const message: SpecMessage = { type: "render", spec, mode: mode ?? "replace" };
      if (state) message.state = state;
      if (chartId) message.chartId = chartId;

      const sent = ipcServer.sendSpec(message);

      if (!sent) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No renderer connected. The tmux pane may have crashed.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered successfully${title ? `: ${title}` : ""}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
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
        return {
          content: [
            { type: "text" as const, text: "No renderer connected. Render a chart first." },
          ],
          isError: true,
        };
      }

      const message: SpecMessage = {
        type: "add_series",
        chartId,
        series: { data, label, color, fill },
      };

      const sent = ipcServer.sendSpec(message);

      if (!sent) {
        return {
          content: [
            { type: "text" as const, text: "Failed to send to renderer." },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Added series${label ? ` "${label}"` : ""} to chart${chartId ? ` "${chartId}"` : ""}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "close_render",
  "Close the terminal rendering pane.",
  async () => {
    try {
      closePane();
      return {
        content: [
          { type: "text" as const, text: "Render pane closed." },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error closing pane: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Cleanup on exit
process.on("SIGINT", () => {
  ipc?.close();
  closePane();
  process.exit(0);
});

process.on("SIGTERM", () => {
  ipc?.close();
  closePane();
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("splash MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
