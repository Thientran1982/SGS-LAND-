/**
 * SGSLand Scraper v2.0 — CLI entry point
 *
 * Usage:
 *   npx tsx src/main.ts                          # scrape once → JSON
 *   npx tsx src/main.ts --format=csv             # scrape once → CSV
 *   npx tsx src/main.ts --format=both            # scrape once → JSON + CSV
 *   npx tsx src/main.ts --mode=schedule --interval=30  # every 30 phút
 *   npx tsx src/main.ts --type=Villa             # filter loại BĐS
 *   npx tsx src/main.ts --transaction=SALE       # chỉ lấy bán
 *   npx tsx src/main.ts --location="Đồng Nai"   # filter khu vực
 *   npx tsx src/main.ts --valuation              # kèm định giá AI
 *   npx tsx src/main.ts --pageSize=50 --delay=1000
 */

import { SgsLandScraper } from './scraper.js';
import { exportJson, exportCsv, printStats } from './exporters.js';
import { startScheduler } from './scheduler.js';
import { ListingFilters, ScraperConfig } from './types.js';

// ── Parse CLI args ────────────────────────────────────────────────────────────

function parseArgs(): {
  mode:       'once' | 'schedule';
  intervalMin: number;
  format:     'json' | 'csv' | 'both';
  outDir:     string;
  config:     Partial<ScraperConfig>;
} {
  const args   = process.argv.slice(2);
  const get    = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=');
  const has    = (key: string) => args.includes(`--${key}`);

  const filters: ListingFilters = {};
  const type        = get('type');
  const transaction = get('transaction');
  const location    = get('location');
  const minPrice    = get('minPrice');
  const maxPrice    = get('maxPrice');
  const minArea     = get('minArea');
  const maxArea     = get('maxArea');
  const search      = get('search');

  if (type)        filters.type        = type;
  if (transaction) filters.transaction = transaction;
  if (location)    filters.location    = location;
  if (minPrice)    filters.minPrice    = Number(minPrice);
  if (maxPrice)    filters.maxPrice    = Number(maxPrice);
  if (minArea)     filters.minArea     = Number(minArea);
  if (maxArea)     filters.maxArea     = Number(maxArea);
  if (search)      filters.search      = search;
  if (has('verified')) filters.isVerified = true;

  const config: Partial<ScraperConfig> = {
    ...(Object.keys(filters).length ? { filters } : {}),
    ...(get('pageSize') ? { pageSize: Number(get('pageSize')) } : {}),
    ...(get('delay')    ? { delayMs:  Number(get('delay'))    } : {}),
    ...(has('valuation') ? { enrichWithValuation: true }        : {}),
  };

  const rawFormat = get('format') ?? 'json';
  const format = (rawFormat === 'csv' || rawFormat === 'both') ? rawFormat : 'json';

  return {
    mode:        (get('mode') === 'schedule') ? 'schedule' : 'once',
    intervalMin: Number(get('interval') ?? '30'),
    format,
    outDir:      get('out') ?? './output',
    config,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { mode, intervalMin, format, outDir, config } = parseArgs();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   SGSLand Scraper v2.0 — sgsland.vn          ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (mode === 'schedule') {
    await startScheduler({ config, intervalMin, outDir, format });
    return;
  }

  // Single run
  const scraper = new SgsLandScraper(config);
  const result  = await scraper.scrapeAll();

  printStats(result);

  if (format === 'json' || format === 'both') exportJson(result, outDir);
  if (format === 'csv'  || format === 'both') exportCsv(result,  outDir);

  console.log('\n✅ Done.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
