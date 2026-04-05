## Optimization: Replace Runtime Tailwind CDN With a Local Browser Stylesheet

### Problem
Splash's browser renderer still fetches and executes Tailwind's CDN runtime on every page load. The HTML shell in `src/browser-server.ts:34` injects `<script src="https://cdn.tailwindcss.com"></script>` and an inline `tailwindcss.config` block at `src/browser-server.ts:40-68`. That means first paint depends on an extra network request plus runtime CSS generation before the shadcn components imported in `src/app/index.tsx:3-12` can render with their intended styles.

The server currently serves only `/app.js` and image passthrough routes, as shown in `src/browser-server.ts:122-172`, so there is no local CSS asset for the browser to cache. The build pipeline reflects that: the browser bundle in `tsup.config.ts:21-30` emits a single JavaScript artifact, and `pnpm build` currently produces only `dist/app.global.js` at 830.30 KB. Even after the JavaScript bundle is optimized separately, Splash will still pay an avoidable startup cost and keep a hard dependency on an external CDN for styling.

### Proposed Change
1. Add a checked-in browser stylesheet source such as `src/app/styles.css` that contains the dark theme variables from `src/browser-server.ts:73-95` plus the utility classes actually used by the current browser component surface.
2. Update the browser build so `src/app/index.tsx` imports that stylesheet and emits a local `dist/app.css` asset alongside the JavaScript bundle. Keep the scope small by generating exactly one CSS file for the current browser renderer rather than introducing a broader design-system pipeline.
3. Change `createBrowserServer()` to cache and serve `/app.css`, replace the Tailwind CDN `<script>` tag with a `<link rel="stylesheet" href="/app.css">`, and keep the existing inline structural reset CSS only if it is not already covered by the generated stylesheet.
4. Add one focused server test that asserts the browser shell references `/app.css` and no longer references `cdn.tailwindcss.com`, plus one build-level assertion that `pnpm build` emits the CSS asset.
5. Validate the optimization manually by loading the browser renderer with network access disabled and confirming that shadcn-backed components remain styled on first paint.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This removes a whole runtime network hop from browser startup, eliminates client-side Tailwind compilation work, allows CSS to be cached locally, and makes Splash's browser renderer faster and less dependent on external infrastructure.

### Dependencies
No functional dependencies. This can land independently of the existing browser-bundle code-splitting proposal because it only changes how styles are shipped and served.
