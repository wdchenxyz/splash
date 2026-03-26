import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let managedPaneId: string | null = null;

export interface PaneOptions {
  position?: "right" | "bottom";
  size?: number; // percentage, default 40
}

async function isTmux(): Promise<boolean> {
  return !!process.env.TMUX;
}

async function paneExists(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await exec("tmux", ["list-panes", "-F", "#{pane_id}"]);
    return stdout.includes(paneId);
  } catch {
    return false;
  }
}

export async function ensurePane(options: PaneOptions = {}): Promise<string> {
  if (!(await isTmux())) {
    throw new Error(
      "Not running inside tmux. Start Claude Code in a tmux session to use terminal rendering."
    );
  }

  if (managedPaneId && (await paneExists(managedPaneId))) {
    return managedPaneId;
  }

  const { position = "right", size = 40 } = options;
  const rendererPath = path.join(__dirname, "renderer.js");
  const splitFlag = position === "right" ? "-h" : "-v";

  const { stdout } = await exec("tmux", [
    "split-window", "-d", splitFlag, "-p", String(size),
    "-P", "-F", "#{pane_id}",
    `node ${rendererPath}`,
  ]);

  managedPaneId = stdout.trim();
  return managedPaneId;
}

export async function closePane(): Promise<void> {
  if (managedPaneId) {
    try {
      await exec("tmux", ["kill-pane", "-t", managedPaneId]);
    } catch {
      // pane may already be gone
    }
    managedPaneId = null;
  }
}

export function getManagedPaneId(): string | null {
  return managedPaneId;
}
