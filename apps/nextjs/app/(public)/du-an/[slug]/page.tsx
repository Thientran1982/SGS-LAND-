import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailPage } from "@/components/public/ProjectDetailPage";
import { PROJECT_CONFIG, ALL_PROJECTS } from "@/data/projects";
import { LANDING_PROJECTS, type LandingProject } from "@/data/landing-projects";
// Fallback: projects present in the listing (ALL_PROJECTS) but without a rich
// PROJECT_CONFIG entry still get a "Thông Tin Chi Tiết" section built from real
// listing data — no fabricated prices/FAQs.
function resolveProjectConfig(slug: string) {
  const cfg = (PROJECT_CONFIG as Record<string, unknown>)[slug];
  if (cfg) return cfg as Record<string, unknown>;
  // Landing-based projects (legacy-66, masteri-cosmo-central, aqua-city): pull
  // rich detail content (entity table, amenities, FAQs) from data/landing-projects.ts.
  const lp = (LANDING_PROJECTS as Record<string, LandingProject>)[slug];
  if (lp) {
    return {
      heroDescription: lp.desc,
      details: (lp.entityTable || []).map((r) => ({ label: r.k, value: r.v })),
      amenities: lp.schemaAmenities && lp.schemaAmenities.length
        ? [{ title: "Tiện ích & pháp lý nổi bật", items: lp.schemaAmenities }]
        : [],
      faqs: lp.faq || [],
    };
  }
  const p = ALL_PROJECTS.find((x) => x.slug === slug);
  if (!p) {
    const meta = PROJECT_META[slug];
    if (!meta) return null;
    return {
      heroDescription: meta.desc,
      details: [
        { label: "Chủ đầu tư", value: meta.dev },
        { label: "Vị trí", value: meta.loc },
        { label: "Quy mô", value: meta.scale },
        { label: "Loại hình", value: "Danh mục bất động sản — cần xác minh theo sản phẩm" },
        { label: "Giá tham khảo", value: meta.priceRange },
        { label: "Tình trạng", value: "Cần xác minh theo hồ sơ hiện hành" },
      ],
    };
  }
  return {
    heroDescription: p.description,
    details: [
      { label: "Chủ đầu tư", value: p.developer },
      { label: "Vị trí", value: p.location },
      { label: "Quy mô", value: p.scale },
      { label: "Loại hình", value: p.projectType },
      { label: "Giá tham khảo", value: p.priceRange },
      { label: "Tình trạng", value: p.status },
    ].filter((d) => Boolean(d.value)),
  };
}
import { SchemaScript } from "@/components/SchemaScript";
import {
  getRealEstateListingSchema,
  getVideoSchema,
  getSpecialAnnouncementSchema,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getFAQSchema,
  getApartmentComplexSchema,
  SITE_URL,
} from "@/lib/schema";
import type { FAQItem } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";

const AQUA_STYLE_DETAIL_SLUGS = new Set([
  "manhattan",
  "thu-thiem",
  "son-kim-land",
  "vinhomes-can-gio",
  "sala",
  "vinhomes-hoc-mon",
  "masteri-park-place",
  "masteri-cosmo-central",
  "eco-retreat-long-an",
  "legacy-66",
  "nha-pho-trung-tam",
  "bat-dong-san-thu-duc",
  "bat-dong-san-long-thanh",
  "bat-dong-san-binh-thanh",
  "bat-dong-san-quan-7",
  "bat-dong-san-long-an",
  "bat-dong-san-dong-nai",
  "bat-dong-san-binh-chanh",
  "bat-dong-san-can-gio",
  "bat-dong-san-hoc-mon",
  "bat-dong-san-binh-duong",
  "bat-dong-san-phu-nhuan",
  "nha-pho-trung-tam",
  "bat-dong-san-thu-duc",
  "bat-dong-san-long-thanh",
]);

const AREA_DETAIL_SLUGS = new Set([
  "bat-dong-san-quan-7",
  "bat-dong-san-long-an",
  "bat-dong-san-dong-nai",
  "bat-dong-san-long-thanh",
  "bat-dong-san-thu-duc",
  "nha-pho-trung-tam",
  "bat-dong-san-binh-thanh",
  "bat-dong-san-binh-chanh",
  "bat-dong-san-can-gio",
  "bat-dong-san-hoc-mon",
  "bat-dong-san-binh-duong",
  "bat-dong-san-phu-nhuan",
]);
const AREA_ENGLISH_NAMES: Record<string, string> = {
  "bat-dong-san-long-an": "Long An Real Estate",
  "bat-dong-san-thu-duc": "Thu Duc Real Estate",
  "bat-dong-san-long-thanh": "Long Thanh Real Estate",
  "bat-dong-san-dong-nai": "Dong Nai Real Estate",
  "bat-dong-san-binh-thanh": "Binh Thanh Real Estate",
  "bat-dong-san-quan-7": "District 7 Real Estate",
  "bat-dong-san-hoc-mon": "Hoc Mon Real Estate",
  "bat-dong-san-can-gio": "Can Gio Real Estate",
  "bat-dong-san-binh-duong": "Binh Duong Real Estate",
  "bat-dong-san-phu-nhuan": "Phu Nhuan Real Estate",
  "nha-pho-trung-tam": "Central Townhouses",
};

function getDetailBasePath(slug: string) {
  return AREA_DETAIL_SLUGS.has(slug) ? `/khu-vuc/${slug}` : `/du-an/${slug}`;
}

