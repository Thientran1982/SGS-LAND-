/**
 * Email send metrics — fire-and-forget logging of every transactional email
 * attempted (Brevo today, future providers welcome).
 *
 * Powers the Admin/Health "tỉ lệ gửi email lead theo từng CĐT" widget so ops
 * can spot tenants whose lead notifications are silently failing (sender chưa
 * verified, rate-limit, mailbox bounce, …).
 */

import { pool } from '../db';
import { logger } from '../middleware/logger';

const HOST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export type EmailKind =
  | 'LEAD_NOTIFY'        // notification gửi vào hotline inbox của CĐT
  | 'LEAD_AUTOREPLY'     // auto-reply cho khách điền form
  | 'LANDING_LEAD'       // landing page lead notification
  | 'OTHER';

export interface RecordEmailSendParams {
  tenantId?: string | null;
  kind: EmailKind;
  success: boolean;
  reason?: string | null;
  provider?: string;
  messageId?: string | null;
}

/** Insert one metric row. Never throws — best-effort logging. */
export async function recordEmailSend(params: RecordEmailSendParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_send_metrics
         (tenant_id, kind, success, reason, provider, message_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        params.tenantId || HOST_TENANT_ID,
        (params.kind || 'OTHER').slice(0, 40),
        !!params.success,
        params.reason ? String(params.reason).slice(0, 500) : null,
        (params.provider || 'brevo').slice(0, 20),
        params.messageId ? String(params.messageId).slice(0, 120) : null,
      ],
    );
  } catch (err: any) {
    logger.warn(`[emailMetrics] recordEmailSend failed: ${err?.message || err}`);
  }
}

export interface TenantEmailStats {
  tenantId: string;
  tenantName: string | null;
  total: number;
  success: number;
  failure: number;
  successRate: number; // 0..1
  topReasons: Array<{ reason: string; count: number }>;
  lastFailureAt: string | null;
}

export interface LeadEmailStatsReport {
  windowDays: number;
  alertThreshold: number; // 0..1 (e.g. 0.8)
  generatedAt: string;
  totals: {
    total: number;
    success: number;
    failure: number;
    successRate: number;
  };
  byTenant: TenantEmailStats[];
  alerts: TenantEmailStats[]; // tenants with rate < threshold AND total >= minSample
}

// Alerting tập trung vào notification gửi tới CĐT (LEAD_NOTIFY + LANDING_LEAD).
// Auto-reply tới khách (mailbox người dùng có thể bounce vì lý do ngoài tầm kiểm
// soát của CĐT) được loại khỏi KPI mặc định để tránh làm loãng tín hiệu — nhưng
// vẫn được persist để debug khi cần.
const NOTIFY_KINDS: EmailKind[] = ['LEAD_NOTIFY', 'LANDING_LEAD'];
const ALL_LEAD_KINDS: EmailKind[] = ['LEAD_NOTIFY', 'LEAD_AUTOREPLY', 'LANDING_LEAD'];
const ALERT_THRESHOLD = 0.8;
const MIN_SAMPLE = 5; // ignore tenants with < 5 attempts to avoid noisy alerts

/**
 * Aggregate lead-email send stats per tenant for the last N days.
 * Returns global totals + per-tenant breakdown + alert list.
 *
 * @param windowDays  số ngày cần xét (1..90, default 7).
 * @param includeAutoreply  nếu true → KPI tính cả auto-reply (debug);
 *                          mặc định false → chỉ notification tới CĐT.
 */
export async function getLeadEmailSendStats(
  windowDays = 7,
  includeAutoreply = false,
): Promise<LeadEmailStatsReport> {
  const days = Math.max(1, Math.min(90, Math.floor(windowDays)));
  const kinds = includeAutoreply ? ALL_LEAD_KINDS : NOTIFY_KINDS;

  // Per-tenant aggregates
  const aggSql = `
    SELECT
      m.tenant_id                                              AS tenant_id,
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE m.success)::int                   AS success,
      COUNT(*) FILTER (WHERE NOT m.success)::int               AS failure,
      MAX(CASE WHEN NOT m.success THEN m.created_at END)       AS last_failure_at
    FROM email_send_metrics m
    WHERE m.kind = ANY($1::text[])
      AND m.created_at >= NOW() - ($2 || ' days')::interval
    GROUP BY m.tenant_id
    ORDER BY total DESC
  `;
  const aggRes = await pool.query(aggSql, [kinds, String(days)]);

  const tenantIds = aggRes.rows.map((r: any) => r.tenant_id).filter(Boolean);
  const nameMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    try {
      const nameRes = await pool.query(
        `SELECT id, name FROM tenants WHERE id = ANY($1::uuid[])`,
        [tenantIds],
      );
      for (const r of nameRes.rows) nameMap.set(String(r.id), r.name || null);
    } catch {
      /* tenants table may not exist in tests; ignore */
    }
  }

  // Top-3 failure reasons per tenant — dùng ROW_NUMBER OVER (PARTITION BY tenant)
  // để bảo đảm thứ tự ổn định (ties tie-break bằng reason ASC) và giới hạn ở DB
  // thay vì truncate trong application code.
  const reasonSql = `
    SELECT tenant_id, reason, count
    FROM (
      SELECT
        tenant_id,
        reason,
        COUNT(*)::int AS count,
        ROW_NUMBER() OVER (
          PARTITION BY tenant_id
          ORDER BY COUNT(*) DESC, reason ASC
        ) AS rn
      FROM email_send_metrics
      WHERE kind = ANY($1::text[])
        AND created_at >= NOW() - ($2 || ' days')::interval
        AND NOT success
        AND reason IS NOT NULL
      GROUP BY tenant_id, reason
    ) ranked
    WHERE rn <= 3
    ORDER BY tenant_id, rn
  `;
  const reasonRes = await pool.query(reasonSql, [kinds, String(days)]);
  const reasonsByTenant = new Map<string, Array<{ reason: string; count: number }>>();
  for (const r of reasonRes.rows) {
    const arr = reasonsByTenant.get(r.tenant_id) ?? [];
    arr.push({ reason: r.reason, count: r.count });
    reasonsByTenant.set(r.tenant_id, arr);
  }

  const byTenant: TenantEmailStats[] = aggRes.rows.map((r: any) => {
    const total = Number(r.total) || 0;
    const success = Number(r.success) || 0;
    const failure = Number(r.failure) || 0;
    return {
      tenantId: r.tenant_id,
      tenantName: nameMap.get(r.tenant_id) ?? null,
      total,
      success,
      failure,
      successRate: total > 0 ? success / total : 1,
      topReasons: reasonsByTenant.get(r.tenant_id) ?? [],
      lastFailureAt: r.last_failure_at ? new Date(r.last_failure_at).toISOString() : null,
    };
  });

  const totalAll = byTenant.reduce((s, t) => s + t.total, 0);
  const successAll = byTenant.reduce((s, t) => s + t.success, 0);
  const failureAll = totalAll - successAll;

  const alerts = byTenant.filter(
    (t) => t.total >= MIN_SAMPLE && t.successRate < ALERT_THRESHOLD,
  );

  return {
    windowDays: days,
    alertThreshold: ALERT_THRESHOLD,
    generatedAt: new Date().toISOString(),
    totals: {
      total: totalAll,
      success: successAll,
      failure: failureAll,
      successRate: totalAll > 0 ? successAll / totalAll : 1,
    },
    byTenant,
    alerts,
  };
}
