// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Nhơn Trạch 2026 – Giá Đất, Dự Án & Đầu Tư | SGS Land",
  description:
    "Bất động sản Nhơn Trạch 2026: giá đất nền 12–25 triệu/m², khu công nghiệp Nhơn Trạch, cầu Nhơn Trạch & Vành đai 3. Tư vấn đầu tư miễn phí từ SGS Land.",
  keywords: ["bất động sản Nhơn Trạch", "đất Nhơn Trạch", "khu công nghiệp Nhơn Trạch", "bđs Nhơn Trạch Đồng Nai"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-nhon-trach", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-nhon-trach", "en-US": "https://sgsland.vn/en/bat-dong-san-nhon-trach", "x-default": "https://sgsland.vn/bat-dong-san-nhon-trach" } },
  openGraph: {
    title: "Bất Động Sản Nhơn Trạch 2026 – Giá Đất & Dự Án | SGS Land",
    description: "Thị trường BĐS Nhơn Trạch 2026: giá đất, khu công nghiệp, cầu Nhơn Trạch. Cập nhật từ SGS Land.",
    url: "https://sgsland.vn/bat-dong-san-nhon-trach",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default function BDSNhonTrachPage() {
  return (
    <LocalLandingPageTemplate
      area="Nhơn Trạch"
      areaSlug="nhon-trach"
      districts={["Hiệp Phước", "Long Tân", "Phú Hội", "Đại Phước", "Phước An", "Vĩnh Thanh"]}
      projects={["Aqua City Novaland", "King Bay", "Swan Bay"]}
      priceRange="12 – 25 triệu/m² (đất nền)"
      totalListings={280}
      description="Nhơn Trạch – huyện công nghiệp giáp TP.HCM qua phà Cát Lái và cầu Nhơn Trạch, kết nối sân bay Long Thành."
      intro={[{"heading":"Bất động sản Nhơn Trạch 2026","body":"Nhơn Trạch là huyện công nghiệp trọng điểm của Đồng Nai, giáp TP.HCM qua phà Cát Lái và cầu Nhơn Trạch (Vành đai 3). Bất động sản Nhơn Trạch hưởng lợi từ hệ thống khu công nghiệp Nhơn Trạch 1–6 và kết nối sân bay Long Thành. Giá đất nền Nhơn Trạch dao động 12–25 triệu/m²."},{"heading":"Tiềm năng đầu tư Nhơn Trạch","body":"Với cầu Nhơn Trạch nối TP.HCM, Vành đai 3 và sân bay Long Thành, Nhơn Trạch được kỳ vọng thành đô thị vệ tinh của vùng Đông Nam Bộ. Nhu cầu nhà ở cho chuyên gia và công nhân khu công nghiệp lớn, phù hợp đầu tư đất nền và nhà phố cho thuê."}]}
      subAreas={[{"label":"Bất động sản Đồng Nai","href":"/bat-dong-san-dong-nai"},{"label":"Bất động sản Long Thành","href":"/bat-dong-san-long-thanh"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"}]}
      faqs={[{"question":"Giá đất Nhơn Trạch hiện nay bao nhiêu?","answer":"Giá đất nền Nhơn Trạch 2026 dao động từ 12–25 triệu/m² tùy vị trí gần khu công nghiệp, phà Cát Lái hay cầu Nhơn Trạch. Liên hệ SGS Land để nhận bảng giá chi tiết."},{"question":"Nhơn Trạch có những khu công nghiệp nào?","answer":"Nhơn Trạch có các khu công nghiệp Nhơn Trạch 1, 2, 3, 5, 6 và khu công nghiệp Dệt May, thu hút đông chuyên gia và lao động, tạo nhu cầu nhà ở và cho thuê lớn."},{"question":"Bất động sản Nhơn Trạch có nên đầu tư không?","answer":"Có, đặc biệt khi cầu Nhơn Trạch và Vành đai 3 hoàn thành giúp rút ngắn thời gian về TP.HCM. Kết hợp sân bay Long Thành, khu vực còn nhiều dư địa tăng giá dài hạn."}]}
    />
  );
}
