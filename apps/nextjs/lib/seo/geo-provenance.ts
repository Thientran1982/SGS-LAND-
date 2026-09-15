export const GEO_REVIEW_DATE = "2026-09-15";
export const GEO_EDITOR_NAME = "SGS LAND Editorial Desk";
export const GEO_EDITOR_URL = "https://sgsland.vn/chinh-sach-bien-tap";

export const GEO_DEFAULT_EVIDENCE_NOTE =
  "Nội dung là bản tóm tắt biên tập từ dữ liệu đang có trên SGS LAND; giá, pháp lý, tiến độ, tiện ích và tư cách phân phối chưa được xem là chứng cứ độc lập nếu chưa có hồ sơ gốc kèm ngày xác minh.";

export function buildGeoDirectAnswer({
  projectName,
  developer,
  location,
  isArea = false,
  en = false,
}: {
  projectName: string;
  developer?: string;
  location?: string;
  isArea?: boolean;
  en?: boolean;
}) {
  if (en) {
    return `${projectName} is ${isArea ? "an area-level real-estate reference" : "a real-estate project reference"} in ${location || "Vietnam"}. This page summarizes the entity, products and key checks. Prices, legal status, progress and distribution are indicative; check dated original documents before a transaction.`;
  }

  return `${projectName} là ${isArea ? "trang tham khảo bất động sản khu vực" : "trang tham khảo bất động sản"} tại ${location || "Việt Nam"}. Trang tóm tắt entity, sản phẩm và điểm cần kiểm tra. Giá, pháp lý, tiến độ và phân phối chỉ là tham khảo; đối chiếu hồ sơ gốc có ngày cập nhật trước giao dịch.`;
}

export function getGeoEvidenceLinks(slug: string) {
  return [
    { label: "Chính sách biên tập SGS LAND", href: GEO_EDITOR_URL },
    { label: "Trang entity/dự án liên quan", href: `https://sgsland.vn/du-an/${slug}` },
  ];
}