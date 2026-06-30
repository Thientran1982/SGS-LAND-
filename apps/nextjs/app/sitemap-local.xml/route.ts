// @ts-nocheck
import { NextResponse } from "next/server";
const BASE = "https://sgsland.vn";
const LOCAL_PAGES = [
  // TP.HCM quận/huyện landing pages
  { path: "/bat-dong-san-quan-1",          title: "Bất động sản Quận 1 TP.HCM" },
  { path: "/bat-dong-san-quan-3",          title: "Bất động sản Quận 3 TP.HCM" },
  { path: "/bat-dong-san-quan-7",          title: "Bất động sản Quận 7 TP.HCM" },
  { path: "/bat-dong-san-quan-10",         title: "Bất động sản Quận 10 TP.HCM" },
  { path: "/bat-dong-san-binh-thanh",      title: "Bất động sản Bình Thạnh TP.HCM" },
  { path: "/bat-dong-san-phu-nhuan",       title: "Bất động sản Phú Nhuận TP.HCM" },
  { path: "/bat-dong-san-thu-duc",         title: "Bất động sản TP Thủ Đức TP.HCM" },
  { path: "/bat-dong-san-binh-chanh",      title: "Bất động sản Bình Chánh TP.HCM" },
  { path: "/bat-dong-san-can-gio",         title: "Bất động sản Cần Giờ TP.HCM" },
  { path: "/bat-dong-san-hoc-mon",         title: "Bất động sản Hóc Môn TP.HCM — Vinhomes Smart City" },
  { path: "/bat-dong-san-nha-be",          title: "Bất động sản Nhà Bè TP.HCM" },
  { path: "/bat-dong-san-cu-chi",          title: "Bất động sản Củ Chi TP.HCM" },
  // Đồng Nai
  { path: "/bat-dong-san-dong-nai",        title: "Bất động sản Đồng Nai tổng hợp" },
  { path: "/bat-dong-san-long-thanh",      title: "Bất động sản Long Thành Đồng Nai" },
  { path: "/bat-dong-san-nhon-trach",      title: "Bất động sản Nhơn Trạch Đồng Nai" },
  { path: "/bat-dong-san-bien-hoa",        title: "Bất động sản Biên Hòa Đồng Nai" },
  // Bình Duong
  { path: "/bat-dong-san-binh-duong",      title: "Bất động sản Bình Dương tổng hợp" },
  { path: "/bat-dong-san-thuan-an",        title: "Bất động sản Thuận An Bình Dương" },
  { path: "/bat-dong-san-di-an",           title: "Bất động sản Dĩ An Bình Dương" },
  // Long An
  { path: "/bat-dong-san-long-an",         title: "Bất động sản Long An" },
  { path: "/bat-dong-san-ben-luc",         title: "Bất động sản Bến Lức Long An" },
  // Project-area crosslinks
  { path: "/du-an/vinhomes-hoc-mon",       title: "Dự án Vinhomes Hóc Môn — Smart City 4.0" },
  { path: "/du-an/vinhomes-can-gio",       title: "Dự án Vinhomes Cần Giờ — Green Paradise" },
  { path: "/du-an/aqua-city",             title: "Dự án Aqua City Novaland — Long Thành" },
  { path: "/du-an/izumi-city",            title: "Dự án Izumi City Nam Long — Biên Hòa" },
  { path: "/du-an/vinhomes-grand-park",   title: "Dự án Vinhomes Grand Park — Thủ Đức" },
  { path: "/du-an/masteri-cosmo-central", title: "Dự án Masteri Cosmo Central — Bình Thạnh" },
];
export async function GET() {
  const now = new Date().toISOString();
  const urlset = LOCAL_PAGES.map(
    (page) => `
  <url>
    <loc>${BASE}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
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