// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất động sản Đồng Nai 2026 – Dự án & Giá | SGS Land",
  description: "Bất động sản Đồng Nai 2026: Aqua City, Izumi City, đất nền Long Thành và nhà phố Biên Hòa. Xem giá tham khảo, pháp lý và nguồn cần kiểm tra.",
  keywords: "bat dong san Dong Nai, bds Dong Nai, gia ban bat dong san Dong Nai, du an bat dong san Dong Nai, dat nen Dong Nai, nha pho Dong Nai, bat dong san Long Thanh, Aqua City Dong Nai, Izumi City Bien Hoa, dat Long Thanh gan san bay 2026",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-dong-nai", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-dong-nai", "en-US": "https://sgsland.vn/en/bat-dong-san-dong-nai", "x-default": "https://sgsland.vn/bat-dong-san-dong-nai" } },
  openGraph: {
    title: "Bất động sản Đồng Nai 2026 – Dự án & Giá | SGS Land",
    description: "Tổng hợp Aqua City, Izumi City, Long Thành và Biên Hòa; giá, pháp lý và tiến độ cần xác minh theo sản phẩm.",
    url: "https://sgsland.vn/bat-dong-san-dong-nai",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default function BDSDongNaiPage() {
  return (
    <LocalLandingPageTemplate
      area="Đồng Nai"
      areaSlug="dong-nai"
      description="Bất động sản Đồng Nai 2026 gồm các nhóm thị trường Biên Hòa, Long Thành và Nhơn Trạch. Trang này tóm tắt dự án, khu vực và câu hỏi người mua; mọi giá, pháp lý, tiến độ và tư cách phân phối đều cần đối chiếu với hồ sơ gốc hiện hành."
      districts={["Long Thành", "Biên Hòa", "Nhơn Trạch", "Trảng Bòm", "Long Khánh"]}
      projects={["Aqua City Novaland", "Izumi City Nam Long", "Mega City Long Thành"]}
      priceRange="Cần xác minh theo sản phẩm"
            intro={[{"heading":"Bất động sản Đồng Nai 2026 là gì?","body":"Bất động sản Đồng Nai là nhóm thị trường gồm Biên Hòa, Long Thành, Nhơn Trạch và các khu vực lân cận. SGS LAND tổng hợp thông tin tham khảo về dự án, loại sản phẩm và câu hỏi người mua; bảng giá, pháp lý, tiến độ và tư cách phân phối phải được kiểm tra theo từng sản phẩm và ngày tài liệu."},{"heading":"Nên đánh giá bất động sản Đồng Nai theo tiêu chí nào?","body":"Không nên kết luận một khu vực phù hợp cho mọi nhà đầu tư chỉ dựa trên một dự án hạ tầng. Hãy đối chiếu quy hoạch, tiến độ đã xác nhận, giá giao dịch của sản phẩm tương đương, pháp lý, chi phí vay và thanh khoản trước khi quyết định."},{"heading":"Các khu vực và dự án liên quan","body":"Long Thành, Nhơn Trạch và Biên Hòa khác nhau về kết nối, khu công nghiệp, nhà ở và sản phẩm dự án. Các liên kết bên dưới giúp đi đến trang chi tiết; thông tin chưa có nguồn chính thức được ghi rõ là cần xác minh."}]}
            subAreas={[{"label":"Bất động sản Long Thành","href":"/bat-dong-san-long-thanh"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"},{"label":"Khu công nghiệp Nhơn Trạch","href":"/marketplace?area=Nh%C6%A1n%20Tr%E1%BA%A1ch"}]}
            faqs={[{"question":"Giá bất động sản Đồng Nai hiện nay bao nhiêu?","answer":"Giá thay đổi theo khu vực, loại đất, diện tích, pháp lý và thời điểm. Các khoảng giá trên trang chỉ là tham khảo; cần xác nhận giao dịch hoặc bảng giá có ngày cập nhật trước khi quyết định."},{"question":"Bất động sản Đồng Nai có nên đầu tư năm 2026 không?","answer":"Không có câu trả lời chung. Người mua cần đánh giá mục tiêu, vốn tự có, chi phí vay, pháp lý, quy hoạch, tiến độ hạ tầng và thanh khoản của đúng sản phẩm thay vì suy luận từ một dự án hạ tầng."},{"question":"Nên mua bất động sản ở khu vực nào của Đồng Nai?","answer":"Long Thành, Nhơn Trạch và Biên Hòa có đặc điểm khác nhau. Hãy chọn theo mục tiêu ở, cho thuê hoặc đầu tư, rồi kiểm tra hồ sơ pháp lý và dữ liệu giá của đúng sản phẩm."},{"question":"Izumi City và Aqua City nằm ở đâu tại Đồng Nai?","answer":"Aqua City được giới thiệu tại Long Hưng, Biên Hòa; Izumi City được giới thiệu tại Biên Hòa, Đồng Nai. Vị trí, ranh dự án và khoảng cách cần được đối chiếu với hồ sơ dự án hiện hành."},{"question":"SGS Land có phải đại lý phân phối chính thức không?","answer":"Tư cách phân phối phụ thuộc hợp đồng hiện hành của từng dự án. Người mua nên yêu cầu xác nhận bằng văn bản từ chủ đầu tư trước khi dựa vào bất kỳ claim đại lý nào."}]}
      updatedAt="15/09/2026"
      evidenceNote="Rà soát theo cấu trúc route và nội dung hiện có; số liệu thị trường không được xem là báo giá hoặc chứng cứ pháp lý."
     />
  );
}
