/**
 * AlonNhaDat.com.vn scraper
 * Status: ✅ HTML scraping hoạt động — không có Cloudflare
 *
 * URL pattern: /nha-dat/can-ban/nha-dat/[province-slug]/[district-id]/[district-slug].html
 * Listing container: <article class='property-item'>
 * Schema.org: RealEstateListing (structured data)
 */

import * as cheerio from 'cheerio';
import {
  ExternalListing, ExternalScraperConfig, SourceResult,
  DEFAULT_EXTERNAL_CONFIG, sleep, parseVnPrice, parseArea,
} from './types.js';

const BASE_URL = 'https://alonhadat.com.vn';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  'Connection':      'keep-alive',
};

// ── Province slug map (từ sitemap) ────────────────────────────────────────────

export const PROVINCE_SLUGS: Record<string, string> = {
  'Hồ Chí Minh':  'tp-ho-chi-minh',
  'Hà Nội':       'ha-noi',
  'Đà Nẵng':      'da-nang',
  'Đồng Nai':     'dong-nai',
  'Bình Dương':   'binh-duong',
  'Bình Thuận':   'binh-thuan',
  'Cần Thơ':      'can-tho',
  'An Giang':     'an-giang',
  'Bà Rịa':       'ba-ria-vung-tau',
  'Quảng Ninh':   'quang-ninh',
};

// District-level URLs for HCM (most active market)
const HCM_DISTRICTS = [
  { id: 1,  slug: 'quan-1',    name: 'Quận 1' },
  { id: 3,  slug: 'quan-3',    name: 'Quận 3' },
  { id: 7,  slug: 'quan-7',    name: 'Quận 7' },
  { id: 9,  slug: 'quan-9',    name: 'Quận 9' },
  { id: 12, slug: 'quan-12',   name: 'Quận 12' },
  { id: 4,  slug: 'quan-binh-thanh', name: 'Bình Thạnh' },
  { id: 2,  slug: 'quan-thu-duc',    name: 'Thủ Đức' },
];

const DONGNAI_DISTRICTS = [
  { id: 1,  slug: 'thanh-pho-bien-hoa', name: 'Biên Hòa' },
  { id: 4,  slug: 'huyen-long-thanh',   name: 'Long Thành' },
];

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
}

// ── Parse article listing ─────────────────────────────────────────────────────

