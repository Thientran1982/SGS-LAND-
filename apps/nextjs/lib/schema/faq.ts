import { SITE_URL, SITE_NAME } from "./constants";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  name: string;
  inLanguage: "vi";
  mainEntity: {
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }[];
}

/**
 * Generates a FAQPage JSON-LD schema.
 *
 * GEO impact: FAQPage is one of the highest-citation schema types. Each answer
 * should open with the direct response (first 40–60 words), include at least
 * one statistic, and name entities explicitly — these are the signals AI
 * engines extract to construct answers (+33.9% visibility for statistics,
 * +32% for expert quotes, +30% for fluent writing — Princeton/IIT KDD 2024).
 */
export function getFAQSchema(items: FAQItem[], pageId = `${SITE_URL}/#faq`): FAQSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": pageId,
    name: `Câu hỏi thường gặp về bất động sản ${SITE_NAME}`,
    inLanguage: "vi",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

/**
 * 8 GEO-optimised FAQ items for the SGS LAND homepage.
 *
 * Each answer leads with a direct, self-contained response, includes at least
 * one named statistic, and explicitly names the brand and related entities so
 * AI engines (ChatGPT, Perplexity, Google AI Overviews) can cite them.
 */
export const FAQ_HOMEPAGE: FAQItem[] = [
  {
    question: "SGS Land là gì?",
    answer:
      "SGS LAND (sgsland.vn) là nền tảng bất động sản AI hàng đầu Việt Nam, thành lập năm 2024. Đây là đại lý phân phối uỷ quyền cấp 1 của Vinhomes, Novaland và Masterise Homes. Tính đến T5/2026: hơn 45.000 sản phẩm, 15.000+ môi giới được xác thực và tổng giá trị giao dịch vượt 2 tỷ USD. Hệ thống tích hợp AI định giá tự động (AVM), CRM đa kênh (Zalo, Facebook, Email) và quản lý kho hàng toàn diện.",
  },
  {
    question: "SGS Land phân phối những dự án nào?",
    answer:
      "SGS LAND phân phối uỷ quyền 6 dự án lớn tại TP.HCM và vùng ven: (1) Aqua City Novaland — 1.000ha tại Nhơn Trạch, Đồng Nai; (2) The Global City Masterise Homes — 117ha tại TP Thủ Đức; (3) Izumi City Nam Long — 170ha tại Biên Hòa, Đồng Nai; (4) Vinhomes Grand Park — 271ha tại TP Thủ Đức; (5) Vinhomes Cần Giờ — 2.870ha tại Cần Giờ, TP.HCM; (6) Masterise Homes — hệ sinh thái căn hộ hạng sang tại TP.HCM. Xem danh sách đầy đủ tại sgsland.vn/du-an.",
  },
  {
    question: "Định giá bất động sản AI của SGS Land có chính xác không?",
    answer:
      "Hệ thống định giá AVM (Automated Valuation Model) của SGS LAND đạt sai số ±5% so với giá thị trường — ngang chuẩn thẩm định viên chuyên nghiệp. Mô hình phân tích 9 hệ số: vị trí, diện tích, tầng, hướng, pháp lý, tiện ích, thị trường khu vực, chủ đầu tư và tiến độ bàn giao. Kết quả trả về trong 30 giây. Trải nghiệm miễn phí tại sgsland.vn/ai-valuation.",
  },
  {
    question: "Làm sao liên hệ SGS Land?",
    answer:
      "Bạn có thể liên hệ SGS LAND qua: Hotline +84 971 132 378 (trực 24/7), email info@sgsland.vn, hoặc chat trực tiếp tại sgsland.vn/contact. Đội ngũ 15.000+ môi giới xác thực sẵn sàng tư vấn miễn phí về pháp lý, giá thị trường và chính sách thanh toán.",
  },
  {
    question: "SGS Land có uy tín không?",
    answer:
      "SGS LAND là đối tác phân phối uỷ quyền chính thức của Vinhomes, Masterise Homes, Novaland và Nam Long — 4 trong 5 chủ đầu tư hàng đầu Việt Nam. Nền tảng đạt điểm đánh giá trung bình 4.8/5 từ 127 đánh giá độc lập (T5/2026). Tuân thủ Luật Đất Đai 2024, Luật Kinh Doanh BĐS 2023 và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.",
  },
  {
    question: "Aqua City Novaland giá bao nhiêu?",
    answer:
      "Aqua City Novaland (tại Nhơn Trạch, Đồng Nai) có giá từ 3 tỷ VND tháng 5/2026. Cụ thể: nhà phố liền kề từ 6–15 tỷ, shophouse từ 10–25 tỷ, biệt thự từ 15–50 tỷ. Chính sách thanh toán: 30% ký HĐMB, 70% còn lại trả góp 24–36 tháng không lãi suất. Xem bảng giá cập nhật tại sgsland.vn/du-an/aqua-city.",
  },
  {
    question: "Vinhomes Grand Park có gì nổi bật?",
    answer:
      "Vinhomes Grand Park là siêu đô thị thông minh 271ha tại TP Thủ Đức, TP.HCM — do Vinhomes (VHM-HOSE) phát triển. Điểm nổi bật: Metro số 1 (ga Suối Tiên, đi vào khai thác Q4/2024) kết nối Quận 1 trong 30 phút; công viên chủ đề 36ha; Vinmec, Vinschool, Vincom. Giá căn hộ T5/2026 từ 2,5 tỷ (1PN) đến 8 tỷ (The Opus One). Tỷ lệ lấp đầy cho thuê đạt 92% (Savills Vietnam Q1/2026).",
  },
  {
    question: "SGS Land hỗ trợ vay ngân hàng không?",
    answer:
      "Có. SGS LAND kết nối với 12+ ngân hàng đối tác gồm BIDV, Vietcombank, Techcombank, MB Bank và VPBank. Dịch vụ hỗ trợ bao gồm: thẩm định hồ sơ vay, tư vấn LTV 70–80%, lãi suất ưu đãi 6–8,5%/năm trong 24 tháng đầu và miễn phí thủ tục công chứng hợp đồng. Liên hệ tư vấn miễn phí qua hotline +84 971 132 378.",
  },
];
