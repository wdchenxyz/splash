## New Feature: Add `BarChart` Support to the Tmux Renderer

### Problem
Splash already resolves `BarChart` `dataFile` inputs into `{ label, value }` pairs in [`src/resolve-data.ts:55`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L55) to [`src/resolve-data.ts:77`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L77), and the browser renderer already exposes a `BarChart` component in [`src/app/index.tsx:27`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L27) to [`src/app/index.tsx:46`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L46) backed by the implementation in [`src/app/components/standard.tsx:206`](/Users/wdchen/Workspace/splash/src/app/components/standard.tsx#L206) to [`src/app/components/standard.tsx:232`](/Users/wdchen/Workspace/splash/src/app/components/standard.tsx#L232).

The tmux renderer is the missing link. Its registry in [`src/catalog.ts:1`](/Users/wdchen/Workspace/splash/src/catalog.ts#L1) to [`src/catalog.ts:13`](/Users/wdchen/Workspace/splash/src/catalog.ts#L13) only registers `LineChart`, `Histogram`, `Heatmap`, and `Image`, so any spec that uses `BarChart` can render in the browser but not in tmux. That directly contradicts the product promise in [`README.md:7`](/Users/wdchen/Workspace/splash/README.md#L7) to [`README.md:11`](/Users/wdchen/Workspace/splash/README.md#L11), which currently says Splash supports bar charts and that the same spec renders in both environments.

### Proposed Change
- Create [`src/components/bar-chart.tsx`](/Users/wdchen/Workspace/splash/src/components/bar-chart.tsx) with a tmux-native horizontal bar chart component that accepts the same input shape the browser already uses:
  - `data: Array<{ label: string; value: number; color?: string }>`
  - `width?: number`
  - `showValues?: boolean`
  - `showPercentage?: boolean`
- Implement the tmux chart with `ink` `Text`/`Box` primitives and block characters, following the same style as [`src/components/histogram.tsx`](/Users/wdchen/Workspace/splash/src/components/histogram.tsx):
  - scale each row against the dataset max
  - preserve per-bar color overrides with a sensible default
  - right-align labels and keep value text optional so dense dashboards can hide it
  - handle `max === 0`, negative/empty input, and long labels deterministically instead of overflowing layout
- Register the new component in [`src/catalog.ts`](/Users/wdchen/Workspace/splash/src/catalog.ts) so `render-tmux` can consume the same `BarChart` specs that `render-browser` already handles.
- Add focused tests in a new file such as [`src/bar-chart.test.tsx`](/Users/wdchen/Workspace/splash/src/bar-chart.test.tsx):
  - render helper output for mixed values, zero-only values, and `showPercentage`
  - confirm per-bar colors and optional value text survive normalization
  - exercise a `resolveDataFiles()` + `BarChart` spec path so file-backed bar charts remain compatible once tmux can render them
- No migration is required. Existing browser `BarChart` specs should start working in tmux as-is once the registry entry exists.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This closes one of the clearest cross-renderer feature gaps with a contained change. Users already author `BarChart` specs and `dataFile` inputs today; adding the tmux implementation makes those specs genuinely portable instead of browser-only.

### Dependencies
No prerequisite feature work is required. This should land before broader renderer-capability validation or documentation cleanup so the most visible parity gap disappears at the source.
