import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  // Add UNIQUE constraint safely using DO block
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_sequence_lead_enrollment'
      ) THEN
        ALTER TABLE sequence_enrollments
          ADD CONSTRAINT unique_sequence_lead_enrollment
          UNIQUE (sequence_id, lead_email);
      END IF;
    END $$;
  `);
  // Create index if not exists (standard syntax supported)
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_seq_enrollments_lead_email
      ON sequence_enrollments(tenant_id, lead_email);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE sequence_enrollments DROP CONSTRAINT IF EXISTS unique_sequence_lead_enrollment;`);
  await client.query(`DROP INDEX IF EXISTS idx_seq_enrollments_lead_email;`);
}

export default { up, down, description: 'Add UNIQUE constraint and index to sequence_enrollments' };
