import { standardComponents } from "@json-render/ink";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";

export const registry: Record<string, any> = {
  ...standardComponents,
  LineChart,
  Histogram,
  Heatmap,
};
