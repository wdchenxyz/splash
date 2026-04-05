import { parseDataFile, type ParsedData } from "./data-file.js";
import type { Spec, SpecElement } from "./render-contract.js";

function isNumericValue(v: unknown): boolean {
  if (typeof v === "number") return !isNaN(v);
  if (typeof v === "string" && v.trim() !== "") {
    return !isNaN(Number(v));
  }
  return false;
}

const NUMERIC_ARRAY_TYPES = new Set(["LineChart", "Sparkline", "Histogram"]);

function extractColumn(rows: Record<string, unknown>[], column: string): unknown[] {
  return rows.map((r) => r[column]);
}

function toNumbers(values: unknown[]): number[] {
  return values.map((v) => {
    const n = Number(v);
    if (isNaN(n)) throw new Error(`Cannot convert "${v}" to number`);
    return n;
  });
}

function resolveNumericArray(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, dataColumn, xLabelsColumn, ...rest } = props;
  const resolved = { ...rest };

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "number") {
    resolved.data = data;
  } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && !Array.isArray(data[0])) {
    const rows = data as Record<string, unknown>[];
    const col = dataColumn as string | undefined;
    if (!col) {
      const firstRow = rows[0];
      const numericKey = Object.keys(firstRow).find((k) => isNumericValue(firstRow[k]));
      if (!numericKey) throw new Error("dataFile contains objects but no dataColumn specified and no numeric column found");
      resolved.data = toNumbers(extractColumn(rows, numericKey));
    } else {
      resolved.data = toNumbers(extractColumn(rows, col));
    }
    if (xLabelsColumn) {
      resolved.xLabels = extractColumn(rows, xLabelsColumn as string).map(String);
    }
  } else {
    throw new Error(`Unexpected data format for numeric array component`);
  }

  return resolved;
}

function resolveBarChart(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, labelColumn, valueColumn, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("BarChart dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const lCol = (labelColumn as string) ?? Object.keys(rows[0]).find((k) => typeof rows[0][k] === "string");
  const vCol = (valueColumn as string) ?? Object.keys(rows[0]).find((k) => isNumericValue(rows[0][k]));

  if (!lCol || !vCol) throw new Error("BarChart: cannot auto-detect label/value columns. Specify labelColumn and valueColumn.");

  return {
    ...rest,
    data: rows.map((r) => ({
      label: String(r[lCol]),
      value: Number(r[vCol]),
    })),
  };
}

function resolveTable(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("Table dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const keys = Object.keys(rows[0]);

  return {
    ...rest,
    columns: keys.map((k) => ({ header: k, key: k })),
    rows: rows.map((r) => {
      const row: Record<string, string> = {};
      for (const k of keys) row[k] = String(r[k] ?? "");
      return row;
    }),
  };
}

function resolveHeatmap(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, ...rest } = props;

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Heatmap dataFile must contain a 2D array");
  }

  return { ...rest, data };
}

export function resolveDataFiles(spec: Spec): Spec {
  const elements = { ...spec.elements };
  let changed = false;

  for (const [id, raw] of Object.entries(elements)) {
    const el = raw as SpecElement;
    if (!el.props?.dataFile) continue;

    const filePath = el.props.dataFile as string;
    const data = parseDataFile(filePath);
    let resolvedProps: Record<string, unknown>;

    if (NUMERIC_ARRAY_TYPES.has(el.type!)) {
      resolvedProps = resolveNumericArray(data, el.props);
    } else if (el.type === "BarChart") {
      resolvedProps = resolveBarChart(data, el.props);
    } else if (el.type === "Table") {
      resolvedProps = resolveTable(data, el.props);
    } else if (el.type === "Heatmap") {
      resolvedProps = resolveHeatmap(data, el.props);
    } else {
      continue;
    }

    elements[id] = { ...el, props: resolvedProps };
    changed = true;
  }

  return changed ? { ...spec, elements } : spec;
}
