import type { PoolClient } from 'pg';

const PROTECTED_TABLES = [
  'users',
  'leads',
  'listings',
  'projects',
  'contracts',
  'subscriptions',
] as const;

const POLICY_NAME = 'tenant_isolation_v2';

export default {
  id: '069_force_rls',
  description:
    'Enforce RLS at owner level with bypass channel for legitimate cross-tenant reads',
  async up(client: PoolClient): Promise<void> {
    for (const table of PROTECTED_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table]
      );
      if (exists.rowCount === 0) {
        console.warn(`[069_force_rls] Bỏ qua bảng không tồn tại: ${table}`);
        continue;
      }

      const existingPolicies = await client.query(
        `SELECT policyname FROM pg_policies WHERE tablename = $1`,
        [table]
      );
      for (const row of existingPolicies.rows as Array<{ policyname: string }>) {
        await client.query(`DROP POLICY IF EXISTS ${row.policyname} ON ${table}`);
      }

      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      await client.query(`
        CREATE POLICY ${POLICY_NAME} ON ${table}
          AS PERMISSIVE
          FOR ALL
          TO PUBLIC
          USING (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
            OR current_setting('app.bypass_rls', true) = 'on'
          )
          WITH CHECK (
            tenant_id = current_setting('app.current_tenant_id', true)::uuid
            OR current_setting('app.bypass_rls', true) = 'on'
          )
      `);

      console.log(
        `[069_force_rls] FORCE RLS đã bật trên "${table}" với policy "${POLICY_NAME}"`
      );
    }
  },

  async down(client: PoolClient): Promise<void> {
    for (const table of PROTECTED_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table]
      );
      if (exists.rowCount === 0) continue;
      await client.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);
    }
  },
};
