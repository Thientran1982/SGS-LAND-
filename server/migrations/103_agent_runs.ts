import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Unified audit trail for all background agents/crons — agent_runs (started_at, finished_at, status, duration_ms, summary_json, error_text, trigger_source).',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_name      TEXT         NOT NULL,
        trigger_source  TEXT         NOT NULL DEFAULT 'unknown',
        status          TEXT         NOT NULL CHECK (status IN ('running','success','error','skipped')),
        started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        finished_at     TIMESTAMPTZ  NULL,
        duration_ms     INTEGER      NULL,
        summary_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
        error_text      TEXT         NULL,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_started
        ON agent_runs(agent_name, started_at DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_runs_started_desc
        ON agent_runs(started_at DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_runs_status_started
        ON agent_runs(status, started_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS agent_runs;`);
  },
};

export default migration;
