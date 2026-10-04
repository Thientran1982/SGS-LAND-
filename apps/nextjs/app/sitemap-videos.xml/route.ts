// @ts-nocheck
import { NextResponse } from "next/server";
import { getPublishedArticlesSnapshot } from "@/lib/content/articles-source";

const BASE = "https://sgsland.vn";
export const dynamic = "force-dynamic";

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

export async function GET() {
  const snapshot = await getPublishedArticlesSnapshot();
  if (!snapshot.available) {
    return new NextResponse("Published article data is unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }

  const entries = snapshot.rows
    .filter((a) => Array.isArray(a.videos) && a.videos.length > 0 && a.slug)
    .map((a) => {
      const thumb = absUrl(a.coverImage || a.cover_image || a.image || "");
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
      return `<url><loc>${esc(`${BASE}/tin-tuc/${a.slug}`)}</loc>${videoTags}</url>`;
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
