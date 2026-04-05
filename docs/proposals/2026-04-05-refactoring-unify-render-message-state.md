## Refactoring: Unify Render Message State Handling Across Browser and Tmux

### Problem
The tmux and browser renderers both implement their own `render`/`add_series` state transitions, but they do not share code or behavior. The tmux renderer keeps a `SpecEntry[]`, stores `state`, and treats `chartId` as the identifier for a rendered entry in [`src/renderer.tsx:22`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L22) to [`src/renderer.tsx:90`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L90). The browser renderer keeps only `Spec[]`, redefines `SpecMessage` locally, ignores `state`, and applies `add_series` only against the last rendered spec in [`src/app/index.tsx:70`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L70) to [`src/app/index.tsx:165`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L165).

This duplication has already drifted into different semantics. In tmux, `chartId` selects the rendered chart instance via `prev.findIndex((e) => e.id === message.chartId)` in [`src/renderer.tsx:59`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L59) to [`src/renderer.tsx:68`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L68). In the browser, `chartId` is treated as an element key inside the most recent spec via `spec.elements[targetId]` in [`src/app/index.tsx:79`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L79) to [`src/app/index.tsx:103`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L103). That does not match the MCP contract from [`src/index.ts:239`](/Users/wdchen/Workspace/splash/src/index.ts#L239) to [`src/index.ts:278`](/Users/wdchen/Workspace/splash/src/index.ts#L278), where `chartId` is described as a chart identifier for later targeting rather than an element ID lookup strategy.

Because the behavior lives in two separate ad hoc reducers, any future change to append/clear behavior, chart targeting, or message shape has to be implemented twice and can silently diverge again.

### Proposed Change
- Create a shared pure reducer module, for example [`src/render-session.ts`](/Users/wdchen/Workspace/splash/src/render-session.ts), that owns:
  - shared `Spec` and `SpecEntry` types
  - `applySpecMessage(entries, message)` for `render`, `append`, `clear`, and `add_series`
  - a small helper that upgrades single-series `LineChart` props into `series[]` before appending
- Move the `addSeriesToSpec()` logic out of both renderers and normalize `chartId` handling in one place:
  - `render` should assign an entry ID from `message.chartId` or a generated fallback
  - `add_series` should target the matching rendered entry by that ID
  - if no `chartId` is provided, the reducer should fall back to the most recent compatible entry consistently for both runtimes
- Update [`src/renderer.tsx`](/Users/wdchen/Workspace/splash/src/renderer.tsx) to delegate all message application to the shared reducer instead of mutating `SpecEntry[]` inline.
- Update [`src/app/index.tsx`](/Users/wdchen/Workspace/splash/src/app/index.tsx) to import `SpecMessage` from [`src/ipc.ts`](/Users/wdchen/Workspace/splash/src/ipc.ts) and use the same shared reducer, so browser and tmux consume identical message semantics.
- Preserve browser-specific rendering concerns separately. This refactor should only centralize state transitions, not merge the Ink and DOM component registries.
- Add focused tests for the new reducer covering:
  - `render` replace/append/clear behavior
  - `add_series` targeting by explicit `chartId`
  - fallback to the most recent chart when `chartId` is omitted
  - upgrading a `LineChart` from `data` to `series`
  - parity between browser and tmux consumers by exercising the reducer directly rather than duplicating UI tests

### Impact
- **Effort**: M
- **Risk**: Medium
- **Value**: Removes duplicated state-management code from the two runtimes, fixes the current `chartId` semantic split before more tools depend on it, and gives future renderer features one source of truth to test.

### Dependencies
No prerequisite feature work is required. This should land before adding more incremental-update tools beyond `add-series`, otherwise duplicated message reducers will become harder to unwind.
