import { SgsLandScraper } from './scraper.js';
import { ScraperConfig, ScrapeResult } from './types.js';
import { exportJson, exportCsv, printStats } from './exporters.js';

export interface SchedulerOptions {
  config:       Partial<ScraperConfig>;
  intervalMin:  number;
  outDir:       string;
  format:       'json' | 'csv' | 'both';
  onResult?:    (result: ScrapeResult) => void;
}

// ── Run one scrape cycle ───────────────────────────────────────────────────────

async function runCycle(opts: SchedulerOptions): Promise<void> {
  const scraper = new SgsLandScraper(opts.config);

  try {
    const result = await scraper.scrapeAll();
    printStats(result);

    if (opts.format === 'json' || opts.format === 'both') exportJson(result, opts.outDir);
    if (opts.format === 'csv'  || opts.format === 'both') exportCsv(result,  opts.outDir);

    opts.onResult?.(result);
  } catch (err) {
    console.error('❌ Scrape cycle failed:', err);
  }
}

// ── Scheduler: run immediately, then repeat every N minutes ───────────────────

export async function startScheduler(opts: SchedulerOptions): Promise<void> {
  const intervalMs = opts.intervalMin * 60 * 1000;

  console.log(`\n⏰ Scheduler khởi động — interval: ${opts.intervalMin} phút`);
  console.log(`   Output: ${opts.outDir} | Format: ${opts.format}`);

  // Run immediately
  await runCycle(opts);

  // Schedule repeating
  const timer = setInterval(async () => {
    console.log(`\n🔄 [${new Date().toLocaleTimeString('vi-VN')}] Chạy scrape định kỳ...`);
    await runCycle(opts);
  }, intervalMs);

  // Graceful shutdown
  process.on('SIGINT',  () => { clearInterval(timer); console.log('\n👋 Scheduler stopped.'); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
}
