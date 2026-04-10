import {
  Listing, RawListing, ValuationTeaser,
  PaginatedResponse, ScraperConfig, ScrapeResult, ScrapeStats,
  PriceStats, AreaStats,
} from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

// ── Normalize raw API listing → clean Listing ─────────────────────────────────

function normalizeListing(raw: RawListing, baseUrl: string): Listing {
  const area       = raw.area ?? 0;
  const price      = raw.price ?? 0;
  const pricePerM2 = area > 0 ? Math.round(price / area) : 0;
  const attrs      = raw.attributes ?? {};

  return {
    id:           raw.id,
    code:         raw.code,
    title:        raw.title,
    type:         raw.type,
    status:       raw.status,
    transaction:  raw.transaction,
    price,
    pricePerM2,
    currency:     raw.currency ?? 'VND',
    area,
    location:     raw.location ?? '',
    lat:          raw.coordinates?.lat ?? null,
    lng:          raw.coordinates?.lng ?? null,
    isVerified:   raw.isVerified ?? false,
    viewCount:    raw.viewCount ?? 0,
    bedrooms:     raw.bedrooms ?? null,
    bathrooms:    raw.bathrooms ?? null,
    direction:    attrs.direction ?? null,
    frontage:     attrs.frontage ?? null,
    legalStatus:  attrs.legalStatus ?? null,
    furniture:    attrs.furniture ?? null,
    contactPhone: raw.contactPhone ?? null,
    images:       (raw.images ?? []).map(img =>
                    img.startsWith('http') ? img : `${baseUrl}${img}`),
    url:          `${baseUrl}/listing/${raw.id}`,
    projectCode:  raw.projectCode ?? null,
    createdAt:    raw.createdAt,
    updatedAt:    raw.updatedAt,
    valuation:    undefined,
  };
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(listings: Listing[]): ScrapeStats {
  const byType:        Record<string, number> = {};
  const byTransaction: Record<string, number> = {};
  const byStatus:      Record<string, number> = {};
  const locationCount: Record<string, number> = {};

  const prices: number[] = [];
  const areas:  number[] = [];

  for (const l of listings) {
    byType[l.type]               = (byType[l.type] ?? 0) + 1;
    byTransaction[l.transaction] = (byTransaction[l.transaction] ?? 0) + 1;
    byStatus[l.status]           = (byStatus[l.status] ?? 0) + 1;

    const locKey = l.location.split(',').slice(-2).join(',').trim();
    locationCount[locKey] = (locationCount[locKey] ?? 0) + 1;

    if (l.price > 0)  prices.push(l.price);
    if (l.area  > 0)  areas.push(l.area);
  }

  prices.sort((a, b) => a - b);
  areas.sort((a, b) => a - b);

  const priceStats: PriceStats = prices.length ? {
    min:    prices[0],
    max:    prices[prices.length - 1],
    avg:    Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    median: percentile(prices, 50),
    p25:    percentile(prices, 25),
    p75:    percentile(prices, 75),
  } : { min: 0, max: 0, avg: 0, median: 0, p25: 0, p75: 0 };

  const areaStats: AreaStats = areas.length ? {
    min: areas[0],
    max: areas[areas.length - 1],
    avg: Math.round(areas.reduce((a, b) => a + b, 0) / areas.length),
  } : { min: 0, max: 0, avg: 0 };

  const topLocations = Object.entries(locationCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  return {
    totalListings:  listings.length,
    verifiedCount:  listings.filter(l => l.isVerified).length,
    byType,
    byTransaction,
    byStatus,
    price:          priceStats,
    area:           areaStats,
    topLocations,
  };
}

// ── Default config ────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: ScraperConfig = {
  baseUrl:             'https://sgsland.vn',
  pageSize:            20,
  delayMs:             800,
  maxRetries:          3,
  enrichWithValuation: false,
};

// ── Core Scraper Class ────────────────────────────────────────────────────────

export class SgsLandScraper {
  private cfg:         ScraperConfig;
  private listingsUrl: string;
  private valuationUrl: string;
  private errors:      Array<{ url: string; error: string }> = [];

  constructor(config: Partial<ScraperConfig> = {}) {
    this.cfg          = { ...DEFAULT_CONFIG, ...config };
    this.listingsUrl  = `${this.cfg.baseUrl}/api/public/listings`;
    this.valuationUrl = `${this.cfg.baseUrl}/api/valuation/teaser`;
  }

  // ── HTTP fetch with retry ─────────────────────────────────────────

  private async fetchJSON<T = unknown>(url: string): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= this.cfg.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            'Accept':        'application/json',
            'User-Agent':    'SGSLand-Scraper/2.0 (internal-tool)',
            'Cache-Control': 'no-cache',
          },
        });

        if (res.status === 429) {
          const wait = this.cfg.delayMs * Math.pow(2, attempt);
          console.warn(`  ⏳ Rate limited. Chờ ${wait}ms...`);
          await sleep(wait);
          continue;
        }

        if (res.status === 503) {
          const wait = this.cfg.delayMs * attempt;
          console.warn(`  ⚠️  503 Service Unavailable. Chờ ${wait}ms... (attempt ${attempt}/${this.cfg.maxRetries})`);
          await sleep(wait);
          continue;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return await res.json() as T;

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.cfg.maxRetries) {
          console.warn(`  ↩️  Attempt ${attempt} failed: ${lastError.message}. Retry...`);
          await sleep(this.cfg.delayMs * attempt);
        }
      }
    }

    this.errors.push({ url, error: lastError.message });
    throw lastError;
  }

  // ── Build paginated URL ───────────────────────────────────────────

  private buildListingsUrl(page: number): string {
    const p = new URLSearchParams({
      page:     String(page),
      pageSize: String(this.cfg.pageSize),
    });

    const f = this.cfg.filters ?? {};
    if (f.type)                 p.set('type',        f.type);
    if (f.transaction)          p.set('transaction', f.transaction);
    if (f.location)             p.set('location',    f.location);
    if (f.minPrice !== undefined) p.set('minPrice',  String(f.minPrice));
    if (f.maxPrice !== undefined) p.set('maxPrice',  String(f.maxPrice));
    if (f.minArea  !== undefined) p.set('minArea',   String(f.minArea));
    if (f.maxArea  !== undefined) p.set('maxArea',   String(f.maxArea));
    if (f.isVerified)           p.set('isVerified',  'true');
    if (f.search)               p.set('search',      f.search);

    return `${this.listingsUrl}?${p.toString()}`;
  }

  // ── Valuation enrichment ──────────────────────────────────────────

  async fetchValuation(location: string, area: number): Promise<ValuationTeaser | null> {
    if (!location || !area) return null;
    try {
      const url = `${this.valuationUrl}?location=${encodeURIComponent(location)}&area=${area}`;
      const data = await this.fetchJSON<ValuationTeaser>(url);
      return data.found ? data : null;
    } catch {
      return null;
    }
  }

  // ── Main scrape ───────────────────────────────────────────────────

  async scrapeAll(): Promise<ScrapeResult> {
    const startTime = Date.now();
    this.errors     = [];

    console.log('\n🚀 Bắt đầu scrape sgsland.vn...');
    console.log(`   Config: pageSize=${this.cfg.pageSize}, delay=${this.cfg.delayMs}ms, enrichValuation=${this.cfg.enrichWithValuation}`);
    if (this.cfg.filters && Object.keys(this.cfg.filters).length) {
      console.log(`   Filters: ${JSON.stringify(this.cfg.filters)}`);
    }

    // Page 1 — lấy metadata pagination
    const firstUrl = this.buildListingsUrl(1);
    console.log(`\n📡 Fetching trang 1...`);
    const firstPage = await this.fetchJSON<PaginatedResponse>(firstUrl);

    const { total, totalPages } = firstPage;
    console.log(`📊 Tổng: ${total} listings / ${totalPages} trang`);

    const allRaw: RawListing[] = [...(firstPage.data ?? [])];
    console.log(`   ✅ Trang 1/${totalPages}: ${firstPage.data?.length ?? 0} items`);

    // Pages 2..N
    for (let page = 2; page <= totalPages; page++) {
      await sleep(this.cfg.delayMs);
      console.log(`📡 Fetching trang ${page}/${totalPages}...`);
      try {
        const pageData = await this.fetchJSON<PaginatedResponse>(this.buildListingsUrl(page));
        allRaw.push(...(pageData.data ?? []));
        console.log(`   ✅ Trang ${page}/${totalPages}: ${pageData.data?.length ?? 0} items (tổng: ${allRaw.length})`);
      } catch (err) {
        console.error(`   ❌ Trang ${page} thất bại: ${err}`);
      }
    }

    // Normalize
    const listings: Listing[] = allRaw.map(r => normalizeListing(r, this.cfg.baseUrl));
    console.log(`\n✅ Normalized: ${listings.length} listings`);

    // Optional valuation enrichment
    if (this.cfg.enrichWithValuation) {
      console.log(`\n🔬 Enriching với valuation teaser...`);
      let enriched = 0;
      for (const listing of listings) {
        const val = await this.fetchValuation(listing.location, listing.area);
        if (val) {
          listing.valuation = val;
          enriched++;
        }
        await sleep(Math.round(this.cfg.delayMs * 0.5));
      }
      console.log(`   ✅ Enriched: ${enriched}/${listings.length} listings`);
    }

    const durationMs = Date.now() - startTime;
    const stats      = computeStats(listings);

    console.log(`\n🏁 Hoàn thành trong ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`   Total: ${stats.totalListings} | Verified: ${stats.verifiedCount}`);
    console.log(`   Types: ${JSON.stringify(stats.byType)}`);
    console.log(`   Giá avg: ${(stats.price.avg / 1e9).toFixed(2)} tỷ VND`);
    if (this.errors.length) {
      console.warn(`   ⚠️  Errors: ${this.errors.length}`);
    }

    return {
      scrapedAt:  new Date().toISOString(),
      durationMs,
      config:     this.cfg,
      stats,
      listings,
      errors:     this.errors,
    };
  }
}
