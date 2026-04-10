/**
 * Chợ Tốt BĐS scraper
 * API: https://gateway.chotot.com/v1/public/ad-listing
 * Status: ✅ Công khai — không cần auth, không có Cloudflare
 *
 * Danh mục bất động sản:
 *   1010 = Căn hộ chung cư
 *   1020 = Nhà ở (all)
 *   1030 = Đất
 *   1040 = Văn phòng, mặt bằng
 *   1050 = Phòng trọ
 */

import {
  ExternalListing, ExternalScraperConfig, SourceResult,
  DEFAULT_EXTERNAL_CONFIG, sleep, parseArea,
} from './types.js';

const BASE_URL    = 'https://gateway.chotot.com/v1/public/ad-listing';
const LISTING_URL = 'https://www.chotot.com';

// ── Category map ──────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  '1010': 'Apartment',
  '1020': 'House',
  '1030': 'Land',
  '1040': 'Office',
  '1050': 'Other',
  '1060': 'Shophouse',
};

// ── House type map ────────────────────────────────────────────────────────────

const HOUSE_TYPE_MAP: Record<number, string> = {
  1: 'House',
  2: 'Townhouse',
  3: 'Townhouse',
  4: 'Villa',
  5: 'Apartment',
  6: 'Land',
  7: 'Office',
  8: 'Shophouse',
  9: 'Warehouse',
};

// ── Region list (chotot region IDs for major cities) ─────────────────────────

const REGIONS: Record<string, number> = {
  'Hồ Chí Minh':  13000,
  'Hà Nội':        12000,
  'Đà Nẵng':       14000,
  'Bình Dương':    51000,
  'Đồng Nai':      38000,
  'Cần Thơ':       65000,
};

function getRegionId(province?: string): number | undefined {
  if (!province) return undefined;
  for (const [k, v] of Object.entries(REGIONS)) {
    if (province.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return undefined;
}

// ── Normalize raw Chotot ad → ExternalListing ─────────────────────────────────

function normalizeAd(ad: Record<string, unknown>): ExternalListing {
  const adId    = String(ad.list_id ?? ad.ad_id ?? '');
  const cat     = String(ad.category ?? '1020');
  const htype   = Number(ad.house_type ?? 0);
  const type    = (HOUSE_TYPE_MAP[htype] ?? CATEGORY_MAP[cat] ?? 'Other') as ExternalListing['type'];
  const trans   = String(ad.type ?? '').toLowerCase() === 'r' ? 'RENT' : 'SALE';
  const price   = Number(ad.price ?? 0);
  const area    = parseArea(String(ad.size ?? ad.area ?? ''));
  const pricePerM2 = area > 0 ? Math.round(price / area) : 0;

  // Location: "lat,lng" format
  let lat: number | null = null;
  let lng: number | null = null;
  if (ad.location && typeof ad.location === 'string' && ad.location.includes(',')) {
    const parts = ad.location.split(',');
    lat = parseFloat(parts[0]);
    lng = parseFloat(parts[1]);
  }
  if (ad.latitude)  lat = Number(ad.latitude);
  if (ad.longitude) lng = Number(ad.longitude);

  const province = String(ad.region_name     ?? ad.region_name_v3 ?? '');
  const district = String(ad.area_name       ?? ad.ward_name      ?? '');
  const street   = String(ad.street_name     ?? '');
  const location = [street, district, province].filter(Boolean).join(', ');

  return {
    id:           `chotot-${adId}`,
    source:       'chotot',
    externalId:   adId,
    title:        String(ad.subject ?? ''),
    type,
    transaction:  trans,
    price,
    priceDisplay: String(ad.price_string ?? ''),
    currency:     'VND',
    area,
    pricePerM2,
    location,
    province,
    district,
    lat,
    lng,
    bedrooms:     ad.rooms    ? Number(ad.rooms)   : null,
    bathrooms:    ad.toilets  ? Number(ad.toilets) : null,
    floors:       ad.floors   ? Number(ad.floors)  : null,
    frontage:     ad.width    ? Number(ad.width)   : null,
    description:  String(ad.body ?? ''),
    imageUrl:     String(ad.thumbnail_image ?? ad.image ?? ''),
    url:          `${LISTING_URL}/${adId}.htm`,
    postedAt:     ad.list_time ? new Date(Number(ad.list_time)).toISOString() : null,
    scrapedAt:    new Date().toISOString(),
  };
}

// ── Scraper class ─────────────────────────────────────────────────────────────

export class ChototScraper {
  private cfg: ExternalScraperConfig;

  constructor(config: Partial<ExternalScraperConfig> = {}) {
    this.cfg = { ...DEFAULT_EXTERNAL_CONFIG, ...config };
  }

  async scrape(): Promise<SourceResult> {
    const start = Date.now();
    console.log('\n📱 [Chợ Tốt] Bắt đầu scrape...');
    console.log(`   Trang tối đa: ${this.cfg.maxPages} | Delay: ${this.cfg.delayMs}ms`);

    const listings: ExternalListing[] = [];
    let total = 0;

    // Category: 1020 = all residential (most common)
    const category = 1020;
    const regionId = getRegionId(this.cfg.province);

    for (let page = 0; page < this.cfg.maxPages; page++) {
      const offset = page * 20;
      const params = new URLSearchParams({
        cg:            String(category),
        o:             String(offset),
        limit:         '20',
        st:            's,k',
        key_param_included: 'true',
      });
      if (regionId)         params.set('w', String(regionId));
      if (this.cfg.keyword) params.set('q', this.cfg.keyword);
      if (this.cfg.transaction === 'RENT') params.set('type', 'r');

      const url = `${BASE_URL}?${params.toString()}`;

      try {
        const res = await fetch(url, {
          headers: {
            'Accept':     'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { total?: number; ads?: Record<string, unknown>[] };

        if (page === 0) {
          total = Number(data.total ?? 0);
          console.log(`   📊 Tổng: ${total} listings`);
        }

        const ads = data.ads ?? [];
        if (!ads.length) break;

        listings.push(...ads.map(a => normalizeAd(a)));
        console.log(`   ✅ Trang ${page + 1}: ${ads.length} items (tổng: ${listings.length})`);

        if (page < this.cfg.maxPages - 1) await sleep(this.cfg.delayMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Trang ${page + 1} lỗi: ${msg}`);
        return {
          source: 'chotot', ok: false, listings, total, durationMs: Date.now() - start,
          error: msg,
        };
      }
    }

    console.log(`   🏁 Chotot done: ${listings.length} listings (${Date.now() - start}ms)`);
    return { source: 'chotot', ok: true, listings, total, durationMs: Date.now() - start };
  }
}
