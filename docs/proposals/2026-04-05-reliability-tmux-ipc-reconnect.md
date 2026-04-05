## Reliability: Reconnect the Tmux Renderer After IPC Disconnects

### Problem
Splash's tmux renderer only retries while the initial IPC connection is being established. In [`src/renderer.tsx:92`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L92) to [`src/renderer.tsx:116`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L116), `connectClient()` is called inside a retry loop, but the success path only sets `connected` and clears `error`. The returned socket is discarded, there is no `close` listener, and there is no path that flips the UI back to `Connecting...` or re-runs `connect()` after a successful connection later drops.

The IPC client helper also exposes no lifecycle hook for post-connect disconnects. [`src/ipc.ts:88`](/Users/wdchen/Workspace/splash/src/ipc.ts#L88) to [`src/ipc.ts:115`](/Users/wdchen/Workspace/splash/src/ipc.ts#L115) resolves once on `net.createConnection`, forwards newline-delimited messages, and only rejects on pre-connect socket errors. If the MCP server restarts, closes the socket, or rotates the Unix socket path, the tmux renderer currently has no recovery path and will sit in a stale connected state until the pane is manually recreated.

The browser renderer already handles this class of failure. In [`src/app/index.tsx:137`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L137) to [`src/app/index.tsx:162`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L162), the WebSocket client listens for `onclose`, marks itself disconnected, and schedules a reconnect. The tmux path lacks equivalent behavior, and there are no tests covering IPC disconnect recovery anywhere in the current suite.

### Proposed Change
- Modify [`src/ipc.ts`](/Users/wdchen/Workspace/splash/src/ipc.ts) so the tmux-side client helper exposes socket lifecycle events after the initial connection succeeds. The smallest slice is either:
  - return the connected `net.Socket` and let the renderer attach `close` / `error` handlers, or
  - add an options object such as `connectClient({ onMessage, onDisconnect })` and keep the socket private.
- Update [`src/renderer.tsx`](/Users/wdchen/Workspace/splash/src/renderer.tsx) so the tmux app tracks the active socket and mirrors the browser reconnect loop:
  - set `connected` to `false` when the socket closes after a successful connection
  - schedule bounded reconnect attempts after disconnect, not only after initial startup failure
  - clear retry timers and destroy the old socket during unmount to avoid duplicate reconnect loops
  - reset any terminal error banner once a new connection succeeds
- Add focused reliability coverage, most likely in a new IPC/renderer test file, that simulates:
  - successful initial connection followed by socket close, proving reconnect is attempted
  - reconnect success restoring `connected` state
  - bounded retry behavior still surfacing a stable error when the server never comes back
- No migration is required. This only makes the existing tmux pane self-healing when the MCP process or IPC server disappears and returns.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: Today a transient IPC disconnect leaves terminal users with a dead pane that looks healthy but never renders again. Reconnect support makes tmux rendering behave like the browser path and removes a manual recovery step from normal development workflows.

### Dependencies
No prerequisite refactor is required. This can land independently, although the later shared-render-contract refactor should reuse the same IPC lifecycle surface instead of reintroducing duplicate client wrappers.
