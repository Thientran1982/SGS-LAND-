import type { Metadata } from "next";
import type { Listing } from "@/types";
import { LandingPage } from "@/components/public/LandingPage";
import { SchemaScript } from "@/components/SchemaScript";
import { getFAQSchema, getBreadcrumbSchema, getFoundersSchema, FAQ_HOMEPAGE, SITE_URL } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
  description:
    "SGS LAND — Marketplace BĐS, định giá AI tự động ±4.8%, CRM đa kênh. Khám phá 45.000+ sản phẩm BĐS tại TP.HCM, Đồng Nai, Bình Dương. Đại lý F1: Vinhomes Hóc Môn, Vinhomes Cần Giờ, Aqua City.",
  alternates: { canonical: "https://sgsland.vn/" },
};

// SSG — statically generated, revalidate every 1 hour for hero stats
export const revalidate = 3600;

// ── Additional GEO schemas for Phase 4 ──────────────────────────────────────

const SPECIAL_ANNOUNCEMENT_VHM = {
  "@context": "https://schema.org",
  "@type": "SpecialAnnouncement",
  "@id": `${SITE_URL}/#announcement-vhm`,
  name: "Vinhomes Smart City Hóc Môn — Mở bán Q4/2026",
  text: "SGS LAND — đại lý F1 uỷ quyền Vinhomes — nhận đăng ký đặt chỗ ưu tiên Vinhomes Smart City Hóc Môn (667ha, giá từ 2,5 tỷ, Smart City 4.0, ra mắt Q4/2026). Vành đai 3 TP.HCM vận hành 2026 — catalyst tăng giá trực tiếp khu vực Hóc Môn.",
  datePosted: "2026-06-05",
  expires: "2027-12-31",
  category: "RealEstate",
  spatialCoverage: {
    "@type": "Place",
    name: "Hóc Môn, TP.HCM, Việt Nam",
  },
  announcementLocation: {
    "@type": "VirtualLocation",
    url: `${SITE_URL}/du-an/vinhomes-hoc-mon`,
  },
};

const SPECIAL_ANNOUNCEMENT_VCG = {
  "@context": "https://schema.org",
  "@type": "SpecialAnnouncement",
  "@id": `${SITE_URL}/#announcement-vcg`,
  name: "Vinhomes Cần Giờ GĐ1 — Mở bán Q3/2026",
  text: "SGS LAND nhận đăng ký đặt chỗ ưu tiên Vinhomes Cần Giờ (Green Paradise, 2.870ha, huyện Cần Giờ, TP.HCM). GĐ1 dự kiến mở bán Q3/2026 — biệt thự biển, shophouse biển từ 15-50 tỷ. Cầu Cần Giờ (vốn 11.000 tỷ) khởi công 2025.",
  datePosted: "2026-06-05",
  expires: "2026-12-31",
  category: "RealEstate",
  spatialCoverage: {
    "@type": "Place",
    name: "Cần Giờ, TP.HCM, Việt Nam",
  },
  announcementLocation: {
    "@type": "VirtualLocation",
    url: `${SITE_URL}/du-an/vinhomes-can-gio`,
  },
};

const DATASET_AREA_PRICE_INDEX = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "@id": `${SITE_URL}/data/area-price-index.json`,
  name: "SGS LAND Area Price Index — Chỉ số giá BĐS Đông Nam Bộ Q2/2026",
  description:
    "Chỉ số giá bất động sản cập nhật Q2/2026 tại 11 quận/huyện trọng điểm TP.HCM, Đồng Nai, Bình Dương, Long An. Bao gồm giá căn hộ, nhà phố, đất nền theo từng khu vực. Dữ liệu từ 2.400+ giao dịch công chứng 2024-2025.",
  url: `${SITE_URL}/data/area-price-index.json`,
  dateModified: "2026-06-05",
  inLanguage: "vi",
  creator: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "SGS LAND",
    url: SITE_URL,
  },
  keywords: ["bất động sản TP.HCM", "chỉ số giá nhà", "giá đất Đồng Nai", "AVM Việt Nam"],
  license: "https://creativecommons.org/licenses/by/4.0/",
};

const DATASET_VHM = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "@id": `${SITE_URL}/data/vinhomes-hoc-mon-price-index.json`,
  name: "Vinhomes Smart City Hóc Môn — Price Index & Project Data 2026",
  description:
    "Dataset chi tiết Vinhomes Smart City Hóc Môn (667ha): giá dự kiến theo loại hình, hạ tầng kết nối, phân tích đầu tư, chỉ số giá khu vực Hóc Môn Q2/2026. Nguồn: SGS LAND (F1 Vinhomes).",
  url: `${SITE_URL}/data/vinhomes-hoc-mon-price-index.json`,
  dateModified: "2026-06-05",
  inLanguage: "vi",
  creator: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "SGS LAND",
    url: SITE_URL,
  },
};

const SPEAKABLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/#speakable`,
  name: "SGS LAND — Nền tảng BĐS AI số 1 Việt Nam",
  url: SITE_URL,
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "h2", ".hero-description", "[data-speakable]"],
    xpath: [
      "/html/head/title",
      "/html/head/meta[@name='description']/@content",
    ],
  },
};

export default async function HomePage() {
  // Fetch featured listings & stats at build/revalidation time
  let featuredListings: Listing[] = [];
  let stats = { totalListings: 45000, totalProjects: 12, totalBrokers: 15000 };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings?limit=6&featured=true`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      featuredListings = data.data || [];
    }
  } catch {
    // Fallback to static data during build
  }

  const homeBreadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
  ]);

  return (
    <>
      {/* Page-specific JSON-LD: FAQ (GEO-optimised) + Breadcrumb + Founders (E-E-A-T) */}
      <SchemaScript schemas={[
        getFAQSchema(FAQ_HOMEPAGE, `${SITE_URL}/#faq-homepage`),
        homeBreadcrumb,
        ...getFoundersSchema(),
        // Phase 4 GEO schemas
        SPECIAL_ANNOUNCEMENT_VHM,
        SPECIAL_ANNOUNCEMENT_VCG,
        DATASET_AREA_PRICE_INDEX,
        DATASET_VHM,
        SPEAKABLE_SCHEMA,
      ]} />
      <LandingPage featuredListings={featuredListings} stats={stats} />
    </>
  );
}
