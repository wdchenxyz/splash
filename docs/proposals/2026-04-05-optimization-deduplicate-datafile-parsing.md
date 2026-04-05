## Optimization: Deduplicate `dataFile` Parsing Per Render

### Problem
`resolveDataFiles()` reparses every `dataFile` reference independently as it walks the spec tree. In [`src/resolve-data.ts:121`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L121) to [`src/resolve-data.ts:127`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L127), each element with `props.dataFile` calls `parseDataFile(filePath)` directly, even when multiple elements point at the same file. `parseDataFile()` then does a synchronous `fs.readFileSync()` and full parse on every call in [`src/data-file.ts:6`](/Users/wdchen/Workspace/splash/src/data-file.ts#L6) to [`src/data-file.ts:27`](/Users/wdchen/Workspace/splash/src/data-file.ts#L27).

This is avoidable work for dashboard specs that reuse one dataset across several views, such as a `LineChart`, `Table`, and `BarChart` all sourced from the same CSV. The cost is paid on every render path because both `render-tmux` and `render-browser` call `resolveDataFiles()` before dispatch in [`src/index.ts:118`](/Users/wdchen/Workspace/splash/src/index.ts#L118) and [`src/index.ts:187`](/Users/wdchen/Workspace/splash/src/index.ts#L187). Current tests in [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts) cover parsing correctness, but there is no assertion that duplicate file references are only read once.

### Proposed Change
- Modify [`src/resolve-data.ts`](/Users/wdchen/Workspace/splash/src/resolve-data.ts) so `resolveDataFiles()` keeps a local `Map<string, ParsedData>` cache keyed by the resolved file path for the duration of one spec resolution pass.
- Move path normalization into a small helper so the cache key is stable even when the same file is referenced via different relative forms.
- Replace the direct `parseDataFile(filePath)` call with `getParsedData(filePath)` that:
  - returns cached data when available
  - otherwise parses once and stores the `ParsedData`
- Extend [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts) with a focused test that builds a spec where multiple elements share the same `dataFile`, spies on `parseDataFile`, and asserts the file is parsed once while each element still receives its transformed props.
- Keep the cache scoped to a single `resolveDataFiles()` invocation. Do not introduce cross-render persistence in this step.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: Reduces synchronous disk I/O and parsing overhead for the common case where one dataset drives multiple panels, without changing the public API or component behavior.

### Dependencies
No prerequisite changes. This can land independently and gives a clean baseline before considering broader cross-render caching later.
