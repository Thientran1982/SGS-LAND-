import { SITE_URL, SITE_NAME, ORG_ID } from "./constants";

export const REVIEW_LIST = [
  {
    "@type": "Review",
    author: { "@type": "Person", name: "Nguyễn Minh Tuấn" },
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    reviewBody: "SGS LAND tư vấn rất chuyên nghiệp, giúp tôi mua được căn hộ Vinhomes Grand Park đúng ngân sách. Công cụ định giá AI rất chính xác so với giá thực tế.",
    datePublished: "2026-05-10",
    itemReviewed: { "@type": "RealEstateListing", name: "Vinhomes Grand Park", url: `${SITE_URL}/du-an/vinhomes-grand-park` },
  },
  {
    "@type": "Review",
    author: { "@type": "Person", name: "Trần Thị Lan Anh" },
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    reviewBody: "Đội ngũ SGS LAND hỗ trợ rất tốt từ khâu tư vấn đến ký hợp đồng. CRM platform giúp tôi quản lý khách hàng hiệu quả hơn nhiều.",
    datePublished: "2026-04-22",
    itemReviewed: { "@type": "LocalBusiness", name: "SGS LAND", url: SITE_URL },
  },
  {
    "@type": "Review",
    author: { "@type": "Person", name: "Phạm Quốc Hùng" },
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    reviewBody: "Mua đất Aqua City qua SGS LAND rất yên tâm về pháp lý. Họ kiểm tra kỹ hồ sơ và hỗ trợ vay vốn ngân hàng nhanh chóng.",
    datePublished: "2026-03-15",
    itemReviewed: { "@type": "RealEstateListing", name: "Aqua City", url: `${SITE_URL}/du-an/aqua-city` },
  },
  {
    "@type": "Review",
    author: { "@type": "Person", name: "Lê Thành Đạt" },
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    reviewBody: "Dữ liệu thị trường BĐS TP.HCM của SGS LAND rất chi tiết và cập nhật. Giúp tôi đưa ra quyết định đầu tư đúng đắn.",
    datePublished: "2026-02-28",
    itemReviewed: { "@type": "LocalBusiness", name: "SGS LAND", url: SITE_URL },
  },
  {
    "@type": "Review",
    author: { "@type": "Person", name: "Hoàng Thị Mai" },
    reviewRating: { "@type": "Rating", ratingValue: "4", bestRating: "5" },
    reviewBody: "The Global City rất đẹp, SGS LAND tư vấn nhiệt tình. Mong nền tảng có thêm ứng dụng mobile để tiện theo dõi.",
    datePublished: "2026-01-20",
    itemReviewed: { "@type": "RealEstateListing", name: "The Global City", url: `${SITE_URL}/du-an/the-global-city` },
  },
];

export function getAggregateRatingSchema() {
  const totalReviews = REVIEW_LIST.length;
  const totalRating = REVIEW_LIST.reduce(
    (sum, r) => sum + parseFloat(r.reviewRating.ratingValue),
    0
  );
  const avgRating = (totalRating / totalReviews).toFixed(1);
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": ORG_ID,
    name: SITE_NAME,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount: String(totalReviews),
      bestRating: "5",
      worstRating: "1",
    },
    review: REVIEW_LIST,
  };
}
