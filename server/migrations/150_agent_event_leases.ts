import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Durable agent event priorities, leases and dead-letter timestamps',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_operating_events
        ADD COLUMN IF NOT EXISTS urgency INTEGER NOT NULL DEFAULT 50,
        ADD COLUMN IF NOT EXISTS lease_token UUID,
        ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_agent_events_worker
        ON agent_operating_events (status, urgency DESC, available_at, created_at);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP INDEX IF EXISTS idx_agent_events_worker;
      ALTER TABLE agent_operating_events
        DROP COLUMN IF EXISTS dead_lettered_at,
        DROP COLUMN IF EXISTS lease_expires_at,
        DROP COLUMN IF EXISTS lease_token,
        DROP COLUMN IF EXISTS urgency;
    `);
  },
};

export default migration;