import { PoolClient } from 'pg';

/*
 * Migration 117: tao 2 bang cho tinh nang Admin:
 *  - custom_fields: dinh nghia truong tuy chinh (Truong Tuy Chinh)
 *  - units: ton kho cap can (Ton Kho Cap Can)
 * Ap dung RLS tenant_isolation_v2 dong bo voi cac bang khac.
 */

const POLICY_NAME = 'tenant_isolation_v2';

const SAFE_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
) OR current_setting('app.bypass_rls', true) = 'on'`;

async function applyPolicy(client: PoolClient, table: string): Promise<void> {
  const exists = await client.query(
    `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
    [table],
  );
  if (exists.rowCount === 0) {
    console.log(`[117] Bo qua ${table} - bang khong ton tai`);
    return;
  }
  await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);
  await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  await client.query(`
    CREATE POLICY ${POLICY_NAME} ON ${table}
      AS PERMISSIVE
      FOR ALL
      TO PUBLIC
      USING (${SAFE_EXPR})
      WITH CHECK (${SAFE_EXPR})
  `);
  console.log(`[117] RLS bat + policy ${POLICY_NAME} ap len ${table}`);
}

export default {
  id: '117_custom_fields_and_units',
  description: 'Create custom_fields and units tables + apply tenant RLS policy',

  async up(client: PoolClient): Promise<void> {
    // ===== custom_fields =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        label       TEXT NOT NULL,
        field_key   TEXT NOT NULL,
        entity      TEXT NOT NULL CHECK (entity IN ('listing','lead','project','contract')),
        field_type  TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','boolean')),
        required    BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, entity, field_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant_entity
        ON custom_fields (tenant_id, entity)
    `);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON custom_fields TO sgs_app`).catch((err: any) => {
      console.log(`[117] Bo qua GRANT sgs_app custom_fields: ${err?.message || err}`);
    });
    await applyPolicy(client, 'custom_fields');

    // ===== units (ton kho cap can) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        code        TEXT NOT NULL,
        tower       TEXT NOT NULL,
        floor       INTEGER NOT NULL,
        bedroom     TEXT NOT NULL,
        area_sqm    NUMERIC(10,2) NOT NULL,
        price_sqm   NUMERIC(14,2) NOT NULL,
        status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold')),
        project_id  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, code)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_units_tenant_status
        ON units (tenant_id, tower, status)
    `);
    // project_id is tenant-scoped; the integrity migration adds the
    // composite FK after auditing existing rows.
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON units TO sgs_app`).catch((err: any) => {
      console.log(`[117] Bo qua GRANT sgs_app units: ${err?.message || err}`);
    });
    await applyPolicy(client, 'units');

    console.log('[117] Hoan tat: custom_fields + units da duoc tao + RLS.');
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON units`).catch(() => {});
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON custom_fields`).catch(() => {});
    await client.query(`DROP TABLE IF EXISTS units`);
    await client.query(`DROP TABLE IF EXISTS custom_fields`);
  },
};
