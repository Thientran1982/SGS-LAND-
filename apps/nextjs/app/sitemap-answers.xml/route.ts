// @ts-nocheck
import { NextResponse } from "next/server";
const BASE = "https://sgsland.vn";
const ANSWER_PAGES = [
  { path: "/dau-tu-bat-dong-san",     title: "Đầu tư bất động sản" },
  { path: "/ky-gui-bat-dong-san",     title: "Ký gửi bất động sản" },
  { path: "/phap-ly-nha-dat",         title: "Pháp lý nhà đất" },
  { path: "/lai-suat-ngan-hang",      title: "Lãi suất ngân hàng" },
  { path: "/ai-valuation",            title: "Định giá AI" },
];
export async function GET() {
  const now = new Date().toISOString();
  const urls = ANSWER_PAGES.map(
    ({ path }) => `
  <url>
    <loc>${BASE}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>`
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}