import { describe, it, expect } from "vitest";
import { parseDataFile } from "./data-file.js";
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
