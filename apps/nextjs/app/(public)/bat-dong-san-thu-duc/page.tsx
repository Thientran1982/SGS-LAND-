// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Thủ Đức 2026 | The Global City, Thủ Thiêm",
  description: "BDS Thu Duc 2026: Masteri Cosmo The Global City tu 6,4 ty, Empire City Thu Thiem, can ho Thu Thiem gia bao nhieu. Quy hoach Thu Duc 2026, du an moi nhat. SGS LAND - dai ly F1 Masterise Homes.",
  keywords: "bat dong san Thu Duc, The Global City Masterise, Thu Thiem 2026, can ho Thu Thiem gia bao nhieu, Empire City tien do, Masteri Cosmo Thu Duc, so sanh du an Thu Thiem",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc" },
  openGraph: {
    title: "BDS Thu Duc 2026 | The Global City | Thu Thiem",
    description: "Thi truong BDS Thu Duc 2026: The Global City, Thu Thiem, can ho tu 6,4 ty. Cap nhat quy hoach, tien do.",
    url: "https://sgsland.vn/bat-dong-san-thu-duc",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default function BDSThuDucPage() {
  return (
    <LocalLandingPageTemplate
      area="Thủ Đức"
      areaSlug="thu-duc"
      description="TP Thủ Đức – thành phố trong thành phố với quy mô 1 triệu dân, trung tâm đổi mới sáng tạo ĐHQG TP.HCM, trụ sở Samsung, Intel. Quản 2 cũ (An Phú, Thủ Thiêm) nằm trong Thủ Đức với giá căn hộ cao nhất TP.HCM. Căn hộ Thủ Thiêm giá bao nhiêu? Từ 150-250 triệu/m² cho dự án hạng sang. Dự án nổi bật: The Global City Masterise (117ha, shophouse từ 15 tỷ, căn hộ từ 6 tỷ), Empire City Thủ Thiêm (tiến độ theo tung đợt), Masteri Cosmo Central (mở bán 2026). Quy hoạch Thủ Đức 2026: câu trợ Metro số 1 (Quận 1 – Thủ Đức) sẽ thay đổi toàn bộ thị trường bất động sản khu vực. SGS LAND – đại lý F1 Masterise Homes tại The Global City."
      districts={["An Phú", "Thủ Thiêm", "Thảo Điền", "Bình Khánh", "An Lợi Đông"]}
      projects={["The Global City", "Masteri Cosmo Central", "Empire City", "Thiso Mall"]}
      priceRange="60 - 250 triệu/m²"
      totalListings={410}
    />
  );
}
