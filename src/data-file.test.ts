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

  it("auto-detects numeric column from CSV for LineChart", () => {
    const f = tmpFile("line-csv.csv", "date,value\nMon,10\nTue,20\nWed,30\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "LineChart", props: { dataFile: f, label: "CSV" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([10, 20, 30]);
    expect(props.dataFile).toBeUndefined();
  });

  it("auto-detects value column from CSV for BarChart", () => {
    const f = tmpFile("bar-csv.csv", "service,latency\napi,45\nweb,30\ndb,12\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "BarChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { label: "api", value: 45 },
      { label: "web", value: 30 },
      { label: "db", value: 12 },
    ]);
  });

  it("auto-detects numeric column from CSV for Histogram", () => {
    const f = tmpFile("hist-csv.csv", "id,latency\na,12\nb,15\nc,20\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "Histogram", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([12, 15, 20]);
  });

  it("resolves Timeline dataFile with explicit columns from JSON", () => {
    const f = tmpFile("timeline.json", JSON.stringify([
      { milestone: "v1.0", detail: "Initial launch", when: "2026-03-01", state: "done" },
      { milestone: "v1.1", detail: "Perf improvements", when: "2026-04-15", state: "pending" },
    ]));
    const spec = {
      root: "t",
      elements: {
        t: {
          type: "Timeline",
          props: { dataFile: f, titleColumn: "milestone", descriptionColumn: "detail", dateColumn: "when", statusColumn: "state" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.t as any).props;
    expect(props.items).toEqual([
      { title: "v1.0", description: "Initial launch", date: "2026-03-01", status: "done" },
      { title: "v1.1", description: "Perf improvements", date: "2026-04-15", status: "pending" },
    ]);
    expect(props.dataFile).toBeUndefined();
    expect(props.titleColumn).toBeUndefined();
  });

  it("resolves Timeline from CSV with auto-detected title and dateColumn", () => {
    const f = tmpFile("timeline.csv", "title,date,status\nKickoff,2026-01-01,done\nLaunch,2026-06-01,pending\n");
    const spec = {
      root: "t",
      elements: {
        t: {
          type: "Timeline",
          props: { dataFile: f, dateColumn: "date", statusColumn: "status" },
          children: [],
        },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.t as any).props;
    expect(props.items).toEqual([
      { title: "Kickoff", date: "2026-01-01", status: "done" },
      { title: "Launch", date: "2026-06-01", status: "pending" },
    ]);
  });

  it("throws when Timeline CSV has no string column and no titleColumn", () => {
    const f = tmpFile("nums-only.json", JSON.stringify([
      [1, 2, 3],
      [4, 5, 6],
    ]));
    const spec = {
      root: "t",
      elements: {
        t: { type: "Timeline", props: { dataFile: f }, children: [] },
      },
    };
    expect(() => resolveDataFiles(spec)).toThrow(/array of objects/i);
  });

  it("throws when CSV has no numeric column and no dataColumn specified", () => {
    const f = tmpFile("no-nums.csv", "name,role\nalice,eng\nbob,pm\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "LineChart", props: { dataFile: f }, children: [] },
      },
    };
    expect(() => resolveDataFiles(spec)).toThrow(/no.*numeric.*column/i);
  });

  it("resolves CandlestickChart dataFile from JSON objects", () => {
    const f = tmpFile("ohlc.json", JSON.stringify([
      { time: "2024-01-01", open: 100, high: 105, low: 98, close: 103 },
      { time: "2024-01-02", open: 103, high: 110, low: 101, close: 108 },
    ]));
    const spec = {
      root: "c",
      elements: {
        c: { type: "CandlestickChart", props: { dataFile: f, label: "AAPL" }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toEqual([
      { time: "2024-01-01", open: 100, high: 105, low: 98, close: 103 },
      { time: "2024-01-02", open: 103, high: 110, low: 101, close: 108 },
    ]);
    expect(props.dataFile).toBeUndefined();
    expect(props.label).toBe("AAPL");
  });

  it("resolves CandlestickChart dataFile from CSV", () => {
    const f = tmpFile("ohlc.csv", "time,open,high,low,close\n2024-01-01,100,105,98,103\n2024-01-02,103,110,101,108\n");
    const spec = {
      root: "c",
      elements: {
        c: { type: "CandlestickChart", props: { dataFile: f }, children: [] },
      },
    };
    const resolved = resolveDataFiles(spec);
    const props = (resolved.elements.c as any).props;
    expect(props.data).toHaveLength(2);
    expect(props.data[0].open).toBe(100);
    expect(props.data[0].time).toBe("2024-01-01");
  });

  it("resolves AreaChart and BaselineChart via numeric array path", () => {
    const f = tmpFile("area.json", "[10, 20, 30, 40]");
    for (const type of ["AreaChart", "BaselineChart"]) {
      const spec = {
        root: "c",
        elements: {
          c: { type, props: { dataFile: f }, children: [] },
        },
      };
      const resolved = resolveDataFiles(spec);
      const props = (resolved.elements.c as any).props;
      expect(props.data).toEqual([10, 20, 30, 40]);
    }
  });
});
