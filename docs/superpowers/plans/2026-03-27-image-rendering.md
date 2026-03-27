# Image Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render local image files in both browser and tmux splash renderers as a composable `Image` component.

**Architecture:** The MCP server rewrites local file paths for each renderer target. Browser: serves files via a new HTTP endpoint, browser renders with `<img>`. Tmux: base64-encodes the file and outputs Kitty graphics protocol escape sequences with tmux DCS passthrough wrapping.

**Tech Stack:** Node.js, React, React Ink, Kitty graphics protocol, tmux DCS passthrough, `@json-render/shadcn` Image component.

**Spec:** `docs/superpowers/specs/2026-03-27-image-rendering-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/browser-server.ts` | Add `/files/*` static image route, expose `getPort()` |
| Modify | `src/app/index.tsx` | Register `Image` in browser component map |
| Create | `src/components/image.tsx` | Kitty graphics protocol Image component for tmux |
| Modify | `src/catalog.ts` | Register `Image` in tmux component registry |
| Modify | `src/index.ts` | Path rewriting for Image elements before sending to browser |

---

### Task 1: Browser File-Serving Endpoint

Add an HTTP route to `browser-server.ts` that serves local image files, and expose the bound port so the MCP server can construct URLs.

**Files:**
- Modify: `src/browser-server.ts`

- [ ] **Step 1: Add MIME type map and path validation helper**

Add these above the `createBrowserServer` function in `src/browser-server.ts`:

```typescript
import path from "node:path";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
```

- [ ] **Step 2: Add `/files/*` route to the HTTP server**

In the `http.createServer` callback inside `start()`, add a branch before the fallback HTML response. The route pattern is `/files/<base64url-encoded-absolute-path>`:

```typescript
server = http.createServer((req, res) => {
  if (req.url === "/app.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(appJs);
  } else if (req.url?.startsWith("/files/")) {
    const encoded = req.url.slice("/files/".length);
    let filePath: string;
    try {
      filePath = Buffer.from(encoded, "base64url").toString("utf-8");
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
      return;
    }

    if (!path.isAbsolute(filePath)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (!mime) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden: not an image type");
      return;
    }

    let data: Buffer;
    try {
      data = fs.readFileSync(filePath);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }
});
```

- [ ] **Step 3: Expose `getPort()` in the return object**

Add a `getPort` function to the returned object so the MCP server can build file URLs:

```typescript
function getPort(): number | null {
  return boundPort;
}

return { start, sendSpec, hasClients, close, getPort };
```

- [ ] **Step 4: Manually test the endpoint**

Run: `npx tsup && node -e "
const { createBrowserServer } = await import('./dist/index.js');
" 2>&1 | head -5`

This is a smoke test that the build succeeds. Full testing will be done after all tasks are integrated.

- [ ] **Step 5: Commit**

```bash
git add src/browser-server.ts
git commit -m "feat: add image file-serving endpoint to browser server"
```

---

### Task 2: Register Image in Browser Renderer

Register the shadcn `Image` component so the browser renderer can display `Image` elements.

**Files:**
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Add `Image` to the component map**

In `src/app/index.tsx`, add `Image` to the `components` object. The shadcn `Image` component renders `<img src=... alt=... />` and handles missing `src` with a placeholder. Add it alongside the other shadcn components:

```typescript
const components: Record<string, (p: { props: Record<string, unknown>; children?: ReactNode }) => ReactNode> = {
  // shadcn components (direct or adapted)
  Card: shadcnComponents.Card,
  Heading: shadcnComponents.Heading,
  Spinner: shadcnComponents.Spinner,
  Image: shadcnComponents.Image,
  Table: ShadcnTable,
  Badge: ShadcnBadge,
  ProgressBar: ShadcnProgress,

  // ... rest unchanged
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat: register Image component in browser renderer"
```

---

### Task 3: Tmux Image Component (Kitty Graphics Protocol)

Create a React Ink component that renders images using the Kitty graphics protocol with tmux DCS passthrough.

**Files:**
- Create: `src/components/image.tsx`

- [ ] **Step 1: Create the Image component**

Create `src/components/image.tsx` with the full Kitty graphics implementation:

```tsx
import React from "react";
import { Box, Text } from "ink";
import fs from "node:fs";

const CHUNK_SIZE = 4096;

function buildKittySequence(base64Data: string, cols?: number, rows?: number): string {
  const chunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  const parts: string[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const isFirst = idx === 0;
    const isLast = idx === chunks.length - 1;

    const controlParts: string[] = [];
    if (isFirst) {
      controlParts.push("a=T", "f=100", "t=d", "q=2");
      if (cols) controlParts.push(`c=${cols}`);
      if (rows) controlParts.push(`r=${rows}`);
    }
    controlParts.push(`m=${isLast ? 0 : 1}`);

    const control = controlParts.join(",");
    parts.push(`\x1b_G${control};${chunks[idx]}\x1b\\`);
  }

  return parts.join("");
}

function wrapTmuxPassthrough(kittySequences: string): string {
  // Each Kitty APC sequence must be individually wrapped.
  // Split on the sequence boundaries and wrap each one.
  const seqs = kittySequences.split(/(?=\x1b_G)/);
  return seqs
    .filter((s) => s.length > 0)
    .map((seq) => {
      const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
      return `\x1bPtmux;${doubled}\x1b\\`;
    })
    .join("");
}

interface ImageProps {
  props: Record<string, unknown>;
}

export function Image({ props }: ImageProps) {
  const src = props.src as string | undefined;
  const alt = (props.alt as string) ?? "";
  const width = props.width as number | undefined;
  const height = props.height as number | undefined;

  if (!src) {
    return (
      <Box>
        <Text color="gray">[Image: {alt || "no source"}]</Text>
      </Box>
    );
  }

  let base64Data: string;
  try {
    const buffer = fs.readFileSync(src);
    base64Data = buffer.toString("base64");
  } catch {
    return (
      <Box>
        <Text color="red">[Image not found: {src}]</Text>
      </Box>
    );
  }

  const kittyOutput = buildKittySequence(base64Data, width, height);
  const inTmux = !!process.env.TMUX;
  const output = inTmux ? wrapTmuxPassthrough(kittyOutput) : kittyOutput;

  return (
    <Box flexDirection="column">
      <Text>{output}</Text>
      {alt ? <Text color="gray">{alt}</Text> : null}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/image.tsx
git commit -m "feat: add Kitty graphics Image component for tmux"
```

