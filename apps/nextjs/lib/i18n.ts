import type { Lang } from "./lang";

/**
 * Inline pair helper — the pragmatic way to translate this codebase:
 *   tt(lang, "Tìm kiếm", "Search")
 * No key registry to maintain, and the Vietnamese source stays readable.
 */
export function tt(lang: Lang, vi: string, en: string): string {
  return lang === "en" ? en : vi;
}

/** Shared UI strings used in more than one place. */
export const UI: Record<string, { vi: string; en: string }> = {
  search: { vi: "Tìm kiếm", en: "Search" },
  searchBtn: { vi: "Tìm", en: "Search" },
  all: { vi: "Tất cả", en: "All" },
  sale: { vi: "Bán", en: "For Sale" },
  rent: { vi: "Cho thuê", en: "For Rent" },
  saleBadge: { vi: "BÁN", en: "FOR SALE" },
  rentBadge: { vi: "CHO THUÊ", en: "FOR RENT" },
  verified: { vi: "ĐÃ XÁC THỰC", en: "VERIFIED" },
  area: { vi: "Diện tích", en: "Area" },
  bedrooms: { vi: "Phòng ngủ", en: "Bedrooms" },
  bathrooms: { vi: "Phòng tắm", en: "Bathrooms" },
  legal: { vi: "Pháp lý", en: "Legal status" },
  price: { vi: "Giá", en: "Price" },
  listedPrice: { vi: "Giá niêm yết", en: "Listed price" },
  viewDetail: { vi: "Xem chi tiết", en: "View details" },
  noResult: { vi: "Không tìm thấy kết quả", en: "No results found" },
  loading: { vi: "Đang tải...", en: "Loading..." },
  prev: { vi: "Trước", en: "Previous" },
  next: { vi: "Sau", en: "Next" },
  page: { vi: "Trang", en: "Page" },
  home: { vi: "Trang chủ", en: "Home" },
  contactUs: { vi: "Liên hệ", en: "Contact" },
  bookViewing: { vi: "Đặt Lịch Xem Nhà", en: "Book a Viewing" },
  callNow: { vi: "Gọi Điện Ngay", en: "Call Now" },
  details: { vi: "Thông Tin Chi Tiết", en: "Property Details" },
  similar: { vi: "Bất Động Sản Phù Hợp Khác", en: "Other Matching Properties" },
};

export function u(lang: Lang, key: keyof typeof UI): string {
  const e = UI[key as string];
  if (!e) return String(key);
  return lang === "en" ? e.en : e.vi;
}
