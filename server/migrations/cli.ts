/**
 * Migration CLI — run directly via:
 *   npx tsx server/migrations/cli.ts
 *   npx tsx server/migrations/cli.ts --dry-run
 *   npx tsx server/migrations/cli.ts --rollback
 *
 * This is kept separate from runner.ts so that runner.ts can be safely
 * bundled into server.js (via esbuild) without the CLI guard triggering
 * process.exit() when the bundle starts.
 */
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runPendingMigrations, rollbackLastMigration } from './runner';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');
const isRollback = process.argv.includes('--rollback');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const action = isRollback
  ? rollbackLastMigration(pool)
  : runPendingMigrations(pool, isDryRun);

action
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
