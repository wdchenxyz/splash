import { standardComponents } from "@json-render/ink";
import { LineChart } from "./components/line-chart.js";

export const registry: Record<string, any> = {
  ...standardComponents,
  LineChart,
};
