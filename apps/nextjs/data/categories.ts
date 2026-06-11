// ─── Article categories ───────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "phan-tich-thi-truong",
    name: "Phân tích thị trường",
    slug: "phan-tich-thi-truong",
    description: "Báo cáo và phân tích xu hướng BĐS TP.HCM, Đồng Nai, Bình Dương",
    icon: "chart-bar",
    color: "#312E81",
  },
  {
    id: "huong-dan-phap-ly",
    name: "Hướng dẫn pháp lý",
    slug: "huong-dan-phap-ly",
    description: "Thủ tục, quy trình pháp lý mua bán BĐS theo Luật Đất Đai 2024",
    icon: "file-certificate",
    color: "#065F46",
  },
  {
    id: "kien-thuc-dau-tu",
    name: "Kiến thức đầu tư",
    slug: "kien-thuc-dau-tu",
    description: "Chiến lược đầu tư BĐS, dòng tiền, đòn bẩy tài chính",
    icon: "trending-up",
    color: "#92400E",
  },
  {
    id: "du-an-noi-bat",
    name: "Dự án nổi bật",
    slug: "du-an-noi-bat",
    description: "Review chuyên sâu và cập nhật tiến độ các dự án lớn",
    icon: "building-estate",
    color: "#1E40AF",
  },
  {
    id: "tai-chinh-vay-mua-nha",
    name: "Tài chính & Vay mua nhà",
    slug: "tai-chinh-vay-mua-nha",
    description: "Lãi suất, gói vay, kinh nghiệm vay mua BĐS ngân hàng",
    icon: "credit-card",
    color: "#7C3AED",
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.name])
);
