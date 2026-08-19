/**
 * Migration CLI - run directly via:
 *   npx tsx server/migrations/cli.ts
 *   npx tsx server/migrations/cli.ts --dry-run
 *   npx tsx server/migrations/cli.ts --rollback
 *
 * This is kept separate from runner.ts so that runner.ts can be safely
 * bundled into server.js (via esbuild) without the CLI guard triggering
 * process.exit() when the bundle starts.
 */
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../db';
import { runPendingMigrations, rollbackLastMigration } from './runner';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');
const isRollback = process.argv.includes('--rollback');

// Reuse the same configured pool as the running app (server/db.ts) so the
// CLI picks up the same Aiven CA cert / connection-string sanitisation.
// A bare `new Pool({ connectionString: process.env.AIVEN_DATABASE_URL })`
// here previously failed every run with "self-signed certificate in
// certificate chain" because it skipped that setup.
const action = isRollback
  ? rollbackLastMigration(pool)
  : runPendingMigrations(pool, isDryRun);

action
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[migrations] Failed:', error);
    process.exit(1);
  });
