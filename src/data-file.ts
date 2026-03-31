import fs from "node:fs";
import path from "node:path";

export type ParsedData = number[] | number[][] | Record<string, unknown>[];

export function parseDataFile(filePath: string): ParsedData {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf-8").trim();
  const ext = path.extname(resolved).toLowerCase();

  if (ext === ".json") {
    return parseJSON(content);
  }

  if (ext === ".csv" || ext === ".tsv") {
    return parseCSV(content);
  }

  if (content.startsWith("[") || content.startsWith("{")) {
    try {
      return parseJSON(content);
    } catch {
      // fall through to newline-delimited
    }
  }

  return parseNewlineNumbers(content);
}

function parseJSON(content: string): ParsedData {
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON data must be an array");
  }
  return parsed;
}

function parseCSV(content: string): Record<string, string>[] {
  const delimiter = content.includes("\t") ? "\t" : ",";
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? "";
    }
    return row;
  });
}

function parseNewlineNumbers(content: string): number[] {
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  const numbers = lines.map((l) => {
    const n = Number(l.trim());
    if (isNaN(n)) throw new Error(`Not a number: "${l.trim()}"`);
    return n;
  });
  return numbers;
}
