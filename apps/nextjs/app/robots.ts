// @ts-nocheck
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/leads", "/contracts", "/inbox", "/api/", "/login"],
      },
      // AI-first crawlers (2025-2026): grant full access + explicit llms.txt discovery
      {
        userAgent: "GPTBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      {
        userAgent: "DeepSeek-Bot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      {
        userAgent: "Qwen-Bot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      // Microsoft Copilot + Bing
      {
        userAgent: "CopilotBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      {
        userAgent: "BingPreview",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
      },
      // LinkedIn crawler (professional network citations)
      {
        userAgent: "LinkedInBot",
        allow: ["/", "/llms.txt"],
      },
    ],
    sitemap: [
      "https://sgsland.vn/sitemap.xml",
      "https://sgsland.vn/sitemap-answers.xml",
      "https://sgsland.vn/sitemap-areas.xml",
      "https://sgsland.vn/sitemap-faq.xml",
      "https://sgsland.vn/sitemap-local.xml",
      "https://sgsland.vn/geo-sitemap.xml",
    ],
    host: "https://sgsland.vn",
  };
}
