import { PoolClient } from 'pg';

/*
 * Tao bang sms_log (mirror cau truc email_log tu migration 072) de theo doi
 * lich su gui SMS (dedupe + quota + trang thai), va ap dung RLS tenant_isolation_v2
 * dong bo voi cac bang khac trong he thong.
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
    console.log(`[115] Bo qua ${table} - bang khong ton tai`);
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
  console.log(`[115] RLS bat + policy ${POLICY_NAME} ap len ${table}`);
}

export default {
  id: '115_sms_log',
  description: 'Create sms_log table (mirror email_log) + apply tenant RLS policy',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_log (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID NOT NULL,
        recipient     TEXT NOT NULL,
        message       TEXT NOT NULL,
        template      TEXT,
        dedupe_key    TEXT,
        status        TEXT NOT NULL CHECK (status IN ('sent','queued_no_provider','failed','deduped','quota_exceeded')),
        provider      TEXT,
        message_id    TEXT,
        error         TEXT,
        sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Index phuc vu dedupe nhanh per (tenant, key) trong cua so thoi gian
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_log_tenant_dedupe
        ON sms_log (tenant_id, dedupe_key, sent_at DESC)
        WHERE dedupe_key IS NOT NULL
    `);

    // Index phuc vu tra cuu theo recipient (debug/audit)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_log_recipient
        ON sms_log (recipient, sent_at DESC)
    `);

    // Cap quyen DML cho sgs_app tren sms_log (dong bo voi email_log)
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON sms_log TO sgs_app`).catch((err: any) => {
      console.log(`[115] Bo qua GRANT sgs_app (co the role chua ton tai o moi truong nay): ${err?.message || err}`);
    });

    // Bat RLS + policy cho sms_log
    await applyPolicy(client, 'sms_log');

    console.log('[115] Hoan tat: sms_log da duoc tao + RLS.');
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON sms_log`).catch(() => {});
    await client.query(`DROP TABLE IF EXISTS sms_log`);
  },
};
