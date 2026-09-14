import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Persist content-free live-chat latency telemetry across server restarts',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_chat_telemetry_snapshots (
        scope TEXT PRIMARY KEY,
        state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_live_chat_telemetry_snapshots_updated
        ON live_chat_telemetry_snapshots (updated_at DESC);
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS live_chat_telemetry_snapshots;');
  },
};

export default migration;