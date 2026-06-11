// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Bình Chánh | Nhà Đất Bình Chánh TP.HCM | SGS LAND",
  description: "Tìm BĐS Bình Chánh TP.HCM: đất nền, nhà phố, căn hộ giá tốt. Hạ tầng vành đai, KCN Vĩnh Lộc phát triển mạnh. Pháp lý rõ ràng, cập nhật liên tục.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-binh-chanh" },
};
export const dynamic = "force-dynamic";

export default function BDSBinhChanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Bình Chánh"
      areaSlug="binh-chanh"
      description="Bình Chánh là cửa ngõ phía Tây Nam TP.HCM, tiếp giáp Long An. Hạ tầng đường vành đai, KCN Vĩnh Lộc, Lê Minh Xuân thúc đẩy thị trường BĐS tăng trưởng mạnh với giá còn hợp lý."
      districts={["Bình Chánh", "Vĩnh Lộc A", "Vĩnh Lộc B", "Tân Kiên", "Bình Hưng"]}
      projects={["KDC Vĩnh Lộc", "Tên Lửa Residence", "Trần Anh Riverside", "Him Lam Phú Đông"]}
      priceRange="20 – 55 triệu/m²"
      totalListings={340}
    />
  );
}
