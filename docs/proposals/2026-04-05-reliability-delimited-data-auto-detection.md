## Reliability: Make Delimited `dataFile` Auto-Detection Understand Numeric Strings

### Problem
Splash parses CSV and TSV rows as `Record<string, string>` regardless of cell contents in [`src/data-file.ts:38`](/Users/wdchen/Workspace/splash/src/data-file.ts#L38) to [`src/data-file.ts:52`](/Users/wdchen/Workspace/splash/src/data-file.ts#L52). That is fine for tables, but the downstream resolver currently decides whether a column is numeric by checking `typeof value === "number"` in two places: numeric-series auto-detection in [`src/resolve-data.ts:34`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L34) to [`src/resolve-data.ts:44`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L44), and `BarChart` value-column auto-detection in [`src/resolve-data.ts:65`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L65) to [`src/resolve-data.ts:69`](/Users/wdchen/Workspace/splash/src/resolve-data.ts#L69).

That combination means delimited files do not participate in the "auto-detect the numeric column" behavior that JSON object arrays already get. A `LineChart` or `Histogram` backed by `metrics.csv` fails unless the caller redundantly sets `dataColumn`, even when the file obviously has one numeric metric column. `BarChart` is worse: it can auto-detect the label column from CSV because every field is a string, but it cannot auto-detect the value column from the same rows, so the tool throws `BarChart: cannot auto-detect label/value columns...` for otherwise valid input.

Existing coverage proves the explicit-column happy paths, but it does not guard the broken delimited-file auto-detection path. The current tests in [`src/data-file.test.ts:83`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L83) to [`src/data-file.test.ts:121`](/Users/wdchen/Workspace/splash/src/data-file.test.ts#L121) only exercise JSON object arrays for chart auto-detection and CSV for `Table`, which is why this regression-prone gap remains invisible.

### Proposed Change
- Update [`src/resolve-data.ts`](/Users/wdchen/Workspace/splash/src/resolve-data.ts) to centralize "is this column numeric enough for auto-detection?" into one helper that accepts either real numbers or numeric-looking strings, while still rejecting blanks and mixed non-numeric values.
- Use that helper in both resolver paths that currently depend on `typeof === "number"`:
  - numeric-series auto-detection for `LineChart`, `Sparkline`, and `Histogram`
  - `BarChart` value-column auto-detection
- Keep parsing behavior in [`src/data-file.ts`](/Users/wdchen/Workspace/splash/src/data-file.ts) unchanged for this iteration. The reliability fix should live at resolution time so `Table` rendering and string-preserving CSV semantics do not change globally.
- Extend [`src/data-file.test.ts`](/Users/wdchen/Workspace/splash/src/data-file.test.ts) with focused resolver coverage for:
  - `LineChart` from CSV without `dataColumn`, proving the numeric column is auto-detected
  - `BarChart` from CSV without `valueColumn`, proving the value column is auto-detected while labels stay string-based
  - a negative case where a candidate column mixes numeric and non-numeric strings, proving the resolver still fails fast with a useful error
- Do not broaden this into general schema inference or CSV type casting. The goal is only to make current auto-detection behavior reliable across both JSON and delimited object-array inputs.

### Impact
- **Effort**: S
- **Risk**: Low
- **Value**: This removes a format-specific footgun from `dataFile` resolution, so equivalent JSON and CSV inputs behave the same for the common auto-detection paths users already expect.

### Dependencies
No earlier proposal is required. This can land independently on top of the current parser and resolver structure.
