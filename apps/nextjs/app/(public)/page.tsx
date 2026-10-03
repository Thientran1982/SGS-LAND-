// @ts-nocheck
import type { Metadata } from "next";
import type { Listing } from "@/types";
import { LandingPage } from "@/components/public/LandingHome";
import { SchemaScript } from "@/components/SchemaScript";
import { getFAQSchema, getBreadcrumbSchema, getFoundersSchema, FAQ_HOMEPAGE, SITE_URL } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en
      ? "Vietnam's #1 AI Real Estate Platform"
      : "Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
    description: en
      ? "SGS LAND — property marketplace, AI-assisted valuation and omnichannel CRM for real-estate references across Vietnam."
      : "SGS LAND — Marketplace BĐS, định giá có hỗ trợ AI và CRM đa kênh cho thông tin tham khảo bất động sản tại Việt Nam.",
    alternates: {
      canonical: en ? "https://sgsland.vn/en" : "https://sgsland.vn/",
      ...langAlternates("/"),
    },
  };
}
// SSG — statically generated, revalidate every 1 hour for hero stats
export const dynamic = "force-dynamic";
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
export default async function HomePage() {
  let featuredListings: Listing[] = [];
  let stats = { totalListings: 0, totalProjects: 0, totalBrokers: 0 };
  const illustrative = process.env.NODE_ENV === "development";
  if (illustrative) {
    // Homepage-only synthetic fixtures: never request live listing data in dev.
    featuredListings = [
      { id: 92001, title: "Nhà phố ven sông Aqua City", location: "Aqua City, Biên Hòa, Đồng Nai", price: 6200000000, area: 120, bedrooms: 3, transaction: "SALE", status: "AVAILABLE", type: "Townhouse", images: ["/images/projects/aqua-city.webp"], attributes: { legalStatus: "Contract" }, isVerified: true },
      { id: 92002, title: "Nhà phố thương mại The Global City", location: "The Global City, Thủ Đức, TP.HCM", price: 7800000000, area: 96, bedrooms: 3, transaction: "SALE", status: "AVAILABLE", type: "Townhouse", images: ["/images/projects/the-global-city.webp"], attributes: { legalStatus: "Contract" }, isVerified: true },
      { id: 92003, title: "Căn hộ Izumi City", location: "Izumi City, Biên Hòa, Đồng Nai", price: 4800000000, area: 82, bedrooms: 2, transaction: "SALE", status: "AVAILABLE", type: "Apartment", images: ["/images/projects/izumi-city.webp"], attributes: { legalStatus: "Contract" }, isVerified: true },
      { id: 92004, title: "Nhà phố Vinhomes Cần Giờ", location: "Vinhomes Cần Giờ, TP.HCM", price: 8200000000, area: 112, bedrooms: 3, transaction: "SALE", status: "AVAILABLE", type: "Townhouse", images: ["/images/projects/vinhomes-can-gio.webp"], attributes: { legalStatus: "Contract" }, isVerified: true },
    ] as Listing[];
    stats = { ...stats, totalListings: 85, totalProjects: 5 };
  } else {
    // Keep the existing production listing behavior unchanged.
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings?limit=6&featured=true`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        featuredListings = data.data || [];
      }
      const apiBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const countRes = await fetch(`${apiBase}/api/public/listings?page=1&pageSize=12`, { next: { revalidate: 600 } });
      if (countRes.ok) {
        const countData = await countRes.json();
        const total = Number(countData?.total);
        if (Number.isFinite(total) && total > 0) stats = { ...stats, totalListings: total };
        if (featuredListings.length < 4 && Array.isArray(countData?.data)) featuredListings = countData.data;
      }
    } catch {
      // Public homepage remains renderable while the listings service is unavailable.
    }
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
        DATASET_AREA_PRICE_INDEX,
      ]} />
      <LandingPage featuredListings={featuredListings} stats={stats} illustrative={illustrative} />
    </>
  );
}