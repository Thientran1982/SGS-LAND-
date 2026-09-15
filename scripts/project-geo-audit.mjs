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
  const response = await fetch(url, {
    redirect: "manual",
    cache: "no-store",
    headers: { "cache-control": "no-cache", "x-geo-audit": "rendered-html" },
    signal: AbortSignal.timeout(20_000),
  });
  return { response, html: await response.text() };
}

function jsonLd($) {
  return $('script[type="application/ld+json"]').map((_, el) => {
    try { return JSON.parse($(el).text()); } catch { return null; }
  }).get().flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean);
}

function auditPage(routePath, status, html) {
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
  const visibleAnswerNode = $(".lp-answer p, .lp-hero-answer, [aria-labelledby='geo-answer-heading'] p")
    .filter((_, el) => $(el).text().trim().length >= 80)
    .first();
  const answerNode = visibleAnswerNode.length
    ? visibleAnswerNode
    : $(".answer-box").filter((_, el) => $(el).text().trim().length >= 80).first();
  const answerText = answerNode.text().replace(/\s+/g, " ").trim();
  const answerWords = answerText ? answerText.split(/\s+/).length : 0;
  const answerLike = answerNode.length > 0;
  const reviewedAt = $("[data-geo-reviewed-at]").attr("data-geo-reviewed-at") || "";
  const evidenceState = $("[data-geo-evidence]").attr("data-geo-evidence") || "";
  const sourceLinks = $("a[href]").map((_, el) => $(el).attr("href")).get()
    .filter((href) => /^https?:\/\//i.test(href || "") && !href.startsWith(base));
  const schemaFactKeys = schemas
    .filter((schema) => {
      const type = Array.isArray(schema["@type"]) ? schema["@type"] : [schema["@type"]];
      return type.some((item) => ["RealEstateProject", "RealEstateListing", "Residence", "Offer", "AggregateOffer"].includes(item));
    })
    .flatMap((schema) => [
    schema.offers ? "offers" : null,
    schema.floorSize ? "floorSize" : null,
    schema.amenityFeature ? "amenityFeature" : null,
    schema.priceRange ? "priceRange" : null,
  ].filter(Boolean));
  const faqVisible = $("h2, h3").filter((_, el) => /câu hỏi|faq|frequently asked/i.test($(el).text())).length > 0;
  const issues = [];
  if (status !== 200) issues.push(`HTTP_${status}`);
  if (!title) issues.push("MISSING_TITLE");
  if (!description) issues.push("MISSING_DESCRIPTION");
  if (!canonical) issues.push("MISSING_CANONICAL");
  if (h1.length !== 1) issues.push(`H1_COUNT_${h1.length}`);
  if (!answerLike) issues.push("MISSING_DIRECT_ANSWER");
  if (answerLike && (answerWords < 40 || answerWords > 60)) issues.push(`DIRECT_ANSWER_WORDS_${answerWords}`);
  if (!reviewedAt) issues.push("MISSING_REVIEW_DATE");
  if (!evidenceState) issues.push("MISSING_EVIDENCE_STATE");
  if (!schemaTypes.includes("BreadcrumbList")) issues.push("MISSING_BREADCRUMB_SCHEMA");
  if (!schemaTypes.includes("FAQPage") && !faqVisible) issues.push("MISSING_VISIBLE_FAQ");
  if (canonical && !/^https:\/\/sgsland\.vn\/(du-an|landing)\//.test(canonical)) issues.push("CANONICAL_HOST_OR_PATH");
  if (!/xác minh|xem xét|tham khảo|verify|indicative|official/i.test(text)) issues.push("MISSING_CAVEAT_OR_PROVENANCE");
  if (schemaFactKeys.length && evidenceState !== "available") issues.push("UNSUPPORTED_SCHEMA_FACTS");
  if (evidenceState === "available" && sourceLinks.length === 0) issues.push("EVIDENCE_WITHOUT_SOURCE_LINK");
  const normalizeEntity = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const routeSlug = routePath.split("/").filter(Boolean).pop() || "";
  if (routeSlug && !normalizeEntity(text).includes(normalizeEntity(routeSlug))) issues.push("ENTITY_ROUTE_MISMATCH");
  const passed = 17 - issues.length;
  return {
    slug: routePath.split("/").filter(Boolean).pop(),
    routePath,
    url: `${base}${routePath}`,
    status,
    score: Math.max(0, Math.round((passed / 17) * 100)),
    title,
    description,
    canonical,
    h1,
    schemaTypes: [...new Set(schemaTypes)],
    directAnswer: answerLike,
    directAnswerWords: answerWords,
    reviewedAt,
    evidenceState,
    sourceLinkCount: sourceLinks.length,
    schemaFactKeys: [...new Set(schemaFactKeys)],
    visibleFaq: faqVisible,
    issues,
  };
}

const sitemap = await fetchText(`${base}/sitemap.xml`);
if (!sitemap.response.ok) throw new Error(`Sitemap returned HTTP ${sitemap.response.status}`);
const sitemapXml = cheerio.load(sitemap.html, { xmlMode: true });
const urls = sitemapXml("url loc").map((_, el) => sitemapXml(el).text().trim()).get()
  .filter((url) => /\/(du-an|landing)\/[^/?#]+$/.test(url));
const landingSlugs = [
  "legacy-66",
  "masteri-cosmo-central",
  "vinhomes-grand-park",
  "the-global-city",
  "izumi-city",
  "vinhomes-central-park",
  "masteri-park-place",
  "diamond-sky-van-phuc-city",
  "thu-thiem",
];
for (const slug of landingSlugs) urls.push(`${base}/landing/${slug}`);
const results = [];
const uniqueUrls = [...new Set(urls.map((url) => new URL(url).pathname))];
const concurrency = Number(process.env.GEO_AUDIT_CONCURRENCY || 1);
for (let index = 0; index < uniqueUrls.length; index += concurrency) {
  const batch = uniqueUrls.slice(index, index + concurrency);
  const batchResults = await Promise.all(batch.map(async (url) => {
    const routePath = url;
    try {
      const separator = routePath.includes("?") ? "&" : "?";
      let page = await fetchText(`${base}${routePath}${separator}__geo_audit=1`);
      let result = auditPage(routePath, page.response.status, page.html);
      if (result.issues.includes("MISSING_REVIEW_DATE") || result.issues.includes("MISSING_EVIDENCE_STATE")) {
        page = await fetchText(`${base}${routePath}${separator}__geo_audit=retry`);
        result = auditPage(routePath, page.response.status, page.html);
      }
      return result;
    } catch (error) {
      return auditPage(routePath, 0, `<!doctype html><title>Fetch error</title><p>${error.message}</p>`);
    }
  }));
  results.push(...batchResults);
}

const report = {
  generatedAt: new Date().toISOString(),
  base,
  methodology: "Rendered HTML audit for project and landing sitemap URLs: status, metadata, H1, 40–60 word visible direct answer, visible FAQ, JSON-LD, review date, evidence state, source links, entity consistency and unsupported schema facts.",
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