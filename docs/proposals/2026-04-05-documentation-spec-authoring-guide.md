## Documentation: Publish an Authoritative Spec Authoring Guide

### Problem
The public docs currently overstate renderer parity and leave the most important spec-authoring behavior undocumented.

In [`README.md:7`](/Users/wdchen/Workspace/splash/README.md#L7) to [`README.md:12`](/Users/wdchen/Workspace/splash/README.md#L12), Splash advertises `Sparkline` and `BarChart` as first-class features and says the same spec renders in both tmux and browser. That is not true today: the tmux registry only registers `LineChart`, `Histogram`, `Heatmap`, and `Image` on top of Ink standard components in [`src/catalog.ts:1`](/Users/wdchen/Workspace/splash/src/catalog.ts#L1) to [`src/catalog.ts:13`](/Users/wdchen/Workspace/splash/src/catalog.ts#L13), while the browser renderer additionally supports `Sparkline`, `BarChart`, `Timeline`, and the shadcn adapters in [`src/app/index.tsx:27`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L27) to [`src/app/index.tsx:46`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L46). A user reading the README has no way to know which components are portable versus browser-only.

The docs also do not explain `dataFile` at all, even though it is a major authoring path implemented in [`src/resolve-data.ts:25`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L25) to [`src/resolve-data.ts:145`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L145) and backed by file-format parsing in [`src/data-file.ts:6`](/Users/wdchen/Workspace/splash/src/data-file.ts#L6) to [`src/data-file.ts:63`](/Users/wdchen/Workspace/splash/src/data-file.ts#L63). Today there is no user-facing explanation of which file formats are supported, which components can resolve them, or which props (`dataColumn`, `xLabelsColumn`, `labelColumn`, `valueColumn`) control auto-detection.

Finally, [`docs/shadcn-components.md:3`](/Users/wdchen/Workspace/splash/docs/shadcn-components.md#L3) to [`docs/shadcn-components.md:15`](/Users/wdchen/Workspace/splash/docs/shadcn-components.md#L15) says there are "Currently Registered (6)" shadcn browser components, but [`src/app/index.tsx:29`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L29) to [`src/app/index.tsx:35`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L35) already registers seven (`Card`, `Heading`, `Spinner`, `Image`, `Table`, `Badge`, `ProgressBar`). That makes the existing reference untrustworthy before a reader even reaches the more important sections.

### Proposed Change
- Create `docs/spec-authoring.md` as the canonical authoring guide for Splash specs.
  - Add a renderer support matrix generated from the actual browser and tmux registries, split into `portable`, `browser-only`, and `tmux-only` component sets.
  - Document `dataFile` behavior per component: accepted source shapes, supported on-disk formats (`.json`, `.csv`, `.tsv`, newline-delimited numbers), and the exact column-selection props used by `LineChart`, `Sparkline`, `Histogram`, `BarChart`, `Table`, and `Heatmap`.
  - Include two minimal end-to-end examples: one tmux-safe portable dashboard and one browser-only spec that intentionally uses `BarChart` and `Timeline` so users learn the boundary.
- Update `README.md` to stop being the only source of truth.
  - Replace the blanket "same spec renders in both tmux and browser" claim with a short explanation that component support differs by renderer today.
  - Keep the tool overview in the README, but link directly to `docs/spec-authoring.md` for component compatibility and `dataFile` authoring rules.
  - Add one short note near the tool table that `render-browser` and `render-tmux` do not currently support identical component sets.
- Rewrite `docs/shadcn-components.md` so it matches the live browser renderer instead of an older migration snapshot.
  - Correct the registered count and include the actual adapter-backed registrations.
  - Clarify that the document is only about browser shadcn-backed components, while `docs/spec-authoring.md` owns the cross-renderer matrix.
- Add a lightweight doc-maintenance check.
  - Either define the browser/tmux component lists once in a shared exported metadata module and reuse them from docs/examples, or add a small script/test that asserts the documented registered-component list matches the code registries.
  - This keeps the new documentation from drifting again after the next component addition.
- Migration steps: none. Existing APIs and specs stay unchanged.

### Impact
- **Effort**: M
- **Risk**: Low
- **Value**: Splash is currently easy to mis-author because the docs hide renderer mismatches and `dataFile` rules that are central to day-to-day use. An authoritative guide reduces avoidable trial-and-error for both humans and MCP agents.

### Dependencies
No feature work is required first. This should land before more components or `dataFile` formats are added, otherwise the current documentation drift will compound.
