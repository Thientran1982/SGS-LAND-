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
       intro={[{"heading":"Bất động sản Nhơn Trạch 2026","body":"Nhơn Trạch là khu vực công nghiệp của Đồng Nai, có các dự án giao thông và bất động sản được quan tâm. Aqua City là một trong các project được liên kết để tham khảo; giá, pháp lý, tiến độ và nhu cầu thuê cần được kiểm tra bằng dữ liệu hiện hành."},{"heading":"Đánh giá Nhơn Trạch thế nào?","body":"Kết nối giao thông và khu công nghiệp là các yếu tố cần xem xét, nhưng không bảo đảm tăng giá hay thanh khoản. Người mua cần kiểm tra quy hoạch, pháp lý, giá giao dịch, hạ tầng đã vận hành và chi phí sở hữu."}]}
      subAreas={[{"label":"Bất động sản Đồng Nai","href":"/bat-dong-san-dong-nai"},{"label":"Bất động sản Long Thành","href":"/bat-dong-san-long-thanh"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"}]}
       faqs={[{"question":"Giá đất Nhơn Trạch hiện nay bao nhiêu?","answer":"Giá thay đổi theo loại đất, vị trí, diện tích, pháp lý và thời điểm. Khoảng giá trên trang chỉ mang tính tham khảo; cần xác nhận giá giao dịch và hồ sơ của đúng thửa đất."},{"question":"Nhơn Trạch có những khu công nghiệp nào?","answer":"Nhơn Trạch có nhiều khu công nghiệp; danh sách, ranh giới và tình trạng hoạt động cần được kiểm tra từ nguồn quản lý khu công nghiệp hoặc cơ quan địa phương hiện hành."},{"question":"Bất động sản Nhơn Trạch có nên đầu tư không?","answer":"Không có câu trả lời chung. Cần đánh giá pháp lý, quy hoạch, hạ tầng đã vận hành, nhu cầu sử dụng, chi phí vay và thanh khoản thực tế trước khi quyết định."}]}
    />
  );
}
