## DX / Ergonomics: Preflight Renderer Compatibility Validation

### Problem
The MCP tool layer accepts almost any spec shape and forwards it straight to a renderer, so users only discover renderer-specific incompatibilities after the render attempt has already started. In [`src/index.ts:30`](/Users/wdchen/Workspace/splash/src/index.ts#L30) to [`src/index.ts:35`](/Users/wdchen/Workspace/splash/src/index.ts#L35), `specSchema` validates only `root` plus an `elements` record of `unknown`, and both render tools immediately pass the parsed spec into runtime work in [`src/index.ts:118`](/Users/wdchen/Workspace/splash/src/index.ts#L118) and [`src/index.ts:187`](/Users/wdchen/Workspace/splash/src/index.ts#L187).

That is especially awkward because the two runtimes expose different component sets today. The tmux registry only adds `LineChart`, `Histogram`, `Heatmap`, and `Image` on top of `standardComponents` in [`src/catalog.ts:1`](/Users/wdchen/Workspace/splash/src/catalog.ts#L1) to [`src/catalog.ts:13`](/Users/wdchen/Workspace/splash/src/catalog.ts#L13), while the browser renderer explicitly supports additional custom types such as `Sparkline`, `BarChart`, `Timeline`, and shadcn adapters in [`src/app/index.tsx:27`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L27) to [`src/app/index.tsx:46`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L46). When a spec includes an unsupported browser-only component, the browser shows a weak inline fallback (`Unknown: {el.type}`) in [`src/app/index.tsx:52`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L52) to [`src/app/index.tsx:55`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L55), and the tmux path leaves the failure to downstream rendering internals.

The result is trial-and-error authoring: users do not get an actionable MCP error that says which element is unsupported, which renderer rejected it, or what to do instead.

### Proposed Change
- Create [`src/renderer-capabilities.ts`](/Users/wdchen/Workspace/splash/src/renderer-capabilities.ts) to hold explicit supported-component sets for `tmux` and `browser`, plus a `validateRendererCompatibility(spec, target)` helper that:
  - verifies `spec.root` exists in `spec.elements`
  - checks each element has a string `type`
  - checks every `children` entry points at an existing element ID
  - reports unsupported component types for the selected renderer with the offending element IDs
- Update [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts) so `render-tmux` and `render-browser` call that validator before `resolveDataFiles()`. Return a single MCP error message such as: `render-tmux cannot render element "sales" of type "BarChart"; use render-browser or switch to LineChart.`
- Export the same capability lists into the renderer implementations so the browser fallback in [`src/app/index.tsx`](/Users/wdchen/Workspace/splash/src/app/index.tsx) can render a clearer diagnostic panel instead of the current `Unknown: ...` fragment when a malformed message still gets through.
- Add focused tests in a new [`src/renderer-capabilities.test.ts`](/Users/wdchen/Workspace/splash/src/renderer-capabilities.test.ts) covering:
  - missing `root`
  - dangling child references
  - unsupported `BarChart`/`Sparkline` in `render-tmux`
  - valid specs that pass for browser and tmux respectively
- Keep this strictly preflight-only. Do not change the spec format or auto-convert components in this iteration.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This turns renderer mismatches into immediate, actionable tool errors, which is a direct ergonomics improvement for agents and humans authoring json-render specs.

### Dependencies
No prior proposal must land first. The change only depends on enumerating the component types Splash already exposes in the current browser and tmux runtimes.
