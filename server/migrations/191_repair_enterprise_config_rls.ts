import type { PoolClient } from 'pg';

const POLICY_NAME = 'enterprise_config_tenant_isolation';

export default {
  id: '191_repair_enterprise_config_rls',
  description: 'Repair enterprise config RLS tenant comparison for typed session settings',
  async up(client: PoolClient): Promise<void> {
    const table = await client.query(
      `SELECT 1 FROM pg_class WHERE relname = 'enterprise_config' AND relkind = 'r'`,
    );
    if (!table.rowCount) return;

    const policies = await client.query(
      `SELECT policyname FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'enterprise_config'`,
    );
    for (const row of policies.rows as Array<{ policyname: string }>) {
      const policyName = row.policyname.replace(/"/g, '""');
      await client.query(`DROP POLICY IF EXISTS "${policyName}" ON enterprise_config`);
    }

    await client.query('ALTER TABLE enterprise_config ENABLE ROW LEVEL SECURITY');
    await client.query('ALTER TABLE enterprise_config FORCE ROW LEVEL SECURITY');
    await client.query(`
      CREATE POLICY ${POLICY_NAME} ON enterprise_config
        AS PERMISSIVE
        FOR ALL
        TO PUBLIC
        USING (
          tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
          tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.bypass_rls', true) = 'on'
        )
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON enterprise_config`);
    await client.query(`
      CREATE POLICY tenant_isolation_policy ON enterprise_config FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
  },
};