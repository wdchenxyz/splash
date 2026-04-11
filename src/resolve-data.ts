import { parseDataFile, type ParsedData } from "./data-file.js";
import type { Spec, SpecElement } from "./render-contract.js";

function isNumericValue(v: unknown): boolean {
  if (typeof v === "number") return !isNaN(v);
  if (typeof v === "string" && v.trim() !== "") {
    return !isNaN(Number(v));
  }
  return false;
}

const NUMERIC_ARRAY_TYPES = new Set(["LineChart", "Sparkline", "Histogram", "AreaChart", "BaselineChart"]);

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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
  const { dataFile, categoryKey: explicitCategoryKey, series: explicitSeries, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("BarChart dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const keys = Object.keys(rows[0]);

  const categoryKey =
    (explicitCategoryKey as string) ??
    keys.find((k) => typeof rows[0][k] === "string");
  if (!categoryKey) {
    throw new Error("BarChart: cannot auto-detect categoryKey. Specify categoryKey.");
  }

  let series: Array<{ dataKey: string; color: string; label: string }>;
  if (explicitSeries) {
    series = explicitSeries as typeof series;
  } else {
    const numericKeys = keys.filter(
      (k) => k !== categoryKey && isNumericValue(rows[0][k])
    );
    if (numericKeys.length === 0) {
      throw new Error(
        "BarChart: no numeric columns found for series. Specify series."
      );
    }
    series = numericKeys.map((k, i) => ({
      dataKey: k,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: k,
    }));
  }

  // Cast numeric values and preserve category as string
  const castData = rows.map((row) => {
    const out: Record<string, unknown> = {
      [categoryKey]: String(row[categoryKey]),
    };
    for (const s of series) {
      out[s.dataKey] = Number(row[s.dataKey]);
    }
    return out;
  });

  return { ...rest, data: castData, categoryKey, series };
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

function resolveTimeline(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, titleColumn, descriptionColumn, dateColumn, statusColumn, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("Timeline dataFile must contain an array of objects");
  }

  const rows = data as Record<string, unknown>[];
  const keys = Object.keys(rows[0]);
  const tCol = (titleColumn as string) ?? keys.find((k) => typeof rows[0][k] === "string");

  if (!tCol) throw new Error("Timeline: cannot auto-detect title column. Specify titleColumn.");

  const dCol = descriptionColumn as string | undefined;
  const dtCol = dateColumn as string | undefined;
  const sCol = statusColumn as string | undefined;

  return {
    ...rest,
    items: rows.map((r) => ({
      title: String(r[tCol]),
      ...(dCol && r[dCol] != null && { description: String(r[dCol]) }),
      ...(dtCol && r[dtCol] != null && { date: String(r[dtCol]) }),
      ...(sCol && r[sCol] != null && { status: String(r[sCol]) }),
    })),
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

function resolveCandlestick(
  data: ParsedData,
  props: Record<string, unknown>
): Record<string, unknown> {
  const { dataFile, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error("CandlestickChart dataFile must contain an array of objects with time/open/high/low/close fields");
  }

  const rows = data as Record<string, unknown>[];
  const required = ["open", "high", "low", "close"];
  for (const key of required) {
    if (!(key in rows[0])) throw new Error(`CandlestickChart: missing required field "${key}"`);
  }

  const timeKey = Object.keys(rows[0]).find((k) => !required.includes(k)) ?? "time";

  return {
    ...rest,
    data: rows.map((r) => ({
      time: r[timeKey] != null ? String(r[timeKey]) : "",
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    })),
  };
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
    } else if (el.type === "CandlestickChart") {
      resolvedProps = resolveCandlestick(data, el.props);
    } else if (el.type === "BarChart") {
      resolvedProps = resolveBarChart(data, el.props);
    } else if (el.type === "Table") {
      resolvedProps = resolveTable(data, el.props);
    } else if (el.type === "Timeline") {
      resolvedProps = resolveTimeline(data, el.props);
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
