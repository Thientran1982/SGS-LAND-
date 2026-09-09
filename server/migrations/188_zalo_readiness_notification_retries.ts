import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Durable retries for failed Zalo readiness notifications',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS zalo_readiness_notification_retries (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        transition_event_id UUID NOT NULL,
        reason_code         VARCHAR(64) NOT NULL,
        checked_at          TIMESTAMPTZ NOT NULL,
        status              VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        attempt_count       INTEGER NOT NULL DEFAULT 0,
        next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        claimed_until       TIMESTAMPTZ,
        delivered_at        TIMESTAMPTZ,
        exhausted_at        TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT zalo_readiness_notification_retry_status_ck
          CHECK (status IN ('PENDING', 'DELIVERED', 'EXHAUSTED')),
        CONSTRAINT zalo_readiness_notification_retry_attempts_ck
          CHECK (attempt_count >= 0),
        CONSTRAINT zalo_readiness_notification_retry_unique_event
          UNIQUE (tenant_id, transition_event_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_zalo_readiness_notification_retries_due
        ON zalo_readiness_notification_retries (next_attempt_at, created_at)
        WHERE status = 'PENDING';
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_zalo_readiness_notification_retries_tenant
        ON zalo_readiness_notification_retries (tenant_id, created_at DESC);
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS zalo_readiness_notification_retries;');
  },
};

export default migration;