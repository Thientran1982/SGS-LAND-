// ── Unified external listing type ─────────────────────────────────────────────

export type ExternalSource = 'chotot' | 'batdongsan' | 'muaban' | 'alonhadat';
export type ExtTransaction  = 'SALE' | 'RENT' | 'UNKNOWN';
export type ExtPropertyType =
  | 'Apartment' | 'House' | 'Townhouse' | 'Villa' | 'Land'
  | 'Office' | 'Shophouse' | 'Warehouse' | 'Other';

export interface ExternalListing {
  id:            string;
  source:        ExternalSource;
  externalId:    string;
  title:         string;
  type:          ExtPropertyType;
  transaction:   ExtTransaction;
  price:         number;
  priceDisplay:  string;
  currency:      string;
  area:          number;
  pricePerM2:    number;
  location:      string;
  province:      string;
  district:      string;
  lat:           number | null;
  lng:           number | null;
  bedrooms:      number | null;
  bathrooms:     number | null;
  floors:        number | null;
  frontage:      number | null;
  description:   string;
  imageUrl:      string | null;
  url:           string;
  postedAt:      string | null;
  scrapedAt:     string;
}

export interface SourceResult {
  source:    ExternalSource;
  ok:        boolean;
  listings:  ExternalListing[];
  total:     number;
  durationMs: number;
  error?:    string;
  warning?:  string;
}

export interface ExternalScraperConfig {
  delayMs:   number;
  maxPages:  number;
  province?: string;
  keyword?:  string;
  transaction?: ExtTransaction;
}

export const DEFAULT_EXTERNAL_CONFIG: ExternalScraperConfig = {
  delayMs:  800,
  maxPages: 3,
};

// ── Helper: sleep ─────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Helper: detect Cloudflare block ──────────────────────────────────────────

export function isCfBlocked(html: string): boolean {
  return html.includes('Just a moment') || html.includes('cf_chl_opt') || html.includes('Checking your browser');
}

// ── Helper: parse Vietnamese price string → number ────────────────────────────

export function parseVnPrice(raw: string): number {
  if (!raw) return 0;
  const s = raw.toLowerCase().replace(/\s/g, '').replace(/,/g, '.');
  // "tỷ" = billion, "triệu" = million
  const ty  = s.match(/([\d.]+)\s*tỷ/);
  const tr  = s.match(/([\d.]+)\s*triệu/);
  const num = parseFloat(s.replace(/[^\d.]/g, ''));
  if (ty)  return Math.round(parseFloat(ty[1]) * 1e9);
  if (tr)  return Math.round(parseFloat(tr[1]) * 1e6);
  if (!isNaN(num) && num > 0) return num;
  return 0;
}

// ── Helper: parse area string → number ────────────────────────────────────────

export function parseArea(raw: string): number {
  if (!raw) return 0;
  const m = raw.replace(/,/g, '.').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}
