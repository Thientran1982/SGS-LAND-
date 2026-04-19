import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add approval_status to tenants for gated B2B vendor onboarding',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_approval_status ON tenants(approval_status);
    `);

    await client.query(`
      UPDATE tenants
        SET approval_status = 'APPROVED', approved_at = created_at
        WHERE id = '00000000-0000-0000-0000-000000000001';
    `);

    await client.query(`
      UPDATE tenants t
        SET approval_status = 'APPROVED', approved_at = t.created_at
        FROM users u
        WHERE u.tenant_id = t.id
          AND u.email_verified = TRUE
          AND u.status = 'ACTIVE'
          AND t.id <> '00000000-0000-0000-0000-000000000001';
    `);

    await client.query(`
      UPDATE tenants t
        SET approval_status = 'PENDING_APPROVAL'
        FROM users u
        WHERE u.tenant_id = t.id
          AND u.status = 'PENDING'
          AND t.id <> '00000000-0000-0000-0000-000000000001'
          AND t.approval_status = 'APPROVED';
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS approval_status,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS rejection_reason;
    `);
    await client.query(`DROP INDEX IF EXISTS idx_tenants_approval_status;`);
  },
};

export default migration;
