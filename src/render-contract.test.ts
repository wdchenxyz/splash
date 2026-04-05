import { describe, it, expect } from "vitest";
import type { Spec, SpecElement, RenderMessage, AddSeriesMessage, SpecMessage } from "./render-contract.js";

describe("render-contract types", () => {
  it("accepts a minimal valid spec", () => {
    const spec: Spec = {
      root: "main",
      elements: {
        main: { type: "Text", props: { text: "hello" }, children: [] },
      },
    };
    expect(spec.root).toBe("main");
    expect(spec.elements.main.type).toBe("Text");
  });

  it("round-trips a RenderMessage through JSON", () => {
    const msg: RenderMessage = {
      type: "render",
      spec: {
        root: "chart",
        elements: {
          chart: { type: "LineChart", props: { data: [1, 2, 3] }, children: [] },
        },
      },
      mode: "replace",
      chartId: "test-chart",
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as RenderMessage;
    expect(parsed.type).toBe("render");
    expect(parsed.spec.root).toBe("chart");
    expect(parsed.chartId).toBe("test-chart");
  });

  it("round-trips an AddSeriesMessage through JSON", () => {
    const msg: AddSeriesMessage = {
      type: "add_series",
      chartId: "chart1",
      series: { data: [10, 20, 30], label: "CPU", color: "green" },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as AddSeriesMessage;
    expect(parsed.type).toBe("add_series");
    expect(parsed.series.data).toEqual([10, 20, 30]);
  });

  it("discriminates SpecMessage union by type field", () => {
    const render: SpecMessage = {
      type: "render",
      spec: { root: "r", elements: {} },
    };
    const addSeries: SpecMessage = {
      type: "add_series",
      series: { data: [1] },
    };

    expect(render.type).toBe("render");
    expect(addSeries.type).toBe("add_series");

    // Type narrowing works
    if (render.type === "render") {
      expect(render.spec).toBeDefined();
    }
    if (addSeries.type === "add_series") {
      expect(addSeries.series).toBeDefined();
    }
  });
});
