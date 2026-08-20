// @ts-nocheck
import type { Metadata } from "next";
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";

export const metadata: Metadata = {
  title: "Bất Động Sản Long Thành 2026 | BĐS Hành Lang Sân Bay",
  description:
    "3.200+ bất động sản Long Thành, Đồng Nai. Hưởng lợi từ Sân Bay Quốc Tế Long Thành, cao tốc Bến Lức — Long Thành. Đất nền, nhà phố, khu công nghiệp.",
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
      priceRange="Từ 1,8 tỷ — 12 tỷ"
      totalListings={3200}
            intro={[{"heading":"Bất động sản Long Thành 2026","body":"Long Thành là một khu vực của Đồng Nai có các dự án hạ tầng và bất động sản được quan tâm. Aqua City Novaland là một trong các project được người dùng tìm kiếm; giá, vị trí pháp lý, tiến độ và tình trạng sản phẩm cần được kiểm tra theo hồ sơ hiện hành."},{"heading":"Đánh giá Long Thành thế nào?","body":"Hạ tầng có thể ảnh hưởng đến khả năng kết nối nhưng không bảo đảm tăng giá hoặc thanh khoản. Người mua cần đối chiếu quy hoạch, tiến độ thực tế, giá giao dịch, pháp lý và chi phí sở hữu trước khi quyết định."}]}
            subAreas={[{"label":"Bất động sản Đồng Nai","href":"/bat-dong-san-dong-nai"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"}]}
            faqs={[{"question":"Giá bất động sản Long Thành hiện nay bao nhiêu?","answer":"Giá thay đổi theo vị trí, loại sản phẩm, diện tích, pháp lý và thời điểm. Các mức giá tham khảo trên trang không thay thế bảng giá hoặc xác nhận giao dịch hiện hành."},{"question":"Sân bay Long Thành khi nào hoạt động?","answer":"Mốc vận hành cần được kiểm tra theo thông báo và tiến độ chính thức mới nhất của cơ quan, đơn vị quản lý dự án. Không nên suy ra mức tăng giá bất động sản chỉ từ một mốc hạ tầng."},{"question":"Nên mua dự án nào ở Long Thành?","answer":"Không có dự án phù hợp cho mọi người mua. Aqua City và các dự án khác cần được so sánh theo sản phẩm cụ thể, pháp lý, tiến độ, giá giao dịch và mục tiêu sử dụng."}]}
      description="Long Thành — tâm điểm đầu tư BĐS với Sân Bay Quốc Tế Long Thành 4,6 tỷ USD, kết nối cao tốc toàn vùng Đông Nam Bộ."
    />
  );
}
