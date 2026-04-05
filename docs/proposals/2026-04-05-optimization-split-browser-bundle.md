## Optimization: Split the Browser Renderer Bundle by Component Family

### Problem
The browser client is shipped as one monolithic bundle today. [`src/app/index.tsx:1`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L1) to [`src/app/index.tsx:12`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L12) eagerly imports every browser component, including charts, shadcn adapters, markdown, timeline, and image rendering, and then registers all of them up front in one `components` map in [`src/app/index.tsx:27`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L27) to [`src/app/index.tsx:46`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L46). The build config then forces that entire app into a single minified IIFE via [`tsup.config.ts:21`](/Users/wdchen/Workspace/splash/tsup.config.ts#L21) to [`tsup.config.ts:30`](/Users/wdchen/Workspace/splash/tsup.config.ts#L30), and the browser server only knows how to serve one `/app.js` asset in [`src/browser-server.ts:122`](/Users/wdchen/Workspace/splash/src/browser-server.ts#L122) to [`src/browser-server.ts:129`](/Users/wdchen/Workspace/splash/src/browser-server.ts#L129).

That means a trivial browser render such as `Text` plus `Metric` still downloads the full charting stack. The current production build makes that cost visible: `pnpm build` emits `dist/app.global.js` at 830.30 KB minified. Because new clients always fetch the same monolith before the first render, browser startup cost scales with the entire component surface rather than the subset actually used in the current spec.

### Proposed Change
- Modify [`tsup.config.ts`](/Users/wdchen/Workspace/splash/tsup.config.ts) so the browser build outputs ESM with code-splitting instead of a single IIFE bundle. Keep the Node builds unchanged.
- Update [`src/browser-server.ts`](/Users/wdchen/Workspace/splash/src/browser-server.ts) to serve a small static asset directory rather than only `/app.js`, and switch the HTML shell to `<script type="module">` so dynamically imported chunks can load.
- Refactor [`src/app/index.tsx`](/Users/wdchen/Workspace/splash/src/app/index.tsx) into:
  - a lightweight always-loaded shell for WebSocket state and basic layout
  - lazily imported component groups, such as standard text/layout widgets, heavy chart components, and optional shadcn adapters
- Introduce a component loader layer that resolves `el.type` to either a sync component or a lazy boundary, so specs that only use low-cost primitives do not pull in chart code.
- Add a focused browser-app test or build assertion that verifies multiple output chunks are produced and that a simple spec can still render after the split.
- Record the target artifact budget in the proposal work itself, for example keeping the initial entry chunk materially below the current 830 KB bundle while leaving heavy visualization code in secondary chunks.

### Impact
- **Effort**: M
- **Risk**: Medium
- **Value**: Reduces first-load latency for browser rendering, lowers bandwidth for simple dashboards, and gives Splash room to add more browser-only components without every render paying the full bundle cost.

### Dependencies
No prerequisite feature work is required, but this should be coordinated with any future browser-state refactor so only one pass touches the app entry and message-handling shell at a time.
