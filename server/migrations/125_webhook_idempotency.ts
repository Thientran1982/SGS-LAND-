import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * Durable webhook/event deduplication. A short processing lease allows a
 * crashed worker to retry while preventing concurrent QStash deliveries from
 * creating duplicate CRM interactions or outbound replies.
 */
const migration: Migration = {
  description: 'Add durable webhook event claims and external interaction IDs for idempotent retries',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        event_key TEXT NOT NULL,
        tenant_id UUID,
        status TEXT NOT NULL DEFAULT 'PROCESSING'
          CHECK (status IN ('PROCESSING', 'PROCESSED')),
        attempts INTEGER NOT NULL DEFAULT 1,
        locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (platform, event_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_events_lease
      ON webhook_events (status, locked_at)
    `);
    await client.query(`ALTER TABLE interactions ADD COLUMN IF NOT EXISTS external_event_id TEXT`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_interactions_external_event
      ON interactions (tenant_id, channel, external_event_id)
      WHERE external_event_id IS NOT NULL
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS ux_interactions_external_event');
    await client.query('ALTER TABLE interactions DROP COLUMN IF EXISTS external_event_id');
    await client.query('DROP TABLE IF EXISTS webhook_events');
  },
};

export default migration;