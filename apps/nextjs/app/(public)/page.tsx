import type { Metadata } from "next";
import type { Listing } from "@/types";
import { LandingPage } from "@/components/public/LandingPage";
import { SchemaScript } from "@/components/SchemaScript";
import { getFAQSchema, getBreadcrumbSchema, getFoundersSchema, FAQ_HOMEPAGE, SITE_URL } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
  description:
    "SGS LAND — Marketplace BĐS, định giá AI tự động, CRM đa kênh. Khám phá 45.000+ sản phẩm BĐS tại TP.HCM, Đồng Nai, Bình Dương.",
  alternates: { canonical: "https://sgsland.vn/" },
};

// SSG — statically generated, revalidate every 1 hour for hero stats
export const revalidate = 3600;

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
      {/* Page-specific JSON-LD: FAQ (GEO-optimised answers) + Breadcrumb + Founders (E-E-A-T) */}
      <SchemaScript schemas={[
        getFAQSchema(FAQ_HOMEPAGE, `${SITE_URL}/#faq-homepage`),
        homeBreadcrumb,
        ...getFoundersSchema(),
      ]} />
      <LandingPage featuredListings={featuredListings} stats={stats} />
    </>
  );
}
