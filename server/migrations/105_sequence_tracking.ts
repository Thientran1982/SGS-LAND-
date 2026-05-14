import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Add sequence_enrollments table to track drip-campaign execution stats (enrolled, opened, clicked) per sequence.',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sequence_enrollments (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID        NOT NULL,
        sequence_id  UUID        NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
        lead_email   TEXT        NOT NULL,
        lead_name    TEXT,
        step_index   INT         NOT NULL DEFAULT 0,
        status       TEXT        NOT NULL DEFAULT 'PENDING',
        sent_at      TIMESTAMPTZ,
        opened_at    TIMESTAMPTZ,
        clicked_at   TIMESTAMPTZ,
        error        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_seq_enroll_seq_id
        ON sequence_enrollments(sequence_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_seq_enroll_tenant
        ON sequence_enrollments(tenant_id)
    `);

    await client.query(`ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename = 'sequence_enrollments'
             AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy
            ON sequence_enrollments FOR ALL TO sgs_app
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
        END IF;
      END $$
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS sequence_enrollments`);
  },
};

export default migration;
