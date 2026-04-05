## New Feature: Add `dataFile` Support to `Timeline`

### Problem
Splash already has a browser-side `Timeline` component, but it only accepts inline `items`. The component reads `props.items` as `Array<{ title: string; description?: string; date?: string; status?: string }>` in [`src/app/components/standard.tsx:156`](/Users/wdchen/Workspace/splash/src/app/components/standard.tsx#L156) to [`src/app/components/standard.tsx:172`](/Users/wdchen/Workspace/splash/src/app/components/standard.tsx#L172), and the browser registry exposes `Timeline` in [`src/app/index.tsx:27`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L27) to [`src/app/index.tsx:46`](/Users/wdchen/Workspace/splash/src/app/index.tsx#L46).

The `dataFile` pipeline stops short of this component. [`src/resolve-data.ts:117`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L117) to [`src/resolve-data.ts:145`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L145) only resolves `dataFile` for numeric charts, `BarChart`, `Table`, and `Heatmap`, so `Timeline` specs cannot consume the same JSON, CSV, or TSV row data that Splash already parses in [`src/data-file.ts:6`](/Users/wdchen/Workspace/splash/src/data-file.ts#L6) to [`src/data-file.ts:27`](/Users/wdchen/Workspace/splash/src/data-file.ts#L27). The current tests in [`src/data-file.test.ts:67`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L67) to [`src/data-file.test.ts:203`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L203) confirm that gap: there is coverage for `LineChart`, `Sparkline`, `Histogram`, `BarChart`, `Table`, and `Heatmap`, but nothing for `Timeline`.

That forces users to inline every milestone/event even when the source data already lives in a structured file. It is a small but real capability hole for release timelines, incident postmortems, changelogs, and project plans.

### Proposed Change
- Extend [`src/resolve-data.ts`](/Users/wdchen/Workspace/splash/src/resolve-data.ts) with a `resolveTimeline()` helper for object-array inputs:
  - accept `dataFile` rows from JSON/CSV/TSV
  - map each row into `items`
  - support explicit column hints such as `titleColumn`, `descriptionColumn`, `dateColumn`, and `statusColumn`
  - auto-detect `titleColumn` from the first string field when not provided, while leaving the other fields optional
- Keep the feature scoped to browser-rendered `Timeline` only. Do not add tmux `Timeline` parity in the same change; the point of this slice is to unlock file-backed timeline authoring without expanding renderer support.
- Make the resolver strip `dataFile` and the column-hint props after conversion, following the same pattern used for charts and tables today.
- Add focused tests in [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts):
  - JSON object-array timeline resolution with all explicit columns
  - CSV timeline resolution with auto-detected title plus optional `dateColumn`/`statusColumn`
  - a failure case where no string column exists and `titleColumn` is omitted
- Update the browser-facing component docs later, but no migration is required. Existing inline `items` specs continue to work unchanged; this only adds an alternate authoring path.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This gives Splash one more genuinely useful data-driven component without changing the spec model or renderer architecture. Users can point `Timeline` at the same structured files they already use for tables and charts instead of hand-copying event arrays into every spec.

### Dependencies
No prerequisite work is required. This should land independently of renderer-parity proposals because it only touches the shared `dataFile` resolver and existing browser `Timeline` behavior.
