// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Cần Giờ | Siêu Đô Thị Lấn Biển | SGS LAND",
  description: "BĐS Cần Giờ TP.HCM: cơ hội đầu tư đón sóng Vinhomes Cần Giờ 2.870ha và Metro số 4. Giá đất còn thấp, tiềm năng tăng trưởng cao nhất TP.HCM.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-can-gio" },
};
export const dynamic = "force-dynamic";

export default function BDSCanGioPage() {
  return (
    <LocalLandingPageTemplate
      area="Cần Giờ"
      areaSlug="can-gio"
      description="Cần Giờ đang chuyển mình mạnh mẽ với quy hoạch siêu đô thị lấn biển 2.870ha của Vinhomes và tuyến Metro số 4 kết nối trung tâm TP.HCM. Khu vực có tiềm năng tăng trưởng cao nhất 2025-2030."
      districts={["Cần Thạnh", "Bình Khánh", "An Thới Đông", "Lý Nhơn", "Tam Thôn Hiệp"]}
      projects={["Vinhomes Cần Giờ", "Cần Giờ Marina", "Khu du lịch sinh thái Vàm Sát"]}
      priceRange="8 – 35 triệu/m²"
      totalListings={120}
    />
  );
}
