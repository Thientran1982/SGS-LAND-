/**
 * Valuation usage tracking + cost reporting.
 *
 * Each call to a valuation endpoint records one row in `valuation_usage_log`.
 * Cost estimate uses GEMINI_PRICE_PER_CALL_USD (default $0.002 per call) × 2 calls
 * (search grounding + reasoning) — adjustable via env without redeploy logic.
 *
 * Admin-facing aggregates are computed on demand (no cron / materialized views).
 */

import { pool } from '../db';
import { logger } from '../middleware/logger';

const PRICE_PER_CALL_USD = (() => {
  const v = parseFloat(process.env.GEMINI_PRICE_PER_CALL_USD || '');
  if (Number.isFinite(v) && v >= 0) return v;
  return 0.002; // Gemini Flash typical: ~$0.002/call (input+output blended)
})();

const CALLS_PER_VALUATION = (() => {
  const v = parseInt(process.env.VALUATION_AI_CALLS_PER_REQUEST || '', 10);
  if (Number.isFinite(v) && v >= 1) return v;
  return 2;
})();

export const COST_CONSTANTS = {
  pricePerCallUsd: PRICE_PER_CALL_USD,
  callsPerValuation: CALLS_PER_VALUATION,
  costPerValuationUsd: PRICE_PER_CALL_USD * CALLS_PER_VALUATION,
};

export interface RecordParams {
  tenantId?: string | null;
  userId?: string | null;
  planId?: string | null;
  endpoint: string;             // 'advanced' | 'realtime' | 'teaser' …
  source?: string | null;       // cache | AI_LIVE | REGIONAL_TABLE | …
  aiCalls?: number;
  latencyMs?: number;
  isGuest?: boolean;
  ipAddress?: string | null;
  addressHint?: string | null;
}

