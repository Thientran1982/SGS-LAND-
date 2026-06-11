// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
export const metadata: Metadata = { title: "Bất Động Sản Phú Nhuận 2025 | SGS LAND", description: "2300+ bất động sản Phú Nhuận — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-phu-nhuan" } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate area="Phú Nhuận" areaSlug="bat-dong-san-phu-nhuan" districts={[]} projects={[]} priceRange="Từ 2 tỷ — 20 tỷ" totalListings={2300} description="Bất động sản Phú Nhuận — tìm kiếm tại SGS LAND." />; }
