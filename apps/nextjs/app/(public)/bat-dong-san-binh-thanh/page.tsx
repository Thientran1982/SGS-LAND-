import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Bình Thạnh | Căn Hộ Cao Cấp Ven Sông | SGS LAND",
  description: "BĐS Bình Thạnh TP.HCM: căn hộ cao cấp ven sông Sài Gòn, Lumière Riverside, Vinhomes Central Park. Vị trí trung tâm, hạ tầng Metro số 1 hoàn thiện.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-thanh" },
};
export const revalidate = 3600;

export default function BDSBinhThanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Bình Thạnh"
      areaSlug="binh-thanh"
      description="Bình Thạnh là quận trung tâm TP.HCM với vị trí đắc địa ven sông Sài Gòn, tiếp giáp Quận 1. Nơi tọa lạc của Vinhomes Central Park, Lumière Riverside và nhiều dự án hạng sang."
      districts={["Phường 1", "Phường 13", "Phường 22", "Phường 25", "Phường 26", "Phường 27", "Phường 28"]}
      projects={["Vinhomes Central Park", "Lumière Riverside", "The Habitat", "Masteri An Phú", "Sunwah Pearl"]}
      priceRange="60 – 150 triệu/m²"
      totalListings={520}
    />
  );
}