export async function recordValuationUsage(params: RecordParams): Promise<void> {
  const aiCalls = params.aiCalls ?? CALLS_PER_VALUATION;
  const cost = aiCalls * PRICE_PER_CALL_USD;

  try {
    await pool.query(
      `INSERT INTO valuation_usage_log
         (tenant_id, user_id, plan_id, endpoint, source, ai_calls, cost_usd,
          latency_ms, is_guest, ip_address, address_hint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        params.tenantId || null,
        params.userId || null,
        params.planId || null,
        params.endpoint.slice(0, 50),
        (params.source || null)?.toString().slice(0, 40) || null,
        aiCalls,
        cost,
        params.latencyMs || 0,
        !!params.isGuest,
        params.ipAddress?.toString().slice(0, 64) || null,
        params.addressHint?.toString().slice(0, 120) || null,
      ]
    );
  } catch (err: any) {
    logger.warn('[valuationUsage] recordValuationUsage failed:', err.message);
    return;
  }

  // Fire-and-forget: check threshold after insert
  if (params.tenantId) {
    setImmediate(() => maybeSendThresholdAlert(params.tenantId!).catch(() => {}));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregates
// ───────────────────────────────────────────────────────────────────────────

export interface MonthlyReport {
  period: string;                 // YYYY-MM
  totalValuations: number;
  totalAiCalls: number;
  estimatedCostUsd: number;
  guestValuations: number;
  authValuations: number;
  byPlan: Array<{ planId: string; valuations: number; costUsd: number }>;
  bySource: Array<{ source: string; valuations: number }>;
  topUsers: Array<{
    userId: string;
    userName: string | null;
    userEmail: string | null;
    valuations: number;
    costUsd: number;
  }>;
  dailyTrend: Array<{ day: string; valuations: number; costUsd: number }>;
  prevPeriod: string;
  prevTotalValuations: number;
  prevEstimatedCostUsd: number;
  pricing: typeof COST_CONSTANTS;
}

function periodBounds(period: string): { start: string; end: string } {
  // period: YYYY-MM → first day of month → first day of next month
  const [y, m] = period.split('-').map((s) => parseInt(s, 10));
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
}

function shiftPeriod(period: string, deltaMonths: number): string {
  const [y, m] = period.split('-').map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function totalsForPeriod(
  period: string,
  tenantId?: string | null,
): Promise<{ total: number; cost: number }> {
  const { start, end } = periodBounds(period);
  const params: any[] = [start, end];
  let where = `created_at >= $1 AND created_at < $2`;
  if (tenantId) {
    params.push(tenantId);
    where += ` AND tenant_id = $${params.length}`;
  }
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(cost_usd),0)::float AS cost
       FROM valuation_usage_log WHERE ${where}`,
    params,
  );
  const row = r.rows[0] || { total: 0, cost: 0 };
  return { total: row.total ?? 0, cost: Number(row.cost ?? 0) };
}

export async function getMonthlyReport(
  period: string,
  opts: { tenantId?: string | null; topUsersLimit?: number } = {},
): Promise<MonthlyReport> {
  const { start, end } = periodBounds(period);
  const tenantFilter = opts.tenantId ? ` AND tenant_id = $3` : '';
  const tenantFilterV = opts.tenantId ? ` AND v.tenant_id = $3` : '';
  const baseParams: any[] = [start, end];
  if (opts.tenantId) baseParams.push(opts.tenantId);

  const totalQ = pool.query(
    `SELECT COUNT(*)::int                                                AS total,
            COALESCE(SUM(ai_calls),0)::int                               AS calls,
            COALESCE(SUM(cost_usd),0)::float                             AS cost,
            COALESCE(SUM(CASE WHEN is_guest THEN 1 ELSE 0 END),0)::int   AS guests,
            COALESCE(SUM(CASE WHEN is_guest THEN 0 ELSE 1 END),0)::int   AS auths
       FROM valuation_usage_log
      WHERE created_at >= $1 AND created_at < $2 ${tenantFilter}`,
    baseParams,
  );

  const planQ = pool.query(
    `SELECT COALESCE(plan_id,'GUEST') AS plan_id,
            COUNT(*)::int            AS valuations,
            COALESCE(SUM(cost_usd),0)::float AS cost
       FROM valuation_usage_log
      WHERE created_at >= $1 AND created_at < $2 ${tenantFilter}
      GROUP BY 1
      ORDER BY valuations DESC`,
    baseParams,
  );

  const sourceQ = pool.query(
    `SELECT COALESCE(source,'unknown') AS source,
            COUNT(*)::int             AS valuations
       FROM valuation_usage_log
      WHERE created_at >= $1 AND created_at < $2 ${tenantFilter}
      GROUP BY 1
      ORDER BY valuations DESC`,
    baseParams,
  );

  const topLimit = Math.max(1, Math.min(50, opts.topUsersLimit || 10));
  const topQ = pool.query(
    `SELECT v.user_id,
            u.name  AS user_name,
            u.email AS user_email,
            COUNT(*)::int                  AS valuations,
            COALESCE(SUM(v.cost_usd),0)::float AS cost
       FROM valuation_usage_log v
       LEFT JOIN users u ON u.id = v.user_id
      WHERE v.created_at >= $1 AND v.created_at < $2 ${tenantFilterV}
        AND v.user_id IS NOT NULL
      GROUP BY v.user_id, u.name, u.email
      ORDER BY valuations DESC
      LIMIT ${topLimit}`,
    baseParams,
  );

  const dailyQ = pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*)::int                                        AS valuations,
            COALESCE(SUM(cost_usd),0)::float                     AS cost
       FROM valuation_usage_log
      WHERE created_at >= $1 AND created_at < $2 ${tenantFilter}
      GROUP BY 1
      ORDER BY 1 ASC`,
    baseParams,
  );

  const prevPeriod = shiftPeriod(period, -1);
  const [totalsRes, plansRes, sourcesRes, topRes, dailyRes, prev] =
    await Promise.all([totalQ, planQ, sourceQ, topQ, dailyQ, totalsForPeriod(prevPeriod, opts.tenantId)]);

  const t = totalsRes.rows[0] || { total: 0, calls: 0, cost: 0, guests: 0, auths: 0 };

  return {
    period,
    totalValuations: t.total ?? 0,
    totalAiCalls: t.calls ?? 0,
    estimatedCostUsd: Number(t.cost ?? 0),
    guestValuations: t.guests ?? 0,
    authValuations: t.auths ?? 0,
    byPlan: plansRes.rows.map((r: any) => ({
      planId: r.plan_id,
      valuations: r.valuations,
      costUsd: Number(r.cost),
    })),
    bySource: sourcesRes.rows.map((r: any) => ({
      source: r.source,
      valuations: r.valuations,
    })),
    topUsers: topRes.rows.map((r: any) => ({
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      valuations: r.valuations,
      costUsd: Number(r.cost),
    })),
    dailyTrend: dailyRes.rows.map((r: any) => ({
      day: r.day,
      valuations: r.valuations,
      costUsd: Number(r.cost),
    })),
    prevPeriod,
    prevTotalValuations: prev.total,
    prevEstimatedCostUsd: prev.cost,
    pricing: COST_CONSTANTS,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Cost alert config + email notification
// ───────────────────────────────────────────────────────────────────────────

export interface CostAlertConfig {
  thresholdUsd: number;
  alertEmail: string | null;
  lastAlertedPeriod: string | null;
}

export async function getCostAlertConfig(tenantId: string): Promise<CostAlertConfig> {
  try {
    const r = await pool.query(
      `SELECT threshold_usd, alert_email, last_alerted_period
         FROM valuation_cost_alerts WHERE tenant_id = $1`,
      [tenantId],
    );
    const row = r.rows[0];
    if (!row) return { thresholdUsd: 0, alertEmail: null, lastAlertedPeriod: null };
    return {
      thresholdUsd: Number(row.threshold_usd ?? 0),
      alertEmail: row.alert_email || null,
      lastAlertedPeriod: row.last_alerted_period || null,
    };
  } catch {
    return { thresholdUsd: 0, alertEmail: null, lastAlertedPeriod: null };
  }
}

export async function setCostAlertConfig(
  tenantId: string,
  cfg: { thresholdUsd: number; alertEmail: string | null },
): Promise<CostAlertConfig> {
  const threshold = Math.max(0, Number(cfg.thresholdUsd) || 0);
  const email = cfg.alertEmail && cfg.alertEmail.trim() ? cfg.alertEmail.trim() : null;
  await pool.query(
    `INSERT INTO valuation_cost_alerts (tenant_id, threshold_usd, alert_email, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE
       SET threshold_usd = EXCLUDED.threshold_usd,
           alert_email   = EXCLUDED.alert_email,
           updated_at    = CURRENT_TIMESTAMP`,
    [tenantId, threshold, email],
  );
  return getCostAlertConfig(tenantId);
}

async function maybeSendThresholdAlert(tenantId: string): Promise<void> {
  const cfg = await getCostAlertConfig(tenantId);
  if (!cfg.thresholdUsd || cfg.thresholdUsd <= 0) return;
  if (!cfg.alertEmail) return;

  const period = currentPeriod();
  if (cfg.lastAlertedPeriod === period) return; // already alerted this month

  const totals = await totalsForPeriod(period, tenantId);
  if (totals.cost < cfg.thresholdUsd) return;

  // Mark as alerted FIRST to avoid duplicate sends if email is slow
  await pool.query(
    `UPDATE valuation_cost_alerts SET last_alerted_period = $2, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1`,
    [tenantId, period],
  );

  try {
    const { emailService } = await import('./emailService');
    const subject = `[SGS Land] Chi phí AI định giá vượt ngưỡng — tháng ${period}`;
    const body = `
      <p>Xin chào,</p>
      <p>Chi phí AI định giá ước tính trong tháng <strong>${period}</strong> đã đạt
         <strong>$${totals.cost.toFixed(2)} USD</strong>, vượt ngưỡng cảnh báo
         <strong>$${cfg.thresholdUsd.toFixed(2)} USD</strong>.</p>
      <p>Tổng số lượt định giá: <strong>${totals.total}</strong>.</p>
      <p>Vào trang quản trị "Chi phí AI" để xem chi tiết.</p>
    `;
    await emailService.sendEmail(tenantId, { to: cfg.alertEmail, subject, html: body, text: body.replace(/<[^>]+>/g, '') });
    logger.info(`[valuationUsage] Threshold alert sent to ${cfg.alertEmail} (tenant=${tenantId}, $${totals.cost.toFixed(2)})`);
  } catch (err: any) {
    logger.warn('[valuationUsage] Failed to send threshold alert email:', err.message);
  }
}

// CSV export
export function reportToCsv(report: MonthlyReport): string {
  const rows: string[] = [];
  rows.push('Section,Key,Valuations,Cost USD');
  rows.push(`Summary,Total,${report.totalValuations},${report.estimatedCostUsd.toFixed(4)}`);
  rows.push(`Summary,Guest,${report.guestValuations},`);
  rows.push(`Summary,Authenticated,${report.authValuations},`);
  rows.push(`Summary,AI calls,${report.totalAiCalls},`);
  rows.push(`Summary,Previous month (${report.prevPeriod}),${report.prevTotalValuations},${report.prevEstimatedCostUsd.toFixed(4)}`);
  rows.push('');
  rows.push('Plan,,Valuations,Cost USD');
  for (const p of report.byPlan) {
    rows.push(`Plan,${escape(p.planId)},${p.valuations},${p.costUsd.toFixed(4)}`);
  }
  rows.push('');
  rows.push('Source,,Valuations,');
  for (const s of report.bySource) {
    rows.push(`Source,${escape(s.source)},${s.valuations},`);
  }
  rows.push('');
  rows.push('Top user,Email,Valuations,Cost USD');
  for (const u of report.topUsers) {
    rows.push(
      `User,${escape(u.userName || u.userEmail || u.userId)},${u.valuations},${u.costUsd.toFixed(4)}`,
    );
  }
  rows.push('');
  rows.push('Day,,Valuations,Cost USD');
  for (const d of report.dailyTrend) {
    rows.push(`Day,${d.day},${d.valuations},${d.costUsd.toFixed(4)}`);
  }
  return rows.join('\n');

  function escape(s: string): string {
    if (s == null) return '';
    const v = String(s);
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }
}