---

### Task 4: Register Image in Tmux Renderer

Register the new Image component in the tmux component registry.

**Files:**
- Modify: `src/catalog.ts`

- [ ] **Step 1: Import and register Image**

Update `src/catalog.ts`:

```typescript
import { standardComponents, type ComponentRegistry } from "@json-render/ink";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";
import { Image } from "./components/image.js";

export const registry: ComponentRegistry = {
  ...standardComponents,
  LineChart,
  Histogram,
  Heatmap,
  Image,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/catalog.ts
git commit -m "feat: register Image in tmux component registry"
```

---

### Task 5: MCP Server Path Rewriting

Add logic to the MCP server that rewrites local file paths in Image elements to HTTP URLs before sending specs to the browser renderer.

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add path rewriting helper**

Add this function in `src/index.ts`, after the schema definitions and before the tmux renderer section:

```typescript
function rewriteImagePaths(
  spec: { root: string; elements: Record<string, unknown> },
  port: number
): { root: string; elements: Record<string, unknown> } {
  const elements = { ...spec.elements };
  for (const [id, raw] of Object.entries(elements)) {
    const el = raw as { type?: string; props?: Record<string, unknown> };
    if (el.type === "Image" && typeof el.props?.src === "string" && el.props.src.startsWith("/")) {
      const encoded = Buffer.from(el.props.src).toString("base64url");
      elements[id] = {
        ...el,
        props: { ...el.props, src: `http://localhost:${port}/files/${encoded}` },
      };
    }
  }
  return { ...spec, elements };
}
```

- [ ] **Step 2: Apply rewriting in `render-browser` tool**

In the `render-browser` tool handler, after constructing the `message` object but before calling `srv.sendSpec(message)`, apply the rewriting. There are two `sendSpec` call sites in the handler — both need rewriting applied to the message:

```typescript
async ({ spec, state, title, mode, chartId }) => {
  try {
    const srv = getBrowser();
    const url = await srv.start();

    const port = srv.getPort()!;
    const rewrittenSpec = rewriteImagePaths(spec, port);

    const message: RenderMessage = {
      type: "render",
      spec: rewrittenSpec,
      mode: mode ?? "replace",
      ...(state && { state }),
      ...(chartId && { chartId }),
    };

    if (!srv.hasClients()) {
      const { exec } = await import("node:child_process");
      exec(`open "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || true`);

      if (!(await waitForBrowserClient(srv))) {
        srv.sendSpec(message);
        return ok(`Browser opened at ${url}. Waiting for connection — refresh if needed.`);
      }
    }

    if (!srv.sendSpec(message)) {
      return err("No browser connected. Open " + url + " in your browser.");
    }

    return ok(`Rendered in browser${title ? `: ${title}` : ""} at ${url}`);
  } catch (error) {
    return err(`Error: ${toErrorMessage(error)}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite Image file paths to HTTP URLs for browser renderer"
```

---

### Task 6: Build and Integration Test

Build the project and verify everything works end-to-end.

**Files:**
- No new files

- [ ] **Step 1: Build the project**

Run: `cd /Users/wchen14/sides/splash && pnpm build`

Expected: Clean build with no errors, producing `dist/index.js`, `dist/renderer.js`, `dist/app.global.js`.

- [ ] **Step 2: Fix any build errors**

If there are type errors or import issues, fix them. Common issues:
- `getPort` not recognized on the browser server type — check the return type in `browser-server.ts`
- Import path for `Image` in `catalog.ts` — must use `.js` extension for ESM

- [ ] **Step 3: Verify with a test image in browser**

Use the MCP inspector or a quick script to send a render spec with an Image element pointing to any local PNG file. Verify:
- The browser page loads
- The image displays correctly
- The `/files/*` endpoint returns the image with correct MIME type

- [ ] **Step 4: Verify with a test image in tmux**

Send the same spec to `render-tmux`. Verify:
- The image renders inline in the tmux pane (requires Ghostty + `tmux set -g allow-passthrough on`)
- If passthrough is not enabled, verify the fallback text `[Image: path]` appears

- [ ] **Step 5: Verify mixed content (image + chart)**

Send a spec combining Image and LineChart in a Box layout to both renderers. Verify both components render correctly together.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and integration issues"
```

(Skip this step if no fixes were needed.)
