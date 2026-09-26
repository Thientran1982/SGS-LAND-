import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Activate valid lead sequences and backfill consented leads without sending immediately',
  async up(client: PoolClient) {
    await client.query(`
      DELETE FROM sequence_enrollments a
       USING sequence_enrollments b
       WHERE a.ctid < b.ctid
         AND a.sequence_id = b.sequence_id
         AND lower(a.lead_email) = lower(b.lead_email)
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'sequence_enrollments'::regclass
             AND conname = 'unique_sequence_lead_enrollment'
        ) THEN
          ALTER TABLE sequence_enrollments
            ADD CONSTRAINT unique_sequence_lead_enrollment UNIQUE (sequence_id, lead_email);
        END IF;
      END $$;
    `);
    await client.query(`
      UPDATE sequences
         SET is_active = true, updated_at = NOW()
       WHERE jsonb_array_length(COALESCE(steps, '[]'::jsonb)) > 0
         AND trigger_event IN ('NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'PROPOSAL', 'NEGOTIATION', 'WON')
    `);
    await client.query(`
      INSERT INTO sequence_enrollments
        (tenant_id, sequence_id, lead_email, lead_name, step_index, status)
      SELECT s.tenant_id, s.id, l.email, l.name, 0, 'PENDING'
        FROM sequences s
        JOIN leads l ON l.tenant_id = s.tenant_id
       WHERE s.is_active = true
         AND s.trigger_event = l.stage
         AND jsonb_array_length(COALESCE(s.steps, '[]'::jsonb)) > 0
         AND l.email IS NOT NULL
         AND COALESCE(l.marketing_email_consent, false) = true
         AND NOT (COALESCE(l.opt_out_channels, '[]'::jsonb) @> '"email"'::jsonb)
      ON CONFLICT (sequence_id, lead_email) DO NOTHING
    `);
  },
};

export default migration;