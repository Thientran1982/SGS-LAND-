#!/usr/bin/env node
/**
 * Audit every project URL exposed by the live sitemap.
 * This checks the rendered HTML that search and answer crawlers receive,
 * rather than only checking source metadata.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const base = (process.env.SEO_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const output = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "docs/seo/project-geo-audit-latest.json";

async function fetchText(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
  return { response, html: await response.text() };
}

function jsonLd($) {
  return $('script[type="application/ld+json"]').map((_, el) => {
    try { return JSON.parse($(el).text()); } catch { return null; }
  }).get().flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean);
}

function auditPage(slug, status, html) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || "";
  const h1 = $("h1").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  const schemas = jsonLd($);
  const schemaTypes = schemas.flatMap((schema) => {
    const type = schema["@type"];
    return Array.isArray(type) ? type : type ? [type] : [];
  });
  const answerLike = $(".answer-box, [role='note'], [itemprop='description']").filter((_, el) => $(el).text().trim().length >= 80).length > 0;
  const faqVisible = $("h2, h3").filter((_, el) => /câu hỏi|faq|frequently asked/i.test($(el).text())).length > 0;
  const issues = [];
  if (status !== 200) issues.push(`HTTP_${status}`);
  if (!title) issues.push("MISSING_TITLE");
  if (!description) issues.push("MISSING_DESCRIPTION");
  if (!canonical) issues.push("MISSING_CANONICAL");
  if (h1.length !== 1) issues.push(`H1_COUNT_${h1.length}`);
  if (!answerLike) issues.push("MISSING_DIRECT_ANSWER");
  if (!schemaTypes.includes("BreadcrumbList")) issues.push("MISSING_BREADCRUMB_SCHEMA");
  if (!schemaTypes.includes("FAQPage") && !faqVisible) issues.push("MISSING_VISIBLE_FAQ");
  if (canonical && !canonical.startsWith("https://sgsland.vn/du-an/")) issues.push("CANONICAL_HOST_OR_PATH");
  if (!/xác minh|xem xét|tham khảo|verify|indicative|official/i.test(text)) issues.push("MISSING_CAVEAT_OR_PROVENANCE");
  const passed = 10 - issues.length;
  return {
    slug,
    url: `${base}/du-an/${slug}`,
    status,
    score: Math.max(0, Math.round((passed / 10) * 100)),
    title,
    description,
    canonical,
    h1,
    schemaTypes: [...new Set(schemaTypes)],
    directAnswer: answerLike,
    visibleFaq: faqVisible,
    issues,
  };
}

const sitemap = await fetchText(`${base}/sitemap.xml`);
if (!sitemap.response.ok) throw new Error(`Sitemap returned HTTP ${sitemap.response.status}`);
const sitemapXml = cheerio.load(sitemap.html, { xmlMode: true });
const urls = sitemapXml("url loc").map((_, el) => sitemapXml(el).text().trim()).get()
  .filter((url) => /\/du-an\/[^/?#]+$/.test(url));
const results = [];
for (const url of [...new Set(urls)]) {
  const slug = url.split("/").pop();
  try {
    const page = await fetchText(`${base}/du-an/${slug}`);
    results.push(auditPage(slug, page.response.status, page.html));
  } catch (error) {
    results.push(auditPage(slug, 0, `<!doctype html><title>Fetch error</title><p>${error.message}</p>`));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  base,
  methodology: "Rendered HTML audit for project sitemap URLs: status, metadata, H1, direct answer, visible FAQ, JSON-LD and provenance caveat.",
  total: results.length,
  passed: results.filter((r) => r.issues.length === 0).length,
  averageScore: results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0,
  results,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Project GEO audit: ${report.total} pages, ${report.passed} clean, average ${report.averageScore}/100`);
for (const result of results.filter((r) => r.issues.length)) {
  console.log(`${result.slug}: ${result.score}/100 — ${result.issues.join(", ")}`);
}
if (results.some((r) => r.status >= 500 || r.status === 0)) process.exitCode = 1;