import { PoolClient } from 'pg';

/*
 * Migration 123: tao bang approval_requests cho Permission Broker.
 * Muc dich: cac hanh dong AI "high-impact" (CONFIRM_DEPOSIT, CHANGE_LEAD_STAGE,
 * CREATE_PROPOSAL, BOOK_VIEWING, SEND_DOCS...) khong con tu dong thuc thi ma
 * duoc ghi lai thanh 1 approval_request PENDING, cho nhan vien duyet qua tab
 * moi trong Inbox truoc khi thuc su thuc hien.
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
    console.log(`[123] Bo qua ${table} - bang khong ton tai`);
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
  console.log(`[123] RLS bat + policy ${POLICY_NAME} ap len ${table}`);
}

export default {
  id: '123_approval_requests',
  description: 'Create approval_requests table for Permission Broker (high-impact AI actions) + apply tenant RLS policy',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID NOT NULL,
        lead_id       UUID NOT NULL,
        channel       TEXT,
        action_type   TEXT NOT NULL CHECK (action_type IN ('CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL','BOOK_VIEWING','SEND_DOCS')),
        payload       JSONB NOT NULL DEFAULT '{}',
        reasoning     TEXT,
        status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by   UUID,
        reviewed_at   TIMESTAMPTZ,
        review_note   TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
        ON approval_requests (tenant_id, status, requested_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_requests_lead
        ON approval_requests (lead_id, requested_at DESC)
    `);

    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON approval_requests TO sgs_app`).catch((err: any) => {
      console.log(`[123] Bo qua GRANT sgs_app (co the role chua ton tai o moi truong nay): ${err?.message || err}`);
    });

    await applyPolicy(client, 'approval_requests');

    console.log('[123] Hoan tat: approval_requests da duoc tao + RLS.');
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON approval_requests`).catch(() => {});
    await client.query(`DROP TABLE IF EXISTS approval_requests`);
  },
};
