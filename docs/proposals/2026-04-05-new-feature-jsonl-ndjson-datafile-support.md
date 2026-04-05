## New Feature: Support JSONL and NDJSON `dataFile` Inputs

### Problem
`parseDataFile()` only has explicit branches for `.json`, `.csv`, and `.tsv`, then falls back to parsing newline-delimited numbers for everything else in [`src/data-file.ts:6`](/Users/wdchen/Workspace/splash/src/data-file.ts#L6) to [`src/data-file.ts:27`](/Users/wdchen/Workspace/splash/src/data-file.ts#L27). That means a log-style file such as `events.jsonl` or `metrics.ndjson` cannot be loaded today: object lines miss the `.json` branch, fail the `content.startsWith("[") || content.startsWith("{")` heuristic once there is more than one line, and finally throw from `parseNewlineNumbers()` in [`src/data-file.ts:19`](/Users/wdchen/Workspace/splash/src/data-file.ts#L19) to [`src/data-file.ts:27`](/Users/wdchen/Workspace/splash/src/data-file.ts#L27).

This is an unnecessary limitation because the rest of the pipeline already knows how to consume arrays of objects. `resolveNumericArray()` can extract a numeric column from row objects in [`src/resolve-data.ts:32`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L32) to [`src/resolve-data.ts:47`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L47), and both `BarChart` and `Table` accept object arrays in [`src/resolve-data.ts:55`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L55) to [`src/resolve-data.ts:101`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L101). Current tests only cover JSON arrays, CSV/TSV, and newline numbers in [`src/data-file.test.ts:15`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L15) to [`src/data-file.test.ts:63`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L63), so this input format gap is not documented or guarded.

### Proposed Change
- Modify [`src/data-file.ts`](/Users/wdchen/Workspace/splash/src/data-file.ts) to recognize `.jsonl` and `.ndjson` extensions before the fallback path, and add a dedicated `parseJsonLines(content)` helper.
- Make `parseJsonLines(content)`:
  - split on non-empty lines
  - `JSON.parse()` each line independently
  - return a `ParsedData` array when every line is either an object or a number array entry shape already supported by callers
  - throw an error that includes the failing line number when one line is invalid JSON
- Keep the feature narrowly scoped to line-delimited JSON arrays and objects. Do not add YAML or generalized streaming support in this step.
- Extend [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts) with focused coverage for:
  - parsing `.jsonl` object rows successfully
  - parsing `.ndjson` numeric rows that can feed `LineChart` via `dataColumn`
  - surfacing a useful error when one JSONL line is malformed
  - resolving a `Table` or `BarChart` spec from a JSONL file to prove the new format integrates with `resolveDataFiles()`
- Update the parser type guard only if needed to keep `ParsedData` accurate; avoid expanding the data model beyond what existing resolvers already consume.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: Adds support for a common machine-generated format used by logs, metrics exports, and append-only datasets without changing the spec shape or renderer code.

### Dependencies
No prerequisite changes. This can land independently after the current parser behavior is preserved for `.json`, `.csv`, `.tsv`, and newline-number files.
