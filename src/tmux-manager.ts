import { execSync, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let managedPaneId: string | null = null;

export interface PaneOptions {
  position?: "right" | "bottom";
  size?: number; // percentage, default 40
}

function isTmux(): boolean {
  return !!process.env.TMUX;
}

function paneExists(paneId: string): boolean {
  try {
    const output = execSync("tmux list-panes -F '#{pane_id}'", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.includes(paneId);
  } catch {
    return false;
  }
}

export function ensurePane(options: PaneOptions = {}): string {
  if (!isTmux()) {
    throw new Error(
      "Not running inside tmux. Start Claude Code in a tmux session to use terminal rendering."
    );
  }

  // Check if existing pane is still alive
  if (managedPaneId && paneExists(managedPaneId)) {
    return managedPaneId;
  }

  const { position = "right", size = 40 } = options;
  const rendererPath = path.join(__dirname, "renderer.js");

  const splitFlag = position === "right" ? "-h" : "-v";
  const cmd = `tmux split-window ${splitFlag} -p ${size} -P -F '#{pane_id}' 'node ${rendererPath}'`;

  const paneId = execSync(cmd, { encoding: "utf-8" }).trim();
  managedPaneId = paneId;

  return paneId;
}

export function closePane(): void {
  if (managedPaneId) {
    try {
      execSync(`tmux kill-pane -t ${managedPaneId}`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // pane may already be gone
    }
    managedPaneId = null;
  }
}

export function getManagedPaneId(): string | null {
  return managedPaneId;
}
