import type { PoolClient } from 'pg';

/**
 * Migration 072 — Email log (quota + dedupe) + mở rộng RLS sang 9 bảng tenant-scoped.
 *
 * Thêm:
 *   1) Bảng `email_log` — ghi nhận mọi lần gửi email (sent / queued_no_smtp / failed
 *      / deduped / quota_exceeded). Dùng cho:
 *        • Dedupe: cùng (tenant_id, dedupe_key) trong cửa sổ X phút → bỏ qua.
 *        • Quota: đếm số email đã gửi trong 30 ngày gần nhất per tenant để khống
 *          chế theo gói cước (TRIAL/INDIVIDUAL/TEAM/ENTERPRISE).
 *        • Audit / hỗ trợ tranh chấp giao hàng.
 *
 *   2) Mở rộng RLS (`tenant_isolation_v2`) sang các bảng tenant-scoped còn lại:
 *        audit_logs, uploaded_files, ai_feedback, team_members, notifications,
 *        tasks, user_page_views, valuation_usage_log, email_log.
 *
 * Lưu ý kỹ thuật:
 *   • `uploaded_files.tenant_id` là VARCHAR(36) (không phải UUID) → policy dùng
 *     phép so sánh `tenant_id::text = NULLIF(...)::text` để hoạt động cho cả
 *     UUID lẫn VARCHAR mà không cần policy riêng.
 *   • Tất cả bảng đều giữ nguyên schema (chỉ ADD POLICY, ENABLE/FORCE RLS) — KHÔNG
 *     đổi kiểu cột ID/khóa nào.
 */

const POLICY_NAME = 'tenant_isolation_v2';

// 8 bảng cần mở RLS (không tính email_log mới tạo bên dưới)
const EXTEND_TABLES = [
  'audit_logs',
  'uploaded_files',
  'ai_feedback',
  'team_members',
  'notifications',
  'tasks',
  'user_page_views',
  'valuation_usage_log',
] as const;

// Biểu thức policy: cast cả hai vế sang text → an toàn cho mọi kiểu tenant_id
// (UUID hoặc VARCHAR). Chuỗi rỗng được coi là "không có context" → chặn trừ khi
// `app.bypass_rls = on` (dùng cho migrations / cross-tenant verify / billing).
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
    console.log(`[072] Bỏ qua ${table} — bảng không tồn tại`);
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
  console.log(`[072] RLS bật + policy ${POLICY_NAME} áp lên ${table}`);
}

export default {
  id: '072_email_log_and_extended_rls',
  description:
    'Create email_log (quota+dedupe) and extend tenant RLS to 8 additional tables',

  async up(client: PoolClient): Promise<void> {
    // 1) Bảng email_log
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID NOT NULL,
        recipient     TEXT NOT NULL,
        subject       TEXT NOT NULL,
        template      TEXT,
        dedupe_key    TEXT,
        status        TEXT NOT NULL CHECK (status IN ('sent','queued_no_smtp','failed','deduped','quota_exceeded')),
        provider      TEXT,
        message_id    TEXT,
        error         TEXT,
        sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Index phục vụ dedupe nhanh per (tenant, key) trong cửa sổ thời gian
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_tenant_dedupe
        ON email_log (tenant_id, dedupe_key, sent_at DESC)
        WHERE dedupe_key IS NOT NULL
    `);

    // Index phục vụ quota: COUNT(*) WHERE tenant_id=$1 AND sent_at > NOW()-30d
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_tenant_sent_at
        ON email_log (tenant_id, sent_at DESC)
    `);

    // Index phục vụ tra cứu theo recipient (debug/audit)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_recipient
        ON email_log (recipient, sent_at DESC)
    `);

    // 2) Cấp quyền DML cho sgs_app trên email_log (default privileges từ migration 070
    //    đã lo bảng mới, nhưng GRANT thẳng để chắc chắn idempotent trên môi trường cũ)
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON email_log TO sgs_app`);

    // 3) Bật RLS + policy cho email_log
    await applyPolicy(client, 'email_log');

    // 4) Mở rộng RLS sang 8 bảng còn lại
    for (const table of EXTEND_TABLES) {
      await applyPolicy(client, table);
    }

    console.log(
      `[072] Hoàn tất: email_log + RLS lan tới ${EXTEND_TABLES.length + 1} bảng (bao gồm email_log).`,
    );
  },

  async down(client: PoolClient): Promise<void> {
    for (const table of EXTEND_TABLES) {
      await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);
    }
    await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON email_log`);
    await client.query(`DROP TABLE IF EXISTS email_log`);
  },
};
