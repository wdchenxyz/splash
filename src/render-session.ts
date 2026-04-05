import type { SeriesData, SpecMessage } from "./ipc.js";

interface Spec {
  root: string;
  elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }>;
}

export interface SpecEntry {
  id: string;
  spec: Spec;
  state: Record<string, unknown>;
}

let entryCounter = 0;

function addSeriesToSpec(spec: Spec, targetId: string | undefined, series: SeriesData): Spec {
  const elementId = targetId ?? Object.keys(spec.elements).reverse().find(
    (k) => spec.elements[k]?.type === "LineChart"
  );
  if (!elementId) return spec;

  const el = spec.elements[elementId];
  if (el?.type !== "LineChart") return spec;

  const props = { ...el.props };
  let seriesList = (props.series as SeriesData[]) ?? [];

  if (props.data && seriesList.length === 0) {
    seriesList = [{
      data: props.data as number[],
      label: props.label as string | undefined,
      color: props.color as string | undefined,
      fill: props.fill as boolean | undefined,
    }];
    delete props.data;
  } else {
    seriesList = [...seriesList];
  }

  seriesList.push(series);
  props.series = seriesList;

  return {
    ...spec,
    elements: { ...spec.elements, [elementId]: { ...el, props } },
  };
}

export function applySpecMessage(entries: SpecEntry[], message: SpecMessage): SpecEntry[] {
  if (message.type === "add_series") {
    const idx = message.chartId
      ? entries.findIndex((e) => e.id === message.chartId)
      : entries.length - 1;

    if (idx < 0) return entries;

    const entry = entries[idx];
    const updated = [...entries];
    updated[idx] = {
      ...entry,
      spec: addSeriesToSpec(entry.spec, undefined, message.series),
    };
    return updated;
  }

  // RenderMessage
  const mode = message.mode ?? "replace";

  if (mode === "clear") {
    return [];
  }

  const entry: SpecEntry = {
    id: message.chartId ?? `spec-${entryCounter++}`,
    spec: message.spec as Spec,
    state: message.state ?? {},
  };

  if (mode === "append") {
    return [...entries, entry];
  }

  // replace
  return [entry];
}
