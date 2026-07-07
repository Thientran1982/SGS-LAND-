// Shared source of truth for homepage "Dự án nổi bật" featured projects.
// Imported by both the Vite app (pages/Landing.tsx) and the Next.js app
// (apps/nextjs/components/public/LandingPage.tsx) to avoid data drift.

export interface FeaturedProject {
  slug: string; name: string; dev: string; loc: string;
  scale: string; priceFrom: string;
  type: string; type_en: string;
  badge: string; badge_en: string; badgeType: "sale" | "open" | "soon";
  img: string; legal?: boolean; category: string;
  landingHref?: string;
}

export const FEATURED_PROJECTS: FeaturedProject[] = [
  { slug: "aqua-city",             name: "Aqua City Novaland",       dev: "Novaland",          loc: "Biên Hòa, Đồng Nai",   scale: "1.000 ha", priceFrom: "6,2 tỷ",  type: "Biệt thự & Nhà phố",  type_en: "Villas & Townhouses",       badge: "Đang bàn giao", badge_en: "Delivering",          badgeType: "sale", img: "/landing/aqua-city/hero-opt.jpg",            legal: true,  category: "villa" },
  { slug: "the-global-city",       name: "The Global City",          dev: "Masterise Homes",   loc: "An Phú, TP Thủ Đức",    scale: "117 ha",   priceFrom: "7,5 tỷ",  type: "Căn hộ cao cấp",      type_en: "Premium Apartments",        badge: "Đang mở bán",  badge_en: "Now Selling",         badgeType: "open", img: "/images/projects/the-global-city.webp",      legal: true,  category: "apt"   },
  { slug: "izumi-city",            name: "Izumi City Nam Long",      dev: "Nam Long Group",    loc: "Biên Hòa, Đồng Nai",   scale: "170 ha",   priceFrom: "1,2 tỷ",  type: "Đô thị chuẩn Nhật",   type_en: "Japanese-Standard Township", badge: "Đang mở bán",  badge_en: "Now Selling",         badgeType: "open", img: "/images/projects/izumi-city.webp",           legal: true,  category: "apt"   },
  { slug: "vinhomes-can-gio",      name: "Vinhomes Cần Giờ",         dev: "Vinhomes",          loc: "Cần Giờ, TP.HCM",      scale: "2.870 ha", priceFrom: "8 tỷ",    type: "Đô thị biển",          type_en: "Coastal Township",          badge: "Đang mở bán", badge_en: "Now Selling",     badgeType: "sale", img: "/images/projects/vinhomes-can-gio.webp",                   category: "villa" },
  { slug: "masteri-cosmo-central", name: "Masteri Cosmo Central",    dev: "Masterise Homes",   loc: "Đỗ Xuân Hợp, Thủ Đức", scale: "20 căn",   priceFrom: "6,43 tỷ", type: "Căn hộ cao cấp",      type_en: "Premium Apartments",        badge: "Còn hàng",     badge_en: "Available",           badgeType: "sale", img: "/landing/masteri-cosmo-central/hero.jpg",    legal: true,  category: "apt",  landingHref: "/landing/masteri-cosmo-central/" },
  { slug: "vinhomes-grand-park",   name: "Vinhomes Grand Park",      dev: "Vinhomes",          loc: "TP Thủ Đức",           scale: "271 ha",   priceFrom: "2,5 tỷ",  type: "Đại đô thị",          type_en: "Mega Township",             badge: "Còn hàng",     badge_en: "Available",           badgeType: "sale", img: "/images/projects/vinhomes-grand-park.webp",  legal: true,  category: "apt"   },
  { slug: "vinhomes-hoc-mon",      name: "Vinhomes Hóc Môn",         dev: "Vinhomes",          loc: "Hóc Môn, TP.HCM",      scale: "TBA",      priceFrom: "6,5 tỷ",  type: "Đô thị mới",          type_en: "New Urban Township",        badge: "Đang mở bán",   badge_en: "Now Selling",         badgeType: "open", img: "/landing/vinhomes-hoc-mon/hero.jpg",         legal: true,  category: "villa", landingHref: "/landing/vinhomes-hoc-mon/" },
  { slug: "diamond-sky-van-phuc-city", name: "Diamond Sky Vạn Phúc City", dev: "Vạn Phúc Corp", loc: "Thủ Đức, TP.HCM",  scale: "18 tầng",  priceFrom: "6,8 tỷ",  type: "Căn hộ cao cấp",      type_en: "Premium Apartments",        badge: "Đang mở bán",  badge_en: "Now Selling",         badgeType: "open", img: "/images/projects/diamond-sky-van-phuc-city.webp", legal: true, category: "apt"  },
  { slug: "legacy-66",             name: "Legacy 66",                dev: "Tân Thành",          loc: "Chợ Lớn, Q.5, TP.HCM", scale: "348 căn",  priceFrom: "Liên hệ", type: "Căn hộ cao cấp",      type_en: "Premium Apartments",        badge: "Đang mở bán",  badge_en: "Now Selling",         badgeType: "open", img: "/landing/legacy-66/hero.jpg",                legal: true,  category: "apt",  landingHref: "/landing/legacy-66/"               },
];
