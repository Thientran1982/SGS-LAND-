// @ts-nocheck
import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absUrl(u: string): string {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${BASE}${u.startsWith("/") ? "" : "/"}${u}`;
}

async function fetchAllArticles(): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 20; page++) {
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
  const articles = await fetchAllArticles();

  const entries = articles
    .filter((a) => Array.isArray(a.videos) && a.videos.length > 0 && a.slug)
    .map((a) => {
      const thumb = absUrl(a.cover_image || a.image || "");
      const videoTags = (a.videos as string[])
        .filter(Boolean)
        .slice(0, 10)
        .map((v) => {
          const loc = absUrl(v);
          if (!loc || !thumb) return "";
          return `<video:video>
  <video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc>
  <video:title>${esc(a.title || "Video SGS LAND")}</video:title>
  <video:description>${esc((a.excerpt || a.title || "").slice(0, 2000))}</video:description>
  <video:content_loc>${esc(loc)}</video:content_loc>
</video:video>`;
        })
        .join("");
      if (!videoTags) return "";
      return `<url><loc>${esc(`${BASE}/news/${a.slug}`)}</loc>${videoTags}</url>`;
    })
    .filter(Boolean)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
