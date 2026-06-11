// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Thủ Đức 2025 | Căn Hộ TP Thủ Đức | SGS LAND",
  description:
    "8.700+ bất động sản TP Thủ Đức — Vinhomes Grand Park, The Global City, Masteri Cosmo Central. Căn hộ, nhà phố, đất nền. Gần Metro số 1, đại học, khu công nghệ cao.",
  keywords: ["bất động sản Thủ Đức", "căn hộ TP Thủ Đức", "BĐS Thủ Đức 2025"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc" },
};

export const dynamic = "force-dynamic";

export default function BDSThuDucPage() {
  return (
    <LocalLandingPageTemplate
      area="TP Thủ Đức"
      areaSlug="thu-duc"
      districts={["An Phú", "Bình Thọ", "Hiệp Bình Chánh", "Linh Đông", "Tam Phú", "Long Bình"]}
      projects={["Vinhomes Grand Park", "The Global City Masterise", "Masteri Cosmo Central"]}
      priceRange="Từ 3,5 tỷ — 20 tỷ"
      totalListings={8700}
      description="TP Thủ Đức — thành phố trong thành phố, trung tâm kinh tế phía Đông TP.HCM với SHTP, ĐHQG và Metro số 1."
    />
  );
}
