// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Đồng Nai 2026 – Giá Bán, Dự Án & Tư Vấn Đầu Tư | SGS Land",
  description: "Bất động sản Đồng Nai 2026: giá bán, danh sách dự án nhà phố, biệt thự, đất nền Long Thành, Biên Hòa, Nhơn Trạch. Cập nhật Aqua City, Izumi City, tiến độ & pháp lý. ☎ Tư vấn mua bán BĐS Đồng Nai miễn phí từ SGS Land!",
  keywords: "bat dong san Dong Nai, bds Dong Nai, gia ban bat dong san Dong Nai, du an bat dong san Dong Nai, dat nen Dong Nai, nha pho Dong Nai, bat dong san Long Thanh, Aqua City Dong Nai, Izumi City Bien Hoa, dat Long Thanh gan san bay 2026",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-dong-nai", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-dong-nai", "en-US": "https://sgsland.vn/en/bat-dong-san-dong-nai", "x-default": "https://sgsland.vn/bat-dong-san-dong-nai" } },
  openGraph: {
    title: "Bất Động Sản Đồng Nai 2026 – Giá Bán & Danh Sách Dự Án | SGS Land",
    description: "Thị trường BĐS Đồng Nai 2026: giá bán, dự án Aqua City, Izumi City, đất nền Long Thành gần sân bay. Cập nhật hàng ngày từ SGS Land.",
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
      description="Đồng Nai là thị trường bất động sản gồm Biên Hòa, Long Thành và Nhơn Trạch. Trang này tổng hợp thông tin tham khảo về Aqua City, Izumi City, đất nền và hạ tầng; giá, pháp lý, tiến độ và tư cách phân phối cần được xác minh theo từng sản phẩm bằng hồ sơ hiện hành."
      districts={["Long Thành", "Biên Hòa", "Nhơn Trạch", "Trảng Bòm", "Long Khánh"]}
      projects={["Aqua City Novaland", "Izumi City Nam Long", "Mega City Long Thành"]}
      priceRange="8 - 25 triệu/m² (đất nền); Nhà phố từ 6 tỷ"
      totalListings={340}
            intro={[{"heading":"Tổng quan thị trường bất động sản Đồng Nai 2026","body":"Bất động sản Đồng Nai gồm các khu vực Biên Hòa, Long Thành và Nhơn Trạch, kết nối với TP.HCM qua các tuyến giao thông liên vùng. SGS Land tổng hợp thông tin tham khảo về Aqua City, Izumi City và các khu đô thị khu vực; giá, pháp lý và tiến độ cần được kiểm tra theo từng sản phẩm và ngày cập nhật."},{"heading":"Đánh giá bất động sản Đồng Nai thế nào?","body":"Không nên kết luận một khu vực phù hợp cho mọi nhà đầu tư chỉ dựa trên dự án hạ tầng. Cần đối chiếu quy hoạch, tiến độ công trình, giá giao dịch thực tế, pháp lý và khả năng tài chính trước khi quyết định."},{"heading":"Các khu vực bất động sản Đồng Nai nổi bật","body":"Long Thành, Nhơn Trạch và Biên Hòa có đặc điểm khác nhau về kết nối, khu công nghiệp, nhà ở và sản phẩm dự án. Các trang khu vực liên kết bên dưới chỉ cung cấp thông tin tham khảo; dữ liệu chưa có nguồn chính thức được ghi rõ là cần xác minh."}]}
            subAreas={[{"label":"Bất động sản Long Thành","href":"/bat-dong-san-long-thanh"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"},{"label":"Khu công nghiệp Nhơn Trạch","href":"/marketplace?area=Nh%C6%A1n%20Tr%E1%BA%A1ch"}]}
            faqs={[{"question":"Giá bất động sản Đồng Nai hiện nay bao nhiêu?","answer":"Giá thay đổi theo khu vực, loại đất, diện tích, pháp lý và thời điểm. Các khoảng giá trên trang chỉ là tham khảo; cần xác nhận giao dịch hoặc bảng giá có ngày cập nhật trước khi quyết định."},{"question":"Bất động sản Đồng Nai có nên đầu tư năm 2026 không?","answer":"Không có câu trả lời chung. Người mua cần đánh giá mục tiêu, vốn tự có, chi phí vay, pháp lý, quy hoạch, tiến độ hạ tầng và thanh khoản của đúng sản phẩm thay vì suy luận từ một dự án hạ tầng."},{"question":"Nên mua bất động sản ở khu vực nào của Đồng Nai?","answer":"Long Thành, Nhơn Trạch và Biên Hòa có đặc điểm khác nhau. Hãy chọn theo mục tiêu ở, cho thuê hoặc đầu tư, rồi kiểm tra hồ sơ pháp lý và dữ liệu giá của đúng sản phẩm."},{"question":"Izumi City và Aqua City nằm ở đâu tại Đồng Nai?","answer":"Aqua City được giới thiệu tại Long Hưng, Biên Hòa; Izumi City được giới thiệu tại Biên Hòa, Đồng Nai. Vị trí, ranh dự án và khoảng cách cần được đối chiếu với hồ sơ dự án hiện hành."},{"question":"SGS Land có phải đại lý phân phối chính thức không?","answer":"Tư cách phân phối phụ thuộc hợp đồng hiện hành của từng dự án. Người mua nên yêu cầu xác nhận bằng văn bản từ chủ đầu tư trước khi dựa vào bất kỳ claim đại lý nào."}]}
    />
  );
}
