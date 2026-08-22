import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Persist notification delivery failures for operator recovery',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_operational_events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        event_type  VARCHAR(100) NOT NULL,
        payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by VARCHAR(255),
        created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_operational_events_tenant
        ON notification_operational_events (tenant_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_operational_events_open
        ON notification_operational_events (tenant_id, created_at DESC)
        WHERE resolved_at IS NULL;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS notification_operational_events;');
  },
};

export default migration;