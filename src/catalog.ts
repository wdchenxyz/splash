import { standardComponents, type ComponentRegistry } from "@json-render/ink";
import { LineChart } from "./components/line-chart.js";
import { Histogram } from "./components/histogram.js";
import { Heatmap } from "./components/heatmap.js";
import { Image } from "./components/image.js";

export const registry: ComponentRegistry = {
  ...standardComponents,
  LineChart,
  Histogram,
  Heatmap,
  Image,
};
