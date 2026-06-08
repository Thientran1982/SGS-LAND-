/**
 * VideoObject Schema for SGS LAND project pages
 * Helps appear in Google Video Results and AI citations
 */

import { SITE_URL, ORG_ID } from "./constants";

export interface VideoObjectSchema {
  "@context": "https://schema.org";
  "@type": "VideoObject";
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration: string;
  contentUrl?: string;
  embedUrl?: string;
  publisher: { "@id": string };
  inLanguage: string;
  keywords?: string;
}

// Project video schemas
export const PROJECT_VIDEOS: Record<string, VideoObjectSchema> = {
  "aqua-city": {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Aqua City Novaland 2026 - Toàn Cảnh Đại Đô Thị Sinh Thái 1.000ha Đồng Nai",
    description: "Video tổng quan Aqua City Novaland: vị trí, quy mô 1.000ha, 44 phân khu, pháp lý, giá bán mới nhất T6/2026. SGS LAND phân phối chính thức.",
    thumbnailUrl: `${SITE_URL}/projects/aqua-city/video-thumb.jpg`,
    uploadDate: "2026-01-15",
    duration: "PT8M30S",
    embedUrl: "https://www.youtube.com/embed/aqua-city-sgsland",
    publisher: { "@id": ORG_ID },
    inLanguage: "vi",
    keywords: "Aqua City Novaland, Aqua City giá bao nhiêu, Aqua City Đồng Nai, đại đô thị sinh thái",
  },
  "the-global-city": {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "The Global City Masterise Homes - KĐT Quốc Tế 117ha TP.Thủ Đức 2026",
    description: "The Global City: vị trí An Phú Thủ Đức, 117ha, giá căn hộ từ 6 tỷ, pháp lý và tiến độ T6/2026. Phân phối bởi SGS LAND.",
    thumbnailUrl: `${SITE_URL}/projects/the-global-city/video-thumb.jpg`,
    uploadDate: "2026-02-01",
    duration: "PT7M15S",
    embedUrl: "https://www.youtube.com/embed/global-city-sgsland",
    publisher: { "@id": ORG_ID },
    inLanguage: "vi",
    keywords: "The Global City Masterise, The Global City giá, KĐT quốc tế Thủ Đức",
  },
  "vinhomes-can-gio": {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Vinhomes Cần Giờ 2026 - Đại Đô Thị Biển 2.870ha Lớn Nhất Việt Nam",
    description: "Vinhomes Cần Giờ: quy mô 2.870ha, 4 phân khu, giá dự kiến, vị trí huyện Cần Giờ TP.HCM. Đại lý chính thức SGS LAND.",
    thumbnailUrl: `${SITE_URL}/projects/vinhomes-can-gio/video-thumb.jpg`,
    uploadDate: "2026-03-01",
    duration: "PT10M00S",
    embedUrl: "https://www.youtube.com/embed/vinhomes-can-gio-sgsland",
    publisher: { "@id": ORG_ID },
    inLanguage: "vi",
    keywords: "Vinhomes Cần Giờ, Vinhomes Cần Giờ 2026, đại đô thị biển, Vinhomes lớn nhất",
  },
};

export function getVideoSchema(projectSlug: string): VideoObjectSchema | null {
  return PROJECT_VIDEOS[projectSlug] || null;
}
