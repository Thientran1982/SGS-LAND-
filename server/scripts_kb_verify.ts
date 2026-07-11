import { getIndexStats, semanticSearch } from './services/ragService';
import { DEFAULT_TENANT_ID } from './constants';

async function main() {
  const stats = await getIndexStats(DEFAULT_TENANT_ID);
  console.log('=== INDEX STATS ===');
  console.log('Tong chunk:', stats.total, '| So tai lieu (sources):', stats.sources);
  console.log('Theo source_type:', JSON.stringify(stats.byType));

  const queries = [
    { q: 'So hong chung nhieu chu so huu can chu ky ai khi ban', dom: ['legal'] },
    { q: 'Cong thuc tinh tra gop hang thang vay ngan hang', dom: ['finance'] },
    { q: 'Gross yield tot cho dau tu cho thue la bao nhieu', dom: ['market'] },
    { q: 'Ban giao tho khac ban giao hoan thien the nao', dom: ['product'] },
  ];
  for (const { q, dom } of queries) {
    console.log(`\n=== QUERY: "${q}" (domains=${dom}) ===`);
    const res = await semanticSearch(DEFAULT_TENANT_ID, q, 2, undefined, dom);
    if (!res.length) { console.log('  (khong co ket qua)'); continue; }
    for (const r of res) {
      console.log(`  [${r.similarity.toFixed(3)}] ${r.sourceType}/${r.sourceId}: ${String(r.content).slice(0, 90)}...`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error('LOI:', e); process.exit(1); });
