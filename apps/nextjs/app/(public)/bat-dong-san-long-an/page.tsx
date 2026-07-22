// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Long An | Đất Nền Long An Giá Tốt",
  description: "Tìm BĐS Long An: đất nền, nhà phố, Waterpoint Nam Long. Giá tốt, pháp lý rõ ràng, giáp TP.HCM, tiềm năng đầu tư cao nhờ hạ tầng kết nối đang hoàn thiện.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-long-an" },
};
export const dynamic = "force-dynamic";

export default function BDSLongAnPage() {
  return (
    <LocalLandingPageTemplate
      area="Long An"
      areaSlug="long-an"
      description="Long An giáp TP.HCM là điểm đến đầu tư BĐS hấp dẫn với giá còn thấp, hạ tầng đang hoàn thiện nhanh. Waterpoint Nam Long 355ha và nhiều KCN lớn thúc đẩy nhu cầu BĐS."
      districts={["Bến Lức", "Đức Hòa", "Cần Giuộc", "Cần Đước", "Tân An"]}
      projects={["Waterpoint Nam Long", "Đức Hòa Star", "Cần Giuộc", "Kim Oanh Long An"]}
      priceRange="8 – 25 triệu/m²"
      totalListings={280}
    />
  );
}
