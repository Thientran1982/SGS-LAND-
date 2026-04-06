/**
 * Migration 021 — Allow guest (anonymous) AI feedback
 *
 * ai_feedback.tenant_id was NOT NULL with FK → tenants.
 * We relax this to allow NULL so unauthenticated users on the
 * public valuation page can submit RLHF feedback without a JWT.
 *
 * Changes:
 *  1. DROP NOT NULL constraint on ai_feedback.tenant_id
 *  2. Recreate the RLS policy with an explicit WITH CHECK that also
 *     permits rows where tenant_id IS NULL (anonymous/guest feedback).
 *     The USING clause is unchanged — guests cannot read rows via RLS;
 *     only the owning tenant (or super-admin) can see their data.
 */
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow guest/anonymous feedback on ai_feedback (nullable tenant_id)',

  async up(client) {
    // 1. Drop FK so we can change nullability
    await client.query(`
      ALTER TABLE ai_feedback
        DROP CONSTRAINT IF EXISTS ai_feedback_tenant_id_fkey;
    `);

    // 2. Allow NULL
    await client.query(`
      ALTER TABLE ai_feedback
        ALTER COLUMN tenant_id DROP NOT NULL;
    `);

    // 3. Re-add FK (nullable FK is valid in PostgreSQL — NULL means no tenant)
    await client.query(`
      ALTER TABLE ai_feedback
        ADD CONSTRAINT ai_feedback_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    `);

    // 4. Recreate RLS policy: SELECT/UPDATE/DELETE still tenant-isolated,
    //    but INSERT allows NULL tenant_id (guest feedback).
    await client.query(`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS ai_feedback_tenant_isolation ON ai_feedback;
        CREATE POLICY ai_feedback_tenant_isolation ON ai_feedback
          USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
          WITH CHECK (
            tenant_id IS NULL
            OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
          );
      END $$;
    `);
  },

  async down(client) {
    // Restore original strict policy
    await client.query(`
      DO $$
      BEGIN
        DROP POLICY IF EXISTS ai_feedback_tenant_isolation ON ai_feedback;
        CREATE POLICY ai_feedback_tenant_isolation ON ai_feedback
          USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      END $$;
    `);

    // Remove rows with NULL tenant_id before re-adding NOT NULL
    await client.query(`DELETE FROM ai_feedback WHERE tenant_id IS NULL;`);

    await client.query(`
      ALTER TABLE ai_feedback
        DROP CONSTRAINT IF EXISTS ai_feedback_tenant_id_fkey;
    `);
    await client.query(`
      ALTER TABLE ai_feedback
        ALTER COLUMN tenant_id SET NOT NULL;
    `);
    await client.query(`
      ALTER TABLE ai_feedback
        ADD CONSTRAINT ai_feedback_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  },
};

export default migration;
