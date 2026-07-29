// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Bình Thạnh 2026 | Căn Hộ Cao Cấp Vỉn Sông",
  description: "BDS Binh Thanh 2026: Can ho Vinhomes Central Park tu 4 ty, Lumiere Riverside, can ho cho thue Binh Thanh tu 15 trieu/thang. Gia dat Binh Thanh theo duong cap nhat. Xem du an, gia ban, cho thue tai sgsland.vn.",
  keywords: "bat dong san Binh Thanh, can ho Binh Thanh, Vinhomes Binh Thanh, Central Park Binh Thanh, can ho cho thue Binh Thanh, gia dat Binh Thanh, can ho view song Binh Thanh",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-thanh", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-binh-thanh", "en-US": "https://sgsland.vn/en/bat-dong-san-binh-thanh", "x-default": "https://sgsland.vn/bat-dong-san-binh-thanh" } },
  openGraph: {
    title: "BDS Binh Thanh 2026 | Can Ho Cao Cap",
    description: "Thi truong BDS Binh Thanh 2026: 500+ can ho dang ban, gia tu 4 ty. Cap nhat bang gia, tien do, phap ly.",
    url: "https://sgsland.vn/bat-dong-san-binh-thanh",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default function BDSBinhThanhPage() {
  return (
    <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-binh-thanh"]} />
  );
}
