/**
 * Migration runner for the market-listings pipeline.
 *
 * Applies every *.sql file in ./migrations in filename order, tracking applied
 * files in a small `market_migrations` table so it is idempotent. Runs under
 * withRlsBypass so DDL executes with the privileged role.
 *
 * Usage (manual):  tsx server/market/db/migrate.ts
 * Or import { runMarketMigrations } and call from server startup.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withRlsBypass } from '../../db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function runMarketMigrations(isDryRun = false): Promise<string[]> {
  const applied: string[] = [];

  await withRlsBypass(async (client) => {
    if (!isDryRun) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS market_migrations (
          filename    TEXT PRIMARY KEY,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    }

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.report.sql'))
      .sort();

    let done = new Set<string>();
    if (!isDryRun || (await client.query(
      `SELECT to_regclass('public.market_migrations') IS NOT NULL AS exists`,
    )).rows[0]?.exists) {
      const doneRes = await client.query<{ filename: string }>(
        'SELECT filename FROM market_migrations',
      );
      done = new Set(doneRes.rows.map((r) => r.filename));
    }

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      if (isDryRun) {
        const reportPath = path.join(MIGRATIONS_DIR, `${file.replace(/\.sql$/, '')}.report.sql`);
        try {
          const report = await fs.readFile(reportPath, 'utf8');
          console.log(`[market:migrate] preview ${file}:`);
          const reportResult = await client.query(report);
          for (const row of reportResult.rows) console.log(`[market:migrate][dry-run] ${JSON.stringify(row)}`);
        } catch (error: any) {
          if (error?.code !== 'ENOENT') throw error;
        }
        continue;
      }
      console.log(`[market:migrate] applying ${file} ...`);
      await client.query(sql);
      await client.query('INSERT INTO market_migrations (filename) VALUES ($1)', [file]);
      applied.push(file);
    }
  });

  if (applied.length === 0) {
    console.log('[market:migrate] up to date, nothing to apply.');
  } else {
    console.log(`[market:migrate] applied ${applied.length} migration(s):`, applied);
  }
  return applied;
}

// Allow running directly: `tsx server/market/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMarketMigrations(process.argv.includes('--dry-run'))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[market:migrate] FAILED:', err);
      process.exit(1);
    });
}
