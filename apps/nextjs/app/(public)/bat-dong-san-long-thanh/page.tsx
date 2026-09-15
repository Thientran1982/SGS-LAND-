// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất động sản Long Thành 2026 – Giá & Dự án | SGS Land",
  description:
    "Bất động sản Long Thành 2026: đất nền, nhà phố, dự án và kết nối khu vực sân bay. Kiểm tra giá, pháp lý, quy hoạch theo từng sản phẩm.",
  keywords: ["bất động sản Long Thành", "đất Long Thành", "BĐS sân bay Long Thành"],
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-long-thanh", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-long-thanh", "en-US": "https://sgsland.vn/en/bat-dong-san-long-thanh", "x-default": "https://sgsland.vn/bat-dong-san-long-thanh" } },
};

export const dynamic = "force-dynamic";

export default function BDSLongThanhPage() {
  return (
    <LocalLandingPageTemplate
      area="Long Thành"
      areaSlug="long-thanh"
      districts={["TT. Long Thành", "Phước Thái", "An Phước", "Bình Sơn", "Tam An", "Long Đức"]}
      projects={["Aqua City Novaland", "Khu đô thị Long Thành Airport"]}
      priceRange="Cần xác minh theo sản phẩm"
            intro={[{"heading":"Bất động sản Long Thành 2026 là gì?","body":"Bất động sản Long Thành gồm đất nền, nhà phố, sản phẩm dự án và bất động sản phục vụ nhu cầu ở hoặc kinh doanh quanh khu vực Long Thành, Đồng Nai. Trang này cung cấp khung tham khảo; giá, quy hoạch, pháp lý và tiến độ cần được đối chiếu bằng tài liệu có ngày cập nhật."},{"heading":"Đánh giá Long Thành theo cách nào?","body":"Hạ tầng có thể cải thiện kết nối nhưng không bảo đảm tăng giá hoặc thanh khoản. Người mua cần kiểm tra quy hoạch đúng thửa hoặc dự án, tiến độ đã xác nhận, giá giao dịch tương đương, pháp lý, chi phí sở hữu và khoảng cách thực tế trước khi quyết định."}]}
            subAreas={[{"label":"Bất động sản Đồng Nai","href":"/bat-dong-san-dong-nai"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"}]}
            faqs={[{"question":"Giá bất động sản Long Thành hiện nay bao nhiêu?","answer":"Giá thay đổi theo vị trí, loại sản phẩm, diện tích, pháp lý và thời điểm. Các mức giá tham khảo trên trang không thay thế bảng giá hoặc xác nhận giao dịch hiện hành."},{"question":"Sân bay Long Thành khi nào hoạt động?","answer":"Mốc vận hành cần được kiểm tra theo thông báo và tiến độ chính thức mới nhất của cơ quan, đơn vị quản lý dự án. Không nên suy ra mức tăng giá bất động sản chỉ từ một mốc hạ tầng."},{"question":"Nên mua dự án nào ở Long Thành?","answer":"Không có dự án phù hợp cho mọi người mua. Aqua City và các dự án khác cần được so sánh theo sản phẩm cụ thể, pháp lý, tiến độ, giá giao dịch và mục tiêu sử dụng."}]}
      updatedAt="15/09/2026"
      evidenceNote="Trang dùng dữ liệu tham khảo theo khu vực; không hiển thị số lượng kho hàng hoặc mức giá cố định khi chưa có nguồn sản phẩm tương ứng."
    />
  );
}
