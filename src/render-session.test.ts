import { describe, it, expect } from "vitest";
import { applySpecMessage, type SpecEntry } from "./render-session.js";
import type { RenderMessage, AddSeriesMessage } from "./ipc.js";

type Spec = SpecEntry["spec"];

function makeSpec(elements: Spec["elements"] = {}): Spec {
  return { root: Object.keys(elements)[0] ?? "root", elements };
}

function makeLineChart(data: number[], label?: string): Spec {
  return makeSpec({
    chart: { type: "LineChart", props: { data, label }, children: [] },
  });
}

describe("render-session", () => {
  describe("render messages", () => {
    it("replace clears existing and adds new entry", () => {
      const existing: SpecEntry[] = [
        { id: "old", spec: makeSpec(), state: {} },
      ];
      const msg: RenderMessage = {
        type: "render",
        spec: makeLineChart([1, 2, 3]),
        mode: "replace",
        chartId: "new-chart",
      };
      const result = applySpecMessage(existing, msg);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new-chart");
    });

    it("append adds below existing entries", () => {
      const existing: SpecEntry[] = [
        { id: "first", spec: makeSpec(), state: {} },
      ];
      const msg: RenderMessage = {
        type: "render",
        spec: makeLineChart([4, 5, 6]),
        mode: "append",
        chartId: "second",
      };
      const result = applySpecMessage(existing, msg);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("first");
      expect(result[1].id).toBe("second");
    });

    it("clear removes all entries", () => {
      const existing: SpecEntry[] = [
        { id: "a", spec: makeSpec(), state: {} },
        { id: "b", spec: makeSpec(), state: {} },
      ];
      const msg: RenderMessage = {
        type: "render",
        spec: makeSpec(),
        mode: "clear",
      };
      const result = applySpecMessage(existing, msg);
      expect(result).toHaveLength(0);
    });

    it("defaults to replace when mode is omitted", () => {
      const existing: SpecEntry[] = [
        { id: "old", spec: makeSpec(), state: {} },
      ];
      const msg: RenderMessage = {
        type: "render",
        spec: makeLineChart([1]),
      };
      const result = applySpecMessage(existing, msg);
      expect(result).toHaveLength(1);
    });

    it("assigns auto-generated ID when chartId is omitted", () => {
      const msg: RenderMessage = {
        type: "render",
        spec: makeLineChart([1]),
      };
      const result = applySpecMessage([], msg);
      expect(result[0].id).toMatch(/^spec-/);
    });

    it("preserves state from message", () => {
      const msg: RenderMessage = {
        type: "render",
        spec: makeLineChart([1]),
        state: { theme: "dark" },
      };
      const result = applySpecMessage([], msg);
      expect(result[0].state).toEqual({ theme: "dark" });
    });
  });

  describe("add_series messages", () => {
    it("appends series to LineChart by chartId", () => {
      const existing: SpecEntry[] = [
        { id: "my-chart", spec: makeLineChart([1, 2, 3], "Original"), state: {} },
      ];
      const msg: AddSeriesMessage = {
        type: "add_series",
        chartId: "my-chart",
        series: { data: [4, 5, 6], label: "New" },
      };
      const result = applySpecMessage(existing, msg);
      const props = result[0].spec.elements.chart.props;
      const series = props.series as any[];
      expect(series).toHaveLength(2);
      expect(series[0].label).toBe("Original");
      expect(series[1].label).toBe("New");
    });

    it("targets last entry when chartId is omitted", () => {
      const existing: SpecEntry[] = [
        { id: "first", spec: makeLineChart([1]), state: {} },
        { id: "second", spec: makeLineChart([2]), state: {} },
      ];
      const msg: AddSeriesMessage = {
        type: "add_series",
        series: { data: [3], label: "Added" },
      };
      const result = applySpecMessage(existing, msg);
      // First should be unchanged
      expect(result[0].spec.elements.chart.props.data).toEqual([1]);
      // Second should have new series
      const series = result[1].spec.elements.chart.props.series as any[];
      expect(series).toHaveLength(2);
    });

    it("upgrades single-series data to series array", () => {
      const existing: SpecEntry[] = [
        { id: "chart", spec: makeLineChart([1, 2, 3], "CPU"), state: {} },
      ];
      const msg: AddSeriesMessage = {
        type: "add_series",
        chartId: "chart",
        series: { data: [4, 5, 6], label: "Memory" },
      };
      const result = applySpecMessage(existing, msg);
      const props = result[0].spec.elements.chart.props;
      expect(props.data).toBeUndefined();
      const series = props.series as any[];
      expect(series).toHaveLength(2);
      expect(series[0].data).toEqual([1, 2, 3]);
      expect(series[1].data).toEqual([4, 5, 6]);
    });

    it("returns unchanged entries when chartId does not match", () => {
      const existing: SpecEntry[] = [
        { id: "chart", spec: makeLineChart([1]), state: {} },
      ];
      const msg: AddSeriesMessage = {
        type: "add_series",
        chartId: "nonexistent",
        series: { data: [2] },
      };
      const result = applySpecMessage(existing, msg);
      expect(result).toEqual(existing);
    });

    it("returns unchanged when no entries exist", () => {
      const msg: AddSeriesMessage = {
        type: "add_series",
        series: { data: [1] },
      };
      const result = applySpecMessage([], msg);
      expect(result).toEqual([]);
    });
  });
});
