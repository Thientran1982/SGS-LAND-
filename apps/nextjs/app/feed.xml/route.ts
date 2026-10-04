import { NextResponse } from "next/server";
import { getPublishedArticlesSnapshot } from "@/lib/content/articles-source";

const BASE = "https://sgsland.vn";
const FEED_TITLE = "SGS LAND - Tin tuc & Phan tich bat dong san";
const FEED_DESC =
  "Cap nhat tin tuc, phan tich thi truong va kien thuc bat dong san tu SGS LAND.";
const MAX_ITEMS = 50;

export const dynamic = "force-dynamic";
export const revalidate = 900;

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  const items = articles
    .filter((a) => a.slug && a.publishedAt)
    .map((a) => ({ ...a, _pub: new Date(a.publishedAt).getTime() }))
    .filter((a) => Number.isFinite(a._pub))
    .sort((a, b) => b._pub - a._pub)
    .slice(0, MAX_ITEMS)
    .map((a) => {
      const link = `${BASE}/tin-tuc/${a.slug}`;
      const pubDate = new Date(a._pub).toUTCString();
      const desc = a.excerpt || a.summary || "";
      const cat = a.category ? `\n      <category>${esc(a.category)}</category>` : "";
      return `    <item>
      <title>${esc(a.title || "")}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>${cat}
      <description>${esc(desc)}</description>
    </item>`;
    })
    .join("\n");

  const lastBuild = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(FEED_TITLE)}</title>
    <link>${BASE}</link>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${esc(FEED_DESC)}</description>
    <language>vi</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
    },
  });
}
