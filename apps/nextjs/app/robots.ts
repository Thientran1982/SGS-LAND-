// @ts-nocheck
import type { MetadataRoute } from "next";

// GEO: this Route Handler is the single source of truth for /robots.txt.
// The duplicate static apps/nextjs/public/robots.txt was moved to
// apps/nextjs/content/legacy-public/ on 2026-08-11 - it collided with this
// file and made /robots.txt answer 500 text/html for every crawler.
const DISALLOW = [
  "/dashboard",
  "/leads",
  "/contracts",
  "/inbox",
  "/api/",
  "/login",
];

// Explicit allow-list of the AI discovery surface. More specific than the
// "/api/" disallow above, so /api/openapi.json and /api/public/schema.json
// stay crawlable for answer engines.
const AI_DISCOVERY = [
  "/",
  "/llms.txt",
  "/llms-full.txt",
  "/llms-en.txt",
  "/api/openapi.json",
  "/api/public/schema.json",
  "/.well-known/ai-plugin.json",
];

// Union of every AI / answer-engine user-agent that was previously split
// across three divergent robots definitions (this file: 9 UAs,
// apps/nextjs/public/robots.txt: 5 UAs, public/robots.txt: 18 UAs).
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Gemini-WebFetch",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "BingPreview",
  "CopilotBot",
  "CCBot",
  "Bytespider",
  "YouBot",
  "Amazonbot",
  "Meta-ExternalAgent",
  "DeepSeek-Bot",
  "Qwen-Bot",
  "MistralAI-User",
  "cohere-ai",
  "Diffbot",
  "Timpibot",
  "Omgilibot",
];

// Only sitemaps that actually resolve are advertised. Removed 2026-08-11:
// geo-sitemap.xml (404) plus /khu-vuc and /bao-cao-thi-truong, which are HTML
// pages, not sitemaps, and were being fed to crawlers as sitemap URLs.
const SITEMAPS = [
  "https://sgsland.vn/sitemap.xml",
  "https://sgsland.vn/sitemap-en.xml",
  "https://sgsland.vn/sitemap-answers.xml",
  "https://sgsland.vn/sitemap-areas.xml",
  "https://sgsland.vn/sitemap-faq.xml",
  "https://sgsland.vn/sitemap-local.xml",
  "https://sgsland.vn/sitemap-images.xml",
  "https://sgsland.vn/sitemap-videos.xml",
  "https://sgsland.vn/sitemap-news.xml",
  "https://sgsland.vn/feed.xml",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: "Googlebot", allow: "/", disallow: DISALLOW },
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        allow: AI_DISCOVERY,
        disallow: DISALLOW,
      })),
      { userAgent: "LinkedInBot", allow: ["/", "/llms.txt"], disallow: DISALLOW },
    ],
    sitemap: SITEMAPS,
    host: "https://sgsland.vn",
  };
}
