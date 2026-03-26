import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: "esm",
    target: "node20",
    platform: "node",
    outDir: "dist",
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: { renderer: "src/renderer.tsx" },
    format: "esm",
    target: "node20",
    platform: "node",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
