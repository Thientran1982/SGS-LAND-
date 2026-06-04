import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";

const AREA_PAGES = [
  { path: "/bat-dong-san-dong-nai",    priority: 0.8 },
  { path: "/bat-dong-san-long-thanh",  priority: 0.8 },
  { path: "/bat-dong-san-thu-duc",     priority: 0.8 },
  { path: "/bat-dong-san-binh-duong",  priority: 0.8 },
  { path: "/bat-dong-san-quan-7",      priority: 0.8 },
  { path: "/bat-dong-san-phu-nhuan",   priority: 0.7 },
  { path: "/bat-dong-san-binh-chanh",  priority: 0.7 },
  { path: "/bat-dong-san-can-gio",     priority: 0.7 },
  { path: "/bat-dong-san-binh-thanh",  priority: 0.7 },
  { path: "/bat-dong-san-long-an",     priority: 0.7 },
  // Price-index data pages (GEO: structured area price data)
  { path: "/lai-suat-ngan-hang",       priority: 0.7 },
  { path: "/marketplace",              priority: 0.9 },
  { path: "/du-an",                    priority: 0.8 },
  { path: "/du-an/vinhomes-hoc-mon",   priority: 0.8 },
  { path: "/du-an/masteri-cosmo-central", priority: 0.8 },
  { path: "/du-an/aqua-city",          priority: 0.8 },
  { path: "/du-an/the-global-city",    priority: 0.8 },
  { path: "/du-an/vinhomes-grand-park", priority: 0.8 },
  { path: "/du-an/izumi-city",         priority: 0.8 },
  { path: "/du-an/vinhomes-can-gio",   priority: 0.8 },
];

export async function GET() {
  const now = new Date().toISOString();

  const urls = AREA_PAGES.map(
    ({ path, priority }) => `
  <url>
    <loc>${BASE}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  ).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
