import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE agent_role_cards
      ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
      ADD COLUMN IF NOT EXISTS approved_by UUID,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approval_reason TEXT;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE agent_role_cards
      DROP COLUMN IF EXISTS approval_reason,
      DROP COLUMN IF EXISTS approved_at,
      DROP COLUMN IF EXISTS approved_by,
      DROP COLUMN IF EXISTS approval_status;
  `);
}

export default {
  up,
  down,
  description: 'Restore role-card approval columns after the operating table was recreated',
};