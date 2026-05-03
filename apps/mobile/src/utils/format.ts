// Vietnamese-localized formatters. Mirror the web `formatSmartPrice` /
// `formatUnitPrice` heuristics so the same listing reads identically on
// web and mobile.

export function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Liên hệ';
  if (value <= 0) return 'Liên hệ';
  if (value >= 1_000_000_000) {
    const v = value / 1_000_000_000;
    const trimmed = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${trimmed.replace(/\.?0+$/, '')} tỷ`;
  }
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)} triệu`;
  }
  return `${value.toLocaleString('vi-VN')} đ`;
}

export function formatUnitPrice(price: number | null | undefined, area: number | null | undefined): string | null {
  if (!price || !area || area <= 0) return null;
  const perM2 = price / area;
  return `${formatVnd(perM2)}/m²`;
}

export function formatArea(area: number | null | undefined): string {
  if (!area) return '—';
  return `${Math.round(area)} m²`;
}

// Vietnamese phone validator — must match server `^(0|\+84)\d{9,10}$`.
export function isValidVnPhone(raw: string): boolean {
  const trimmed = String(raw || '').replace(/\s+/g, '');
  return /^(0|\+84)\d{9,10}$/.test(trimmed);
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Căn hộ',
  VILLA: 'Biệt thự',
  TOWNHOUSE: 'Nhà phố',
  LAND: 'Đất nền',
  PROJECT: 'Dự án',
};

export function propertyTypeLabel(type: string | null | undefined): string {
  if (!type) return '';
  return PROPERTY_TYPE_LABELS[type] || type;
}

const TRANSACTION_LABELS: Record<string, string> = {
  SALE: 'Bán',
  RENT: 'Cho thuê',
};

export function transactionLabel(t: string | null | undefined): string {
  if (!t) return '';
  return TRANSACTION_LABELS[t] || t;
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Còn hàng',
  BOOKING: 'Đặt chỗ',
  OPENING: 'Mở bán',
  SOLD: 'Đã bán',
  PAUSED: 'Tạm dừng',
};

export function statusLabel(s: string | null | undefined): string {
  if (!s) return '';
  return STATUS_LABELS[s] || s;
}

// SEO-friendly slug, used to build deep links matching `/bds/<slug>-<uuid>`.
export function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
