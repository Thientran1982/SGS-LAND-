import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add audit-preserving soft archive fields to approval requests',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS archived_by UUID,
        ADD COLUMN IF NOT EXISTS archive_reason TEXT;

      CREATE INDEX IF NOT EXISTS idx_approval_requests_active_pending
        ON approval_requests (tenant_id, requested_at DESC)
        WHERE status = 'PENDING' AND archived_at IS NULL;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP INDEX IF EXISTS idx_approval_requests_active_pending;
      ALTER TABLE approval_requests
        DROP COLUMN IF EXISTS archive_reason,
        DROP COLUMN IF EXISTS archived_by,
        DROP COLUMN IF EXISTS archived_at;
    `);
  },
};

export default migration;