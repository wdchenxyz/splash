# Image Rendering in Splash

## Goal

Extend splash to render local image files (screenshots, PNGs, etc.) in both the browser and tmux terminal renderers. Images are a new component type (`Image`) composable with all existing components via the existing `render-browser` and `render-tmux` MCP tools — no new tools needed.

## Motivation

When Claude saves screenshots during debugging, users must manually open them. Splash already renders data visualizations inline; adding image support lets it display screenshots alongside charts and tables in the same workflow.

## Architecture

### Data Flow

```
Claude sends spec with Image element (src: "/path/to/screenshot.png")
  -> MCP server intercepts the spec
  -> Browser: rewrites src to http://localhost:PORT/files/<base64url-encoded-path>
  -> Tmux: reads file, base64-encodes, injects as `data` prop
  -> Renderer displays the image
```

### No New MCP Tools

`Image` is registered as a component in both renderer registries. Callers use the existing `render-browser` and `render-tmux` tools with an `Image` element in the spec, just like `LineChart` or `Card`.

## Browser Renderer

### File-Serving Endpoint

Add a route to `browser-server.ts`:

- **Path:** `GET /files/<base64url-encoded-absolute-path>`
- **Behavior:** Decodes the path, validates it is absolute and has an image extension, reads the file, serves with correct `Content-Type`
- **Allowed MIME types:** `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`
- **Security:** Rejects non-absolute paths, non-image extensions, and missing files with appropriate HTTP errors

### Image Component Registration

Register `shadcnComponents.Image` from `@json-render/shadcn` in the browser component map (`src/app/index.tsx`). The existing shadcn Image component renders `<img src=... alt=... width=... height=... className="rounded max-w-full" />` when `src` is provided.

### Path Rewriting

In the MCP server (`src/index.ts`), before sending a `RenderMessage` to the browser server:

1. Walk all elements in `spec.elements`
2. For any element with `type === "Image"` whose `props.src` starts with `/`
3. Rewrite `src` to `http://localhost:<boundPort>/files/<base64url(src)>`

This requires the browser server to expose its bound port.

## Tmux Renderer

### Kitty Graphics Protocol

The tmux `Image` component uses the Kitty graphics protocol to render images inline in the terminal.

**Escape sequence format:**
```
\x1b_Ga=T,f=100,t=d,q=2[,c=<cols>][,r=<rows>];BASE64DATA\x1b\\
```

Key parameters:
- `a=T` — transmit and display
- `f=100` — PNG format
- `t=d` — direct inline base64 transmission
- `q=2` — suppress all terminal responses
- `c`, `r` — optional display size in terminal cells
- `m=0|1` — chunked transfer flag

### tmux DCS Passthrough

When `process.env.TMUX` is set, wrap each Kitty sequence in tmux passthrough:

```
\x1bPtmux;\x1b<inner-with-doubled-ESC>\x1b\\
```

Every `\x1b` in the inner Kitty sequence is doubled to `\x1b\x1b`.

### Chunked Transmission

Large images are split into 4096-byte base64 chunks:
- First chunk: `a=T,f=100,t=d,q=2,m=1;CHUNK1`
- Middle chunks: `m=1;CHUNKN`
- Last chunk: `m=0;CHUNKLAST`

Each chunk is individually wrapped in tmux passthrough when inside tmux.

### Implementation in React Ink

The Image component:
1. Receives `src` (file path), `alt`, `width`, `height` as props
2. Reads the file from disk and base64-encodes it
3. Constructs Kitty graphics escape sequences with chunking
4. Wraps in tmux passthrough if `process.env.TMUX` is set
5. Outputs via Ink's `<Text>` component (raw escape sequences to stdout)
6. Falls back to `[Image: <path>]` text if the file cannot be read

### Prerequisite

Users must enable tmux passthrough: `tmux set -g allow-passthrough on`. This is documented but not auto-configured.

## Spec Format

Images use the same flat spec format as all other components:

```json
{
  "spec": {
    "root": "layout",
    "elements": {
      "layout": {
        "type": "Box",
        "props": { "direction": "column" },
        "children": ["img1", "chart1"]
      },
      "img1": {
        "type": "Image",
        "props": {
          "src": "/path/to/screenshot.png",
          "alt": "debug screenshot",
          "width": 600
        }
      },
      "chart1": {
        "type": "LineChart",
        "props": { "data": [1, 2, 3] }
      }
    }
  }
}
```

### Image Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | Yes | Absolute path to a local image file |
| `alt` | `string` | No | Alt text / description |
| `width` | `number` | No | Display width (pixels for browser, cells for tmux) |
| `height` | `number` | No | Display height (pixels for browser, cells for tmux) |

## Security

- File-serving endpoint restricted to image MIME types only (png, jpg, gif, webp, svg)
- Path must be absolute (starts with `/`)
- No directory listing or traversal
- Missing files return 404, invalid types return 403

## Files to Modify

1. **`src/browser-server.ts`** — Add `/files/*` route, expose `boundPort` getter
2. **`src/app/index.tsx`** — Register `Image` in browser component map
3. **`src/index.ts`** — Add path rewriting for Image elements before sending to browser
4. **`src/components/image.tsx`** (new) — Kitty graphics Image component for tmux
5. **`src/catalog.ts`** — Register Image in tmux component registry
6. **`tsup.config.ts`** — No changes expected (new file auto-included)

## Out of Scope

- URL-based images (only local file paths supported)
- Auto-configuring tmux `allow-passthrough`
- Image resizing / format conversion
- Non-Kitty terminal image protocols (iTerm2, Sixel)
