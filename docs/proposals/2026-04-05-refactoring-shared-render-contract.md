## Refactoring: Promote the Render Contract to a Shared Module

### Problem
Splash defines the same render contract in several places instead of having one canonical model. The MCP server owns a shallow Zod schema for `spec` in [`src/index.ts:30`](/Users/wdchen/Workspace/splash/src/index.ts#L30) to [`src/index.ts:35`](/Users/wdchen/Workspace/splash/src/index.ts#L35), but then immediately casts the validated value back to `{ root: string; elements: Record<string, unknown> }` before calling `resolveDataFiles()` in [`src/index.ts:118`](/Users/wdchen/Workspace/splash/src/index.ts#L118) and [`src/index.ts:187`](/Users/wdchen/Workspace/splash/src/index.ts#L187).

The transport and both renderers then redefine overlapping versions of the same shapes. [`src/ipc.ts:13`](/Users/wdchen/Workspace/splash/src/ipc.ts#L13) to [`src/ipc.ts:27`](/Users/wdchen/Workspace/splash/src/ipc.ts#L27) defines `RenderMessage`, `AddSeriesMessage`, and `SpecMessage`. [`src/renderer.tsx:11`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L11) to [`src/renderer.tsx:25`](/Users/wdchen/Workspace/splash/src/renderer.tsx#L25) redefines `ElementDef`, `Spec`, and `SpecEntry`. [`src/app/index.tsx:16`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L16) to [`src/app/index.tsx:25`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L25) defines another `Element`/`Spec`, and [`src/app/index.tsx:70`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L70) to [`src/app/index.tsx:77`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L77) recreates `SpecMessage` again.

That duplication already leaks into unsafe casts and drift-prone code paths. The browser reconstructs a `Spec` with `msg.spec!.elements as Record<string, Element>` in [`src/app/index.tsx:125`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L125) to [`src/app/index.tsx:128`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L128), while the tmux renderer and IPC layer rely on different local interfaces for the same serialized payload. Any future work on reducer unification, validator coverage, or renderer capability metadata will keep rethreading these definitions unless the contract is centralized first.

### Proposed Change
- Create a shared contract module, for example [`src/render-contract.ts`](/Users/wdchen/Workspace/splash/src/render-contract.ts), that exports the canonical TypeScript types for:
  - `SpecElement`
  - `Spec`
  - `RenderMode`
  - `SeriesData`
  - `RenderMessage`
  - `AddSeriesMessage`
  - `SpecMessage`
- Move schema-adjacent validation into the same contract boundary, either by exporting the existing Zod pieces from a sibling module such as [`src/render-contract-schema.ts`](/Users/wdchen/Workspace/splash/src/render-contract-schema.ts) or by colocating Node-only validators behind type-only imports for browser code. The goal is for [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts) to stop hand-writing a parallel contract and stop casting validated specs back to anonymous object literals.
- Update [`src/ipc.ts`](/Users/wdchen/Workspace/splash/src/ipc.ts), [`src/renderer.tsx`](/Users/wdchen/Workspace/splash/src/renderer.tsx), and [`src/app/index.tsx`](/Users/wdchen/Workspace/splash/src/app/index.tsx) to import the shared types instead of redefining them locally.
- Keep runtime behavior unchanged in this refactor. Do not merge the browser and tmux reducers here; this step is only about making every layer speak the same contract so later behavior refactors operate on one set of types.
- Add focused coverage in a new test file such as [`src/render-contract.test.ts`](/Users/wdchen/Workspace/splash/src/render-contract.test.ts) that exercises:
  - spec validation for the minimum valid shape
  - a serialized `render` message round-trip through the shared types
  - a serialized `add_series` message round-trip through the shared types
  - one browser-facing parse path proving the shared contract removes the current `as Record<string, Element>` reconstruction

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This removes one of the main sources of type drift in Splash's render pipeline. It makes later work on reducer unification, preflight validation, and renderer capability metadata smaller and safer because the serialized contract will live in exactly one place.

### Dependencies
No prerequisite feature work is required. This should land before any broader render-state refactor so the next iteration can build on one shared contract instead of migrating several local type aliases in parallel.
