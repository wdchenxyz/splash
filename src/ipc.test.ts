import { describe, it, expect, afterEach } from "vitest";
import { createIPCServer, connectClient } from "./ipc.js";
import path from "node:path";
import os from "node:os";

function uniqueSocket(): string {
  return path.join(os.tmpdir(), `splash-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

describe("IPC reconnect", () => {
  let server: ReturnType<typeof createIPCServer> | null = null;

  afterEach(() => {
    server?.close();
    server = null;
  });

  it("connectClient resolves on successful connection", async () => {
    const socketPath = uniqueSocket();
    server = createIPCServer(socketPath);
    await server.listening;

    const messages: unknown[] = [];
    const socket = await connectClient((msg) => messages.push(msg), socketPath);
    expect(socket).toBeTruthy();
    socket.destroy();
  });

  it("connectClient calls onDisconnect when server closes", async () => {
    const socketPath = uniqueSocket();
    server = createIPCServer(socketPath);
    await server.listening;

    let disconnected = false;
    const socket = await connectClient(
      () => {},
      socketPath,
      () => { disconnected = true; }
    );

    // Close server to trigger disconnect
    server.close();
    server = null;

    // Wait for disconnect callback
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (disconnected) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });

    expect(disconnected).toBe(true);
  });

  it("delivers messages before disconnect", async () => {
    const socketPath = uniqueSocket();
    server = createIPCServer(socketPath);
    await server.listening;

    const messages: unknown[] = [];
    let disconnected = false;

    await connectClient(
      (msg) => messages.push(msg),
      socketPath,
      () => { disconnected = true; }
    );

    // Wait for client to register
    await new Promise((r) => setTimeout(r, 100));

    // Send a message
    server.sendSpec({ type: "render", spec: { root: "a", elements: {} }, mode: "replace" });

    // Wait for delivery
    await new Promise((r) => setTimeout(r, 200));
    expect(messages.length).toBe(1);
    expect((messages[0] as any).type).toBe("render");

    // Close server
    server.close();
    server = null;

    await new Promise((r) => setTimeout(r, 500));
    expect(disconnected).toBe(true);
  });

  it("rejects on connection failure without calling onDisconnect", async () => {
    const socketPath = uniqueSocket(); // No server listening
    let disconnected = false;

    await expect(
      connectClient(() => {}, socketPath, () => { disconnected = true; })
    ).rejects.toThrow();

    expect(disconnected).toBe(false);
  });
});
