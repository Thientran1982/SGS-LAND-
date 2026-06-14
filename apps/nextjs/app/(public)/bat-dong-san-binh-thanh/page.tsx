// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Bình Thạnh 2026 | Căn Hộ Cao Cấp Vỉn Sông | SGS LAND",
  description: "BDS Binh Thanh 2026: Can ho Vinhomes Central Park tu 4 ty, Lumiere Riverside, can ho cho thue Binh Thanh tu 15 trieu/thang. Gia dat Binh Thanh theo duong cap nhat. Xem du an, gia ban, cho thue tai sgsland.vn.",
  keywords: "bat dong san Binh Thanh, can ho Binh Thanh, Vinhomes Binh Thanh, Central Park Binh Thanh, can ho cho thue Binh Thanh, gia dat Binh Thanh, can ho view song Binh Thanh",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-thanh" },
  openGraph: {
    title: "BDS Binh Thanh 2026 | Can Ho Cao Cap | SGS LAND",
    description: "Thi truong BDS Binh Thanh 2026: 500+ can ho dang ban, gia tu 4 ty. Cap nhat bang gia, tien do, phap ly.",
    url: "https://sgsland.vn/bat-dong-san-binh-thanh",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default function BDSBinhThanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Bình Thạnh"
      areaSlug="binh-thanh"
      description="Bình Thạnh là quận trung tâm TP.HCM với vị trí đắc địa ven sông Sài Gòn, tiếp giáp Quận 1. Nơi tọa lạc Vinhomes Central Park, Lumiere Riverside, Landmark 81 và nhiều dự án hạng sang. Căn hộ cho thuê Bình Thạnh từ 15 triệu/tháng. Giá đất Bình Thạnh theo đường: Nguyễn Hữu Cảnh 120-180 triệu/m², Xo Viết Nghệ Tĩnh 80-120 triệu/m², D1 60-90 triệu/m². Dự án nổi bật: Vinhomes Central Park (Block Park 1-6, Arcadia, Botanica), Lumiere Riverside, The Habitat, Masteri An Phú, Sunwah Pearl. Hạ tầng: Metro số 1 (Bến Thành – Suối Tiên) dự kiến hoàn thành 2026, tăng giá bất động sản 15-20%. Xem danh sách dự án và căn hộ đang bán tại sgsland.vn."
      districts={["Phường 1", "Phường 13", "Phường 22", "Phường 25", "Phường 26", "Phường 27", "Phường 28"]}
      projects={["Vinhomes Central Park", "Lumière Riverside", "The Habitat", "Masteri An Phú", "Sunwah Pearl"]}
      priceRange="60 - 150 triệu/m²"
      totalListings={520}
    />
  );
}
