// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
export const metadata: Metadata = { title: "Bất Động Sản Bình Dương 2025 | SGS LAND", description: "6400+ bất động sản Bình Dương — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-duong" } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate area="Bình Dương" areaSlug="bat-dong-san-binh-duong" districts={[]} projects={[]} priceRange="Từ 2 tỷ — 20 tỷ" totalListings={6400} description="Bất động sản Bình Dương — tìm kiếm tại SGS LAND." />; }
