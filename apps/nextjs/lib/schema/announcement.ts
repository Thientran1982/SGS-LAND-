/**
 * SpecialAnnouncement Schema - GEO Freshness Signal
 * Helps AI Overviews show current price/status info
 * Update monthly for maximum freshness signals
 */

import { SITE_URL, ORG_ID } from "./constants";

export interface ProjectAnnouncement {
  slug: string;
  name: string;
  currentPrice: string;
  status: string;
  update: string;
}

export const PROJECT_ANNOUNCEMENTS: ProjectAnnouncement[] = [
  {
    slug: "aqua-city",
    name: "Aqua City Novaland",
    currentPrice: "Shophouse từ 2,5 tỷ - Biệt thự từ 8 tỷ đồng",
    status: "Đang mở bán phân khu mới - Sân bay Long Thành T6/2026",
    update: "Pháp lý sổ đỏ đầy đủ, ngân hàng cho vay 70%, lãi suất ưu đãi 6.5%/năm",
  },
  {
    slug: "the-global-city",
    name: "The Global City Masterise Homes",
    currentPrice: "Căn hộ từ 6 tỷ - Sky villa từ 25 tỷ đồng",
    status: "Giai đoạn 2 đang bàn giao, giai đoạn 3 mở booking T6/2026",
    update: "Kết nối Metro số 1, pháp lý hoàn thiện, cho thuê ROI 5-7%/năm",
  },
  {
    slug: "vinhomes-can-gio",
    name: "Vinhomes Cần Giờ",
    currentPrice: "Dự kiến từ 2,5 tỷ/căn hộ - chờ mở bán chính thức 2026",
    status: "Đang phê duyệt quy hoạch 2.870ha - lớn nhất Đông Nam Á",
    update: "Đăng ký ưu tiên nhận thông tin mở bán sớm nhất tại SGS LAND",
  },
  {
    slug: "vinhomes-grand-park",
    name: "Vinhomes Grand Park",
    currentPrice: "Căn hộ từ 1,8 tỷ - nhà phố từ 15 tỷ đồng",
    status: "Dự án hoàn thiện, đang bàn giao giai đoạn cuối T6/2026",
    update: "Tiện ích đầy đủ, cộng đồng 230.000 cư dân, Metro số 1 kết nối",
  },
  {
    slug: "izumi-city",
    name: "Izumi City Nam Long",
    currentPrice: "Nhà phố từ 5,5 tỷ - biệt thự từ 12 tỷ đồng",
    status: "Đang bàn giao phân khu Yuki và Ichijo T6/2026",
    update: "Khu đô thị Nhật Bản 170ha, Aeon Mall, trường quốc tế, pháp lý đầy đủ",
  },
  {
    slug: "diamond-sky-van-phuc-city",
    name: "Diamond Sky Vạn Phúc City",
    currentPrice: "Căn hộ cao tầng từ 2,8 tỷ - 8 tỷ đồng",
    status: "Đang mở bán tòa Diamond Sky Tower mới nhất T6/2026",
    update: "Khu đô thị thông minh Thủ Đức, view sông, pháp lý hoàn chỉnh",
  },
];


export function getSpecialAnnouncementSchema(announcement: ProjectAnnouncement): object;
export function getSpecialAnnouncementSchema(slug: string): object | null;
export function getSpecialAnnouncementSchema(input: ProjectAnnouncement | string): object | null {
  const announcement = typeof input === 'string'
    ? PROJECT_ANNOUNCEMENTS.find(a => a.slug === input) || null
    : input;

  const ann2 = announcement as ProjectAnnouncement;
  const projectUrl = `${SITE_URL}/du-an/${ann2.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "SpecialAnnouncement",
    "@id": `${projectUrl}#announcement-2026-06`,
    name: `Cập nhật mới nhất: ${ann2.name} T6/2026`,
    text: `${ann2.status}. Giá mới nhất: ${ann2.currentPrice}. ${ann2.update}. Liên hệ SGS LAND để được tư vấn miễn phí và xem nhà thực tế: 0971.132.378.`,
    datePosted: "2026-06-08",
    expires: "2026-09-30",
    category: "https://www.wikidata.org/wiki/Q1021645",
    announcementLocation: {
      "@type": "Place",
      name: ann2.name,
      url: projectUrl,
    },
    spatialCoverage: {
      "@type": "Place",
      name: "TP. Hồ Chí Minh và Đồng Nai, Việt Nam",
      addressCountry: "VN",
    },
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}
