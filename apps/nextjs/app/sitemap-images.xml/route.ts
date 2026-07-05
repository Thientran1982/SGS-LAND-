// @ts-nocheck
import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function slugifyListing(title: string, code: string): string {
  const base = (title || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return `${base}-${code}`;
}

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

async function fetchAllListings(): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 20; page++) {
    let json: any;
    try {
      const res = await fetch(`${API_BASE}/api/public/listings?page=${page}&pageSize=500`, { cache: "no-store" });
      if (!res.ok) break;
      json = await res.json();
    } catch {
      break;
    }
    const data = json?.data ?? json?.listings ?? [];
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 500) break;
  }
  return all;
}

export async function GET() {
  const listings = await fetchAllListings();

  const entries = listings
    .filter((l) => Array.isArray(l.images) && l.images.length > 0)
    .map((l) => {
      const slug = slugifyListing(l.title, l.code);
      const imgTags = (l.images as string[])
        .filter(Boolean)
        .slice(0, 30)
        .map((img) => {
          const loc = absUrl(img);
          if (!loc) return "";
          return `<image:image><image:loc>${esc(loc)}</image:loc>${
            l.title ? `<image:title>${esc(l.title)}</image:title>` : ""
          }</image:image>`;
        })
        .join("");
      if (!imgTags) return "";
      return `<url><loc>${esc(`${BASE}/bds/${slug}`)}</loc>${imgTags}</url>`;
    })
    .filter(Boolean)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
