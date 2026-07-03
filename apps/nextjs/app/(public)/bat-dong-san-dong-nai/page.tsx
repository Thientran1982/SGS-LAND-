// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Đồng Nai 2026 – Giá Bán, Dự Án & Tư Vấn Đầu Tư | SGS Land",
  description: "Bất động sản Đồng Nai 2026: giá bán, danh sách dự án nhà phố, biệt thự, đất nền Long Thành, Biên Hòa, Nhơn Trạch. Cập nhật Aqua City, Izumi City, tiến độ & pháp lý. ☎ Tư vấn mua bán BĐS Đồng Nai miễn phí từ SGS Land!",
  keywords: "bat dong san Dong Nai, bds Dong Nai, gia ban bat dong san Dong Nai, du an bat dong san Dong Nai, dat nen Dong Nai, nha pho Dong Nai, bat dong san Long Thanh, Aqua City Dong Nai, Izumi City Bien Hoa, dat Long Thanh gan san bay 2026",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-dong-nai" },
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
      description="Đồng Nai – đầu tàu kinh tế vùng Đông Nam Bộ với tiềm năng bất động sản lớn nhất TP.HCM mở rộng. Các dự án nổi bật: Aqua City Novaland 1.000ha (nhà phố từ 6 tỷ) tại Long Thành, Izumi City Nam Long 170ha (nhà phố từ 8,4 tỷ) tại Biên Hòa. Đất Long Thành gần sân bay quốc tế Long Thành (hoàn thành 2026): từ 8-25 triệu/m². Hạ tầng: Cao tốc Long Thành - Dầu Giây, Vnh Săn Máy, sân bay quốc tế Long Thành. Aqua City có nên mua không 2026? Theo SGS LAND: đây là thời điểm tốt khi pháp lý đang hoàn thiện và giá chưa tăng như giai đoạn 2019-2021. SGS LAND là đại lý F1 chính thức của Aqua City và Izumi City."
      districts={["Long Thành", "Biên Hòa", "Nhơn Trạch", "Trảng Bòm", "Long Khánh"]}
      projects={["Aqua City Novaland", "Izumi City Nam Long", "Mega City Long Thành"]}
      priceRange="8 - 25 triệu/m² (đất nền); Nhà phố từ 6 tỷ"
      totalListings={340}
            intro={[{"heading":"Tổng quan thị trường bất động sản Đồng Nai 2026","body":"Bất động sản Đồng Nai đang là tâm điểm đầu tư phía Đông TP.HCM nhờ Sân bay Quốc tế Long Thành, cao tốc Long Thành – Dầu Giây, Bến Lức – Long Thành và Vành đai 3. Giá bán bất động sản Đồng Nai hiện dao động 8–25 triệu/m² với đất nền, biệt thự và nhà phố dự án. SGS Land tổng hợp giá bán, tiến độ và pháp lý các dự án nổi bật gồm Aqua City Novaland, Izumi City Nam Long và các khu đô thị Long Thành, Nhơn Trạch."},{"heading":"Vì sao nên đầu tư bất động sản Đồng Nai?","body":"Đồng Nai kết nối trực tiếp với TP.HCM qua nhiều tuyến cao tốc và là cửa ngõ công nghiệp với hàng loạt khu công nghiệp Nhơn Trạch, Long Thành, Biên Hòa. Sân bay Long Thành dự kiến vận hành 2026 tạo lực đẩy tăng giá cho bất động sản khu vực. Đây là thời điểm giá còn hợp lý so với chu kỳ 2019–2021, phù hợp cho nhà đầu tư trung – dài hạn."},{"heading":"Các khu vực bất động sản Đồng Nai nổi bật","body":"Long Thành – trung tâm sân bay quốc tế với đất nền và dự án Aqua City, Izumi City. Nhơn Trạch – vùng công nghiệp giáp TP.HCM qua phà Cát Lái và cầu Nhơn Trạch, nhiều khu công nghiệp Nhơn Trạch 1–6. Biên Hòa – trung tâm hành chính, nhà phố và căn hộ. Trảng Bom, Long Khánh – đất nền vùng ven giá mềm."}]}
            subAreas={[{"label":"Bất động sản Long Thành","href":"/bat-dong-san-long-thanh"},{"label":"Bất động sản Nhơn Trạch","href":"/bat-dong-san-nhon-trach"},{"label":"Aqua City Novaland","href":"/du-an/aqua-city"},{"label":"Izumi City Nam Long","href":"/du-an/izumi-city"},{"label":"Khu công nghiệp Nhơn Trạch","href":"/marketplace?area=Nh%C6%A1n%20Tr%E1%BA%A1ch"}]}
            faqs={[{"question":"Giá bán bất động sản Đồng Nai hiện nay bao nhiêu?","answer":"Giá bất động sản Đồng Nai 2026 dao động từ 8–25 triệu/m² với đất nền, nhà phố dự án từ 6 tỷ, biệt thự từ 12 tỷ tùy khu vực Long Thành, Nhơn Trạch hay Biên Hòa. Liên hệ SGS Land để nhận bảng giá mới nhất."},{"question":"Bất động sản Đồng Nai có nên đầu tư năm 2026 không?","answer":"Có. Với Sân bay Long Thành vận hành 2026, hệ thống cao tốc và Vành đai 3 hoàn thiện, bất động sản Đồng Nai được đánh giá còn dư địa tăng giá tốt, giá hiện tại chưa tăng nhiều so với đỉnh 2019–2021."},{"question":"Nên mua bất động sản ở khu vực nào của Đồng Nai?","answer":"Long Thành phù hợp đầu tư quanh sân bay (Aqua City, Izumi City); Nhơn Trạch hợp đầu tư công nghiệp và giáp TP.HCM; Biên Hòa hợp ở thực với nhà phố, căn hộ. SGS Land tư vấn theo ngân sách và mục tiêu của bạn."},{"question":"Izumi City và Aqua City nằm ở đâu tại Đồng Nai?","answer":"Cả Aqua City và Izumi City đều thuộc khu vực Biên Hòa – Long Thành, ven sông Đồng Nai, kết nối TP.HCM qua cao tốc Long Thành – Dầu Giây. Đây là hai đại đô thị của Novaland và Nam Long."},{"question":"SGS Land có phải đại lý phân phối chính thức không?","answer":"SGS Land là đại lý F1 chính thức của Aqua City và Izumi City, cung cấp giá gốc từ chủ đầu tư, hỗ trợ pháp lý, vay ngân hàng và chính sách bán hàng cập nhật."}]}
    />
  );
}
