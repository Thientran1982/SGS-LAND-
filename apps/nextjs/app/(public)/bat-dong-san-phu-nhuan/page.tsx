// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
export const metadata: Metadata = { title: "Bất Động Sản Phú Nhuận 2025", description: "2300+ bất động sản Phú Nhuận — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-phu-nhuan" } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-phu-nhuan"]} />; }
