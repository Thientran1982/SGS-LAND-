// @ts-nocheck
import { NextResponse } from "next/server";
const BASE = "https://sgsland.vn";
const FAQ_PAGES = [
  { path: "/dau-tu-bat-dong-san",         title: "Đầu tư bất động sản TP.HCM 2026" },
  { path: "/ky-gui-bat-dong-san",          title: "Ký gửi bất động sản" },
  { path: "/phap-ly-nha-dat",             title: "Pháp lý nhà đất Việt Nam" },
  { path: "/lai-suat-ngan-hang",          title: "Lãi suất ngân hàng mua nhà 2026" },
  { path: "/ai-valuation",               title: "Định giá AI bất động sản" },
  { path: "/mua-nha-lan-dau",            title: "Hướng dẫn mua nhà lần đầu Việt Nam" },
  { path: "/can-ho-duoi-2-ty-tphcm",     title: "Căn hộ dưới 2 tỷ TP.HCM" },
  { path: "/mua-hay-thue-nha-tphcm",     title: "Mua hay thuê nhà TP.HCM 2026" },
  { path: "/vinhomes-hoc-mon",           title: "Vinhomes Hóc Môn giá bao nhiêu 2026" },
  { path: "/news/luat-dat-dai-2024-nhung-diem-moi-quan-trong", title: "Luật Đất Đai 2024 điểm mới" },
  { path: "/news/dau-tu-bds-dong-nai-2025",               title: "Đầu tư BĐS Đồng Nai 2025" },
  { path: "/news/gia-chung-cu-tphcm-2025",                title: "Giá chung cư TP.HCM 2025-2026" },
  { path: "/news/vay-mua-nha-ngan-hang-nao-tot-nhat",     title: "Vay mua nhà ngân hàng nào tốt nhất" },
  { path: "/news/dau-tu-vinhomes-grand-park",             title: "Đầu tư Vinhomes Grand Park" },
  { path: "/news/can-ho-ha-tang-tphcm-2025-2026",        title: "Căn hộ hạ tầng TP.HCM 2025-2026" },
  { path: "/news/phong-thuy-mua-nha",                    title: "Phong thuỷ mua nhà chuẩn" },
  { path: "/news/vinhomes-hoc-mon-du-an-moi-2026",       title: "Vinhomes Hóc Môn dự án mới 2026" },
  { path: "/news/masteri-cosmo-central-co-dang-mua-khong", title: "Masteri Cosmo Central có đáng mua" },
  { path: "/news/nha-o-xa-hoi-tphcm-2026",              title: "Nhà ở xã hội TP.HCM 2026" },
  { path: "/news/quy-trinh-mua-nha-lan-dau",            title: "Quy trình mua nhà lần đầu step-by-step" },
  { path: "/news/so-hong-so-do-khac-nhau-gi",           title: "Sổ hồng và sổ đỏ khác nhau gì" },
  { path: "/news/nhon-trach-co-nen-mua-dat",            title: "Nhơn Trạch có nên mua đất 2026" },
  { path: "/news/dau-tu-can-gio-vinhomes",              title: "Đầu tư Vinhomes Cần Giờ 2026" },
  { path: "/news/thue-nha-hay-mua-nha-tphcm",          title: "Thuê hay mua nhà TP.HCM 2026" },
  { path: "/news/lai-suat-vay-mua-nha-2026",           title: "Lãi suất vay mua nhà 2026 tất cả ngân hàng" },
  { path: "/news/bien-dong-gia-bds-sau-vat-dai-3",     title: "Biến động giá BĐS sau Vành đai 3" },
  { path: "/news/chung-cu-biet-thu-nha-pho-nen-mua-gi", title: "Chung cư, biệt thự hay nhà phố nên mua gì" },
  { path: "/news/long-thanh-airport-bds-2026",         title: "Sân bay Long Thành tác động BĐS 2026" },
  { path: "/news/foreigner-buy-property-vietnam",      title: "Foreigners buying property in Vietnam 2026" },
  { path: "/dau-tu-bat-dong-san/chien-luoc-2026-2028", title: "Chiến lược đầu tư BĐS 2026-2028" },
  { path: "/ai-valuation/huong-dan-su-dung",          title: "Hướng dẫn dùng AI định giá BĐS" },
  { path: "/phap-ly-nha-dat/kiem-tra-so-hong",        title: "Cách kiểm tra sổ hồng online" },
  { path: "/phap-ly-nha-dat/tranh-chap-bds",          title: "Giải quyết tranh chấp bất động sản" },
  { path: "/dau-tu-bat-dong-san/bds-cho-thue",        title: "Đầu tư BĐS cho thuê TP.HCM" },
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