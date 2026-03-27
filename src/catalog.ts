import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/ink/schema";
import {
  standardComponents,
  standardComponentDefinitions,
  standardActionDefinitions,
  type ComponentRegistry,
} from "@json-render/ink";
import { z } from "zod";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";

// -- Zod schemas for custom components --

const seriesSchema = z.object({
  data: z.array(z.number()),
  label: z.string().nullable(),
  color: z.string().nullable(),
  fill: z.boolean().nullable(),
});

const lineChartDefinition = {
  props: z.object({
    data: z.array(z.number()).nullable(),
    series: z.array(seriesSchema).nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    label: z.string().nullable(),
    color: z.string().nullable(),
    showAxis: z.boolean().nullable(),
    fill: z.boolean().nullable(),
  }),
  slots: [] as string[],
  description:
    "Multi-series line chart using braille characters for high-resolution terminal rendering. Supports single data array or multiple named series with individual colors.",
  example: {
    data: [10, 25, 18, 30, 22, 35, 28, 40],
    label: "Latency (ms)",
    width: 60,
    height: 12,
  },
};

const histogramDefinition = {
  props: z.object({
    data: z.array(z.number()),
    bins: z.number().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    label: z.string().nullable(),
    color: z.string().nullable(),
    showValues: z.boolean().nullable(),
  }),
  slots: [] as string[],
  description:
    "Frequency distribution chart that bins numeric data and renders horizontal bars with 1/8th block precision. Shows statistics (n, mean, stddev).",
  example: {
    data: [12, 15, 14, 18, 22, 19, 25, 30, 28, 35, 33, 40],
    label: "Response Time Distribution",
    bins: 10,
  },
};

const heatmapDefinition = {
  props: z.object({
    data: z.array(z.array(z.number())),
    xLabels: z.array(z.string()).nullable(),
    yLabels: z.array(z.string()).nullable(),
    label: z.string().nullable(),
    color: z
      .enum(["green", "red", "blue", "yellow", "cyan", "magenta", "white"])
      .nullable(),
    showValues: z.boolean().nullable(),
    cellWidth: z.number().nullable(),
  }),
  slots: [] as string[],
  description:
    "2D color-mapped grid visualization. Uses background color gradients to represent values. Supports axis labels and optional value display.",
  example: {
    data: [
      [1, 3, 5],
      [2, 4, 6],
      [9, 7, 5],
    ],
    xLabels: ["Mon", "Tue", "Wed"],
    yLabels: ["AM", "PM", "Eve"],
    color: "green",
    showValues: true,
  },
};

// -- Formal catalog (schema definitions for MCP tool generation) --

export const catalog = defineCatalog(schema, {
  components: {
    ...standardComponentDefinitions,
    LineChart: lineChartDefinition,
    Histogram: histogramDefinition,
    Heatmap: heatmapDefinition,
  },
  actions: standardActionDefinitions,
});

// -- Ink component registry (render functions for terminal) --

export const registry: ComponentRegistry = {
  ...standardComponents,
  LineChart,
  Histogram,
  Heatmap,
};
