## DX / Ergonomics: Make Render Titles Actually Reach The Renderer

### Problem
Splash exposes a `title` parameter on both render tools and documents it as real renderer output, but the current implementation only echoes that value back in the success string. [`src/index.ts:97`](/Users/wdchen/Workspace/splash/src/index.ts#L97) to [`src/index.ts:131`](/Users/wdchen/Workspace/splash/src/index.ts#L131) accepts `title` for `render-tmux`, yet the value is never passed into `ensurePane()` or the IPC `RenderMessage`; the only effect is `Rendered successfully: ...`. The browser path has the same issue in [`src/index.ts:177`](/Users/wdchen/Workspace/splash/src/index.ts#L177) to [`src/index.ts:212`](/Users/wdchen/Workspace/splash/src/index.ts#L212): `title` is accepted and echoed in the success text, but the outgoing `RenderMessage` still contains only `spec`, `state`, `mode`, and `chartId`.

The renderer side confirms that `title` is dead metadata today. The shared IPC contract in [`src/ipc.ts:13`](/Users/wdchen/Workspace/splash/src/ipc.ts#L13) to [`src/ipc.ts:19`](/Users/wdchen/Workspace/splash/src/ipc.ts#L19) has no `title` field, the browser shell hardcodes `<title>Splash</title>` in [`src/browser-server.ts:34`](/Users/wdchen/Workspace/splash/src/browser-server.ts#L34) to [`src/browser-server.ts:40`](/Users/wdchen/Workspace/splash/src/browser-server.ts#L40), and tmux pane creation in [`src/tmux-manager.ts:40`](/Users/wdchen/Workspace/splash/src/tmux-manager.ts#L40) to [`src/tmux-manager.ts:52`](/Users/wdchen/Workspace/splash/src/tmux-manager.ts#L52) never sets a pane title at all. README still describes `title` as "Display title for the pane" and "Title for the visualization" in [`README.md:61`](/Users/wdchen/Workspace/splash/README.md#L61) to [`README.md:79`](/Users/wdchen/Workspace/splash/README.md#L79), so the public API currently promises behavior that does not exist.

### Proposed Change
- Extend the shared render contract in [`src/ipc.ts`](/Users/wdchen/Workspace/splash/src/ipc.ts) with an optional `title` field on `RenderMessage`, and thread it through both tool handlers in [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts) so the renderer receives the same title the MCP caller provided.
- Make browser titles real instead of static:
  - keep the HTML shell default as `Splash`
  - update [`src/app/index.tsx`](/Users/wdchen/Workspace/splash/src/app/index.tsx) so each incoming `render` message applies `document.title = message.title ?? "Splash"`
  - preserve the fallback title after `clear` or reconnect so tabs do not get stuck with stale labels
- Make tmux titles real instead of purely textual:
  - add a small helper in [`src/tmux-manager.ts`](/Users/wdchen/Workspace/splash/src/tmux-manager.ts) to run `tmux select-pane -T`
  - call it when creating or reusing the managed pane so repeated `render-tmux` calls can refresh the pane title without recreating the pane
  - default the pane title to `Splash` when the user omits `title`, so the pane remains identifiable
- Add focused validation:
  - a browser-side test that asserts `document.title` follows `RenderMessage.title`
  - a tmux-manager unit test that locks down the `select-pane -T` command wiring
  - one MCP-layer test that confirms `render-browser` and `render-tmux` both include `title` in the render payload
- No migration is required. Existing callers can keep sending the same payloads; the change only makes a documented parameter behave as advertised.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This removes a misleading API surface and turns `title` into a useful affordance for browser tab management and tmux-pane identification, which matters immediately when users keep multiple Splash views open.

### Dependencies
No prerequisite work is required. This should land before broader README cleanup so the docs can describe actual title behavior instead of the current no-op.
