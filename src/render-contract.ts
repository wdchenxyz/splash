// Canonical render contract — single source of truth for all message types
// shared between the MCP server, IPC transport, and both renderers.

export interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

export interface Spec {
  root: string;
  elements: Record<string, SpecElement>;
}

export type RenderMode = "replace" | "append" | "clear";

export interface TimeValuePoint {
  time: string | number;
  value: number;
}

export interface SeriesData {
  data: number[] | TimeValuePoint[];
  label?: string;
  color?: string;
  fill?: boolean;
}

export interface RenderMessage {
  type: "render";
  spec: Spec;
  state?: Record<string, unknown>;
  mode?: RenderMode;
  chartId?: string;
}

export interface AddSeriesMessage {
  type: "add_series";
  chartId?: string;
  series: SeriesData;
}

export type SpecMessage = RenderMessage | AddSeriesMessage;
