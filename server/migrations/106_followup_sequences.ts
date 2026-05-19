import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Create follow_up_sequences and follow_up_sends tables for multi-channel D+1/3/5/7 follow-up agent system (Zalo → SMS → Email cascade).',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS follow_up_sequences (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID        NOT NULL,
        lead_id       UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        lead_name     TEXT,
        lead_phone    TEXT,
        lead_email    TEXT,
        lead_zalo_id  TEXT,
        status        TEXT        NOT NULL DEFAULT 'ACTIVE',
        cancel_reason TEXT,
        source        TEXT        NOT NULL DEFAULT 'LIVE_CHAT',
        project_code  TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT follow_up_sequences_status_check
          CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
      );

      CREATE INDEX IF NOT EXISTS idx_fup_seq_tenant
        ON follow_up_sequences (tenant_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_fup_seq_lead
        ON follow_up_sequences (lead_id);

      CREATE TABLE IF NOT EXISTS follow_up_sends (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID        NOT NULL,
        sequence_id  UUID        NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
        lead_id      UUID        NOT NULL,
        day_number   INT         NOT NULL,
        channel      TEXT,
        status       TEXT        NOT NULL DEFAULT 'PENDING',
        message      TEXT,
        sent_at      TIMESTAMPTZ,
        error        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT follow_up_sends_status_check
          CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED')),
        CONSTRAINT follow_up_sends_channel_check
          CHECK (channel IS NULL OR channel IN ('ZALO', 'SMS', 'EMAIL')),
        CONSTRAINT follow_up_sends_day_check
          CHECK (day_number IN (1, 3, 5, 7))
      );

      CREATE INDEX IF NOT EXISTS idx_fup_sends_due
        ON follow_up_sends (tenant_id, status, day_number, created_at)
        WHERE status = 'PENDING';

      CREATE INDEX IF NOT EXISTS idx_fup_sends_seq
        ON follow_up_sends (sequence_id);
    `);

    await client.query(`ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE follow_up_sends ENABLE ROW LEVEL SECURITY`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename = 'follow_up_sequences' AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy
            ON follow_up_sequences FOR ALL TO sgs_app
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
        END IF;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename = 'follow_up_sends' AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy
            ON follow_up_sends FOR ALL TO sgs_app
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
        END IF;
      END $$
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS follow_up_sends`);
    await client.query(`DROP TABLE IF EXISTS follow_up_sequences`);
  },
};

export default migration;
