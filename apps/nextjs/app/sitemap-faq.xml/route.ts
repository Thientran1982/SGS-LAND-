// @ts-nocheck
import { NextResponse } from "next/server";
const BASE = "https://sgsland.vn";
const FAQ_PAGES = [
  { path: "/", title: "Câu hỏi thường gặp SGS LAND" },
  { path: "/phap-ly-nha-dat", title: "Câu hỏi thường gặp về pháp lý nhà đất" },
  { path: "/ai-valuation", title: "Câu hỏi thường gặp về định giá AI" },
];
export async function GET() {
  const now = new Date().toISOString();
  const urlset = FAQ_PAGES.map(
    (page) => `
  <url>
    <loc>${BASE}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlset}
</urlset>`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400",
    },
  });
}