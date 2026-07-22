// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
export const metadata: Metadata = { title: "Bất Động Sản Quận 7 2025", description: "4100+ bất động sản Quận 7 — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-quan-7" } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate area="Quận 7" areaSlug="bat-dong-san-quan-7" districts={[]} projects={[]} priceRange="Từ 2 tỷ — 20 tỷ" totalListings={4100} description="Bất động sản Quận 7 — tìm kiếm tại SGS LAND." />; }
