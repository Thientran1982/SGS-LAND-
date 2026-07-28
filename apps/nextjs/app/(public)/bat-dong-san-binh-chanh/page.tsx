// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Bất Động Sản Bình Chánh | Nhà Đất Bình Chánh TP.HCM",
  description: "Tìm BĐS Bình Chánh TP.HCM: đất nền, nhà phố, căn hộ giá tốt. Hạ tầng vành đai, KCN Vĩnh Lộc phát triển mạnh. Pháp lý rõ ràng, cập nhật liên tục.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-chanh" },
};
export const dynamic = "force-dynamic";

export default function BDSBinhChanhPage() {
  return (
    <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-binh-chanh"]} />
  );
}