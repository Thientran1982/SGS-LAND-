// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Đồng Nai 2025 | Mua Bán BĐS Đồng Nai | SGS LAND",
  description:
    "12.500+ bất động sản Đồng Nai — Nhơn Trạch, Biên Hòa, Long Thành, Trảng Bom. Aqua City, Izumi City, đất nền, nhà phố, căn hộ. Pháp lý sổ hồng, giá thực.",
  keywords: ["bất động sản Đồng Nai", "mua bán nhà đất Đồng Nai", "căn hộ Đồng Nai 2025"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-dong-nai" },
};

export const dynamic = "force-dynamic";

export default function BDSDongNaiPage() {
  return (
    <LocalLandingPageTemplate
      area="Đồng Nai"
      areaSlug="dong-nai"
      districts={["Nhơn Trạch", "Biên Hòa", "Long Thành", "Trảng Bom", "Vĩnh Cửu", "Thống Nhất"]}
      projects={["Aqua City Novaland", "Izumi City Nam Long", "Waterpoint Nam Long"]}
      priceRange="Từ 2,5 tỷ — 15 tỷ"
      totalListings={12500}
      description="Đồng Nai — điểm đến BĐS hàng đầu miền Nam với hành lang sân bay Long Thành, cao tốc và hạ tầng phát triển mạnh mẽ."
    />
  );
}
