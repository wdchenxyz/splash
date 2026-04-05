## DX / Ergonomics: Make `dataFile` Failures Actionable

### Problem
Splash's `dataFile` pipeline currently throws low-context parser and resolver errors, and the MCP tools pass those strings through almost unchanged. [`src/data-file.ts:6`](/Users/wdchen/Workspace/splash/src/data-file.ts#L6) to [`src/data-file.ts:27`](/Users/wdchen/Workspace/splash/src/data-file.ts#L27) emits raw messages such as `JSON data must be an array`, `CSV must have a header row and at least one data row`, or `Not a number: "foo"`. [`src/resolve-data.ts:117`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L117) to [`src/resolve-data.ts:145`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L145) calls `parseDataFile()` for each element and then throws more generic follow-up errors like `Unexpected data format for numeric array component` or `BarChart: cannot auto-detect label/value columns...` without mentioning which spec element or file caused the failure.

At the MCP boundary, both render tools just catch the exception and return `Error: ${message}` in [`src/index.ts:118`](/Users/wdchen/Workspace/splash/src/index.ts#L118) to [`src/index.ts:133`](/Users/wdchen/Workspace/splash/src/index.ts#L133) and [`src/index.ts:187`](/Users/wdchen/Workspace/splash/src/index.ts#L187) to [`src/index.ts:214`](/Users/wdchen/Workspace/splash/src/index.ts#L214). The user therefore sees a detached parser string with no element ID, component type, file path, or remediation hint. The current tests in [`src/data-file.test.ts:14`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L14) to [`src/data-file.test.ts:203`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L203) cover success paths plus one generic missing-file throw, but they do not verify that resolver failures are understandable from an MCP client's perspective.

### Proposed Change
- Add a small shared error wrapper, for example in [`src/resolve-data.ts`](/Users/wdchen/Workspace/splash/src/resolve-data.ts), that catches parser/resolver failures per element and rethrows a `DataResolutionError` with:
  - `elementId`
  - `componentType`
  - absolute `dataFile` path
  - the original cause
- Make each resolver branch enrich its most common auto-detection failures with concrete hints instead of only restating the generic rule:
  - numeric-array components should mention `dataColumn` and list detected keys when rows are objects
  - `BarChart` should mention `labelColumn` / `valueColumn` and the available columns from the first row
  - `Table` and `Heatmap` should preserve the expected shape while still reporting the offending file and element
- Update the MCP tool handlers in [`src/index.ts`](/Users/wdchen/Workspace/splash/src/index.ts) so `render-tmux` and `render-browser` format these failures consistently, for example: `Failed to resolve dataFile for element "latency" (BarChart) from /tmp/metrics.csv: cannot auto-detect valueColumn. Available columns: service, p95`.
- Extend [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts) or add a focused resolver-error test file to cover:
  - malformed numeric input surfacing the element ID and file path
  - `BarChart` auto-detection failure surfacing available columns
  - top-level render-tool formatting staying stable once the richer error reaches the MCP layer
- No migration is required. Existing specs keep the same behavior; only failure output changes.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This turns one of Splash's most common authoring loops from guesswork into a one-shot fix. Users working through MCP can correct a bad `dataFile` without reopening the source file and reverse-engineering which element failed.

### Dependencies
No prerequisite work is required. This should land before broader documentation cleanup so the docs can show the improved error shape instead of documenting today's opaque failures.
