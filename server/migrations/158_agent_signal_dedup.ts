import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Idempotency and provenance for agent learning signals',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_signals ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
      ALTER TABLE agent_signals ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT 'system';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_signals_dedupe
        ON agent_signals (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_agent_signals_provenance
        ON agent_signals (tenant_id, signal_type, provenance, created_at DESC);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS idx_agent_signals_provenance; DROP INDEX IF EXISTS idx_agent_signals_dedupe; ALTER TABLE agent_signals DROP COLUMN IF EXISTS provenance, DROP COLUMN IF EXISTS dedupe_key;');
  },
};

export default migration;