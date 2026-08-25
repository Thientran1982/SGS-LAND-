// @ts-nocheck
import { SITE_NAME, SITE_URL, ORG_ID } from "./constants";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_HOMEPAGE: FAQItem[] = [
  // --- ENTITY CLARIFICATION (AI Overview anchor) ---
  {
    question: "SGS LAND là gì?",
    answer: "SGS LAND (tên đầy đủ: Công ty TNHH Tư Vấn Bất Động Sản SGS) là nền tảng bất động sản công nghệ tại TP.HCM, tích hợp AI định giá ±5%, sàn giao dịch dự án, CRM đa kênh và dữ liệu thị trường thời gian thực. Mã số thuế 0312960439. Website: sgsland.vn.",
  },
  {
    question: "SGS LAND có trụ sở ở đâu?",
    answer: "SGS LAND đặt trụ sở tại 60 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP.HCM. Hotline: 0379.281.445. Email: info@sgsland.vn.",
  },
  {
    question: "SGS LAND thành lập năm nào?",
    answer: "SGS LAND được thành lập năm 2015 và chính thức vận hành nền tảng proptech từ 2022, chuyên tư vấn và giao dịch bất động sản TP.HCM.",
  },
  {
    question: "SGS LAND khác gì so với các sàn bất động sản thông thường?",
    answer: "SGS LAND là nền tảng proptech tích hợp: AI định giá tự động với sai số ±5%, dữ liệu giao dịch thị trường thời gian thực, CRM đa kênh cho môi giới, sàn giao dịch dự án trực tuyến và tư vấn pháp lý, thay vì chỉ đăng tin truyền thống.",
  },
  {
    question: "SGS LAND có uy tín không?",
    answer: "SGS LAND là thành viên Hiệp hội Bất động sản TP.HCM (HoREA), đối tác chính thức của Novaland, Vinhomes, Nam Long. Đã tư vấn hơn 500 giao dịch thành công và quản lý danh mục >200 tỷ đồng cho nhà đầu tư.",
  },

  // --- AI VALUATION ---
  {
    question: "Công cụ định giá bất động sản AI của SGS LAND hoạt động như thế nào?",
    answer: "Hệ thống AI Valuation của SGS LAND phân tích >50 yếu tố: vị trí, tiện ích lân cận, lịch sử giao dịch, pháp lý, xu hướng thị trường để đưa ra mức giá tham chiếu với sai số ±5%. Kết quả được cập nhật theo dữ liệu giao dịch mới nhất.",
  },
  {
    question: "Định giá AI của SGS LAND có độ chính xác bao nhiêu?",
    answer: "Mô hình AI của SGS LAND đạt độ chính xác ±5% so với giá giao dịch thực tế, được kiểm chứng qua >10.000 giao dịch lịch sử tại TP.HCM.",
  },
  {
    question: "Tôi có thể định giá căn hộ miễn phí tại SGS LAND không?",
    answer: "Có. SGS LAND cung cấp công cụ định giá tự động miễn phí tại sgsland.vn/ai-valuation. Chỉ cần nhập địa chỉ và diện tích, hệ thống sẽ trả kết quả ngay lập tức.",
  },
  {
    question: "Ngoài định giá tự động, SGS LAND có hỗ trợ thẩm định thực tế không?",
    answer: "Có. Sau khi định giá AI, khách hàng có thể yêu cầu thẩm định thực địa bởi chuyên viên giàu kinh nghiệm của SGS LAND để kiểm tra pháp lý và tình trạng tài sản.",
  },

  // --- CRM PLATFORM ---
  {
    question: "CRM của SGS LAND có những tính năng gì dành cho môi giới?",
    answer: "SGS LAND CRM cung cấp: quản lý khách hàng tiềm năng (pipeline), tích hợp Zalo/Facebook/Email/SMS đa kênh, phân tích hiệu quả chiến dịch, tự động hoá follow-up và báo cáo doanh thu theo thời gian thực.",
  },
  {
    question: "SGS LAND CRM Platform phù hợp với môi giới cá nhân hay chỉ doanh nghiệp?",
    answer: "SGS LAND CRM phù hợp cả hai: cá nhân môi giới tự do và team/sàn bất động sản. Có gói miễn phí cho cá nhân và gói Enterprise cho sàn quy mô lớn.",
  },
  {
    question: "Tôi có thể dùng thử CRM của SGS LAND miễn phí không?",
    answer: "Có. SGS LAND cung cấp gói dùng thử miễn phí 30 ngày cho toàn bộ tính năng CRM tại sgsland.vn/crm-platform.",
  },

  // --- MARKETPLACE ---
  {
    question: "Sàn giao dịch SGS LAND có những loại BĐS nào?",
    answer: "SGS LAND Marketplace cung cấp: căn hộ chung cư, nhà phố, biệt thự, đất nền, bất động sản nghỉ dưỡng tại TP.HCM và các tỉnh vệ tinh Đồng Nai, Bình Dương, Long An.",
  },
  {
    question: "Làm thế nào để đăng tin bán BĐS trên SGS LAND?",
    answer: "Đăng ký tài khoản tại sgsland.vn/marketplace, xác thực pháp lý và đăng tin với đầy đủ thông tin: ảnh thực tế, giá, diện tích, pháp lý. Tin đăng được kiểm duyệt trong 24 giờ.",
  },
  {
    question: "SGS LAND có hỗ trợ vay vốn ngân hàng khi mua BĐS không?",
    answer: "Có. SGS LAND hợp tác với hơn 10 ngân hàng lớn: Vietcombank, BIDV, Techcombank, VPBank để hỗ trợ khách hàng vay vốn mua BĐS với lãi suất ưu đãi và thủ tục nhanh.",
  },

  // --- PROJECT: AQUA CITY ---
  {
    question: "Dự án Aqua City ở đâu và do chủ đầu tư nào phát triển?",
    answer: "Aqua City tọa lạc tại Long Hưng, Biên Hòa, Đồng Nai, do Novaland phát triển trên quy mô 1.000 ha. Đây là đô thị sinh thái ven sông Đồng Nai, cách TP.HCM khoảng 40 phút lái xe.",
  },
  {
    question: "Giá bán căn hộ tại Aqua City hiện tại là bao nhiêu?",
    answer: "Tại tháng 6/2026, giá căn hộ Aqua City dao động từ 1,5–4,5 tỷ đồng/căn tùy loại và vị trí, giá biệt thự từ 8–25 tỷ đồng. Liên hệ SGS LAND: 0379.281.445 để nhận bảng giá mới nhất.",
  },
  {
    question: "Aqua City có tiện ích gì nổi bật?",
    answer: "Aqua City sở hữu: cảng du thuyền, bệnh viện quốc tế, trường học liên cấp, khu vui chơi giải trí Wonderworld, 3 km bờ sông, hồ bơi vô cực và hệ thống 24 tiện ích đẳng cấp.",
  },
  {
    question: "Pháp lý Aqua City đã hoàn thiện chưa?",
    answer: "Aqua City đã có sổ đỏ/sổ hồng cho nhiều phân khu. Một số phân khu vẫn đang hoàn thiện pháp lý. Liên hệ SGS LAND để được cập nhật tình trạng pháp lý cụ thể từng lô/căn.",
  },

  // --- PROJECT: THE GLOBAL CITY ---
  {
    question: "The Global City là dự án gì và nằm ở đâu?",
    answer: "The Global City là siêu đô thị thương mại – tài chính – giải trí do Masterise Homes phát triển tại Thủ Đức, TP.HCM, quy mô 117 ha, vốn đầu tư hơn 2 tỷ USD.",
  },
  {
    question: "Giá căn hộ The Global City hiện tại là bao nhiêu?",
    answer: "Giá căn hộ The Global City từ 4,5–15 tỷ đồng/căn (T6/2026) tùy tầng và hướng. Phân khu thương mại và penthouse có giá đặc biệt. Liên hệ SGS LAND: 0379.281.445.",
  },
  {
    question: "The Global City có gì khác biệt so với các dự án cao cấp khác tại TP.HCM?",
    answer: "The Global City được quy hoạch theo mô hình Mixed-use với: trung tâm tài chính quốc tế, trung tâm thương mại 300.000 m², khách sạn 5 sao, biệt thự, văn phòng hạng A và công viên trung tâm 10 ha.",
  },

  // --- PROJECT: VINHOMES CẦN GIỜ ---
  {
    question: "Vinhomes Cần Giờ là dự án gì?",
    answer: "Vinhomes Cần Giờ là đại đô thị sinh thái biển do Vinhomes phát triển tại Cần Giờ, TP.HCM, diện tích 2.870 ha — một trong những dự án BĐS lớn nhất Việt Nam.",
  },
  {
    question: "Tiến độ Vinhomes Cần Giờ như thế nào tính đến T6/2026?",
    answer: "Tính đến T6/2026, Vinhomes Cần Giờ đang triển khai giai đoạn 1 với san lấp và hạ tầng cơ bản. Dự kiến mở bán chính thức cuối 2026. SGS LAND sẽ cập nhật tiến độ mới nhất khi có thông tin.",
  },
  {
    question: "Đất nền Vinhomes Cần Giờ có sổ đỏ không?",
    answer: "Đây là câu hỏi quan trọng vì Cần Giờ thuộc vùng sinh quyển. Pháp lý và khả năng cấp sổ đỏ đang được làm rõ theo chỉ đạo của UBND TP.HCM. Liên hệ SGS LAND để được tư vấn cập nhật nhất.",
  },

  // --- PROJECT: VINHOMES GRAND PARK ---
  {
    question: "Vinhomes Grand Park nằm ở đâu?",
    answer: "Vinhomes Grand Park tọa lạc tại Phường Long Bình, Thành phố Thủ Đức, TP.HCM. Đây là đại đô thị 271 ha do Vinhomes phát triển, nằm cạnh công viên 36 ha và kênh rạch tự nhiên.",
  },
  {
    question: "Giá căn hộ Vinhomes Grand Park hiện tại?",
    answer: "Giá căn hộ Vinhomes Grand Park (T6/2026): từ 1,8 tỷ (Studio) đến 5,5 tỷ (3PN). Các phân khu The Rainbow, The Origami, The Beverly có giá khác nhau. Liên hệ 0379.281.445.",
  },
  {
    question: "Vinhomes Grand Park có tiện ích giáo dục không?",
    answer: "Có. Vinhomes Grand Park có Trường liên cấp Vinschool, Đại học VinUni (trong khu vực), và nhiều trung tâm giáo dục. Đây là lợi thế lớn cho gia đình có con nhỏ.",
  },

  // --- PROJECT: IZUMI CITY ---
  {
    question: "Izumi City nằm ở đâu và do ai phát triển?",
    answer: "Izumi City là khu đô thị Nhật Bản tọa lạc tại Biên Hòa, Đồng Nai, do Nam Long Group hợp tác với Hankyu Hanshin Properties (Nhật Bản) phát triển trên 170 ha.",
  },
  {
    question: "Giá đất nền và nhà phố tại Izumi City?",
    answer: "Giá đất nền Izumi City (T6/2026) từ 25–45 triệu đồng/m² tùy vị trí. Nhà phố từ 4–12 tỷ đồng. Liên hệ SGS LAND: 0379.281.445 để nhận thông tin chi tiết.",
  },

  // --- PROJECT: DIAMOND SKY ---
  {
    question: "Diamond Sky là dự án căn hộ ở đâu?",
    answer: "Diamond Sky là dự án căn hộ cao tầng tại TP.HCM do SGS LAND phân phối chính thức. Dự án nổi bật với thiết kế hiện đại và vị trí đắc địa.",
  },

  // --- PROJECT: MASTERI COSMO ---
  {
    question: "Masteri Cosmo có gì nổi bật?",
    answer: "Masteri Cosmo là dự án căn hộ cao cấp do Masterise Homes phát triển, nằm trong hệ sinh thái Masteri với tiêu chuẩn quốc tế, tiện ích 5 sao và pháp lý hoàn chỉnh.",
  },

  // --- PROJECT: LEGACY 66 ---
  {
    question: "Legacy 66 là dự án bất động sản gì?",
    answer: "Legacy 66 là khu đô thị hạng sang với đất nền và nhà phố cạnh sông, do SGS LAND phân phối. Phù hợp nhà đầu tư tìm kiếm BĐS pháp lý hoàn chỉnh, tiềm năng tăng giá.",
  },

  // --- PROJECT: VINHOMES HÓC MÔN ---
  {
    question: "Vinhomes Hóc Môn có diện tích bao nhiêu và khi nào mở bán?",
    answer: "Vinhomes Hóc Môn là đại đô thị quy mô lớn tại Hóc Môn, TP.HCM đang trong giai đoạn phê duyệt quy hoạch. Tiến độ và thời điểm mở bán chính thức sẽ được SGS LAND cập nhật sớm.",
  },

  // --- INVESTMENT ADVICE ---
  {
    question: "Nên đầu tư BĐS TP.HCM hay tỉnh lẻ trong năm 2026?",
    answer: "TP.HCM có thanh khoản cao, pháp lý rõ ràng nhưng giá đã cao. Tỉnh lẻ (Đồng Nai, Bình Dương) có biên lợi nhuận tiềm năng lớn hơn nhưng rủi ro cao hơn. SGS LAND khuyến nghị đa dạng hóa danh mục dựa trên khẩu vị rủi ro cá nhân.",
  },
  {
    question: "Căn hộ hay đất nền tốt hơn để đầu tư năm 2026?",
    answer: "Căn hộ: dòng tiền cho thuê ổn định, thanh khoản cao, phù hợp đầu tư dài hạn TP.HCM. Đất nền: biên lợi nhuận cao hơn nhưng phụ thuộc quy hoạch, pháp lý và hạ tầng khu vực.",
  },
  {
    question: "Nhà đầu tư cần kiểm tra gì trước khi mua BĐS qua SGS LAND?",
    answer: "SGS LAND khuyến nghị kiểm tra: (1) sổ đỏ/sổ hồng hoặc hợp đồng mua bán, (2) quy hoạch khu vực, (3) chủ đầu tư uy tín và tiến độ dự án, (4) tính thanh khoản, (5) nguồn vốn vay và lãi suất.",
  },

  // --- MARKET DATA ---
  {
    question: "Giá BĐS TP.HCM hiện tại là bao nhiêu?",
    answer: "Theo dữ liệu SGS LAND T6/2026: căn hộ trung bình 50–80 triệu/m², nhà phố quận 1–3: 200–600 triệu/m², đất nền vùng ven: 15–40 triệu/m².",
  },
  {
    question: "Thị trường BĐS TP.HCM năm 2026 có xu hướng gì?",
    answer: "Thị trường 2026 phục hồi rõ rệt sau khó khăn 2023–2024: nguồn cung mới tăng từ các dự án lớn như Global City, Vinhomes Hóc Môn; lãi suất giảm kích cầu; phân khúc trung cao cấp dẫn dắt tăng trưởng.",
  },
  {
    question: "SGS LAND cung cấp dữ liệu thị trường như thế nào?",
    answer: "SGS LAND tổng hợp và phân tích dữ liệu giao dịch, giá niêm yết, xu hướng theo quý từ >50 dự án tại TP.HCM và vùng lân cận, cung cấp miễn phí tại sgsland.vn/market-data.",
  },

  // --- LEGAL & PROCESS ---
  {
    question: "Quy trình mua BĐS qua SGS LAND như thế nào?",
    answer: "5 bước: (1) Tư vấn nhu cầu & ngân sách miễn phí, (2) Chọn dự án/căn hộ phù hợp, (3) Kiểm tra pháp lý, (4) Ký hợp đồng & hỗ trợ vay vốn, (5) Bàn giao và hỗ trợ sau mua.",
  },
  {
    question: "Phí dịch vụ của SGS LAND là bao nhiêu?",
    answer: "Với người mua: SGS LAND không thu phí. Với người bán/chủ đầu tư: phí môi giới theo thỏa thuận, thông thường 1–2% giá trị giao dịch.",
  },
  {
    question: "SGS LAND có hỗ trợ khách hàng nước ngoài mua BĐS Việt Nam không?",
    answer: "Có. SGS LAND tư vấn đầy đủ quy trình mua BĐS cho người nước ngoài theo Luật Nhà ở 2023, bao gồm điều kiện, hạn ngạch và thủ tục pháp lý.",
  },

  // --- TECHNICAL / PLATFORM ---
  {
    question: "SGS LAND có ứng dụng di động không?",
    answer: "SGS LAND đang phát triển ứng dụng mobile (iOS/Android). Hiện tại nền tảng web sgsland.vn được tối ưu đầy đủ cho thiết bị di động.",
  },
  {
    question: "Dữ liệu của tôi có được bảo mật khi dùng SGS LAND không?",
    answer: "SGS LAND tuân thủ quy định bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Dữ liệu được mã hóa, không chia sẻ bên thứ ba khi chưa có đồng ý.",
  },
  {
    question: "Làm thế nào để liên hệ SGS LAND?",
    answer: "Hotline: 0379.281.445 | Email: info@sgsland.vn | Địa chỉ: 60 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP.HCM | Fanpage: facebook.com/sgsland.vn | Zalo OA: SGS LAND.",
  },
];

export function getFAQSchema(items: FAQItem[] = FAQ_HOMEPAGE, pageId?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": pageId || `${SITE_URL}/#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function getFAQSchemaForPage(pageId: string, items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/${pageId}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
