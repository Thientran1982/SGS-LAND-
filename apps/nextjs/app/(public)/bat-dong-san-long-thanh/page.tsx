// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Long Thành 2026 | BĐS Hành Lang Sân Bay | SGS LAND",
  description:
    "3.200+ bất động sản Long Thành, Đồng Nai. Hưởng lợi từ Sân Bay Quốc Tế Long Thành, cao tốc Bến Lức — Long Thành. Đất nền, nhà phố, khu công nghiệp.",
  keywords: ["bất động sản Long Thành", "đất Long Thành", "BĐS sân bay Long Thành"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-long-thanh" },
};

export const dynamic = "force-dynamic";

export default function BDSLongThanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Long Thành"
      areaSlug="long-thanh"
      districts={["TT. Long Thành", "Phước Thái", "An Phước", "Bình Sơn", "Tam An", "Long Đức"]}
      projects={["Aqua City Novaland", "Khu đô thị Long Thành Airport"]}
      priceRange="Từ 1,8 tỷ — 12 tỷ"
      totalListings={3200}
            intro={[{"heading":"Bất động sản Long Thành 2026","body":"Long Thành là tâm điểm bất động sản Đồng Nai nhờ Sân bay Quốc tế Long Thành (4.6 tỷ USD) và cao tốc Long Thành – Dầu Giây, Bến Lức – Long Thành. Các dự án lớn như Aqua City Novaland và khu đô thị Long Thành Airport thu hút nhà đầu tư. Giá đất nền, nhà phố Long Thành từ 8.4 tỷ."},{"heading":"Vì sao đầu tư Long Thành?","body":"Long Thành kết nối cao tốc toàn vùng Đông Nam Bộ, sở hữu sân bay quốc tế lớn nhất Việt Nam dự kiến vận hành 2026. Đây là động lực tăng giá mạnh cho bất động sản khu vực, phù hợp đầu tư trung – dài hạn và an cư."}]}
            subAreas={[{"label":"Bất động sản Đồng Nai","href":"/bat-dong-san-dong-nai"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"}]}
            faqs={[{"question":"Giá bất động sản Long Thành hiện nay bao nhiêu?","answer":"Giá đất nền Long Thành 2026 từ 8.4 tỷ/nền, nhà phố dự án Aqua City từ 6 tỷ. Giá dao động theo vị trí gần sân bay và cao tốc. Liên hệ SGS Land để nhận bảng giá mới nhất."},{"question":"Sân bay Long Thành khi nào hoạt động?","answer":"Sân bay Quốc tế Long Thành giai đoạn 1 dự kiến vận hành năm 2026, là động lực chính thúc đẩy bất động sản Long Thành và toàn Đồng Nai."},{"question":"Nên mua dự án nào ở Long Thành?","answer":"Aqua City Novaland là đại đô thị sinh thái nổi bật; ngoài ra có các khu đô thị quanh sân bay Long Thành. SGS Land là đại lý F1 tư vấn giá gốc và chính sách."}]}
      description="Long Thành — tâm điểm đầu tư BĐS với Sân Bay Quốc Tế Long Thành 4,6 tỷ USD, kết nối cao tốc toàn vùng Đông Nam Bộ."
    />
  );
}
