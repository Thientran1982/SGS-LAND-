import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Long Thành 2025 | BĐS Hành Lang Sân Bay | SGS LAND",
  description:
    "3.200+ bất động sản Long Thành, Đồng Nai. Hưởng lợi từ Sân Bay Quốc Tế Long Thành, cao tốc Bến Lức — Long Thành. Đất nền, nhà phố, khu công nghiệp.",
  keywords: ["bất động sản Long Thành", "đất Long Thành", "BĐS sân bay Long Thành"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-long-thanh" },
};

export const revalidate = 3600;

export default function BDSLongThanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Long Thành"
      areaSlug="long-thanh"
      districts={["TT. Long Thành", "Phước Thái", "An Phước", "Bình Sơn", "Tam An", "Long Đức"]}
      projects={["Aqua City Novaland", "Khu đô thị Long Thành Airport"]}
      priceRange="Từ 1,8 tỷ — 12 tỷ"
      totalListings={3200}
      description="Long Thành — tâm điểm đầu tư BĐS với Sân Bay Quốc Tế Long Thành 4,6 tỷ USD, kết nối cao tốc toàn vùng Đông Nam Bộ."
    />
  );
}
