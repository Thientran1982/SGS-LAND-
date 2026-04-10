/**
 * Muaban.net scraper
 * Status: ⚠️ Cloudflare Bot Management bảo vệ
 *
 * Cloudflare yêu cầu JavaScript challenge — không thể bypass với HTTP request thông thường.
 * Giải pháp: Set env SCRAPER_PROXY_URL hoặc dùng Puppeteer/Playwright.
 *
 * Khi SCRAPER_PROXY_URL được set, scraper tự động dùng proxy bypass CF.
 */

import {
  ExternalListing, ExternalScraperConfig, SourceResult,
  DEFAULT_EXTERNAL_CONFIG, sleep, isCfBlocked, parseVnPrice, parseArea,
} from './types.js';
import * as cheerio from 'cheerio';

const BASE_URL  = 'https://muaban.net';
const PROXY_URL = process.env['SCRAPER_PROXY_URL'] ?? '';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  'Connection':      'keep-alive',
};

async function fetchHtml(url: string): Promise<string> {
  const fetchUrl = PROXY_URL ? `${PROXY_URL}${encodeURIComponent(url)}` : url;
  const res = await fetch(fetchUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseListings(html: string, source: 'muaban'): ExternalListing[] {
  const $ = cheerio.load(html);
  const listings: ExternalListing[] = [];

  // Try __NEXT_DATA__ first (Next.js site)
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const data = JSON.parse(nextData);
      const items: unknown[] =
        data?.props?.pageProps?.data?.items ??
        data?.props?.pageProps?.postList?.data ??
        data?.props?.pageProps?.posts ??
        [];

      for (const item of items) {
        const it = item as Record<string, unknown>;
        const price  = parseVnPrice(String(it.price ?? it.priceLabel ?? ''));
        const area   = parseArea(String(it.area ?? it.acreage ?? ''));
        listings.push({
          id:          `muaban-${it.id ?? it.postId}`,
          source,
          externalId:  String(it.id ?? it.postId ?? ''),
          title:       String(it.title ?? it.subject ?? ''),
          type:        'House',
          transaction: String(it.type ?? '').includes('thue') ? 'RENT' : 'SALE',
          price,
          priceDisplay: String(it.priceLabel ?? it.price ?? ''),
          currency:    'VND',
          area,
          pricePerM2:  area > 0 ? Math.round(price / area) : 0,
          location:    String(it.address ?? it.location ?? ''),
          province:    String(it.province?.name ?? it.city ?? ''),
          district:    String(it.district?.name ?? ''),
          lat:         it.lat  ? Number(it.lat)  : null,
          lng:         it.lng  ? Number(it.lng)  : null,
          bedrooms:    it.bedroom ? Number(it.bedroom) : null,
          bathrooms:   null,
          floors:      null,
          frontage:    null,
          description: String(it.description ?? '').substring(0, 500),
          imageUrl:    String(it.thumbnail ?? it.image ?? ''),
          url:         `${BASE_URL}/${it.slug ?? it.id}`,
          postedAt:    it.publishDate ? String(it.publishDate) : null,
          scrapedAt:   new Date().toISOString(),
        });
      }
    } catch { /* fall through */ }
  }

  return listings;
}

export class MuabanScraper {
  private cfg: ExternalScraperConfig;

  constructor(config: Partial<ExternalScraperConfig> = {}) {
    this.cfg = { ...DEFAULT_EXTERNAL_CONFIG, ...config };
  }

  async scrape(): Promise<SourceResult> {
    const start = Date.now();
    console.log('\n🏠 [Muaban.net] Bắt đầu scrape...');

    if (!PROXY_URL) {
      console.warn('   ⚠️  CẢNH BÁO: muaban.net được bảo vệ bởi Cloudflare Bot Management.');
      console.warn('   ⚠️  Set env SCRAPER_PROXY_URL để bypass, hoặc dùng Puppeteer.');
      console.warn('   ⚠️  Đang thử kết nối trực tiếp (có thể bị block)...');
    } else {
      console.log(`   🔄 Dùng proxy: ${PROXY_URL}`);
    }

    const listings: ExternalListing[] = [];
    const basePath = this.cfg.transaction === 'RENT' ? '/bat-dong-san/cho-thue' : '/bat-dong-san';

    for (let page = 1; page <= this.cfg.maxPages; page++) {
      const url = `${BASE_URL}${basePath}?page=${page}`;

      try {
        const html = await fetchHtml(url);

        if (isCfBlocked(html)) {
          const msg = 'Bị chặn bởi Cloudflare Bot Management. Cần proxy hoặc headless browser.';
          console.error(`   ❌ ${msg}`);
          return {
            source: 'muaban', ok: false, listings, total: 0,
            durationMs: Date.now() - start,
            error: msg,
            warning: 'Set SCRAPER_PROXY_URL=https://your-proxy/get?url= hoặc dùng Puppeteer để bypass Cloudflare',
          };
        }

        const pageListings = parseListings(html, 'muaban');
        listings.push(...pageListings);
        console.log(`   ✅ Trang ${page}: ${pageListings.length} items`);

        if (page < this.cfg.maxPages) await sleep(this.cfg.delayMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Trang ${page} lỗi: ${msg}`);
        if (page === 1) {
          return { source: 'muaban', ok: false, listings, total: 0, durationMs: Date.now() - start, error: msg };
        }
        break;
      }
    }

    return { source: 'muaban', ok: listings.length > 0, listings, total: listings.length, durationMs: Date.now() - start };
  }
}