function parseArticles(
  html:     string,
  province: string,
  district: string,
  trans:    'SALE' | 'RENT',
): ExternalListing[] {
  const $ = cheerio.load(html);
  const listings: ExternalListing[] = [];

  $('article.property-item').each((_, el) => {
    const $el    = $(el);
    const href   = $el.find('a.link').attr('href') ?? '';
    const title  = $el.find('.property-title').text().trim();
    const date   = $el.find('time.created-date').attr('datetime') ?? null;
    const desc   = $el.find('p.brief').text().trim();
    const imgSrc = $el.find('.thumbnail img').attr('src') ?? null;

    // Details
    const det         = $el.find('.property-details');
    const priceRaw    = det.find('.price strong').text().trim() || $el.find('.price').text().trim();
    const areaRaw     = det.find('.area').text().trim() || det.find('.square').text().trim();
    const frontageRaw = det.find('.street-width').text().trim();
    const floorsRaw   = det.find('.floors').text().trim();
    const bedroomRaw  = det.find('.bedroom').text().trim();

    // Address
    const address = det.find('.address').text().trim() || district;

    const price  = parseVnPrice(priceRaw);
    const area   = parseArea(areaRaw);

    // Extract ID from URL slug
    const idMatch = href.match(/(\d{5,})/);
    const externalId = idMatch ? idMatch[1] : href.replace(/[^a-z0-9-]/gi, '').substring(0, 30);

    listings.push({
      id:           `alonhadat-${externalId}`,
      source:       'alonhadat',
      externalId,
      title,
      type:         'House',
      transaction:  trans,
      price,
      priceDisplay: priceRaw,
      currency:     'VND',
      area,
      pricePerM2:   area > 0 ? Math.round(price / area) : 0,
      location:     [address, district, province].filter(Boolean).join(', '),
      province,
      district,
      lat:          null,
      lng:          null,
      bedrooms:     bedroomRaw ? parseInt(bedroomRaw) || null : null,
      bathrooms:    null,
      floors:       floorsRaw ? parseInt(floorsRaw) || null : null,
      frontage:     frontageRaw ? parseFloat(frontageRaw.replace(/[^\d.]/g, '')) || null : null,
      description:  desc.substring(0, 500),
      imageUrl:     imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`) : null,
      url:          href.startsWith('http') ? href : `${BASE_URL}${href}`,
      postedAt:     date,
      scrapedAt:    new Date().toISOString(),
    });
  });

  return listings;
}

// ── Build URL list to scrape ──────────────────────────────────────────────────

function buildUrls(cfg: ExternalScraperConfig): Array<{ url: string; province: string; district: string }> {
  const prefix = cfg.transaction === 'RENT' ? 'cho-thue' : 'can-ban';
  const subtype = cfg.transaction === 'RENT' ? 'cho-thue' : 'nha-dat';

  const provinceSlug = cfg.province
    ? (PROVINCE_SLUGS[cfg.province] ?? cfg.province.toLowerCase().replace(/\s+/g, '-').replace(/[đ]/g, 'd'))
    : null;

  const urls: Array<{ url: string; province: string; district: string }> = [];

  if (provinceSlug === 'tp-ho-chi-minh' || !provinceSlug) {
    for (const d of HCM_DISTRICTS) {
      urls.push({
        url:      `${BASE_URL}/nha-dat/${prefix}/${subtype}/tp-ho-chi-minh/${d.id}/${d.slug}.html`,
        province: 'TP Hồ Chí Minh',
        district: d.name,
      });
    }
  }

  if (provinceSlug === 'dong-nai' || !provinceSlug) {
    for (const d of DONGNAI_DISTRICTS) {
      urls.push({
        url:      `${BASE_URL}/nha-dat/${prefix}/${subtype}/dong-nai/${d.id}/${d.slug}.html`,
        province: 'Đồng Nai',
        district: d.name,
      });
    }
  }

  if (provinceSlug && provinceSlug !== 'tp-ho-chi-minh' && provinceSlug !== 'dong-nai') {
    // Generic province-level URL
    urls.push({
      url:      `${BASE_URL}/nha-dat/${prefix}/${subtype}/${provinceSlug}.html`,
      province: cfg.province ?? '',
      district: '',
    });
  }

  // Apply maxPages as page limit per URL — limit number of district URLs
  return urls.slice(0, Math.max(cfg.maxPages, 2));
}

// ── Scraper class ─────────────────────────────────────────────────────────────

export class AlonNhaDatScraper {
  private cfg: ExternalScraperConfig;

  constructor(config: Partial<ExternalScraperConfig> = {}) {
    this.cfg = { ...DEFAULT_EXTERNAL_CONFIG, ...config };
  }

  async scrape(): Promise<SourceResult> {
    const start = Date.now();
    console.log('\n🏡 [AlonNhaDat] Bắt đầu scrape...');

    const trans    = this.cfg.transaction === 'RENT' ? 'RENT' : 'SALE';
    const urlList  = buildUrls(this.cfg);
    const listings: ExternalListing[] = [];
    let okCount = 0;

    console.log(`   Scrape ${urlList.length} khu vực...`);

    for (const { url, province, district } of urlList) {
      try {
        console.log(`   📡 ${province} / ${district}...`);
        const html     = await fetchHtml(url);
        const pageData = parseArticles(html, province, district, trans);

        listings.push(...pageData);
        okCount++;
        console.log(`      ✅ ${pageData.length} listings`);

        await sleep(this.cfg.delayMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`      ⚠️  Lỗi: ${msg}`);
      }
    }

    const ok = okCount > 0;
    console.log(`   🏁 AlonNhaDat done: ${listings.length} listings (${Date.now() - start}ms)`);

    return {
      source: 'alonhadat', ok, listings, total: listings.length,
      durationMs: Date.now() - start,
      ...(ok ? {} : { error: 'Không scrape được bất kỳ trang nào' }),
    };
  }
}
