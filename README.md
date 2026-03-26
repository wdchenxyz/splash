# Splash

Terminal data visualizations for Claude Code. An MCP server that renders charts, tables, and sparklines in a tmux split pane using [json-render](https://github.com/vercel-labs/json-render) specs.

## Requirements

- Node.js 20+
- tmux (must be running inside a tmux session)

## Setup

### Install & Build

```bash
npm install
npm run build
```

### Add to Claude Code

Add the following to your Claude Code MCP settings (`~/.claude/settings.json`):

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

Replace `/absolute/path/to/splash` with the actual path to this project.

Alternatively, add it to a project-scoped `.claude/settings.json` in your repo.

## MCP Tools

### `render`

Renders a json-render spec in a tmux pane.

| Parameter  | Type   | Default     | Description                                        |
|------------|--------|-------------|----------------------------------------------------|
| `spec`     | object | (required)  | json-render spec with `root` and `elements`        |
| `state`    | object | `{}`        | Dynamic state values referenced via `$state`       |
| `title`    | string | `""`        | Display title for the pane                         |
| `position` | string | `"right"`   | Pane placement: `"right"` or `"bottom"`            |
| `size`     | number | `40`        | Pane size as percentage                            |
| `mode`     | string | `"replace"` | `"replace"`, `"append"`, or `"clear"`              |
| `chartId`  | string | —           | ID for targeting with `add_series`                 |

**Example spec:**

```json
{
  "spec": {
    "root": "chart",
    "elements": {
      "chart": {
        "type": "LineChart",
        "props": {
          "data": [1, 4, 2, 8, 5, 3, 7],
          "label": "Requests/sec"
        }
      }
    }
  }
}
```

### `add_series`

Adds a data series to an existing LineChart.

| Parameter | Type     | Default | Description                              |
|-----------|----------|---------|------------------------------------------|
| `chartId` | string   | —       | Chart to target (last rendered if omitted)|
| `data`    | number[] | (required) | Data points for the series            |
| `label`   | string   | —       | Legend label                             |
| `color`   | string   | —       | Series color (e.g. `"cyan"`, `"red"`)    |
| `fill`    | boolean  | —       | Fill area below the line                 |

### `close_render`

Closes the rendering pane and cleans up resources.

## Components

### Standard (from `@json-render/ink`)

`Sparkline`, `BarChart`, `Table`, `ProgressBar`, `Box`, `Card`, `Heading`, `Text`, `Badge`, `KeyValue`, `List`, `Markdown`, and more.

### Custom

- **`LineChart`** — Multi-series line chart with braille rendering. Supports `data`, `series`, `width`, `height`, `showAxis`.
- **`Heatmap`** — 2D heatmap with color gradients. Supports `data`, `xLabels`, `yLabels`, `color`, `showValues`.
- **`Histogram`** — Binned frequency distribution with statistics (n, mean, stddev). Supports `data`, `bins`, `color`, `showValues`.

## Architecture

Two-process model communicating over a Unix domain socket (`/tmp/splash.sock`):

1. **MCP Server** (`src/index.ts`) — registers with Claude Code via stdio, manages tmux pane lifecycle, forwards specs to the renderer.
2. **Renderer** (`src/renderer.tsx`) — spawned in a tmux split pane, renders json-render specs using React Ink.

## Development

```bash
npm run dev    # watch mode
npm run build  # production build
```
