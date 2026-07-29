// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
export const metadata: Metadata = { title: "Bất Động Sản Bình Dương 2025", description: "6400+ bất động sản Bình Dương — nhà phố, căn hộ, đất nền.", alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-duong", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-binh-duong", "en-US": "https://sgsland.vn/en/bat-dong-san-binh-duong", "x-default": "https://sgsland.vn/bat-dong-san-binh-duong" } } };
export const dynamic = "force-dynamic";
export default function Page() { return <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-binh-duong"]} />; }
