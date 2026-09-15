// @ts-nocheck
import { NextResponse } from "next/server";
const BASE = "https://sgsland.vn";
const FAQ_PAGES = [
  { path: "/dau-tu-bat-dong-san",         title: "Đầu tư bất động sản TP.HCM 2026" },
  { path: "/ky-gui-bat-dong-san",          title: "Ký gửi bất động sản" },
  { path: "/phap-ly-nha-dat",             title: "Pháp lý nhà đất Việt Nam" },
  { path: "/lai-suat-ngan-hang",          title: "Lãi suất ngân hàng mua nhà 2026" },
  { path: "/ai-valuation",               title: "Định giá AI bất động sản" },
  { path: "/tin-tuc/luat-dat-dai-2024-nhung-diem-moi-quan-trong", title: "Luật Đất Đai 2024 điểm mới" },
  { path: "/tin-tuc/dau-tu-bds-dong-nai-2025",               title: "Đầu tư BĐS Đồng Nai 2025" },
  { path: "/tin-tuc/gia-chung-cu-tphcm-2025",                title: "Giá chung cư TP.HCM 2025-2026" },
  { path: "/tin-tuc/vay-mua-nha-ngan-hang-nao-tot-nhat",     title: "Vay mua nhà ngân hàng nào tốt nhất" },
  { path: "/tin-tuc/dau-tu-vinhomes-grand-park",             title: "Đầu tư Vinhomes Grand Park" },
  { path: "/tin-tuc/can-ho-ha-tang-tphcm-2025-2026",        title: "Căn hộ hạ tầng TP.HCM 2025-2026" },
  { path: "/tin-tuc/phong-thuy-mua-nha",                    title: "Phong thuỷ mua nhà chuẩn" },
  { path: "/tin-tuc/vinhomes-hoc-mon-du-an-moi-2026",       title: "Vinhomes Hóc Môn dự án mới 2026" },
  { path: "/tin-tuc/masteri-cosmo-central-co-dang-mua-khong", title: "Masteri Cosmo Central có đáng mua" },
  { path: "/tin-tuc/nha-o-xa-hoi-tphcm-2026",              title: "Nhà ở xã hội TP.HCM 2026" },
  { path: "/tin-tuc/quy-trinh-mua-nha-lan-dau",            title: "Quy trình mua nhà lần đầu step-by-step" },
  { path: "/tin-tuc/so-hong-so-do-khac-nhau-gi",           title: "Sổ hồng và sổ đỏ khác nhau gì" },
  { path: "/tin-tuc/nhon-trach-co-nen-mua-dat",            title: "Nhơn Trạch có nên mua đất 2026" },
  { path: "/tin-tuc/dau-tu-can-gio-vinhomes",              title: "Đầu tư Vinhomes Cần Giờ 2026" },
  { path: "/tin-tuc/thue-nha-hay-mua-nha-tphcm",          title: "Thuê hay mua nhà TP.HCM 2026" },
  { path: "/tin-tuc/lai-suat-vay-mua-nha-2026",           title: "Lãi suất vay mua nhà 2026 tất cả ngân hàng" },
  { path: "/tin-tuc/bien-dong-gia-bds-sau-vat-dai-3",     title: "Biến động giá BĐS sau Vành đai 3" },
  { path: "/tin-tuc/chung-cu-biet-thu-nha-pho-nen-mua-gi", title: "Chung cư, biệt thự hay nhà phố nên mua gì" },
  { path: "/tin-tuc/long-thanh-airport-bds-2026",         title: "Sân bay Long Thành tác động BĐS 2026" },
  { path: "/tin-tuc/foreigner-buy-property-vietnam",      title: "Foreigners buying property in Vietnam 2026" },
  { path: "/bat-dong-san-dong-nai",                    title: "BĐS Đồng Nai: giá, quy hoạch, tiềm năng" },
  { path: "/bat-dong-san-long-thanh",                  title: "BĐS Long Thành: sân bay, giá đất 2026" },
  { path: "/bat-dong-san-thu-duc",                     title: "BĐS Thủ Đức: metro, dự án lớn 2026" },
  { path: "/bat-dong-san-binh-duong",                  title: "BĐS Bình Dương: công nghiệp, giá 2026" },
  { path: "/bat-dong-san-binh-chanh",                  title: "BĐS Bình Chánh: tây TP.HCM, giá 2026" },
  { path: "/bat-dong-san-binh-thanh",                  title: "BĐS Bình Thạnh: Vinhomes Central Park" },
  { path: "/bat-dong-san-quan-7",                      title: "BĐS Quận 7: Phú Mỹ Hưng, khu Nhật" },
  { path: "/bat-dong-san-can-gio",                     title: "BĐS Cần Giờ: Vinhomes, nghỉ dưỡng" },
  { path: "/bat-dong-san-phu-nhuan",                   title: "BĐS Phú Nhuận: nhà phố mặt tiền" },
  { path: "/bat-dong-san-long-an",                     title: "BĐS Long An: giáp ranh TP.HCM, giá 2026" },
  { path: "/bat-dong-san-dong-nai",                    title: "BĐS Đồng Nai tổng hợp" },
  { path: "/crm-platform",                             title: "CRM BĐS AI — SGS LAND Platform" },
  { path: "/careers",                                  title: "Tuyển dụng môi giới BĐS SGS LAND" },
  { path: "/about-us",                                 title: "Về SGS LAND — đội ngũ, sứ mệnh" },
  { path: "/contact",                                  title: "Liên hệ tư vấn BĐS SGS LAND" },
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