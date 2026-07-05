// @ts-nocheck
import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const PUBLICATION_NAME = "SGS LAND";
const NEWS_WINDOW_HOURS = 48; // Google News sitemap chi nen chua bai trong 48h gan nhat

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchRecentArticles(): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 5; page++) {
    let json: any;
    try {
      const res = await fetch(`${API_BASE}/api/public/articles?page=${page}&pageSize=200`, { cache: "no-store" });
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
  const cutoff = Date.now() - NEWS_WINDOW_HOURS * 60 * 60 * 1000;

  const entries = articles
    .filter((a) => a.slug && a.published_at)
    .filter((a) => {
      const t = new Date(a.published_at).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .map((a) => {
      const pubDate = new Date(a.published_at).toISOString();
      return `<url>
  <loc>${esc(`${BASE}/news/${a.slug}`)}</loc>
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
