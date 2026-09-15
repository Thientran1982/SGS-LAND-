#!/usr/bin/env node
/**
 * Attach explicit provenance to a normalized GSC opportunity report.
 * This creates a reviewable snapshot; it does not call Search Console.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
const outFlag = process.argv.indexOf("--out");
const output = outFlag >= 0 ? process.argv[outFlag + 1] : "docs/seo/gsc-snapshot-latest.json";

if (!input) {
  console.error("Usage: gsc-snapshot <opportunity-report.json> [--out <json-file>] [--property <url>] [--period-start <date>] [--period-end <date>] [--search-type <type>] [--source <file>]");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(report.rows)) throw new Error(`${input} does not contain a rows array`);

const args = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] || null : null;
};
const source = args("--source");
const sourceInfo = source && fs.existsSync(source)
  ? {
      path: source,
      sizeBytes: fs.statSync(source).size,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    }
  : source
    ? { path: source, unavailable: true }
    : null;

const snapshot = {
  ...report,
  generatedAt: new Date().toISOString(),
  provenance: {
    property: args("--property"),
    searchType: args("--search-type"),
    periodStart: args("--period-start"),
    periodEnd: args("--period-end"),
    exportedAt: args("--exported-at"),
    source: sourceInfo,
    sourceKind: sourceInfo ? "user-provided-export" : "unspecified",
    liveApi: false,
  },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`GSC snapshot written to ${output}`);