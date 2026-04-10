/**
 * SGSLand External Scraper — Thu thập dữ liệu từ 4 trang BĐS
 *
 * Usage:
 *   npx tsx src/main-external.ts                        # tất cả nguồn đang hoạt động
 *   npx tsx src/main-external.ts --source=chotot        # chỉ Chợ Tốt ✅
 *   npx tsx src/main-external.ts --source=alonhadat     # chỉ AlonNhaDat ✅
 *   npx tsx src/main-external.ts --source=batdongsan    # BatDongSan ⚠️ CF
 *   npx tsx src/main-external.ts --source=muaban        # Muaban.net ⚠️ CF
 *   npx tsx src/main-external.ts --source=all           # tất cả 4 nguồn
 *   npx tsx src/main-external.ts --province="Hồ Chí Minh"
 *   npx tsx src/main-external.ts --transaction=RENT
 *   npx tsx src/main-external.ts --pages=5
 *   npx tsx src/main-external.ts --format=csv
 *   npx tsx src/main-external.ts --format=both
 *
 * Bypass Cloudflare (batdongsan, muaban):
 *   SCRAPER_PROXY_URL="https://your-proxy/get?url=" npx tsx src/main-external.ts --source=batdongsan
 */

import fs   from 'fs';
import path from 'path';
import {
  ChototScraper, BatDongSanScraper, MuabanScraper, AlonNhaDatScraper,
  ExternalScraperConfig, ExternalListing, SourceResult,
} from './sources/index.js';

// ── Parse args ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const get     = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');

const source      = get('source') ?? 'working';
const province    = get('province');
const keyword     = get('keyword');
const transaction = get('transaction') as 'SALE' | 'RENT' | undefined;
const maxPages    = Number(get('pages') ?? '3');
const delayMs     = Number(get('delay') ?? '900');
const format      = get('format') ?? 'json';
const outDir      = get('out')    ?? './output';

const cfg: Partial<ExternalScraperConfig> = {
  maxPages,
  delayMs,
  ...(province    ? { province }    : {}),
  ...(keyword     ? { keyword }     : {}),
  ...(transaction ? { transaction } : {}),
};

// ── Scrape ────────────────────────────────────────────────────────────────────

async function runSource(src: string): Promise<SourceResult | null> {
  switch (src) {
    case 'chotot':     return new ChototScraper(cfg).scrape();
    case 'batdongsan': return new BatDongSanScraper(cfg).scrape();
    case 'muaban':     return new MuabanScraper(cfg).scrape();
    case 'alonhadat':  return new AlonNhaDatScraper(cfg).scrape();
    default: return null;
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────

const CSV_COLS = [
  'id','source','title','type','transaction','price','priceDisplay','currency',
  'area','pricePerM2','location','province','district','lat','lng',
  'bedrooms','bathrooms','floors','frontage','description','imageUrl','url','postedAt','scrapedAt',
] as const;

function toCSV(listings: ExternalListing[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLS.join(','), ...listings.map(l => CSV_COLS.map(c => esc(l[c])).join(','))].join('\n');
}

// ── Print summary ─────────────────────────────────────────────────────────────

function printSummary(results: SourceResult[]): void {
  const all   = results.flatMap(r => r.listings);
  const total = all.reduce((s, _) => s + 1, 0);
  const prices = all.map(l => l.price).filter(p => p > 0).sort((a, b) => a - b);
  const avg   = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  console.log('\n' + '═'.repeat(58));
  console.log('  📊 TỔNG HỢP TỪ 4 TRANG BẤT ĐỘNG SẢN');
  console.log('═'.repeat(58));

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    const ms   = (r.durationMs / 1000).toFixed(1);
    console.log(`  ${icon} ${r.source.padEnd(15)} : ${String(r.listings.length).padStart(4)} listings (${ms}s)`);
    if (r.error)   console.log(`       ⚠️  ${r.error.substring(0, 80)}`);
    if (r.warning) console.log(`       💡 ${r.warning.substring(0, 80)}`);
  }

  console.log('');
  console.log(`  Tổng cộng     : ${total} listings`);
  if (prices.length) {
    console.log(`  Giá avg       : ${(avg / 1e9).toFixed(2)} tỷ VND`);
    console.log(`  Giá min/max   : ${(prices[0] / 1e9).toFixed(2)} – ${(prices[prices.length-1] / 1e9).toFixed(2)} tỷ`);
  }

  // By type
  const byType: Record<string, number> = {};
  for (const l of all) byType[l.type] = (byType[l.type] ?? 0) + 1;
  if (Object.keys(byType).length) {
    console.log('');
    console.log('  Loại BĐS:');
    for (const [k, v] of Object.entries(byType).sort(([, a], [, b]) => b - a)) {
      console.log(`    ${k.padEnd(15)}: ${v}`);
    }
  }

  // By province
  const byProv: Record<string, number> = {};
  for (const l of all) if (l.province) byProv[l.province] = (byProv[l.province] ?? 0) + 1;
  if (Object.keys(byProv).length) {
    console.log('');
    console.log('  Tỉnh/Thành:');
    for (const [k, v] of Object.entries(byProv).sort(([, a], [, b]) => b - a).slice(0, 8)) {
      console.log(`    ${k.substring(0,20).padEnd(20)}: ${v}`);
    }
  }

  console.log('═'.repeat(58));
}

// ── Save output ───────────────────────────────────────────────────────────────

function saveOutput(results: SourceResult[], fmt: string, dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const all = results.flatMap(r => r.listings);

  if (fmt === 'json' || fmt === 'both') {
    const file = path.join(dir, `external-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify({ scrapedAt: new Date().toISOString(), sources: results.map(r => ({ source: r.source, ok: r.ok, count: r.listings.length, error: r.error })), total: all.length, listings: all }, null, 2));
    console.log(`💾 JSON → ${file} (${all.length} listings)`);
  }
  if (fmt === 'csv' || fmt === 'both') {
    const file = path.join(dir, `external-${ts}.csv`);
    fs.writeFileSync(file, toCSV(all));
    console.log(`📊 CSV → ${file} (${all.length} rows)`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  SGSLand External Scraper — BatDongSan, Chotot,     ║');
  console.log('║  Muaban.net, AlonNhaDat                              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Source: ${source} | Pages: ${maxPages} | Delay: ${delayMs}ms`);
  if (province)    console.log(`  Province: ${province}`);
  if (transaction) console.log(`  Transaction: ${transaction}`);

  // Choose which sources to run
  let sources: string[];
  switch (source) {
    case 'all':     sources = ['chotot', 'alonhadat', 'batdongsan', 'muaban']; break;
    case 'working': sources = ['chotot', 'alonhadat']; break;
    default:        sources = [source]; break;
  }

  const results: SourceResult[] = [];

  for (const src of sources) {
    const result = await runSource(src);
    if (result) results.push(result);
  }

  printSummary(results);
  saveOutput(results, format, outDir);

  console.log('\n✅ Done.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
