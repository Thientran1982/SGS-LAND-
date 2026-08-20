#!/usr/bin/env node
/**
 * Turn a Google Search Console Performance export into a reproducible
 * query-to-page opportunity map. The input can be a directory containing
 * CSV exports, or a single CSV file. No API credentials are needed.
 *
 * Usage:
 *   node scripts/gsc-opportunity-report.mjs docs/seo/gsc-export --out docs/seo/gsc-query-page-map.json
 */
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
const outFlag = process.argv.indexOf("--out");
const output = outFlag >= 0 ? process.argv[outFlag + 1] : "docs/seo/gsc-query-page-map.json";
if (!input) {
  console.error("Usage: gsc-opportunity-report <csv-file-or-directory> [--out <json-file>]");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase();
}
function number(value) {
  const n = Number(String(value ?? "").replace(/[% ,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function readFiles(target) {
  const stat = fs.statSync(target);
  return stat.isDirectory()
    ? fs.readdirSync(target, { encoding: "buffer" })
        .filter(f => f.toString("utf8").toLowerCase().endsWith(".csv"))
        .map(f => Buffer.concat([Buffer.from(`${target}/`), f]))
    : [target];
}
function intent(query) {
  const q = normalise(query);
  if (/sgs\\s*land|sgsland/.test(q)) return "brand";
  if (/đồng nai|dong nai|long thành|long thanh|biên hòa|bien hoa|aqua city|izumi|grand manhattan/.test(q)) return "location-project";
  if (/pháp lý|phap ly|sổ hồng|so hong|hợp đồng|hop dong/.test(q)) return "legal";
  if (/lãi suất|lai suat|vay|tài chính|tai chinh/.test(q)) return "financing";
  if (/định giá|dinh gia|giá nhà|gia nha|giá đất|gia dat/.test(q)) return "valuation";
  return "real-estate";
}
function recommendedPage(query) {
  switch (intent(query)) {
    case "brand": return "/";
    case "location-project": {
      const q = normalise(query);
      if (/legacy\\s*66/.test(q)) return "/landing/legacy-66/";
      if (/masteri\\s*cosmo/.test(q)) return "/landing/masteri-cosmo-central/";
      if (/central\\s*park|vinhome/.test(q)) return "/du-an/vinhomes-central-park";
      if (/long thành|long thanh/.test(q)) return "/bat-dong-san-long-thanh";
      if (/đồng nai|dong nai/.test(q)) return "/bat-dong-san-dong-nai";
      if (/aqua city/.test(q)) return "/du-an/aqua-city";
      if (/izumi/.test(q)) return "/du-an/izumi-city";
      if (/manhattan/.test(q)) return "/du-an/manhattan";
      return "/bat-dong-san-dong-nai";
    }
    case "legal": return "/phap-ly-nha-dat";
    case "financing": return "/lai-suat-ngan-hang";
    case "valuation": return "/ai-valuation";
    default: return "/marketplace";
  }
}

const records = [];
for (const file of readFiles(input)) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    console.warn(`Skipping unreadable CSV ${file.toString()}: ${error.message}`);
    continue;
  }
  const rows = parseCsv(text);
  if (rows.length < 2) continue;
  const headers = rows[0].map(normalise);
  const find = (...names) => names.map(normalise).map(n => headers.indexOf(n)).find(i => i >= 0);
  const queryIndex = find("top queries", "query", "truy vấn hàng đầu", "truy vấn phổ biến nhất");
  const pageIndex = find("top pages", "page", "trang hàng đầu");
  if (queryIndex < 0) continue;
  const impressionsIndex = find("impressions", "lượt hiển thị");
  const clicksIndex = find("clicks", "số lần nhấp", "lượt nhấp");
  const ctrIndex = find("ctr", "tỷ lệ nhấp");
  const positionIndex = find("position", "vị trí");
  for (const row of rows.slice(1)) {
    const query = row[queryIndex]?.trim();
    const observedPage = pageIndex >= 0 ? row[pageIndex]?.trim() : "";
    const page = observedPage || recommendedPage(query);
    if (!query || !page) continue;
    const impressions = number(row[impressionsIndex]);
    const clicks = number(row[clicksIndex]);
    const ctr = number(row[ctrIndex]) > 1 ? number(row[ctrIndex]) / 100 : number(row[ctrIndex]);
    const position = number(row[positionIndex]);
    const opportunity = Math.round(impressions * Math.max(0, 0.12 - ctr) * (position > 0 && position < 20 ? 1 + (20 - position) / 20 : 0.5) * 100) / 100;
    records.push({
      query, page, intent: intent(query), impressions, clicks, ctr, position, opportunity,
      pageEvidence: Boolean(observedPage),
      source: file.toString(),
    });
  }
}
records.sort((a, b) => b.opportunity - a.opportunity || b.impressions - a.impressions);
const report = {
  generatedAt: new Date().toISOString(),
  methodology: "Opportunity = impressions × max(0, 12% − CTR) × position-weight; source is the GSC CSV export named per row.",
  totalRows: records.length,
  totals: records.reduce((a, r) => ({ impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks }), { impressions: 0, clicks: 0 }),
  rows: records,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Wrote ${records.length} query-page rows to ${output}`);