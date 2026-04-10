/**
 * BatDongSan.com.vn scraper
 * Status: ⚠️ Cloudflare Bot Management bảo vệ
 *
 * Cloudflare yêu cầu JavaScript challenge — không thể bypass với HTTP request thông thường.
 * Giải pháp:
 *   1. Dùng Puppeteer/Playwright (headless browser) — xem README
 *   2. Dùng ScraperAPI / BrightData proxy
 *   3. Set env SCRAPER_PROXY_URL=https://your-proxy/get?url=
 *
 * Khi SCRAPER_PROXY_URL được set, scraper tự động dùng proxy bypass CF.
 */

import {
  ExternalListing, ExternalScraperConfig, SourceResult,
  DEFAULT_EXTERNAL_CONFIG, sleep, isCfBlocked,
} from './types.js';

const BASE_URL    = 'https://batdongsan.com.vn';
const PROXY_URL   = process.env['SCRAPER_PROXY_URL'] ?? '';

const HEADERS = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language':           'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding':           'gzip, deflate, br',
  'Connection':                'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Cache-Control':             'max-age=0',
};

// ── Fetch with optional proxy ─────────────────────────────────────────────────

async function fetchHtml(path: string): Promise<string> {
  const targetUrl = `${BASE_URL}${path}`;
  const fetchUrl  = PROXY_URL ? `${PROXY_URL}${encodeURIComponent(targetUrl)}` : targetUrl;

  const res = await fetch(fetchUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
}

// ── Parse BDS listing HTML (Next.js __NEXT_DATA__) ────────────────────────────

function parseNextData(html: string): ExternalListing[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]+?\})<\/script>/);
  if (!m) return [];

  try {
    const data = JSON.parse(m[1]);
    const items: unknown[] =
      data?.props?.pageProps?.searchResult?.products ??
      data?.props?.pageProps?.data?.items ??
      [];

    return items.map((item: unknown) => {
      const it = item as Record<string, unknown>;
      const price  = Number(it.price ?? 0);
      const area   = Number(it.area  ?? 0);
      return {
        id:          `batdongsan-${it.id ?? it.productId}`,
        source:      'batdongsan' as const,
        externalId:  String(it.id ?? it.productId ?? ''),
        title:       String(it.title ?? it.name ?? ''),
        type:        'House' as ExternalListing['type'],
        transaction: String(it.transactionType ?? '').includes('for-rent') ? 'RENT' : 'SALE',
        price,
        priceDisplay: String(it.priceLabel ?? ''),
        currency:    'VND',
        area,
        pricePerM2:  area > 0 ? Math.round(price / area) : 0,
        location:    String(it.fullAddress ?? it.address ?? ''),
        province:    String(it.province?.name ?? ''),
        district:    String(it.district?.name ?? ''),
        lat:         it.lat  ? Number(it.lat)  : null,
        lng:         it.lng  ? Number(it.lng)  : null,
        bedrooms:    it.bedRoomCount  ? Number(it.bedRoomCount)  : null,
        bathrooms:   it.bathRoomCount ? Number(it.bathRoomCount) : null,
        floors:      it.floorCount    ? Number(it.floorCount)    : null,
        frontage:    it.width         ? Number(it.width)         : null,
        description: String(it.description ?? '').substring(0, 500),
        imageUrl:    String(it.thumbnail ?? it.coverImage ?? ''),
        url:         `${BASE_URL}/${it.slug ?? it.id}.htm`,
        postedAt:    it.publishedDate ? String(it.publishedDate) : null,
        scrapedAt:   new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// ── Scraper class ─────────────────────────────────────────────────────────────

export class BatDongSanScraper {
  private cfg: ExternalScraperConfig;

  constructor(config: Partial<ExternalScraperConfig> = {}) {
    this.cfg = { ...DEFAULT_EXTERNAL_CONFIG, ...config };
  }

  async scrape(): Promise<SourceResult> {
    const start = Date.now();
    console.log('\n🏢 [BatDongSan] Bắt đầu scrape...');

    if (!PROXY_URL) {
      console.warn('   ⚠️  CẢNH BÁO: batdongsan.com.vn được bảo vệ bởi Cloudflare Bot Management.');
      console.warn('   ⚠️  Set env SCRAPER_PROXY_URL để bypass, hoặc dùng Puppeteer.');
      console.warn('   ⚠️  Đang thử kết nối trực tiếp (có thể bị block)...');
    } else {
      console.log(`   🔄 Dùng proxy: ${PROXY_URL}`);
    }

    const listings: ExternalListing[] = [];
    const path = this.cfg.transaction === 'RENT' ? '/nha-dat-cho-thue' : '/nha-dat-ban';

    for (let page = 1; page <= this.cfg.maxPages; page++) {
      const pagePath = page === 1 ? path : `${path}/p${page}`;

      try {
        const html = await fetchHtml(pagePath);

        if (isCfBlocked(html)) {
          const msg = 'Bị chặn bởi Cloudflare Bot Management. Cần proxy hoặc headless browser.';
          console.error(`   ❌ ${msg}`);
          return {
            source: 'batdongsan', ok: false, listings, total: 0,
            durationMs: Date.now() - start,
            error: msg,
            warning: 'Set SCRAPER_PROXY_URL=https://your-proxy/get?url= hoặc dùng Puppeteer để bypass Cloudflare',
          };
        }

        const pageListings = parseNextData(html);
        listings.push(...pageListings);
        console.log(`   ✅ Trang ${page}: ${pageListings.length} items`);

        if (page < this.cfg.maxPages) await sleep(this.cfg.delayMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Trang ${page} lỗi: ${msg}`);
        if (page === 1) {
          return { source: 'batdongsan', ok: false, listings, total: 0, durationMs: Date.now() - start, error: msg };
        }
        break;
      }
    }

    return { source: 'batdongsan', ok: listings.length > 0, listings, total: listings.length, durationMs: Date.now() - start };
  }
}
