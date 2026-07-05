import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
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

async function fetchRecentArticles(): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 5; page++) {
    let json: any;
    try {
      const res = await fetch(
        `${API_BASE}/api/public/articles?page=${page}&pageSize=200`,
        { cache: "no-store" }
      );
      if (!res.ok) break;
      json = await res.json();
    } catch {
      break;
    }
    const data = json?.data ?? [];
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 200) break;
  }
  return all;
}

export async function GET() {
  const articles = await fetchRecentArticles();

  const items = articles
    .filter((a) => a.slug && (a.publishedAt || a.published_at))
    .map((a) => ({
      ...a,
      _pub: new Date(a.publishedAt || a.published_at).getTime(),
    }))
    .filter((a) => Number.isFinite(a._pub))
    .sort((a, b) => b._pub - a._pub)
    .slice(0, MAX_ITEMS)
    .map((a) => {
      const link = `${BASE}/news/${a.slug}`;
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
