import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Social publication jobs, platform targets, and delivery attempts',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_publications (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         VARCHAR(36) NOT NULL,
        listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
        created_by        UUID,
        status            VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        publish_mode      VARCHAR(20) NOT NULL DEFAULT 'NOW',
        scheduled_at      TIMESTAMPTZ,
        content_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
        asset_snapshot    JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_error        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at       TIMESTAMPTZ,
        published_at      TIMESTAMPTZ,
        CONSTRAINT social_publications_status_ck CHECK (
          status IN (
            'DRAFT', 'SCHEDULED', 'PROCESSING', 'PARTIALLY_PUBLISHED',
            'PUBLISHED', 'FAILED', 'CANCELLED'
          )
        ),
        CONSTRAINT social_publications_publish_mode_ck CHECK (
          publish_mode IN ('NOW', 'SCHEDULED')
        ),
        CONSTRAINT social_publications_schedule_ck CHECK (
          (publish_mode = 'NOW' AND scheduled_at IS NULL)
          OR (publish_mode = 'SCHEDULED' AND scheduled_at IS NOT NULL)
        )
      );

      CREATE TABLE IF NOT EXISTS social_publication_targets (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        publication_id        UUID NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
        tenant_id             VARCHAR(36) NOT NULL,
        platform              VARCHAR(40) NOT NULL,
        account_id            VARCHAR(200) NOT NULL DEFAULT 'default',
        status                VARCHAR(32) NOT NULL DEFAULT 'NOT_READY',
        provider_post_id      VARCHAR(500),
        provider_post_url     TEXT,
        provider_request_id   VARCHAR(500),
        attempt_count         INTEGER NOT NULL DEFAULT 0,
        next_retry_at         TIMESTAMPTZ,
        processing_started_at TIMESTAMPTZ,
        last_error_code       VARCHAR(120),
        last_error_message    TEXT,
        published_at          TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT social_publication_targets_status_ck CHECK (
          status IN (
            'NOT_READY', 'PENDING', 'PROCESSING', 'PUBLISHED',
            'FAILED_RETRYABLE', 'FAILED_FINAL', 'AMBIGUOUS', 'CANCELLED'
          )
        ),
        CONSTRAINT social_publication_targets_unique_target
          UNIQUE (publication_id, platform, account_id)
      );

      CREATE TABLE IF NOT EXISTS social_publication_attempts (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_id           UUID NOT NULL REFERENCES social_publication_targets(id) ON DELETE CASCADE,
        attempt_number      INTEGER NOT NULL,
        request_id           VARCHAR(120) NOT NULL,
        provider_request_id  VARCHAR(500),
        status_code          INTEGER,
        result_status        VARCHAR(32) NOT NULL,
        error_code           VARCHAR(120),
        error_message_safe   TEXT,
        started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at          TIMESTAMPTZ,
        CONSTRAINT social_publication_attempts_unique_number
          UNIQUE (target_id, attempt_number)
      );

      CREATE INDEX IF NOT EXISTS idx_social_publications_tenant_created
        ON social_publications(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_social_publications_due
        ON social_publications(status, publish_mode, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_social_publication_targets_due
        ON social_publication_targets(status, next_retry_at, updated_at);
      CREATE INDEX IF NOT EXISTS idx_social_publication_targets_tenant
        ON social_publication_targets(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_social_publication_attempts_target
        ON social_publication_attempts(target_id, attempt_number DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP TABLE IF EXISTS social_publication_attempts;
      DROP TABLE IF EXISTS social_publication_targets;
      DROP TABLE IF EXISTS social_publications;
    `);
  },
};

export default migration;