function getAquaStyleLanding(slug: string): LandingProject | null {
  const existing = LANDING_PROJECTS[slug];
  if (existing) return existing;
  if (!AQUA_STYLE_DETAIL_SLUGS.has(slug)) return null;

  const config = resolveProjectConfig(slug) as {
    name?: string;
    developer?: string;
    location?: string;
    heroDescription?: string;
    details?: { label: string; value: string }[];
    amenities?: { title: string; items: string[] }[];
    faqs?: { q: string; a: string }[];
  } | null;
  const listedProject = ALL_PROJECTS.find((item) => item.slug === slug);
  const metaProject = PROJECT_META[slug];
  const project = listedProject || (metaProject ? {
    name: metaProject.name,
    developer: metaProject.dev,
    location: metaProject.loc,
    scale: metaProject.scale,
    priceRange: metaProject.priceRange,
    projectType: "Danh mục bất động sản",
    status: "Cần xác minh",
    description: metaProject.desc,
  } : null);
  if (!config || !project) return null;

  const details = config.details || [
    { label: "Chủ đầu tư", value: project.developer },
    { label: "Vị trí", value: project.location },
    { label: "Quy mô", value: project.scale },
    { label: "Loại hình", value: project.projectType },
    { label: "Giá tham khảo", value: project.priceRange },
    { label: "Tình trạng", value: project.status },
  ].filter((row) => Boolean(row.value));
  const projectName = config.name || project.name;
  const developer = config.developer || project.developer;
  const location = config.location || project.location;
  const description = config.heroDescription || project.description;
  const stats = details.slice(0, 5).map((row) => ({ num: row.value, lbl: row.label }));
  const amenities = config.amenities?.length
    ? config.amenities
    : [{
        title: "Tiện ích và trạng thái cần kiểm tra",
        items: [
          "Danh mục tiện ích cần đối chiếu theo đúng phân khu và thời điểm",
          "Phân biệt tiện ích đã vận hành, đang triển khai và mới nằm trong quy hoạch",
          "Kiểm tra đơn vị vận hành, điều kiện sử dụng và chi phí liên quan",
        ],
      }];
  const faq = config.faqs?.length
    ? config.faqs
    : buildProjectFAQ(slug, projectName, developer, location, project.priceRange)
        .slice(0, 8)
        .map((item) => ({ q: item.question, a: item.answer }));
  const coordinates: Record<string, { lat: number; lng: number }> = {
    "vinhomes-can-gio": { lat: 10.4124, lng: 106.9524 },
    sala: { lat: 10.8025, lng: 106.7414 },
    "vinhomes-hoc-mon": { lat: 10.8835, lng: 106.5937 },
    "legacy-66": { lat: 10.7548, lng: 106.6642 },
    "nha-pho-trung-tam": { lat: 10.7769, lng: 106.7009 },
    "bat-dong-san-thu-duc": { lat: 10.8492, lng: 106.7537 },
    "bat-dong-san-long-thanh": { lat: 10.965, lng: 106.841 },
    "bat-dong-san-binh-thanh": { lat: 10.8016, lng: 106.7109 },
    "bat-dong-san-quan-7": { lat: 10.734, lng: 106.7218 },
    "bat-dong-san-long-an": { lat: 10.6956, lng: 106.2431 },
    "bat-dong-san-dong-nai": { lat: 10.957, lng: 106.842 },
    "bat-dong-san-binh-chanh": { lat: 10.684, lng: 106.604 },
    "bat-dong-san-can-gio": { lat: 10.411, lng: 106.954 },
    "bat-dong-san-hoc-mon": { lat: 10.889, lng: 106.596 },
    "bat-dong-san-binh-duong": { lat: 11.016, lng: 106.656 },
    "bat-dong-san-phu-nhuan": { lat: 10.799, lng: 106.678 },
  };
  const geo = coordinates[slug] || (slug === "manhattan"
    ? { lat: 10.7769, lng: 106.7009 }
    : { lat: 10.7891, lng: 106.7265 });
  return {
    slug,
    titleFull: `${projectName} – Thông tin dự án | SGS LAND`,
    titleShort: projectName,
    eyebrow: `${developer} • ${location} • Thông tin tham khảo`,
    desc: description,
    keywords: `${projectName}, ${location}, giá ${projectName}, pháp lý ${projectName}, SGS Land`,
    heroImageAlt: `${projectName} tại ${location} — thông tin vị trí, sản phẩm và hồ sơ tham khảo`,
    heroGradient: "linear-gradient(rgba(6,48,31,.72),rgba(6,48,31,.55))",
    theme: { primary: "#0B3B32", deep: "#062F25", soft: "#E6F0EC", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
    geo,
    stats: stats.length ? stats : [{ num: project.scale || "Cần xác minh", lbl: "Quy mô" }],
    heroH1: projectName,
    heroSub: description,
    heroMeta: `${developer} | ${location} | ${project.scale || "Quy mô cần xác minh"}`,
    overviewParas: [description, `Thông tin sản phẩm, giá, tiện ích và hồ sơ của ${projectName} cần được đối chiếu theo đúng phân khu hoặc sản phẩm và tài liệu hiện hành trước giao dịch.`],
    entityTable: details.map((row) => ({ k: row.label, v: row.value })),
    locationIntro: `${projectName} được ghi nhận tại ${location}. Ranh dự án, thời gian di chuyển và tình trạng từng sản phẩm cần được kiểm tra theo bản đồ, tuyến đường và thời điểm thực tế.`,
    googleMapsEmbedSrc: `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`,
    faq,
    navLinks: [
      { href: "#tong-quan", label: "Tổng quan" },
      { href: "#thong-tin", label: "Thông tin dự án" },
      { href: "#vi-tri", label: "Vị trí" },
      { href: "#bang-gia", label: "Bảng giá" },
      { href: "#tien-ich", label: "Tiện ích" },
      { href: "#tham-dinh", label: "Thẩm định" },
      { href: "#faq", label: "FAQ" },
      { href: "#lien-he", label: "Liên hệ" },
    ],
    schemaName: projectName,
    schemaDev: developer,
    schemaLocality: location,
    schemaRegion: "TP.HCM",
    schemaAmenities: amenities.flatMap((group) => group.items),
  };
}
// ─── Static project data (SEO seed) ──────────────────────
const PROJECT_META: Record<
  string,
  {
    name: string;
    dev: string;
    loc: string;
    desc: string;
    priceRange: string;
    scale: string;
    areaHa: number;
    priceLow: number;
    priceHigh: number;
    metaTitle?: string;
    metaDescription?: string;
    subdivisions?: { name: string; price: string; area?: string; note?: string }[];
  }
> = {
  "diamond-sky-van-phuc-city": {
    name: "Diamond Sky Vạn Phúc City",
    dev: "Tập đoàn Vạn Phúc (Van Phuc Group)",
    loc: "KĐĐT Vạn Phúc, Hiệp Bình Phước, TP Thủ Đức, TP.HCM",
    desc: "Diamond Sky Vạn Phúc City – tòa căn hộ hạng sang 20 tầng view sông Sài Gòn trong KĐĐT Vạn Phúc 198ha. Giá 2026: 1PN từ 9,6 tỷ, 2PN từ 14 tỷ, 3PN từ 20 tỷ. Sổ hồng lâu dài, bàn giao Q4/2026.",
    priceRange: "1PN từ 9,6 tỷ; 2PN từ 14 tỷ; 3PN từ 20 tỷ VNĐ (2026)",
    scale: "20 tầng, ~520 căn hộ",
    areaHa: 198,
    priceLow: 9_600_000_000,
    priceHigh: 30_000_000_000,
    metaTitle: "Diamond Sky Vạn Phúc City 2026 — Giá, Mặt Bằng",
    metaDescription: "Diamond Sky Vạn Phúc City: căn hộ Thủ Đức từ 9,6 tỷ (1PN), 2PN 14 tỷ, 3PN 20 tỷ, bàn giao Q4/2026, sổ hồng lâu dài. Xem giá & chính sách gốc tại SGS Land.",
  },
  "aqua-city": {
    name: "Aqua City Novaland Đồng Nai",
    dev: "Novaland",
    loc: "Long Hưng, Biên Hòa, Đồng Nai",
    desc: "Aqua City Novaland là khu đô thị tại Long Hưng, Biên Hòa, Đồng Nai. Trang này tổng hợp thông tin tham khảo về vị trí, sản phẩm, phân khu và các câu hỏi người mua; giá bán, pháp lý và tiến độ cần được xác minh theo từng sản phẩm bằng hồ sơ hiện hành.",
     priceRange: "Biệt thự đảo từ 6,5 tỷ; sản phẩm khoảng 8–50 tỷ VNĐ/căn (2026)",
     scale: "Khoảng 1.000 ha",
     areaHa: 1000,
     priceLow: 6_500_000_000,
     priceHigh: 50_000_000_000,
    metaTitle: "Aqua City Novaland Đồng Nai 2026 — Giá, Mặt Bằng",
    metaDescription: "Aqua City Novaland Đồng Nai: thông tin tham khảo về vị trí, phân khu, sản phẩm, giá, pháp lý và tiến độ. Xác minh hồ sơ gốc trước khi giao dịch.",
    subdivisions: [
      { name: "Các phân khu Aqua City", price: "Cần xác minh", area: "Theo sản phẩm", note: "Đối chiếu hồ sơ và tiến độ hiện hành" },
    ],
  },
  "the-global-city": {
    name: "The Global City",
    metaTitle: "The Global City Thủ Đức 2026 — Giá, Mặt Bằng",
    metaDescription: "The Global City Thủ Đức (Masterise): căn hộ & nhà phố, giá & mặt bằng phân khu 2026, tiến độ mới nhất. Nhận báo giá gốc & chính sách tại SGS Land.",
    subdivisions: [{"name":"SOHO (nhà phố thương mại)","price":"Từ 25 tỷ","area":"5x20m","note":"Mặt tiền đại lộ"},{"name":"The Manhattan (nhà phố, biệt thự)","price":"Từ 28 tỷ","area":"5x18m","note":"View kênh đào"},{"name":"The Global City căn hộ","price":"Đang cập nhật","area":"1–3PN","note":"Giai đoạn tiếp theo"}],
    dev: "Masterise Homes",
    loc: "An Phú, TP Thủ Đức",
    desc: "Đô thị thương mại 117ha của Masterise Homes, trung tâm tài chính TP Thủ Đức.",
    priceRange: "Shophouse từ 15 tỷ; căn hộ từ 5 tỷ VNĐ",
    scale: "117 ha",
    areaHa: 117,
    priceLow: 5_000_000_000,
    priceHigh: 60_000_000_000,
  },
  "izumi-city": {
    name: "Izumi City Nam Long",
    metaTitle: "Izumi City Nam Long Đồng Nai 2026 — Giá, Mặt Bằng",
    metaDescription: "Izumi City Nam Long Biên Hòa Đồng Nai: nhà phố, biệt thự 2026, giá & mặt bằng phân khu, tiến độ ven sông Đồng Nai. Nhận báo giá gốc tại SGS Land.",
    subdivisions: [{"name":"Nhà phố Izumi","price":"Từ 6 tỷ","area":"5x18m","note":"Ven sông"},{"name":"Biệt thự Izumi","price":"Từ 12 tỷ","area":"8x18m","note":"View công viên"},{"name":"Shophouse Izumi","price":"Từ 9 tỷ","area":"5x20m","note":"Mặt đường lớn"}],
    dev: "Nam Long Group",
    loc: "Biên Hòa, Đồng Nai",
    desc: "Đô thị tích hợp chuẩn Nhật 170ha, tiêu chuẩn sống quốc tế, giá từ 8,4 tỷ.",
    priceRange: "Nhà phố từ 8,4 tỷ; biệt thự từ 20 tỷ VNĐ",
    scale: "170 ha",
    areaHa: 170,
    priceLow: 8_400_000_000,
    priceHigh: 40_000_000_000,
  },
  "vinhomes-can-gio": {
    name: "Vinhomes Cần Giờ",
    metaTitle: "Vinhomes Cần Giờ Green Paradise 2026 — Giá",
    metaDescription: "Vinhomes Cần Giờ (Green Paradise): giá bán 2026, mặt bằng phân khu, tiến độ siêu đô thị lấn biển. Nhận báo giá gốc & chính sách tại SGS Land.",
    subdivisions: [{"name":"Căn hộ","price":"60–90 triệu/m²","area":"Nhiều loại","note":"Green Paradise"},{"name":"Nhà phố","price":"10–30 tỷ/căn","area":"Nhiều loại","note":"Khu đô thị lấn biển"},{"name":"Shophouse","price":"13–40 tỷ/căn","area":"Nhiều loại","note":"Mặt tiền kinh doanh"},{"name":"Biệt thự song lập","price":"19–50 tỷ/căn","area":"Nhiều loại","note":"Phân khu ven biển"},{"name":"Biệt thự đơn lập","price":"40–120 tỷ/căn","area":"Nhiều loại","note":"Phân khu cao cấp"}],
    dev: "Vinhomes",
    loc: "Cần Giờ, TP.HCM",
    desc: "Siêu đô thị lấn biển 2.870ha, tuyến Metro số 4, khu đô thị sinh thái biển đầu tiên Việt Nam.",
    priceRange: "Dự kiến mở bán Q3/2026",
    scale: "2.870 ha",
    areaHa: 2870,
    priceLow: 10_000_000_000,
    priceHigh: 200_000_000_000,
  },
  "vinhomes-grand-park": {
    name: "Vinhomes Grand Park",
    metaTitle: "Vinhomes Grand Park Quận 9 2026 — Giá, Mặt Bằng",
    metaDescription: "Vinhomes Grand Park Quận 9 (TP Thủ Đức): giá căn hộ 2026, mặt bằng phân khu, cho thuê, tiến độ đại đô thị. Nhận báo giá gốc & chính sách SGS Land.",
    subdivisions: [{"name":"The Origami","price":"Từ 2.8 tỷ","area":"1–3PN","note":"Phong cách Nhật"},{"name":"The Beverly","price":"Từ 3.5 tỷ","area":"1–3PN","note":"View công viên"},{"name":"Glory Heights","price":"Từ 3.9 tỷ","area":"2–3PN","note":"Phân khu mới"}],
    dev: "Vinhomes",
    loc: "TP Thủ Đức, TP.HCM",
    desc: "Siêu đô thị 271ha, 12 công viên chủ đề, Metro số 1, tâm điểm phát triển phía Đông TP.HCM.",
    priceRange: "Căn hộ từ 2,5 tỷ; The Opus One từ 8 tỷ VNĐ",
    scale: "271 ha",
    areaHa: 271,
    priceLow: 2_500_000_000,
    priceHigh: 15_000_000_000,
  },
  "vinhomes-central-park": {
    name: "Vinhomes Central Park Bình Thạnh – Căn hộ Landmark 81",
    dev: "Vinhomes",
    loc: "Bình Thạnh, TP.HCM",
    desc: "Vinhomes Central Park Bình Thạnh – khu đô thị phân khu viên 43,9ha ven sông Sài Gòn. Nơi tọa lạc tòa Landmark 81 cao nhất Việt Nam. Căn hộ cho thuê Vinhomes Central Park từ 15 triệu/tháng. Giá căn hộ theo block: Park 1-6 từ 4 tỷ, The Arcadia từ 5 tỷ, The Botanica từ 6 tỷ. Shophouse mặt tiền từ 15 tỷ. Công viên 10ha, bể bơi vô cực, trung tâm thương mại Vincom. Từ khóa LSI: Vinhomes Bình Thạnh, Central Park Bình Thạnh, căn hộ view sông Bình Thạnh.",
    priceRange: "Căn hộ từ 4 tỷ; Shophouse từ 15 tỷ VNĐ (2026)",
    scale: "43,9 ha",
    areaHa: 43.9,
    priceLow: 4_000_000_000,
    priceHigh: 25_000_000_000,
    metaTitle: "Vinhomes Central Park Bình Thạnh 2026 — Giá",
    metaDescription: "Vinhomes Central Park Bình Thạnh: căn hộ từ 4 tỷ, cho thuê từ 15 triệu/tháng, view sông Sài Gòn & Landmark 81. Xem giá & mặt bằng tại SGS Land.",
    subdivisions: [
      { name: "Landmark 81", price: "Căn hộ từ 8 tỷ", area: "51-150m2", note: "Tòa cao nhất Việt Nam, view toàn thành phố" },
      { name: "The Park (Park 1-7)", price: "Căn hộ từ 4 tỷ", area: "50-100m2", note: "Cận công viên 14ha, đã bàn giao" },
      { name: "The Central (C1-C3)", price: "Căn hộ từ 4,5 tỷ", area: "53-116m2", note: "Trung tâm dự án, gần Vincom" },
      { name: "The Landmark (L1-L6)", price: "Căn hộ từ 5 tỷ", area: "54-120m2", note: "View sông Sài Gòn trực diện" },
    ],
  },
  "masterise-homes": {
    name: "Masterise Homes",
    dev: "Masterise Group",
    loc: "TP.HCM",
    desc: "Hệ sinh thái căn hộ hạng sang Masterise Homes tại Quận 1, Quận 2, Bình Thạnh TP.HCM.",
    priceRange: "Căn hộ từ 5 tỷ VNĐ",
    scale: "Nhiều dự án",
    areaHa: 0,
    priceLow: 5_000_000_000,
    priceHigh: 50_000_000_000,
  },
  lumiere: {
    name: "Lumière Riverside",
    dev: "Masterise Homes",
    loc: "Bình Thạnh, TP.HCM",
    desc: "Căn hộ hạng sang ven sông Sài Gòn, tầm nhìn panorama, tiện ích 5 sao.",
    priceRange: "Căn hộ từ 7 tỷ VNĐ",
    scale: "3,4 ha",
    areaHa: 3.4,
    priceLow: 7_000_000_000,
    priceHigh: 30_000_000_000,
  },
  waterpoint: {
    name: "Waterpoint Nam Long",
    dev: "Nam Long Group",
    loc: "Bến Lức, Long An",
    desc: "Đô thị sông nước 355ha, vị trí cửa ngõ TP.HCM, pháp lý minh bạch sổ hồng từng căn.",
    priceRange: "Nhà phố từ 5 tỷ VNĐ",
    scale: "355 ha",
    areaHa: 355,
    priceLow: 5_000_000_000,
    priceHigh: 25_000_000_000,
  },
  "the-privia": {
    name: "The Privia Khang Điền",
    dev: "Khang Điền",
    loc: "Bình Tân, TP.HCM",
    desc: "Khu căn hộ cao cấp 7.5ha, tiện ích nội khu đẳng cấp, pháp lý sổ hồng.",
    priceRange: "Căn hộ từ 3,5 tỷ VNĐ",
    scale: "7,5 ha",
    areaHa: 7.5,
    priceLow: 3_500_000_000,
    priceHigh: 10_000_000_000,
  },
  "van-phuc-city": {
    name: "Văn Phúc City",
    dev: "Văn Phúc Group",
    loc: "Thủ Đức, TP.HCM",
    desc: "Khu đô thị phức hợp 198ha ven sông Sài Gòn, tiêu chuẩn quốc tế, pháp lý sổ hồng.",
    priceRange: "Nhà phố từ 8 tỷ VNĐ",
    scale: "198 ha",
    areaHa: 198,
    priceLow: 8_000_000_000,
    priceHigh: 50_000_000_000,
  },
  sala: {
    name: "Sala Đại Quang Minh",
    metaTitle: "Sala Đại Quang Minh Thủ Thiêm 2026 — Giá",
    metaDescription: "Khu đô thị Sala Đại Quang Minh Thủ Thiêm Quận 2: căn hộ, nhà phố, biệt thự 2026, giá & mặt bằng phân khu. Nhận báo giá gốc tại SGS Land.",
    subdivisions: [{"name":"Sarimi căn hộ","price":"Từ 7 tỷ","area":"2–3PN","note":"Trung tâm Sala"},{"name":"Sarica căn hộ","price":"Từ 9 tỷ","area":"2–3PN","note":"Cao cấp"},{"name":"Nhà phố & biệt thự Sala","price":"Từ 40 tỷ","area":"Nhiều loại","note":"Ven sông"}],
    dev: "Đại Quang Minh",
    loc: "TP Thủ Đức, TP.HCM",
    desc: "Khu đô thị ven sông 98ha, trung tâm thương mại, căn hộ và nhà phố cao cấp.",
    priceRange: "Căn hộ từ 5 tỷ VNĐ",
    scale: "98 ha",
    areaHa: 98,
    priceLow: 5_000_000_000,
    priceHigh: 30_000_000_000,
  },
  "thu-thiem": {
    name: "Thủ Thiêm",
    metaTitle: "Dự án Thủ Thiêm Quận 2 TP Thủ Đức 2026 — Giá",
    metaDescription: "Dự án Thủ Thiêm Quận 2 TP Thủ Đức: giá bán mới nhất 2026, mặt bằng khu đô thị, căn hộ & nhà phố gần trường. Tư vấn miễn phí tại SGS Land.",
    subdivisions: [{"name":"The Metropole Thủ Thiêm","price":"Từ 10 tỷ","area":"1–3PN","note":"Ven sông"},{"name":"Empire City","price":"Từ 9 tỷ","area":"1–4PN","note":"Tháp biểu tượng"},{"name":"The River Thủ Thiêm","price":"Từ 8 tỷ","area":"1–3PN","note":"Refico"}],
    dev: "Nhiều CĐT",
    loc: "TP Thủ Đức, TP.HCM",
    desc: "Trung tâm tài chính - thương mại mới của TP.HCM, 657ha, nhiều dự án hạng sang.",
    priceRange: "Căn hộ từ 8 tỷ VNĐ",
    scale: "657 ha",
    areaHa: 657,
    priceLow: 8_000_000_000,
    priceHigh: 100_000_000_000,
  },
  manhattan: {
    name: "Manhattan",
    metaTitle: "Grand Manhattan Novaland Quận 1 2026 — Giá",
    metaDescription: "The Grand Manhattan Novaland Quận 1: giá căn hộ 2026, mặt bằng tháp A/B, cho thuê, tiến độ trung tâm Quận 1. Nhận báo giá gốc tại SGS Land.",
    subdivisions: [{"name":"Tháp A","price":"Từ 9 tỷ","area":"1–3PN","note":"Trung tâm Quận 1"},{"name":"Tháp B","price":"Từ 10 tỷ","area":"2–3PN","note":"Cao cấp"}],
    dev: "Hưng Thịnh Land",
    loc: "Quận 7, TP.HCM",
    desc: "Khu căn hộ cao tầng 5,1ha tại Quận 7, tiện ích đầy đủ, gần Phú Mỹ Hưng.",
    priceRange: "Căn hộ từ 3,8 tỷ VNĐ",
    scale: "5,1 ha",
    areaHa: 5.1,
    priceLow: 3_800_000_000,
    priceHigh: 12_000_000_000,
  },
  "son-kim-land": {
    name: "Sơn Kim Land",
    metaTitle: "SonKim Land 2026 — The Metropole, Serenity Sky",
    metaDescription: "SonKim Land: dự án cao cấp The Metropole Thủ Thiêm, Serenity Sky Villas, Gateway Thảo Điền. Giá & mặt bằng 2026. Tư vấn miễn phí tại SGS Land.",
    subdivisions: [{"name":"The Metropole Thủ Thiêm","price":"Từ 10 tỷ","area":"1–3PN","note":"Quận 2"},{"name":"Serenity Sky Villas","price":"Từ 25 tỷ","area":"Sky villa","note":"Quận 3"},{"name":"Gateway Thảo Điền","price":"Từ 8 tỷ","area":"1–3PN","note":"Quận 2"}],
    dev: "Sơn Kim Group",
    loc: "TP.HCM",
    desc: "Hệ sinh thái BĐS cao cấp Sơn Kim Land tại TP.HCM, pháp lý minh bạch.",
    priceRange: "Từ 5 tỷ VNĐ",
    scale: "Nhiều dự án",
    areaHa: 0,
    priceLow: 5_000_000_000,
    priceHigh: 40_000_000_000,
  },
  "nha-pho-trung-tam": {
    name: "Nhà Phố Trung Tâm",
    dev: "Nhiều CĐT",
    loc: "TP.HCM",
    desc: "Danh mục nhà phố, biệt thự khu trung tâm TP.HCM — pháp lý sổ hồng, vị trí đắc địa.",
    priceRange: "Từ 10 tỷ VNĐ",
    scale: "Nhiều vị trí",
    areaHa: 0,
    priceLow: 10_000_000_000,
    priceHigh: 150_000_000_000,
    metaTitle: "Nhà Phố Trung Tâm TP.HCM 2026 — Giá Từ 10 Tỷ",
    metaDescription: "Nhà phố & biệt thự trung tâm TP.HCM giá từ 10 tỷ, sổ hồng lâu dài, vị trí đắc địa. Xem bảng giá & chính sách mới nhất tại SGS Land.",
  },
  "vinhomes-hoc-mon": {
    name: "Vinhomes Hóc Môn",
    metaTitle: "Vinhomes Hóc Môn Green City 2026 — Giá, Mặt Bằng",
    metaDescription: "Vinhomes Hóc Môn (Green City): giá bán 2026, mặt bằng phân khu, tiến độ đại đô thị xanh Tây Bắc TP.HCM. Nhận báo giá gốc tại SGS Land.",
    subdivisions: [{"name":"Nhà phố giãn xây","price":"4–4,8 tỷ/căn","area":"Nhiều loại","note":"Bàn giao giãn xây"},{"name":"Nhà phố xây thô","price":"5,4–6,4 tỷ/căn","area":"Nhiều loại","note":"Bàn giao xây thô"},{"name":"Nhà phố hoàn thiện","price":"6,2–7,8 tỷ/căn","area":"Nhiều loại","note":"Bàn giao hoàn thiện"}],
    dev: "Vinhomes",
    loc: "Hóc Môn, TP.HCM",
    desc: "Đại đô thị hiện đại phía Tây Bắc TP.HCM.",
    priceRange: "Dự kiến từ 3-10 tỷ VNĐ",
    scale: "Đang phát triển",
    areaHa: 0,
    priceLow: 3000000000,
    priceHigh: 10000000000,
  },
  "masteri-cosmo-central": {
    name: "Masteri Cosmo Central The Global City Thủ Đức",
    subdivisions: [{"name":"Cosmo 1","price":"Từ 3.5 tỷ","area":"1–2PN","note":"View kênh đào"},{"name":"Cosmo 2","price":"Từ 4.2 tỷ","area":"2–3PN","note":"View quảng trường"}],
    dev: "Masterise Homes",
    loc: "An Phú, TP. Thủ Đức, TP.HCM",
    desc: "Masteri Cosmo Central tại The Global City Thủ Đức – dự án căn hộ All-in-One 6 tòa tháp, quần 2 cũ, cách trung tâm 10 phút. Masteri Cosmo ở đâu? Tọa lạc tại An Phú, nơi giao thoa giữa Thủ Thêem và Quận 2. Tổng 3.000 căn, giá từ 6,429 tỷ/căn. Loại: studio, 1PN+, 2PN, 3PN. Tiện ích 5 sao: hồ bơi sky, clubhouse, trung tâm thương mại. Masteri Cosmo Central The Global City – từ khóa SEO chính. Mở bán 2026.",
    priceRange: "Studio từ 6,4 tỷ; 2PN từ 9 tỷ; 3PN từ 13 tỷ VNĐ (2026)",
    scale: "117 ha",
    areaHa: 117,
    priceLow: 5000000000,
    priceHigh: 30000000000,
},
  "legacy-66": {
    name: "Căn hộ Legacy 66 Quận 5",
    metaTitle: "Legacy 66 Quận 5 2026 — Giá, Mặt Bằng Căn Hộ",
    metaDescription: "Căn hộ Legacy 66 Quận 5: giá bán 2026, mặt bằng, chính sách thanh toán, tiến độ vị trí trung tâm Quận 5. Nhận báo giá gốc tại SGS Land.",
    subdivisions: [{"name":"Căn hộ 1PN","price":"6,0–6,4 tỷ/căn","area":"50–54 m²","note":"Trung tâm Quận 5"},{"name":"Căn hộ 2PN","price":"8,3–9,6 tỷ/căn","area":"70–80 m²","note":"Trung tâm Quận 5"},{"name":"Căn hộ 3PN","price":"11,2–11,5 tỷ/căn","area":"95 m²","note":"Giá TB từ 119 triệu/m²"}],
    dev: "Nhiều chủ đầu tư",
    loc: "Quận 5, TP.HCM",
    desc: "Căn hộ Legacy 66 Quận 5 – dự án căn hộ cáo cấp ngay trung tâm Quận 5, tổ hợp thương mại, văn phòng và căn hộ. Bảng giá Legacy 66 theo tầng: tầng 5-10 từ 4,5 tỷ/căn (52m²), tầng 15-20 từ 5,2 tỷ/căn (65m²), tầng penthouse từ 8 tỷ. Loại: 1PN (52m²), 2PN (75m²), 3PN (95m²). Tiện ích: hồ bơi, gym, sky lounge, trung tâm thương mại tầng 1-4. Video walkaround căn mẫu tại sgsland.vn/du-an/legacy-66.",
    priceRange: "Từ 4,5 tỷ/căn (1PN); 2PN từ 5,2 tỷ (2026)",
    scale: "Đang phát triển",
    areaHa: 0,
    priceLow: 5000000000,
    priceHigh: 50000000000,
  },
  "eco-retreat-long-an": {
    name: "Eco Retreat Long An",
    dev: "Eco Park",
    loc: "Long An",
    desc: "Khu nghỉ dưỡng sinh thái cao cấp tại Long An, hòa mình vào thiên nhiên, chuẩn resort 5 sao.",
    priceRange: "Biệt thự từ 2,5 tỷ; nhà vườn từ 1,8 tỷ VNĐ",
    scale: "150 ha",
    areaHa: 150,
    priceLow: 1800000000,
    priceHigh: 8000000000,
  },
  "bat-dong-san-dong-nai": {
    name: "Bất Động Sản Đồng Nai",
    dev: "Nhiều chủ đầu tư",
    loc: "Đồng Nai",
    desc: "Danh mục bất động sản tại Đồng Nai gồm nhiều khu vực và loại hình. Vị trí, giá, pháp lý, tiến độ và tiện ích cần được xác minh theo từng dự án hoặc sản phẩm.",
    priceRange: "Đất nền từ 1,5 tỷ; biệt thự từ 5 tỷ VNĐ",
    scale: "500 ha",
    areaHa: 500,
    priceLow: 1500000000,
    priceHigh: 15000000000,
  },
  "bat-dong-san-long-thanh": {
    name: "Bất Động Sản Long Thành",
    dev: "Nhiều chủ đầu tư",
    loc: "Long Thành, Đồng Nai",
    desc: "Danh mục bất động sản tại Long Thành, Đồng Nai. Tác động của hạ tầng, giá và khả năng khai thác cần được đối chiếu theo vị trí, thời điểm và hồ sơ cụ thể.",
    priceRange: "Đất nền từ 1,8 tỷ; biệt thự từ 8 tỷ VNĐ",
    scale: "300 ha",
    areaHa: 300,
    priceLow: 1800000000,
    priceHigh: 20000000000,
  },
  "bat-dong-san-thu-duc": {
    name: "Bất Động Sản Thủ Đức",
    dev: "Nhiều chủ đầu tư",
    loc: "TP Thủ Đức, TP.HCM",
    desc: "Danh mục bất động sản tại TP Thủ Đức, TP.HCM. Sản phẩm, giá, pháp lý, tiến độ và kết nối cần được kiểm tra theo từng khu vực và dự án.",
    priceRange: "Căn hộ từ 2 tỷ; biệt thự từ 10 tỷ VNĐ",
    scale: "211 ha",
    areaHa: 211,
    priceLow: 2000000000,
    priceHigh: 18000000000,
  },
  "bat-dong-san-binh-duong": {
    name: "Bất Động Sản Bình Dương",
    dev: "Nhiều chủ đầu tư",
    loc: "Bình Dương",
    desc: "Danh mục bất động sản theo khu vực tại Bình Dương. Loại hình, giá, hạ tầng, pháp lý và khả năng khai thác cần được đối chiếu theo địa bàn và sản phẩm cụ thể.",
    priceRange: "Đất nền từ 1,2 tỷ; nhà phố từ 3 tỷ VNĐ",
    scale: "400 ha",
    areaHa: 400,
    priceLow: 1200000000,
    priceHigh: 12000000000,
  },
  "bat-dong-san-long-an": {
    name: "Bất Động Sản Long An",
    dev: "Nhiều chủ đầu tư",
    loc: "Long An",
    desc: "Danh mục bất động sản theo khu vực tại Long An. Khoảng cách, hạ tầng, giá, pháp lý và khả năng khai thác cần được xác minh theo tuyến đường, khu vực và sản phẩm.",
    priceRange: "Đất nền từ 1 tỷ; biệt thự từ 3 tỷ VNĐ",
    scale: "600 ha",
    areaHa: 600,
    priceLow: 1000000000,
    priceHigh: 8000000000,
  },
  "bat-dong-san-phu-nhuan": {
    name: "Bất Động Sản Phú Nhuận",
    dev: "Nhiều chủ đầu tư",
    loc: "Quận Phú Nhuận, TP.HCM",
    desc: "Bất động sản Phú Nhuận – quận trung tâm TP.HCM, pháp lý minh bạch.",
    priceRange: "Căn hộ từ 3,5 tỷ; nhà phố từ 10 tỷ VNĐ",
    scale: "12 ha",
    areaHa: 12,
    priceLow: 3500000000,
    priceHigh: 20000000000,
  },
  "bat-dong-san-binh-thanh": {
    name: "Bất Động Sản Bình Thạnh",
    dev: "Nhiều chủ đầu tư",
    loc: "Quận Bình Thạnh, TP.HCM",
    desc: "Danh mục bất động sản tại Bình Thạnh, TP.HCM gồm căn hộ, nhà phố và các sản phẩm khác. Giá, pháp lý, tiện ích và khả năng khai thác cần được thẩm định theo từng tài sản.",
    priceRange: "Căn hộ từ 3 tỷ; biệt thự từ 15 tỷ VNĐ",
    scale: "20 ha",
    areaHa: 20,
    priceLow: 3000000000,
    priceHigh: 22000000000,
  },
  "bat-dong-san-quan-7": {
    name: "Bất Động Sản Quận 7",
    dev: "Nhiều chủ đầu tư",
    loc: "Quận 7, TP.HCM",
    desc: "Danh mục bất động sản tại Quận 7, TP.HCM, gồm nhiều phân khu và loại hình. Tiện ích, giá, pháp lý và kết nối cần được đối chiếu theo từng dự án hoặc sản phẩm.",
    priceRange: "Căn hộ từ 3 tỷ; biệt thự từ 15 tỷ VNĐ",
    scale: "30 ha",
    areaHa: 30,
    priceLow: 3000000000,
    priceHigh: 25000000000,
  },
  "bat-dong-san-binh-chanh": {
    name: "Bất Động Sản Bình Chánh",
    dev: "Nhiều chủ đầu tư",
    loc: "Huyện Bình Chánh, TP.HCM",
    desc: "Danh mục bất động sản theo khu vực tại Bình Chánh, TP.HCM. Quy hoạch, hạ tầng, giá, pháp lý và kết nối cần được kiểm tra theo từng địa bàn và sản phẩm.",
    priceRange: "Đất nền từ 1,5 tỷ; nhà phố từ 4 tỷ VNĐ",
    scale: "350 ha",
    areaHa: 350,
    priceLow: 1500000000,
    priceHigh: 10000000000,
  },
  "bat-dong-san-can-gio": {
    name: "Bất Động Sản Cần Giờ",
    dev: "Nhiều chủ đầu tư",
    loc: "Cần Giờ, TP.HCM",
    desc: "Danh mục bất động sản theo khu vực tại Cần Giờ, TP.HCM. Quy hoạch, hạ tầng, pháp lý, môi trường và khả năng khai thác cần được kiểm tra theo từng địa bàn và sản phẩm.",
    priceRange: "18–55 triệu/m² (giá tham khảo)",
    scale: "Cần xác minh theo khu vực",
    areaHa: 0,
    priceLow: 0,
    priceHigh: 0,
  },
  "bat-dong-san-hoc-mon": {
    name: "Bất Động Sản Hóc Môn",
    dev: "Nhiều chủ đầu tư",
    loc: "Hóc Môn, TP.HCM",
    desc: "Danh mục bất động sản theo khu vực tại Hóc Môn, TP.HCM. Quy hoạch, hạ tầng, giá, pháp lý và kết nối cần được đối chiếu theo từng địa bàn và sản phẩm.",
    priceRange: "15–42 triệu/m² (giá tham khảo)",
    scale: "Cần xác minh theo khu vực",
    areaHa: 0,
    priceLow: 0,
    priceHigh: 0,
  },
  "dau-tu-bat-dong-san": {
    name: "Đầu Tư Bất Động Sản",
    dev: "SGS LAND",
    loc: "TP.HCM và các tỉnh lân cận",
    desc: "Tư vấn đầu tư BĐS chuyên nghiệp với công cụ phân tích AI và danh mục đa dạng.",
    priceRange: "Từ 1 tỷ đến 50 tỷ VNĐ",
    scale: "500+ dự án",
    areaHa: 0,
    priceLow: 1000000000,
    priceHigh: 50000000000,
  },
};

// ─── Project FAQ (English) ───────────────────────────────
function buildProjectFAQEn(slug: string, name: string, dev: string, loc: string, priceRange: string): FAQItem[] {
  return [
    {
      question: `How much does ${name} cost in 2026?`,
      answer: `${name} in ${loc} is shown by SGS LAND with an indicative range of ${priceRange} (content updated in 2026). Actual pricing depends on the sub-zone, unit, timing and sales policy; verify the developer's original price list before transacting.`,
    },
    {
      question: `Does ${name} have a pink book (land title) yet?`,
      answer: `The legal status of ${name} must be verified for the specific sub-zone and transaction date. Check original title, planning, contract and developer documents, and obtain independent professional advice before paying a deposit.`,
    },
    {
      question: `Is ${name} worth buying?`,
      answer: `${name}, developed by ${dev} in ${loc}, is assessed by SGS LAND using publicly available project information and location context. SGS LAND provides AI-assisted valuation analysis and independent advice free of charge. Call +84 971 132 378.`,
    },
    {
      question: `Does SGS LAND distribute ${name}?`,
      answer: `SGS LAND provides project information and buyer-support services for ${name}. Distribution authorization, inventory and sales policy depend on the current project agreement with ${dev}; request written confirmation before relying on an agency claim. Hotline: +84 971 132 378.`,
    },
    {
      question: `Where is ${name} and how central is it?`,
      answer: `${name} is located in ${loc} — a strategic position with well-connected infrastructure. Details on transport links, distances and nearby amenities are at sgsland.vn/en/du-an/${slug}.`,
    },
    {
      question: `What property types does ${name} offer?`,
      answer: `${name} offers a range of product types — apartments, townhouses, villas, shophouses and land plots — depending on the sub-zone. Full price tiers and floor areas are at sgsland.vn/en/du-an/${slug}.`,
    },
    {
      question: `What is the construction progress of ${name} in 2025–2026?`,
      answer: `Construction progress for ${name} should be checked against the developer's latest official notice and project documents. The SGS LAND page is informational and should not replace a current progress certificate or independent legal review.`,
    },
    {
      question: `How does ${name} compare with nearby projects?`,
      answer: `SGS LAND offers an AI comparison tool that benchmarks ${name} against other projects in the area on price per sqm, amenities, legal status and growth potential. Visit sgsland.vn/en/ai-valuation.`,
    },
    {
      question: `What are the mortgage terms for ${name}?`,
      answer: `Mortgage eligibility for ${name} depends on the bank, income evidence, collateral and current lending policy. Confirm the loan-to-value, promotional period, interest rate and disbursement conditions directly with the bank.`,
    },
    {
      question: `What is the SGS LAND hotline for ${name}?`,
      answer: `SGS LAND advises on ${name} 24/7. Hotline: +84 971 132 378, or message our Live Chat AI at sgsland.vn — we reply within 5 minutes. Free AI valuation at sgsland.vn/en/ai-valuation.`,
    },
  ];
}

// ─── Project-specific FAQ builder ────────────────────────
function buildProjectFAQ(slug: string, name: string, dev: string, loc: string, priceRange: string, en = false): FAQItem[] {
  if (en) return buildProjectFAQEn(slug, name, dev, loc, priceRange);
  // SEO #1 FIX: 10 FAQ questions per project for FAQPage structured data
  // Targets search intents: price, legal, developer, location, investment
  if (slug === "thu-thiem") {
    return [{"question":"Thủ Thiêm thuộc quận nào?","answer":"Khu đô thị mới Thủ Thiêm thuộc Thành phố Thủ Đức (trước đây là Quận 2), TP.HCM, nằm bên bờ Đông sông Sài Gòn đối diện Quận 1."},{"question":"Khu đô thị Thủ Thiêm có những dự án nào?","answer":"Thủ Thiêm có các dự án lớn như The Metropole Thủ Thiêm, Empire City, The River Thủ Thiêm, Zeit River và khu đô thị Sala Đại Quang Minh. Đây là trung tâm tài chính mới của TP.HCM."},{"question":"Quảng trường trung tâm Thủ Thiêm ở đâu?","answer":"Quảng trường trung tâm Thủ Thiêm nằm tại khu chức năng số 1, ven sông Sài Gòn, là quảng trường lớn nhất Việt Nam theo quy hoạch, kết nối cầu Thủ Thiêm và hầm vượt sông Sài Gòn."},{"question":"Giá bán bất động sản Thủ Thiêm mới nhất bao nhiêu?","answer":"Giá bán căn hộ Thủ Thiêm 2026 từ 8–10 tỷ (Empire City, The River, Metropole); nhà phố và biệt thự Sala từ 40 tỷ. Liên hệ SGS Land để nhận bảng giá từng dự án."},{"question":"Có nên đầu tư bất động sản Thủ Thiêm không?","answer":"Thủ Thiêm được quản lý quy hoạch thành trung tâm tài chính – thương mại quốc tế, hạ tầng cầu đường hoàn thiện, tiềm năng tăng giá dài hạn cao. Phù hợp đầu tư và an cư cao cấp."},{"question":"Thủ Thiêm cách trung tâm Quận 1 bao xa?","answer":"Thủ Thiêm chỉ cách trung tâm Quận 1 khoảng 300m qua sông Sài Gòn, di chuyển qua hầm Thủ Thiêm hoặc cầu Thủ Thiêm chỉ vài phút."}];
  }
  return [
    {
      question: `${name} giá bao nhiêu năm 2026?`,
      answer: `${name} tại ${loc} được SGS LAND hiển thị với mức tham khảo ${priceRange} (cập nhật nội dung: 2026). Giá thực tế phụ thuộc phân khu, diện tích, thời điểm và chính sách bán hàng; người mua nên xác nhận bảng giá gốc trước khi giao dịch.`,
    },
    {
      question: `${name} có pháp lý sổ hồng chưa?`,
      answer: `Tình trạng pháp lý của ${name} cần được xác minh theo từng phân khu và thời điểm giao dịch. Người mua nên kiểm tra hồ sơ gốc, quy hoạch, hợp đồng và xác nhận với cơ quan hoặc chuyên gia có thẩm quyền trước khi đặt cọc.`,
    },
    {
      question: `Mua ${name} có nên không?`,
      answer: `${name} do ${dev} phát triển tại ${loc}; SGS LAND phân tích dựa trên thông tin dự án được công bố và bối cảnh khu vực. SGS LAND cung cấp phân tích định giá có hỗ trợ AI và tư vấn độc lập miễn phí. Liên hệ: +84 971 132 378.`,
    },
    {
      question: `SGS LAND có phân phối ${name} không?`,
      answer: `SGS LAND cung cấp thông tin và hỗ trợ người mua tìm hiểu ${name}. Việc phân phối uỷ quyền, quỹ hàng và chính sách bán hàng phụ thuộc vào dự án và thỏa thuận hiện hành với ${dev}; người mua nên yêu cầu xác nhận bằng văn bản trước khi giao dịch. Hotline: +84 971 132 378.`,
    },
    {
      question: `${name} ở đâu, có gân trung tâm không?`,
      answer: `${name} tọa lạc tại ${loc}. Vị trí chiến lược, kết nối hạ tầng đồng bộ. Chi tiết về giao thông, khoảng cách và tiện ích lân cận tại sgsland.vn/du-an/${slug}.`,
    },
    {
      question: `${name} có những loại hình bất động sản nào?`,
      answer: `${name} cung cấp nhiều loại hình: căn hộ, nhà phố, biệt thự, shophouse và đất nền tùy theo phân khu. Mọi tầng giá và diện tích cụ thể tại sgsland.vn/du-an/${slug}.`,
    },
    {
      question: `Tiến độ xây dựng ${name} 2025-2026 như thế nào?`,
      answer: `Tiến độ ${name} cần được đối chiếu với thông báo chính thức của chủ đầu tư, hồ sơ xây dựng và thời điểm cập nhật. Trang SGS LAND chỉ cung cấp thông tin tham khảo; người mua nên yêu cầu tài liệu tiến độ mới nhất trước khi giao dịch.`,
    },
    {
      question: `So sánh ${name} với các dự án lân cận?`,
      answer: `SGS LAND cung cấp công cụ so sánh AI giữa ${name} và các dự án cùng khu vực dựa trên giá/m², tiện ích, pháp lý và tiềm năng tăng giá. Truy cập sgsland.vn/ai-valuation.`,
    },
    {
      question: `Vay mua ${name} có điều kiện gì?`,
      answer: `Khả năng vay mua ${name} phụ thuộc ngân hàng, hồ sơ thu nhập, tài sản bảo đảm và chính sách từng thời điểm. Người mua cần xác nhận hạn mức, lãi suất, thời gian ưu đãi và điều kiện giải ngân trực tiếp với ngân hàng.`,
    },
    {
      question: `Hotline tư vấn ${name} của SGS LAND là bao nhiêu?`,
      answer: `SGS LAND hỗ trợ tư vấn 24/7 về ${name}. Hotline: +84 971 132 378. Hoặc nhắn tin qua Live Chat AI tại sgsland.vn – phản hồi trong 5 phút. Định giá AI miễn phí tại sgsland.vn/ai-valuation.`,
    },
  ];
}
// —— Apartment Complex SEO Meta (GEO Tier S) ——————————————————————————
const APARTMENT_COMPLEX_META: Record<string, {
  amenities: string[];
  numberOfRooms: string;
  priceRange: string;
}> = {
  "aqua-city": {
    amenities: ["Bãi tắm riêng", "Marina & du thuyền", "Bệnh viện 5 sao", "Trường học quốc tế", "Công viên chủ đề", "Sân golf 18 lỗ", "Trung tâm thương mại"],
    numberOfRooms: "1-5",
    priceRange: "VND 6000000000-50000000000",
  },
  "diamond-sky-van-phuc-city": {
    amenities: ["Hồ bơi vô cực tầng thượng", "Sky lounge", "Phòng gym 24/7", "Công viên nội khu", "Trường mầm non quốc tế", "Siêu thị nội khu", "Bãi đậu xe thông minh"],
    numberOfRooms: "1-3",
    priceRange: "VND 2500000000-9000000000",
  },
  "vinhomes-hoc-mon": {
    amenities: ["Hồ sinh thái trung tâm", "Công viên xanh 50ha", "Trường học liên cấp Vinschool", "Vinmec clinic", "Vincom mega mall", "Hệ thống an ninh 24/7", "Vinhomes Smart City app"],
    numberOfRooms: "2-5",
    priceRange: "VND 3500000000-50000000000",
  },
  "masteri-cosmo-central": {
    amenities: ["Smart home Loxone", "Hồ bơi vô cực tầng 38", "Sky gym & yoga deck", "Co-working lounge", "Trực tiếp Metro số 1", "BBQ terrace", "Electric car charging"],
    numberOfRooms: "1-4",
    priceRange: "VND 2800000000-14000000000",
  },
  "legacy-66": {
    amenities: ["Full nội thất cao cấp bàn giao", "Hồ bơi tầng trệt & tầng thượng", "Phòng gym hiện đại", "Clubhouse 5 sao", "Kết nối Vsip 3 & Aeon Mall", "Trường học nội khu", "CCTV 24/7 AI"],
    numberOfRooms: "1-3",
    priceRange: "VND 2100000000-5500000000",
  },
  "sala": {
    amenities: ["Đường dạo bộ sông", "Hồ bơi ngoài trời", "Trung tâm thương mại Sala", "CLB thể thao", "Trường học quốc tế", "Spa & wellness", "Bãi đỗ xe thông minh"],
    numberOfRooms: "1-4",
    priceRange: "VND 4000000000-25000000000",
  },
  "eco-retreat-long-an": {
    amenities: ["Khu nghỉ dưỡng sinh thái", "Hồ bơi vô cực", "Farm trải nghiệm hữu cơ", "Yoga & meditation garden", "Nhà hàng farm-to-table", "Khu vui chơi trẻ em", "An ninh 24/7"],
    numberOfRooms: "2-4",
    priceRange: "VND 2500000000-8000000000",
  },
  "bat-dong-san-dong-nai": {
    amenities: ["Hạ tầng giao thông đồng bộ", "Khu công nghiệp lân cận", "Trường học & bệnh viện", "Trung tâm thương mại", "Công viên cây xanh", "Hệ thống an ninh 24/7", "Giao thông kết nối TP.HCM"],
    numberOfRooms: "2-5",
    priceRange: "VND 1500000000-15000000000",
  },
  "bat-dong-san-long-thanh": {
    amenities: ["Gần sân bay Long Thành", "Hạ tầng giao thông phát triển", "Khu công nghiệp", "Tiện ích giáo dục", "Y tế chuẩn quốc tế", "Trung tâm thương mại", "An ninh 24/7"],
    numberOfRooms: "2-5",
    priceRange: "VND 1800000000-20000000000",
  },
  "bat-dong-san-thu-duc": {
    amenities: ["Metro số 1", "ĐHQG TP.HCM", "Khu công nghệ cao", "Vincom Mega Mall", "Hồ bơi & gym", "Công viên hiện đại", "Hệ thống an ninh 24/7"],
    numberOfRooms: "1-4",
    priceRange: "VND 2000000000-18000000000",
  },
  "bat-dong-san-binh-duong": {
    amenities: ["Hạ tầng đồng bộ", "Khu công nghiệp VSIP", "Trung tâm hành chính", "Hệ thống trường học", "Y tế hiện đại", "Khu đô thị mới", "An ninh 24/7"],
    numberOfRooms: "2-5",
    priceRange: "VND 1200000000-12000000000",
  },
  "bat-dong-san-long-an": {
    amenities: ["Khí hậu trong lành", "Hạ tầng giao thông mới", "Khu công nghiệp lân cận", "Tiện ích giáo dục", "Công viên sinh thái", "Hệ thống an ninh 24/7", "Giao thông kết nối TP.HCM"],
    numberOfRooms: "2-4",
    priceRange: "VND 1000000000-8000000000",
  },
  "bat-dong-san-phu-nhuan": {
    amenities: ["Vị trí trung tâm TP.HCM", "Tiện ích mua sắm cao cấp", "Trường học quốc tế", "Nhà hàng & café sang trọng", "Spa & fitness center", "Bảo vệ 24/7", "Giao thông thuận tiện"],
    numberOfRooms: "1-3",
    priceRange: "VND 3500000000-20000000000",
  },
  "bat-dong-san-binh-thanh": {
    amenities: ["Vị trí vàng TP.HCM", "View sông Sài Gòn", "Tiện ích cao cấp", "Trung tâm thương mại", "Trường học & bệnh viện", "Hồ bơi & gym", "An ninh 24/7"],
    numberOfRooms: "1-4",
    priceRange: "VND 3000000000-22000000000",
  },
  "bat-dong-san-quan-7": {
    amenities: ["Phú Mỹ Hưng hiện đại", "Trung tâm thương mại Crescent Mall", "Hồ bơi vô cực", "Trường học quốc tế", "Bệnh viện FV", "Công viên hiện đại", "An ninh 24/7"],
    numberOfRooms: "1-4",
    priceRange: "VND 3000000000-25000000000",
  },
  "bat-dong-san-binh-chanh": {
    amenities: ["Hạ tầng giao thông phát triển", "Khu đô thị mới quy hoạch", "Công viên cây xanh", "Tiện ích giáo dục", "Trung tâm y tế", "Khu thương mại dịch vụ", "An ninh 24/7"],
    numberOfRooms: "2-4",
    priceRange: "VND 1500000000-10000000000",
  },
  "dau-tu-bat-dong-san": {
    amenities: ["Dự án đa dạng phân khúc", "Tư vấn đầu tư chuyên nghiệp", "Phân tích thị trường có hỗ trợ AI", "Quản lý danh mục BĐS", "Hỗ trợ pháp lý theo nhu cầu", "Kết nối nhà đầu tư & chủ đầu tư", "Bảo mật thông tin"],
    numberOfRooms: "1-5",
    priceRange: "VND 1000000000-50000000000",
  },
};
// ─── Generate static paths ────────────────────────────────
export async function generateStaticParams() {
  return Object.keys(PROJECT_META).map((slug) => ({ slug }));
}
// ─── Metadata ─────────────────────────────────────────────
const SLUG_KEYWORDS: Record<string, string> = {
  "aqua-city": "Aqua City Novaland Dong Nai, nha pho Aqua City, biet thu Aqua City, gia du an Aqua City, Aqua City Long Thanh, Aqua City co nen mua khong 2026, Aqua City gia bao nhieu, mat bang Aqua City",
  "vinhomes-central-park": "Vinhomes Central Park Binh Thanh, can ho Vinhomes Central Park, Central Park Binh Thanh, Landmark 81, can ho cho thue Vinhomes Central Park, gia can ho Vinhomes Central Park 2026, mat bang Vinhomes Central Park",
  "masteri-cosmo-central": "Masteri Cosmo Central The Global City, Masteri Cosmo o dau, Masteri Cosmo Thu Duc, Masteri Cosmo gia bao nhieu, can ho The Global City 2026",
  "legacy-66": "can ho Legacy 66 Quan 5, Legacy 66 gia bao nhieu, Legacy 66 ban phong nao, mua can ho Legacy 66",
  "diamond-sky-van-phuc-city": "Diamond Sky Van Phuc City, Diamond Sky Thu Duc, can ho Diamond Sky gia bao nhieu, can ho Van Phuc City 2026",
  "vinhomes-grand-park": "Vinhomes Grand Park Quan 9, Vinhomes Grand Park Thu Duc, can ho Vinhomes Grand Park, Vinhomes Grand Park gia bao nhieu, mua ban Vinhomes Grand Park 2026",
  "the-global-city": "The Global City Quan 2, The Global City An Phu, can ho The Global City, SOHO The Global City, gia ban The Global City 2026",
  "izumi-city": "Izumi City Nam Long, Izumi City Bien Hoa, Izumi City Dong Nai, dat nen Izumi City, biet thu Izumi City, gia Izumi City 2026",
  "masteri-park-place": "Masteri Park Place, Masteri Park Place The Global City, can ho Masteri Park Place, gia ban Masteri Park Place 2026",
  "thu-thiem": "Khu do thi Thu Thiem, ban dat nen Thu Thiem, quy hoach Thu Thiem 2026, gia dat Thu Thiem, du an Thu Thiem",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const en = (await getLang()) === "en";
  const meta = PROJECT_META[slug];
  const areaName = en && AREA_DETAIL_SLUGS.has(slug)
    ? (AREA_ENGLISH_NAMES[slug] || meta?.name || slug)
    : meta?.name;
  const title = en
    ? meta
      ? `${areaName} | ${AREA_DETAIL_SLUGS.has(slug) ? "Area reference" : "Property project"}`
      : `Project ${slug} | SGS LAND`
    : meta?.metaTitle
    ? meta.metaTitle
    : meta
    ? `${meta.name} | Dự án BĐS | SGS LAND`
    : `Dự án ${slug} | SGS LAND`;
  const description = en
    ? meta
      ? `${areaName} — ${meta.loc}. ${meta.priceRange}. ${AREA_DETAIL_SLUGS.has(slug) ? "Indicative area information" : "Indicative project information"} from SGS LAND; verify current price, legal status, progress and distribution authorization against original documents.`
      : "Detailed real estate project information from SGS LAND."
    : meta?.metaDescription ??
      meta?.desc ??
      "Thông tin chi tiết dự án bất động sản tại SGS LAND.";
  return {
    title,
    description,
    alternates: {
      canonical: en ? `https://sgsland.vn/en/du-an/${slug}` : `https://sgsland.vn/du-an/${slug}`,
      ...langAlternates(`/du-an/${slug}`),
    },
      keywords: SLUG_KEYWORDS[slug] ?? `${meta?.name ?? slug} gia ban, phap ly, tien do 2026`,
    openGraph: {
      title,
      description,
      url: en ? `https://sgsland.vn/en/du-an/${slug}` : `https://sgsland.vn/du-an/${slug}`,
      images: [{ url: `/images/projects/${slug}.jpg`, width: 1200, height: 630 }],
    },
  };
}
// ─── ISR — revalidate every 6 hours ──────────────────────
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const en = (await getLang()) === "en";
  // Fetch live project data from Express backend (server-side, ISR cached)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any = null;
  let cmsContent: any = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/projects/${slug}`,
      { next: { revalidate: 21600 } }
    );
    if (res.ok) {
      const data = await res.json();
      project = data.project ?? null;
    }
    const cmsRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public-project-content/published/${slug}`,
      { cache: "no-store" }
    );
    if (cmsRes.ok) cmsContent = await cmsRes.json();
  } catch {
    // Fallback to static meta below
  }
  const listItem = ALL_PROJECTS.find((x) => x.slug === slug);
  if (!project && !PROJECT_META[slug] && !listItem) {
    notFound();
  }
  const meta = PROJECT_META[slug];
  const cms = cmsContent?.content || {};
  const projectData = cmsContent ? {
    ...(project || {}),
    name: cmsContent.name,
    slug,
    developer: cms.developer || project?.developer || "",
    location: cms.location || project?.location || "",
    description: cms.description || project?.description || "",
    images: String(cms.images || "").split(/\r?\n/).filter(Boolean),
    videos: String(cms.videos || "").split(/\r?\n/).filter(Boolean),
    amenities: String(cms.amenities || "").split(/\r?\n/).filter(Boolean),
  } : project ?? {
    name: meta?.name ?? listItem?.name ?? slug,
    developer: meta?.dev ?? listItem?.developer ?? "",
    location: meta?.loc ?? listItem?.location ?? "",
    description: meta?.desc ?? listItem?.description ?? "",
    slug,
    images: [],
    videos: [],
    amenities: [],
  };
  const schemaProjectName = en && AREA_DETAIL_SLUGS.has(slug)
    ? (AREA_ENGLISH_NAMES[slug] || projectData.name)
    : projectData.name;
  const schemaLocation = en && AREA_DETAIL_SLUGS.has(slug)
    ? (projectData.location || meta?.loc || "Vietnam")
      .replace(/TP\.?HCM/gi, "Ho Chi Minh City")
      .replace(/Quận\s+/gi, "District ")
    : (projectData.location || meta?.loc || "");
  const schemaProjectDescription = cmsContent?.content?.seoDescription || (en && AREA_DETAIL_SLUGS.has(slug)
    ? `${schemaProjectName} is an area-level real estate reference page, not a single development. Verify the specific property, legal documents, pricing and operating status before a transaction.`
    : projectData.description);
  const schemaProjectDeveloper = en && AREA_DETAIL_SLUGS.has(slug)
    ? (slug === "nha-pho-trung-tam" ? "Multiple individual and organizational owners" : "Multiple developers")
    : projectData.developer;
  const schemaPriceRange = en && AREA_DETAIL_SLUGS.has(slug)
    ? "Reference figures vary by sub-zone and property; verify current pricing against dated documents"
    : (meta?.priceRange || (en ? "Contact SGS LAND for the latest price list" : "Liên hệ SGS LAND để biết giá cập nhật"));
  // ─── JSON-LD schemas ──────────────────────────────────
  const listingSchema = getRealEstateListingSchema({
    name: schemaProjectName,
    slug,
    description: schemaProjectDescription,
    location: schemaLocation,
    developer: schemaProjectDeveloper,
    images: projectData.images,
    amenities: projectData.amenities,
    total_units: projectData.total_units ?? projectData.listing_count,
    area_ha: meta?.areaHa,
    price_low: meta?.priceLow,
    price_high: meta?.priceHigh,
  });
  const detailPath = getDetailBasePath(slug);
  const isArea = AREA_DETAIL_SLUGS.has(slug);
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: en ? "Home" : "Trang chủ", url: en ? `${SITE_URL}/en` : SITE_URL },
    { name: en ? (isArea ? "Areas" : "Property projects") : (isArea ? "Khu vực" : "Dự án BĐS"), url: en ? `${SITE_URL}/en/${isArea ? "khu-vuc" : "du-an"}` : `${SITE_URL}/${isArea ? "khu-vuc" : "du-an"}` },
    { name: schemaProjectName, url: `${SITE_URL}${detailPath}` },
  ]);
  const orgSchema = getOrganizationSchema();
  const faqItems = buildProjectFAQ(
    slug,
    schemaProjectName,
    schemaProjectDeveloper || meta?.dev || "",
    projectData.location || meta?.loc || "",
    schemaPriceRange,
    en
  );
  const faqSchema = getFAQSchema(faqItems, `${SITE_URL}${detailPath}#faq`);
  const videoSchema = getVideoSchema(slug);
  const announcementSchema = getSpecialAnnouncementSchema(slug);
  // Serialised JSON for noscript layer
  const aptMeta = APARTMENT_COMPLEX_META[slug];
  const apartmentSchema = aptMeta && slug !== "aqua-city" ? getApartmentComplexSchema({
    name: projectData.name,
     url: `${SITE_URL}${detailPath}`,
     description: schemaProjectDescription,
    location: projectData.location,
    developer: projectData.developer,
    numberOfRooms: aptMeta.numberOfRooms,
    amenities: aptMeta.amenities,
    priceRange: aptMeta.priceRange,
  }) : null;
  const schemasJson = JSON.stringify(
    [listingSchema, breadcrumbSchema, orgSchema, faqSchema, ...(apartmentSchema ? [apartmentSchema] : [])],
    null, 2
  );
  return (
    <>
      {/* ── JSON-LD schemas: SSR-rendered, visible in raw HTML ── */}
      <SchemaScript schemas={[listingSchema, breadcrumbSchema, orgSchema, faqSchema, ...(videoSchema ? [videoSchema] : []), ...(announcementSchema ? [announcementSchema] : [])]} />
      {/*
       * ── noscript fallback layer ──────────────────────────────
       * AI crawlers that do not execute JavaScript still receive
       * the full JSON-LD payload embedded as plain text inside
       * <noscript>. Browsers with JS disabled see the structured
       * data as readable HTML; structured crawlers parse the
       * embedded <script> tags even inside <noscript>.
       */}
      <noscript>
        {/* eslint-disable-next-line react/no-danger */}
        <div
          aria-hidden="true"
          data-ld-noscript="true"
          dangerouslySetInnerHTML={{
            __html: `<script type="application/ld+json">${schemasJson}</script>`,
          }}
        />
      </noscript>
      {/*
       * ── Server-rendered article block ───────────────────────
       * Provides fully hydrated, AI-parseable content before the
       * client component mounts. Uses sr-only visibility so the
       * interactive ProjectDetailPage is the visual source of
       * truth — but crawlers that skip JS see real content here.
       *
       * GEO note: statistics (+33.9%), named entities (+30%) and
       * direct answerability (+28%) are the top citation signals
       * per Princeton/IIT Delhi KDD 2024.
       */}
      <article
        className="sr-only"
         aria-label={en ? `Area information: ${schemaProjectName}` : `Thông tin dự án ${projectData.name}`}
        itemScope        itemType="https://schema.org/RealEstateListing"
      >
        <p itemProp="name" className="font-semibold">{schemaProjectName}</p>
        <p className="answer-box" role="note">
          {en
             ? `${schemaProjectName} is an area-level real-estate reference in ${schemaLocation} with multiple individual and organizational owners. This page summarizes indicative area information and buyer questions; price, legal status and property conditions must be verified against current original documents.`
            : `${projectData.name} là dự án bất động sản tại ${projectData.location || meta?.loc || "Việt Nam"} do ${projectData.developer || meta?.dev || "chủ đầu tư được ghi trên trang"} phát triển. Trang này tổng hợp thông tin tham khảo, loại hình và câu hỏi người mua; giá, pháp lý và tiến độ cần được xác minh bằng hồ sơ gốc hiện hành.`}
        </p>
        <p itemProp="description">{schemaProjectDescription ?? meta?.desc}</p>

        {/* — Bảng giá theo phân khu (SEO/GEO structured content) — */}
        {meta?.subdivisions && meta.subdivisions.length > 0 && (
          <section aria-label={en ? `Sub-zone price list: ${projectData.name}` : `Bảng giá các phân khu ${projectData.name}`}>
            <h2>{en ? `Sub-zone price list & floor plans — ${projectData.name}` : `Bảng giá & mặt bằng các phân khu ${projectData.name}`}</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">{en ? "Sub-zone" : "Phân khu"}</th>
                  <th scope="col">{en ? "From" : "Giá từ"}</th>
                  <th scope="col">{en ? "Area" : "Diện tích"}</th>
                  <th scope="col">{en ? "Notes" : "Ghi chú"}</th>
                </tr>
              </thead>
              <tbody>
                {meta.subdivisions.map((sub, i) => (
                  <tr key={i}>
                    <th scope="row">{sub.name}</th>
                    <td>{sub.price}</td>
                    <td>{sub.area ?? "—"}</td>
                    <td>{sub.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {en
                ? `${projectData.name} price list, updated for 2026. Contact SGS LAND for the developer's original price list, detailed sub-zone floor plans and current sales policy.`
                : `Bảng giá ${projectData.name} cập nhật mới nhất 2026. Liên hệ SGS Land để nhận bảng giá gốc, mặt bằng chi tiết từng phân khu và chính sách bán hàng.`}
            </p>
          </section>
        )}
        <dl>
          <dt>{en ? "Developer" : "Chủ đầu tư"}</dt>
           <dd itemProp="brand">{en && AREA_DETAIL_SLUGS.has(slug) ? schemaProjectDeveloper : (projectData.developer || meta?.dev)}</dd>

          <dt>{en ? "Location" : "Vị trí"}</dt>
           <dd itemProp="address">{schemaLocation}</dd>
          {meta?.scale && (
            <>
              <dt>{en ? "Scale" : "Quy mô"}</dt>
              <dd>{meta.scale}</dd>
            </>
          )}
          {meta?.priceRange && (
            <>
              <dt>{en ? "Indicative price" : "Giá tham khảo"}</dt>
               <dd itemProp="offers">{en && AREA_DETAIL_SLUGS.has(slug) ? schemaPriceRange : meta.priceRange}</dd>
            </>
          )}
          <dt>{en ? "Authorised distribution agent" : "Đại lý phân phối uỷ quyền"}</dt>
          <dd>
            {en
              ? "SGS LAND (sgsland.vn) — provides project information and buyer support. Verify authorization, legal status and pricing against original documents and the current developer policy. Hotline: +84 971 132 378."
              : "SGS LAND (sgsland.vn) — cung cấp thông tin dự án và hỗ trợ người mua. Người mua cần xác minh tư cách phân phối, pháp lý và giá bán bằng hồ sơ gốc cùng chính sách hiện hành của chủ đầu tư. Hotline: +84 971 132 378."}
          </dd>
          <dt>URL</dt>
          <dd>
            <a href={`https://sgsland.vn${detailPath}`}>
              https://sgsland.vn{detailPath}
            </a>
          </dd>
        </dl>
        {/* FAQ section for AI extraction */}
        <section aria-label={en ? "Frequently asked questions" : "Câu hỏi thường gặp"}>
           <h2>{en ? `Frequently asked questions about ${schemaProjectName}` : `Câu hỏi thường gặp về ${projectData.name}`}</h2>
          {faqItems.map((item, i) => (
            <div key={i} itemScope itemType="https://schema.org/Question">
              <h3 itemProp="name">{item.question}</h3>
              <div itemScope itemType="https://schema.org/Answer">
                <p itemProp="text">{item.answer}</p>
              </div>
            </div>
          ))}
        </section>
      </article>
      {/* ── Interactive client component ── */}
      <ProjectDetailPage
        project={projectData}
        slug={slug}
        config={resolveProjectConfig(slug)}
        landingProject={getAquaStyleLanding(slug)}
      />
    </>
  );
}