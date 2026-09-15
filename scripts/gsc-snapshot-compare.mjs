#!/usr/bin/env node
/**
 * Compare two normalized GSC opportunity reports without inventing missing
 * measurements. Each input must contain a `rows` array with query/page,
 * clicks, impressions, ctr and position fields.
 *
 * Usage:
 *   node scripts/gsc-snapshot-compare.mjs before.json after.json --out report.json
 */
import fs from "node:fs";
import path from "node:path";

const [beforePath, afterPath] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const outFlag = process.argv.indexOf("--out");
const output = outFlag >= 0 ? process.argv[outFlag + 1] : "docs/seo/gsc-before-after-latest.json";

if (!beforePath || !afterPath) {
  console.error("Usage: gsc-snapshot-compare <before.json> <after.json> [--out <json-file>]");
  process.exit(1);
}

function readReport(file) {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(report.rows)) throw new Error(`${file} does not contain a rows array`);
  return report;
}

function key(row) {
  return `${String(row.query || "").trim().toLocaleLowerCase()}|${String(row.page || "").trim()}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricDelta(before, after) {
  const beforeValue = number(before);
  const afterValue = number(after);
  return beforeValue === null || afterValue === null ? null : afterValue - beforeValue;
}

function compareRow(before, after) {
  return {
    query: after?.query || before?.query,
    page: after?.page || before?.page,
    status: before && after ? "changed" : before ? "removed" : "new",
    before: before
      ? { clicks: before.clicks, impressions: before.impressions, ctr: before.ctr, position: before.position }
      : null,
    after: after
      ? { clicks: after.clicks, impressions: after.impressions, ctr: after.ctr, position: after.position }
      : null,
    delta: before && after
      ? {
          clicks: metricDelta(before.clicks, after.clicks),
          impressions: metricDelta(before.impressions, after.impressions),
          ctr: metricDelta(before.ctr, after.ctr),
          position: metricDelta(before.position, after.position),
        }
      : null,
  };
}

const before = readReport(beforePath);
const after = readReport(afterPath);
const beforeByKey = new Map(before.rows.map((row) => [key(row), row]));
const afterByKey = new Map(after.rows.map((row) => [key(row), row]));
const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])];
const rows = keys.map((rowKey) => compareRow(beforeByKey.get(rowKey), afterByKey.get(rowKey)));

const report = {
  generatedAt: new Date().toISOString(),
  methodology: "Exact query + page key join. Missing rows remain new/removed; no missing metric is converted to zero.",
  before: {
    file: path.basename(beforePath),
    generatedAt: before.generatedAt || null,
    provenance: before.provenance || null,
    totals: before.totals || null,
  },
  after: {
    file: path.basename(afterPath),
    generatedAt: after.generatedAt || null,
    provenance: after.provenance || null,
    totals: after.totals || null,
  },
  summary: {
    comparedKeys: rows.length,
    changed: rows.filter((row) => row.status === "changed").length,
    new: rows.filter((row) => row.status === "new").length,
    removed: rows.filter((row) => row.status === "removed").length,
    improvedCtr: rows.filter((row) => row.delta?.ctr > 0).length,
    worsenedCtr: rows.filter((row) => row.delta?.ctr < 0).length,
    improvedPosition: rows.filter((row) => row.delta?.position < 0).length,
    worsenedPosition: rows.filter((row) => row.delta?.position > 0).length,
  },
  rows,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`GSC before/after: ${rows.length} query-page keys written to ${output}`);