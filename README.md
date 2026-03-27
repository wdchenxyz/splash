# Splash

MCP server for rendering data visualizations and images in the terminal (tmux) and browser. Built on [json-render](https://github.com/vercel-labs/json-render) specs.

## Features

- **Charts**: Line charts, histograms, heatmaps, sparklines, bar charts
- **Tables**: Structured tabular data with column alignment
- **Dashboards**: Composable layouts with cards, headings, badges, status lines
- **Images**: Render local image files (PNG, JPEG, GIF, WebP, SVG)
- **Dual rendering**: Same spec renders in both tmux (braille/block characters) and browser (SVG/HTML)

## Requirements

- Node.js 20+
- tmux (for terminal rendering)
- Ghostty or Kitty terminal (for image rendering in tmux, with `tmux set -g allow-passthrough all`)

## Setup

```bash
pnpm install
pnpm build
```

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "splash": {
      "command": "node",
      "args": ["/absolute/path/to/splash/dist/index.js"]
    }
  }
}
```

## Renderers

### Terminal (`render-tmux`)

Renders in a tmux split pane using braille/block characters for charts and Kitty graphics protocol (Unicode placeholders) for images.

### Browser (`render-browser`)

Renders at `localhost:3456` using SVG charts, shadcn/ui components, and `<img>` tags for images. Local files are served via a built-in `/files/` HTTP endpoint. Auto-opens the browser on first call.

## MCP Tools

| Tool | Description |
|------|-------------|
| `render-tmux` | Render spec in a tmux pane |
| `render-browser` | Render spec in a browser page |
| `add-series` | Add data series to an existing LineChart (broadcasts to all renderers) |
| `close-tmux` | Close the tmux rendering pane |
| `close-browser` | Stop the browser server |

### `render-tmux`

| Parameter  | Type   | Default     | Description |
|------------|--------|-------------|-------------|
| `spec`     | object | (required)  | json-render spec with `root` and `elements` |
| `state`    | object | `{}`        | Dynamic state values referenced via `$state` |
| `title`    | string | —           | Display title for the pane |
| `position` | string | `"right"`   | Pane placement: `"right"` or `"bottom"` |
| `size`     | number | `40`        | Pane size as percentage |
| `mode`     | string | `"replace"` | `"replace"`, `"append"`, or `"clear"` |
| `chartId`  | string | —           | ID for targeting with `add-series` |

### `render-browser`

| Parameter  | Type   | Default     | Description |
|------------|--------|-------------|-------------|
| `spec`     | object | (required)  | json-render spec with `root` and `elements` |
| `state`    | object | `{}`        | Dynamic state values referenced via `$state` |
| `title`    | string | —           | Title for the visualization |
| `mode`     | string | `"replace"` | `"replace"`, `"append"`, or `"clear"` |
| `chartId`  | string | —           | ID for targeting with `add-series` |

### `add-series`

| Parameter | Type     | Default    | Description |
|-----------|----------|------------|-------------|
| `chartId` | string   | —          | Chart to target (last rendered if omitted) |
| `data`    | number[] | (required) | Data points for the series |
| `label`   | string   | —          | Legend label |
| `color`   | string   | —          | Series color (e.g. `"cyan"`, `"#ef4444"`) |
| `fill`    | boolean  | —          | Fill area below the line |

## Components

### Data Visualization

| Component | Key Props |
|-----------|-----------|
| `LineChart` | `data`, `series`, `width`, `height`, `label`, `color`, `fill`, `showAxis` |
| `Histogram` | `data`, `bins`, `width`, `label`, `color`, `showValues` |
| `Heatmap` | `data` (2D array), `xLabels`, `yLabels`, `color`, `showValues`, `cellWidth` |
| `Sparkline` | `data`, `width`, `label`, `color`, `min`, `max` |
| `BarChart` | `data` (label/value pairs), `width` |

### Images

| Component | Key Props |
|-----------|-----------|
| `Image` | `src` (absolute file path), `alt`, `width`, `height` |

- **Browser**: `src` is rewritten to `http://localhost:PORT/files/<encoded-path>` and rendered as `<img>`.
- **Tmux**: Image uploaded via Kitty graphics protocol, displayed using Unicode placeholders. `width`/`height` are terminal cell units (default: 40x15).

### Layout & Content

`Box`, `Card`, `Heading`, `Text`, `Badge`, `Table`, `Metric`, `KeyValue`, `StatusLine`, `ProgressBar`, `List`, `Markdown`, `Callout`, `Timeline`, `Divider`, `Spinner`

## Example

```json
{
  "spec": {
    "root": "layout",
    "elements": {
      "layout": {
        "type": "Box",
        "props": { "flexDirection": "column" },
        "children": ["img", "chart"]
      },
      "img": {
        "type": "Image",
        "props": { "src": "/tmp/screenshot.png", "alt": "Debug capture", "width": 30, "height": 8 }
      },
      "chart": {
        "type": "LineChart",
        "props": { "data": [3, 7, 2, 9, 4, 6, 8, 1, 5], "label": "Errors/min", "color": "cyan" }
      }
    }
  }
}
```

## Architecture

```
Claude / MCP Client
    |
    v
MCP Server (src/index.ts)
    |
    +-- Unix Socket IPC --> Tmux Renderer (React Ink)
    |                        - Braille/block charts
    |                        - Kitty Unicode placeholders for images
    |
    +-- WebSocket ---------> Browser Renderer (React DOM)
                              - SVG charts
                              - shadcn/ui components
                              - <img> tags for images (via /files/ endpoint)
```

## Development

```bash
pnpm dev    # Watch mode
pnpm build  # Production build
```

Build outputs:
- `dist/index.js` — MCP server (Node.js, ESM)
- `dist/renderer.js` — Tmux renderer (Node.js, ESM)
- `dist/app.global.js` — Browser app (IIFE, bundled)
