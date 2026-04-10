import fs   from 'fs';
import path from 'path';
import { ScrapeResult, Listing } from './types.js';

// ── JSON export ───────────────────────────────────────────────────────────────

export function exportJson(result: ScrapeResult, outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(outDir, `listings-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
  console.log(`💾 JSON → ${file} (${result.listings.length} listings)`);
  return file;
}

// ── CSV export ────────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'id', 'code', 'title', 'type', 'status', 'transaction',
  'price', 'pricePerM2', 'currency', 'area',
  'location', 'lat', 'lng',
  'bedrooms', 'bathrooms',
  'direction', 'frontage', 'legalStatus', 'furniture',
  'isVerified', 'viewCount',
  'contactPhone', 'projectCode',
  'url',
  'valuation_pricePerM2', 'valuation_confidence', 'valuation_trendText',
  'createdAt', 'updatedAt',
] as const;

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function listingToCsvRow(l: Listing): string {
  return [
    l.id, l.code, l.title, l.type, l.status, l.transaction,
    l.price, l.pricePerM2, l.currency, l.area,
    l.location, l.lat ?? '', l.lng ?? '',
    l.bedrooms ?? '', l.bathrooms ?? '',
    l.direction ?? '', l.frontage ?? '', l.legalStatus ?? '', l.furniture ?? '',
    l.isVerified, l.viewCount,
    l.contactPhone ?? '',
    l.projectCode ?? '',
    l.url,
    l.valuation?.pricePerM2  ?? '',
    l.valuation?.confidence  ?? '',
    l.valuation?.trendText   ?? '',
    l.createdAt, l.updatedAt,
  ].map(csvEscape).join(',');
}

export function exportCsv(result: ScrapeResult, outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(outDir, `listings-${ts}.csv`);

  const lines = [
    CSV_HEADERS.join(','),
    ...result.listings.map(listingToCsvRow),
  ];
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`📊 CSV → ${file} (${result.listings.length} rows)`);
  return file;
}

// ── Stats summary ─────────────────────────────────────────────────────────────

export function printStats(result: ScrapeResult): void {
  const { stats } = result;
  const fmt = (n: number) => (n / 1e9).toFixed(2) + ' tỷ';

  console.log('\n' + '═'.repeat(55));
  console.log('  📈 KẾT QUẢ SCRAPE SGSLAND.VN');
  console.log('═'.repeat(55));
  console.log(`  Tổng listings     : ${stats.totalListings}`);
  console.log(`  Đã xác minh       : ${stats.verifiedCount}`);
  console.log(`  Thời gian          : ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log('');
  console.log('  Phân loại sản phẩm:');
  for (const [k, v] of Object.entries(stats.byType).sort(([,a],[,b]) => b-a)) {
    console.log(`    ${k.padEnd(15)}: ${v}`);
  }
  console.log('');
  console.log('  Giao dịch:');
  for (const [k, v] of Object.entries(stats.byTransaction)) {
    console.log(`    ${k.padEnd(15)}: ${v}`);
  }
  console.log('');
  console.log('  Thống kê giá:');
  console.log(`    Min  : ${fmt(stats.price.min)}`);
  console.log(`    Max  : ${fmt(stats.price.max)}`);
  console.log(`    Avg  : ${fmt(stats.price.avg)}`);
  console.log(`    P25  : ${fmt(stats.price.p25)}`);
  console.log(`    P50  : ${fmt(stats.price.median)}`);
  console.log(`    P75  : ${fmt(stats.price.p75)}`);
  console.log('');
  console.log('  Thống kê diện tích (m²):');
  console.log(`    Min  : ${stats.area.min}`);
  console.log(`    Max  : ${stats.area.max}`);
  console.log(`    Avg  : ${stats.area.avg}`);
  console.log('');
  console.log('  Top 10 khu vực:');
  for (const { location, count } of stats.topLocations) {
    console.log(`    ${location.substring(0, 35).padEnd(35)}: ${count}`);
  }
  if (result.errors.length) {
    console.log('');
    console.log(`  ⚠️  Lỗi: ${result.errors.length}`);
    result.errors.forEach(e => console.log(`    ${e.url}: ${e.error}`));
  }
  console.log('═'.repeat(55));
}
