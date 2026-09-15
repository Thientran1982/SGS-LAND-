#!/usr/bin/env node
/**
 * Crawl guard for SEO/GEO/AEO regressions.
 *
 * Usage:
 *   SEO_BASE_URL=http://localhost:5000 node scripts/seo-regression.mjs
 *
 * It intentionally checks rendered HTML and sitemap URLs only. It does not
 * submit data to search engines or mutate third-party services.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE_URL = (process.env.SEO_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const REPORT_DIR = path.resolve("docs/seo");
const failures = [];
const warnings = [];

function resolveLocalUrl(route) {
  if (!route.startsWith("http")) return `${BASE_URL}${route}`;
  const url = new URL(route);
  return url.hostname === "sgsland.vn"
    ? `${BASE_URL}${url.pathname}${url.search}`
    : route;
}

async function fetchText(route) {
  const url = resolveLocalUrl(route);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "SGSLandSeoRegression/1.0" },
    signal: AbortSignal.timeout(Number(process.env.SEO_REQUEST_TIMEOUT_MS || 20_000)),
  });
  return { url, response, text: await response.text() };
}

async function collectSitemapRoutes(route, seen = new Set()) {
  const url = resolveLocalUrl(route);
  if (seen.has(url)) return [];
  seen.add(url);
  const result = await fetchText(url);
  if (!result.response.ok) {
    addFailure("sitemap_status", `${url} returned ${result.response.status}`);
    return [];
  }
  const locations = [...result.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (/<sitemapindex[\s>]/i.test(result.text)) {
    const nested = [];
    for (const location of locations) nested.push(...await collectSitemapRoutes(location, seen));
    return nested;
  }
  return locations;
}

function addFailure(code, message) {
  failures.push({ code, message });
}

function auditHtml(route, html) {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || "";
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || "";
  const twitterCard = $('meta[name="twitter:card"]').attr("content")?.trim() || "";
  const hreflangCount = $('link[rel="alternate"][hreflang]').length;
  const h1Count = $("h1").length;
  const robots = $('meta[name="robots"]').attr("content") || "";
  const isNoIndex = /noindex/i.test(robots);

  if (!title) addFailure("missing_title", `${route}: missing <title>`);
  if (!description && !isNoIndex) addFailure("missing_description", `${route}: missing meta description`);
  if (!canonical && !isNoIndex) addFailure("missing_canonical", `${route}: missing canonical`);
  if (!isNoIndex && h1Count !== 1) addFailure("h1_count", `${route}: expected 1 H1, found ${h1Count}`);
  if (canonical && !canonical.startsWith("https://sgsland.vn/") && canonical !== "https://sgsland.vn") {
    addFailure("canonical_host", `${route}: canonical points outside sgsland.vn (${canonical})`);
  }
  if (canonical) {
    try {
      const canonicalPath = new URL(canonical).pathname.replace(/\/+$/, "") || "/";
      const sitemapPath = new URL(route, BASE_URL).pathname.replace(/\/+$/, "") || "/";
      if (canonicalPath !== sitemapPath) {
        addFailure("canonical_mismatch", `${route}: sitemap URL canonicalizes to ${canonical}`);
      }
    } catch {
      addFailure("canonical_invalid", `${route}: canonical is not an absolute URL (${canonical})`);
    }
  }
  if (!ogTitle) warnings.push({ code: "missing_og_title", message: `${route}: missing og:title` });
  if (!ogDescription) warnings.push({ code: "missing_og_description", message: `${route}: missing og:description` });
  if (!twitterCard) warnings.push({ code: "missing_twitter_card", message: `${route}: missing twitter:card` });
  if (hreflangCount === 0) warnings.push({ code: "missing_hreflang", message: `${route}: no hreflang alternate links` });

  $('script[type="application/ld+json"]').each((index, element) => {
    try {
      JSON.parse($(element).text());
    } catch {
      addFailure("invalid_jsonld", `${route}: JSON-LD block ${index + 1} is not valid JSON`);
    }
  });
  return {
    title,
    description,
    canonical,
    h1Count,
    isNoIndex,
    ogTitle,
    ogDescription,
    twitterCard,
    hreflangCount,
    internalLinkCount: $('a[href^="/"]').length,
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function consume() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

async function main() {
  const robots = await fetchText("/robots.txt");
  if (!robots.response.ok) addFailure("robots_status", `/robots.txt returned ${robots.response.status}`);
  if (!/Sitemap:\s*https?:\/\/sgsland\.vn\/sitemap\.xml/i.test(robots.text)) {
    addFailure("robots_sitemap", "/robots.txt does not advertise sitemap.xml");
  }

  const sitemapSources = [...robots.text.matchAll(/^Sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  const sitemapLocations = new Set();
  for (const source of sitemapSources.length ? sitemapSources : [`${BASE_URL}/sitemap.xml`]) {
    for (const location of await collectSitemapRoutes(source)) sitemapLocations.add(location);
  }
  const sitemapUrls = [...sitemapLocations];
  const routes = [...new Set(sitemapUrls.map((url) => new URL(url).pathname))];
  if (!routes.length) addFailure("empty_sitemap", "sitemap.xml has no URL entries");

  const pageResults = await mapWithConcurrency(
    routes,
    Number(process.env.SEO_REGRESSION_CONCURRENCY || 6),
    async (route) => {
      try {
        const result = await fetchText(route);
        if (result.response.status >= 300 && result.response.status < 400) {
          addFailure("sitemap_redirect", `${route} redirects (${result.response.status})`);
          return null;
        }
        if (!result.response.ok) {
          addFailure("sitemap_broken_url", `${route} returned ${result.response.status}`);
          return null;
        }
        return { route, ...auditHtml(route, result.text) };
      } catch (error) {
        addFailure("sitemap_fetch_error", `${route} could not be fetched: ${error.message}`);
        return null;
      }
  });
  const pages = pageResults.filter(Boolean);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    sitemapSources,
    sitemapUrlCount: routes.length,
    pagesChecked: pages.length,
    failures,
    warnings,
    pages,
  };
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(
    path.join(REPORT_DIR, "seo-regression-latest.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const markdown = [
    "# SEO/GEO/AEO Regression Check",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Base URL: ${BASE_URL}`,
    `- Sitemap URLs: ${routes.length}`,
    `- Pages checked: ${pages.length}`,
    `- Failures: ${failures.length}`,
    `- Warnings: ${warnings.length}`,
    "",
    ...(failures.length ? failures.map((item) => `- **${item.code}** — ${item.message}`) : ["- No failures"]),
  ].join("\n") + "\n";
  await writeFile(path.join(REPORT_DIR, "seo-regression-latest.md"), markdown);

  console.log(`SEO regression: ${pages.length} pages, ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});