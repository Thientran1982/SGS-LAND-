/**
 * PRICE FORMAT - single source of truth for Vietnamese price formatting.
 * ---------------------------------------------------------------------------
 * Extracted from utils/textUtils.ts (which pulls in config/routes) so that the
 * Next.js public app can reuse the EXACT same implementation as the CRM SPA.
 * utils/textUtils.ts re-exports these for backwards compatibility.
 *
 * NOTE: Vietnamese labels are written as \uXXXX escapes on purpose to keep this
 * file pure ASCII (safe against tooling that mangles UTF-8).
 */

export type PriceLang = 'vi' | 'en';

const LABELS: Record<PriceLang, { billion: string; million: string; perMonth: string; unit: string }> = {
  vi: { billion: 'T\u1ef7', million: 'Tri\u1ec7u', perMonth: '/th\u00e1ng', unit: '\u0111/m\u00b2' },
  en: { billion: 'B VND', million: 'M VND', perMonth: '/month', unit: 'VND/m\u00b2' },
};

/** 4.4805 -> '4,48' | 13200 -> '13.200' (vi grouping + comma decimal) */
export const fmtDecimalDot = (n: number, maxFractions: number): string => {
  const rounded = parseFloat(n.toFixed(maxFractions));
  const [intPart, decPart] = rounded.toString().split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${intFormatted},${decPart}` : intFormatted;
};

/** Smart price: >=1e9 -> Ty, >=1e6 -> Trieu/Tr, else grouped VND. */
export const formatSmartPrice = (price: number, t?: (key: string) => string): string => {
  if (!price) return '0';
  const billionLabel = t ? t('format.billion') : 'T\u1ef7';
  const millionLabel = t ? t('format.million') : 'Tr';
  if (price >= 1_000_000_000) {
    return `${fmtDecimalDot(price / 1_000_000_000, 3)} ${billionLabel}`;
  }
  if (price >= 1_000_000) {
    return `${fmtDecimalDot(price / 1_000_000, 2)} ${millionLabel}`;
  }
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/** Unit price (price per m2). Falls back to d/m2 for cheap rentals. */
export const formatUnitPrice = (price: number, area: number, t?: (key: string) => string): string => {
  if (!price || !area) return '';
  const unit = price / area;
  const billionLabel = t ? t('format.billion') : 'T\u1ef7';
  const millionLabel = t ? t('format.million') : 'Tr';
  if (unit >= 1_000_000_000) {
    return `${fmtDecimalDot(unit / 1_000_000_000, 1)} ${billionLabel}/m\u00b2`;
  }
  if (unit >= 1_000_000) {
    return `${fmtDecimalDot(unit / 1_000_000, 1)} ${millionLabel}/m\u00b2`;
  }
  return `${Math.round(unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} \u0111/m\u00b2`;
};

const langT = (lang: PriceLang) => (key: string): string =>
  key === 'format.billion'
    ? LABELS[lang].billion
    : key === 'format.million'
      ? LABELS[lang].million
      : key;

/** Language-aware wrappers used by the public (Next.js) site. */
export const formatPriceLang = (price: number, lang: PriceLang = 'vi'): string =>
  formatSmartPrice(price, langT(lang));

export const formatUnitPriceLang = (price: number, area: number, lang: PriceLang = 'vi'): string => {
  const out = formatUnitPrice(price, area, langT(lang));
  return lang === 'en' ? out.replace('\u0111/m\u00b2', LABELS.en.unit) : out;
};

/** '/thang' | '/month' - appended to RENT prices. */
export const rentSuffix = (lang: PriceLang = 'vi'): string => LABELS[lang].perMonth;
