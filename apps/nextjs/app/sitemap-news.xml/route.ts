// @ts-nocheck
import { NextResponse } from "next/server";
import { getPublishedArticlesSnapshot } from "@/lib/content/articles-source";

const BASE = "https://sgsland.vn";
const PUBLICATION_NAME = "SGS LAND";
const NEWS_WINDOW_HOURS = 48; // Google News sitemap chi nen chua bai trong 48h gan nhat
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const snapshot = await getPublishedArticlesSnapshot();
  if (!snapshot.available) {
    return new NextResponse("Published article data is unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  const articles = snapshot.articles;
  const cutoff = Date.now() - NEWS_WINDOW_HOURS * 60 * 60 * 1000;

  const entries = articles
    .filter((a) => a.slug && a.publishedAt)
    .filter((a) => {
      const t = new Date(a.publishedAt).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .map((a) => {
      const pubDate = new Date(a.publishedAt).toISOString();
      return `<url>
  <loc>${esc(`${BASE}/tin-tuc/${a.slug}`)}</loc>
  <news:news>
    <news:publication>
      <news:name>${esc(PUBLICATION_NAME)}</news:name>
      <news:language>vi</news:language>
    </news:publication>
    <news:publication_date>${pubDate}</news:publication_date>
    <news:title>${esc(a.title || "")}</news:title>
  </news:news>
</url>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
    },
  });
}
