// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Hóc Môn | Đất Nền & Nhà Phố Vùng Ven",
  description:
    "BĐS Hóc Môn TP.HCM: đất nền, nhà phố vùng ven phía Tây Bắc. Giá còn mềm quanh 25 triệu/m², hạ tầng Vành đai 3 và Quốc lộ 22 thúc đẩy tăng trưởng.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-hoc-mon", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-hoc-mon", "en-US": "https://sgsland.vn/en/bat-dong-san-hoc-mon", "x-default": "https://sgsland.vn/bat-dong-san-hoc-mon" } },
};
export const dynamic = "force-dynamic";

export default function BDSHocMonPage() {
  return (
    <LocalLandingPageTemplate
      area="Hóc Môn"
      areaSlug="hoc-mon"
      description="Hóc Môn là huyện cửa ngõ phía Tây Bắc TP.HCM, kết nối trung tâm qua Quốc lộ 22 và tuyến Vành đai 3. Khu vực có quỹ đất lớn, mặt bằng giá còn mềm so với nội thành, phù hợp đầu tư đất nền, nhà phố và nhà xưởng. Hạ tầng giao thông và quy hoạch đô thị hóa đang tạo dư địa tăng giá cho bất động sản Hóc Môn giai đoạn 2025-2030."
      districts={["Thị trấn Hóc Môn", "Bà Điểm", "Xuân Thới Sơn", "Tân Xuân", "Đông Thạnh"]}
      projects={["Khu dân cư Xuân Thới Sơn", "Nhà phố Bà Điểm", "Đất nền Đông Thạnh"]}
      priceRange="20 - 40 triệu/m²"
      totalListings={95}
    />
  );
}
