// @ts-nocheck
import { NextResponse } from "next/server";

const BASE = "https://sgsland.vn";

const ANSWER_PAGES = [
  { path: "/dau-tu-bat-dong-san",     title: "Đầu tư bất động sản" },
  { path: "/ky-gui-bat-dong-san",     title: "Ký gửi bất động sản" },
  { path: "/phap-ly-nha-dat",         title: "Pháp lý nhà đất" },
  { path: "/lai-suat-ngan-hang",      title: "Lãi suất ngân hàng" },
  { path: "/ai-valuation",            title: "Định giá AI" },
  { path: "/news/luat-dat-dai-2024-nhung-diem-moi-quan-trong", title: "Luật Đất Đai 2024" },
  { path: "/news/dau-tu-bds-dong-nai-2025", title: "Đầu tư BĐS Đồng Nai 2025" },
  { path: "/news/gia-chung-cu-tphcm-2025", title: "Giá chung cư TP.HCM 2025" },
  { path: "/news/vay-mua-nha-ngan-hang-nao-tot-nhat", title: "Vay mua nhà ngân hàng nào tốt nhất" },
  { path: "/news/dau-tu-vinhomes-grand-park", title: "Đầu tư Vinhomes Grand Park" },
  { path: "/news/phong-thuy-mua-nha", title: "Phong thuỷ mua nhà" },
  { path: "/news/can-ho-ha-tang-tphcm-2025-2026", title: "Căn hộ hạ tầng TP.HCM 2025-2026" },
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
