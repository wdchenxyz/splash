import { describe, it, expect } from "vitest";
import { parseDataFile } from "./data-file.js";
import { resolveDataFiles } from "./resolve-data.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function tmpFile(name: string, content: string): string {
  const p = path.join(os.tmpdir(), `splash-test-${Date.now()}-${name}`);
  fs.writeFileSync(p, content);
  return p;
}

describe("parseDataFile", () => {
  it("parses JSON number array", () => {
    const f = tmpFile("nums.json", "[1, 2, 3, 4, 5]");
    expect(parseDataFile(f)).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses JSON object array", () => {
    const f = tmpFile("objs.json", JSON.stringify([
      { date: "Mar 1", cost: 10.5 },
      { date: "Mar 2", cost: 20.3 },
    ]));
    expect(parseDataFile(f)).toEqual([
      { date: "Mar 1", cost: 10.5 },
      { date: "Mar 2", cost: 20.3 },
    ]);
  });

  it("parses JSON 2D array", () => {
    const f = tmpFile("matrix.json", "[[1,2],[3,4],[5,6]]");
    expect(parseDataFile(f)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it("parses CSV with headers", () => {
    const f = tmpFile("data.csv", "name,value\nalice,10\nbob,20\n");
    expect(parseDataFile(f)).toEqual([
      { name: "alice", value: "10" },
      { name: "bob", value: "20" },
    ]);
  });

  it("parses TSV with headers", () => {
    const f = tmpFile("data.tsv", "name\tvalue\nalice\t10\nbob\t20\n");
    expect(parseDataFile(f)).toEqual([
      { name: "alice", value: "10" },
      { name: "bob", value: "20" },
    ]);
  });

  it("parses newline-delimited numbers", () => {
    const f = tmpFile("vals.txt", "1.5\n2.7\n3.9\n");
    expect(parseDataFile(f)).toEqual([1.5, 2.7, 3.9]);
  });

  it("ignores blank lines in newline-delimited numbers", () => {
    const f = tmpFile("vals2.txt", "10\n\n20\n30\n\n");
    expect(parseDataFile(f)).toEqual([10, 20, 30]);
  });

  it("throws on missing file", () => {
    expect(() => parseDataFile("/tmp/does-not-exist-splash.json")).toThrow();
  });
});

describe("resolveDataFiles", () => {
  it("resolves LineChart dataFile to data array", () => {
    const f = tmpFile("line.json", "[10, 20, 30]");
    const spec = {
      root: "c",
      elements: {
        c: { type: "LineChart", props: { dataFile: f, label: "Test" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([10, 20, 30]);
    expect(props.dataFile).toBeUndefined();
    expect(props.label).toBe("Test");
  });

  it("resolves LineChart with dataColumn", () => {
    const f = tmpFile("line-col.json", JSON.stringify([
      { date: "Mon", cpu: 10, mem: 50 },
      { date: "Tue", cpu: 20, mem: 60 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: { type: "LineChart", props: { dataFile: f, dataColumn: "cpu", label: "CPU" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([10, 20]);
    expect(props.dataColumn).toBeUndefined();
  });

  it("resolves BarChart with labelColumn and valueColumn", () => {
    const f = tmpFile("bar.json", JSON.stringify([
      { service: "api", latency: 45 },
      { service: "web", latency: 30 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: {
          type: "BarChart",
          props: { dataFile: f, labelColumn: "service", valueColumn: "latency" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { label: "api", value: 45 },
      { label: "web", value: 30 },
    ]);
  });

  it("resolves Table dataFile with auto headers", () => {
    const f = tmpFile("table.csv", "Name,Role,Status\nAlice,Eng,Active\nBob,PM,Away\n");
    const spec = {
      root: "t",
      elements: {
        t: { type: "Table", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.t as any).props;
    expect(props.columns).toEqual([
      { header: "Name", key: "Name" },
      { header: "Role", key: "Role" },
      { header: "Status", key: "Status" },
    ]);
    expect(props.rows).toEqual([
      { Name: "Alice", Role: "Eng", Status: "Active" },
      { Name: "Bob", Role: "PM", Status: "Away" },
    ]);
  });

  it("resolves Heatmap dataFile as 2D array", () => {
    const f = tmpFile("heat.json", "[[1,2],[3,4]]");
    const spec = {
      root: "h",
      elements: {
        h: { type: "Heatmap", props: { dataFile: f, label: "Heat" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.h as any).props;
    expect(props.data).toEqual([[1, 2], [3, 4]]);
  });

  it("leaves elements without dataFile untouched", () => {
    const spec = {
      root: "c",
      elements: {
        c: { type: "LineChart", props: { data: [1, 2, 3], label: "Inline" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    expect(resolved).toEqual(spec);
  });

  it("resolves Sparkline and Histogram via dataColumn", () => {
    const f = tmpFile("spark.json", JSON.stringify([
      { ts: "1", val: 5 },
      { ts: "2", val: 10 },
    ]));
    const spec = {
      root: "s",
      elements: {
        s: { type: "Sparkline", props: { dataFile: f, dataColumn: "val" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    expect((resolved.elements.s as any).props.data).toEqual([5, 10]);
  });

  it("resolves LineChart xLabelsColumn from same file", () => {
    const f = tmpFile("labeled.json", JSON.stringify([
      { date: "Mon", value: 10 },
      { date: "Tue", value: 20 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: {
          type: "LineChart",
          props: { dataFile: f, dataColumn: "value", xLabelsColumn: "date" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([10, 20]);
    expect(props.xLabels).toEqual(["Mon", "Tue"]);
  });
});
