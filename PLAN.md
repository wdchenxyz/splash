# Plan: json-render Terminal MCP Server

## Context

**Problem:** We want Claude Code to render data visualizations (charts, tables, sparklines) in the terminal when fetching GCP monitoring data or other data sources.

**Why not use json-render's built-in MCP?** The `@json-render/mcp` package renders into an iframe (MCP Apps), which works in Claude Desktop/VS Code but **not in Claude Code CLI** (terminal-only).

**Solution:** Build a custom stdio MCP server that accepts json-render specs and renders them using `@json-render/ink` (React Ink) into a tmux pane.

## Architecture

```
Claude Code CLI (tmux pane 0)
    │ calls MCP tool "render" with JSON spec
    ▼
MCP Server (stdio, in Claude Code's process)
    │ sends spec via Unix socket
    ▼
Renderer (Ink app in a tmux split pane)
    │ renders Sparkline, BarChart, Table, etc.
    ▼
Terminal UI output
```

Two separate processes communicate over a Unix domain socket (`/tmp/json-render-terminal.sock`):
- **MCP server** — long-lived, stdio transport, registered in Claude Code settings
- **Ink renderer** — spawned in a tmux pane, stays alive, re-renders on each new spec

## Project Location

`~/sides/json-render-terminal/`

## File Structure

```
json-render-terminal/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts          # MCP server entry (stdio)
│   ├── renderer.tsx      # Ink app (runs in tmux pane)
│   ├── tmux-manager.ts   # Tmux pane lifecycle
│   ├── ipc.ts            # Unix socket IPC
│   └── catalog.ts        # json-render ink catalog
```

## Implementation Steps

### Step 1: Scaffold the project

Create `~/sides/json-render-terminal/` with:
- `package.json` — dependencies: `@modelcontextprotocol/sdk`, `@json-render/core`, `@json-render/ink`, `ink`, `react`, `zod`; devDeps: `typescript`, `tsup`, `@types/react`, `@types/node`
- `tsconfig.json` — ESNext, NodeNext, JSX react-jsx
- `tsup.config.ts` — two entry points: `src/index.ts` → `dist/index.js`, `src/renderer.tsx` → `dist/renderer.js`

### Step 2: Implement IPC (`src/ipc.ts`)

Unix domain socket at `/tmp/json-render-terminal.sock`:
- `createServer(socketPath)` — MCP server side; returns `sendSpec(spec, state)` that writes newline-delimited JSON to connected clients
- `connectClient(socketPath, onSpec)` — renderer side; calls `onSpec(data)` on each incoming spec
- Cleanup stale socket file on startup

### Step 3: Implement tmux manager (`src/tmux-manager.ts`)

- `ensurePane(options)` — checks if a pane with title `json-render` exists via `tmux list-panes`; if not, creates one with `tmux split-window` running `node dist/renderer.js`
- `closePane()` — kills the managed pane
- Tracks pane ID in module-level state
- Supports `position: "right" | "bottom"` and `size` (percentage)

### Step 4: Implement catalog (`src/catalog.ts`)

Import and re-export `@json-render/ink` standard component and action definitions. Available components:
- **Data viz:** Sparkline, BarChart, Table, ProgressBar
- **Layout:** Box, Card, Heading, Divider, Spacer
- **Content:** Text, Badge, KeyValue, List/ListItem, StatusLine, Markdown
- **Interactive:** Select, TextInput, Tabs

### Step 5: Implement renderer (`src/renderer.tsx`)

Ink React app that:
1. Connects to Unix socket on startup
2. Shows "Waiting for data..." initially
3. On receiving a spec, renders it using `@json-render/ink` renderer
4. Each new spec replaces the previous render (React state update)
5. Stays alive indefinitely (Ink keeps event loop open)

### Step 6: Implement MCP server (`src/index.ts`)

Stdio-based MCP server with two tools:

**`render` tool** — accepts:
```typescript
{
  spec: { root: string, elements: Record<string, Element> },
  state?: Record<string, any>,
  title?: string,
  position?: "right" | "bottom",  // default: "right"
  size?: number                    // default: 40 (percentage)
}
```
Handler: ensures tmux pane → sends spec via IPC → returns success message.

**`close_render` tool** — no params, kills the tmux pane and cleans up socket.

### Step 7: Build and configure

1. Run `pnpm build` (tsup)
2. Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "json-render-terminal": {
      "command": "node",
      "args": ["/Users/wchen14/sides/json-render-terminal/dist/index.js"]
    }
  }
}
```

### Step 8: Write skill file

Create skill at `~/.claude/skills/json-render-terminal/` that documents:
- All available Ink components and their props
- The JSON spec format (root + elements map)
- Example specs for each component type (Sparkline, BarChart, Table, etc.)
- Composition patterns for multi-widget dashboards
- When to use which component for different data types

## Key Reference: json-render Spec Format

```typescript
// The spec is a flat map of elements with a root pointer
{
  root: "dashboard",        // ID of the top-level element
  elements: {
    "dashboard": {
      type: "Box",
      props: { flexDirection: "column" },
      children: ["title", "chart", "table"]
    },
    "title": {
      type: "Heading",
      props: { level: 1, text: "Service Metrics" }
    },
    "chart": {
      type: "Sparkline",
      props: { data: [1, 4, 2, 8, 5, 3, 7], title: "Requests/sec" }
    },
    "table": {
      type: "Table",
      props: {
        columns: ["Service", "Status", "Latency"],
        rows: [["api", "healthy", "45ms"]]
      }
    }
  }
}
```

### Dynamic values with $state:
```typescript
{
  spec: { /* elements referencing { "$state": "/metrics/cpu" } */ },
  state: { metrics: { cpu: [1, 4, 2, 8] } }
}
```

## Key Reference: @json-render/ink Component Props

| Component | Key Props |
|-----------|-----------|
| Sparkline | `data: number[], title?: string` |
| BarChart | `data: {label: string, value: number}[]` |
| Table | `columns: string[], rows: string[][]` |
| ProgressBar | `value: number (0-1), title?: string` |
| KeyValue | `items: {key: string, value: string}[]` |
| Card | `title?: string, children` |
| Heading | `level: 1-4, text: string` |
| Badge | `text: string, color?: string` |
| StatusLine | `items: {label: string, value: string}[]` |
| List/ListItem | `ordered?: boolean, children` |
| Divider | `title?: string` |
| Markdown | `content: string` |

## Verification

1. Start Claude Code in a tmux session
2. Ask: "Show me a sparkline of [1, 4, 2, 8, 5, 3, 7]"
3. Verify: tmux pane opens to the right with a rendered sparkline
4. Ask: "Now show me a table with service health data"
5. Verify: the pane re-renders with the new table (no new pane)
6. Ask: "Close the render pane"
7. Verify: pane is killed cleanly

## Risks / Open Questions

- **json-render is new** — API may be unstable; pin versions in package.json
- **Ink + json-render/ink compatibility** — need to verify the renderer actually works with the standard catalog before building the full MCP wrapper (do this first in Step 5)
- **Socket race condition** — renderer needs a moment to start and connect; MCP server should retry sending for ~2s after spawning a new pane
- **IMPORTANT:** Use Context7 MCP to check latest `@json-render/ink` and `@modelcontextprotocol/sdk` docs before implementing — APIs may differ from what's described here
