// -----------------------------------------------------------------------------
// Shared source of truth for genuine customer reviews (testimonials).
// Imported by landing pages (Vite app) and reused for Review JSON-LD schema so
// the displayed testimonials and structured data stay consistent.
//
// NOTE: reviewCount in aggregateRating MUST reflect the number of verifiable
// reviews we actually have. Do NOT inflate this number.
// -----------------------------------------------------------------------------

export interface CustomerReview {
  author: string;
  datePublished: string; // YYYY-MM-DD
  rating: number; // 1..5
  body: string;
}

export const CUSTOMER_REVIEWS: CustomerReview[] = [
  {
    author: 'Nguyễn Minh Tuấn',
    datePublished: '2026-03-01',
    rating: 5,
    body: 'Tư vấn pháp lý chi tiết, hỗ trợ hồ sơ vay ngân hàng nhanh. Đặt cọc qua SGS LAND minh bạch, nhận bằng giá chính chủ trong ngày.',
  },
  {
    author: 'Nguyễn Minh Trí',
    datePublished: '2026-03-10',
    rating: 5,
    body: 'Chuyên viên SGS LAND tư vấn kỹ về thị trường BĐS địa phương, hỗ trợ kiểm tra pháp lý miễn phí và kết nối vay ngân hàng tốt.',
  },
  {
    author: 'Đặng Thị Hương',
    datePublished: '2026-02-05',
    rating: 5,
    body: 'Tư vấn nhiệt tình và am hiểu thị trường địa phương. SGS LAND là lựa chọn đáng tin cậy khi mua BĐS tại khu vực này.',
  },
];

// Average rating derived from the real reviews above.
export const REVIEW_AGGREGATE = {
  ratingValue: Number(
    (CUSTOMER_REVIEWS.reduce((s, r) => s + r.rating, 0) / CUSTOMER_REVIEWS.length).toFixed(1)
  ),
  reviewCount: CUSTOMER_REVIEWS.length,
  bestRating: 5,
  worstRating: 1,
};

// Build schema.org Review[] objects from the shared review data.
export function buildReviewSchema() {
  return CUSTOMER_REVIEWS.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    datePublished: r.datePublished,
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    reviewBody: r.body,
  }));
}

export function buildAggregateRatingSchema() {
  return {
    '@type': 'AggregateRating',
    ratingValue: REVIEW_AGGREGATE.ratingValue,
    reviewCount: REVIEW_AGGREGATE.reviewCount,
    bestRating: REVIEW_AGGREGATE.bestRating,
    worstRating: REVIEW_AGGREGATE.worstRating,
  };
}
