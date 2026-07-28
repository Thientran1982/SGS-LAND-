// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
export const metadata: Metadata = { title: "Bất Động Sản Quận 7 2025", description: "4100+ bất động sản Quận 7 — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-quan-7" } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-quan-7"]} />; }
