import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Operator audit events for social publication reconciliation and recovery',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_publication_events (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36) NOT NULL,
        publication_id  UUID NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
        target_id       UUID REFERENCES social_publication_targets(id) ON DELETE CASCADE,
        actor_id        UUID,
        event_type      VARCHAR(64) NOT NULL,
        from_status     VARCHAR(32),
        to_status       VARCHAR(32),
        reason          TEXT,
        metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_social_publication_events_publication
        ON social_publication_events(tenant_id, publication_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_social_publication_events_target
        ON social_publication_events(tenant_id, target_id, created_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS social_publication_events');
  },
};

export default migration;