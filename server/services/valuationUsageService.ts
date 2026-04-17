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
  warnPercent: number;             // early-warning threshold (e.g. 80 = 80%)
  hardCapEnabled: boolean;         // if true, block AI calls once spending ≥ thresholdUsd
  lastWarnAlertedPeriod: string | null;
}

const DEFAULT_WARN_PERCENT = 80;

export async function getCostAlertConfig(tenantId: string): Promise<CostAlertConfig> {
  try {
    const r = await pool.query(
      `SELECT threshold_usd, alert_email, last_alerted_period,
              warn_percent, hard_cap_enabled, last_warn_alerted_period
         FROM valuation_cost_alerts WHERE tenant_id = $1`,
      [tenantId],
    );
    const row = r.rows[0];
    if (!row) {
      return {
        thresholdUsd: 0,
        alertEmail: null,
        lastAlertedPeriod: null,
        warnPercent: DEFAULT_WARN_PERCENT,
        hardCapEnabled: false,
        lastWarnAlertedPeriod: null,
      };
    }
    return {
      thresholdUsd: Number(row.threshold_usd ?? 0),
      alertEmail: row.alert_email || null,
      lastAlertedPeriod: row.last_alerted_period || null,
      warnPercent: Number(row.warn_percent ?? DEFAULT_WARN_PERCENT),
      hardCapEnabled: !!row.hard_cap_enabled,
      lastWarnAlertedPeriod: row.last_warn_alerted_period || null,
    };
  } catch {
    return {
      thresholdUsd: 0,
      alertEmail: null,
      lastAlertedPeriod: null,
      warnPercent: DEFAULT_WARN_PERCENT,
      hardCapEnabled: false,
      lastWarnAlertedPeriod: null,
    };
  }
}

export async function setCostAlertConfig(
  tenantId: string,
  cfg: {
    thresholdUsd: number;
    alertEmail: string | null;
    warnPercent?: number;
    hardCapEnabled?: boolean;
  },
): Promise<CostAlertConfig> {
  const threshold = Math.max(0, Number(cfg.thresholdUsd) || 0);
  const email = cfg.alertEmail && cfg.alertEmail.trim() ? cfg.alertEmail.trim() : null;
  const warnPct = (() => {
    const v = Math.round(Number(cfg.warnPercent));
    if (!Number.isFinite(v) || v <= 0) return DEFAULT_WARN_PERCENT;
    // Clamp 1-100; warn must be ≤ 100% (can equal 100 to disable early-warning effectively)
    return Math.max(1, Math.min(100, v));
  })();
  const hardCap = !!cfg.hardCapEnabled;
  await pool.query(
    `INSERT INTO valuation_cost_alerts
       (tenant_id, threshold_usd, alert_email, warn_percent, hard_cap_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE
       SET threshold_usd     = EXCLUDED.threshold_usd,
           alert_email       = EXCLUDED.alert_email,
           warn_percent      = EXCLUDED.warn_percent,
           hard_cap_enabled  = EXCLUDED.hard_cap_enabled,
           updated_at        = CURRENT_TIMESTAMP`,
    [tenantId, threshold, email, warnPct, hardCap],
  );
  return getCostAlertConfig(tenantId);
}

/**
 * Check whether AI valuation requests for this tenant must be blocked because
 * the configured monthly hard cap (thresholdUsd) has been reached.
 *
 * Returns null when not capped, otherwise returns the relevant numbers so the
 * caller can build a friendly error response.
 */
export async function checkHardCap(
  tenantId: string,
): Promise<{ thresholdUsd: number; spentUsd: number; period: string } | null> {
  try {
    const cfg = await getCostAlertConfig(tenantId);
    if (!cfg.hardCapEnabled || !cfg.thresholdUsd || cfg.thresholdUsd <= 0) return null;
    const period = currentPeriod();
    const totals = await totalsForPeriod(period, tenantId);
    if (totals.cost < cfg.thresholdUsd) return null;
    return { thresholdUsd: cfg.thresholdUsd, spentUsd: totals.cost, period };
  } catch {
    return null;
  }
}

async function maybeSendThresholdAlert(tenantId: string): Promise<void> {
  const cfg = await getCostAlertConfig(tenantId);
  if (!cfg.thresholdUsd || cfg.thresholdUsd <= 0) return;
  if (!cfg.alertEmail) return;

  const period = currentPeriod();
  const totals = await totalsForPeriod(period, tenantId);
  const warnAt = cfg.thresholdUsd * (cfg.warnPercent / 100);

  // Hard threshold breach (≥ 100% of cap) — send/upgrade alert if not yet sent this month
  if (totals.cost >= cfg.thresholdUsd && cfg.lastAlertedPeriod !== period) {
    await pool.query(
      `UPDATE valuation_cost_alerts
          SET last_alerted_period = $2,
              last_warn_alerted_period = COALESCE(last_warn_alerted_period, $2),
              updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1`,
      [tenantId, period],
    );
    await sendCostAlertEmail({
      tenantId,
      to: cfg.alertEmail,
      period,
      spentUsd: totals.cost,
      thresholdUsd: cfg.thresholdUsd,
      totalValuations: totals.total,
      severity: 'over',
      warnPercent: cfg.warnPercent,
      hardCapEnabled: cfg.hardCapEnabled,
    });
    return;
  }

  // Early-warning breach (≥ warn_percent of cap) — separate one-shot per month
  if (
    cfg.warnPercent > 0 &&
    cfg.warnPercent < 100 &&
    totals.cost >= warnAt &&
    totals.cost < cfg.thresholdUsd &&
    cfg.lastWarnAlertedPeriod !== period
  ) {
    await pool.query(
      `UPDATE valuation_cost_alerts
          SET last_warn_alerted_period = $2, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1`,
      [tenantId, period],
    );
    await sendCostAlertEmail({
      tenantId,
      to: cfg.alertEmail,
      period,
      spentUsd: totals.cost,
      thresholdUsd: cfg.thresholdUsd,
      totalValuations: totals.total,
      severity: 'warn',
      warnPercent: cfg.warnPercent,
      hardCapEnabled: cfg.hardCapEnabled,
    });
  }
}

async function sendCostAlertEmail(args: {
  tenantId: string;
  to: string;
  period: string;
  spentUsd: number;
  thresholdUsd: number;
  totalValuations: number;
  severity: 'warn' | 'over';
  warnPercent: number;
  hardCapEnabled: boolean;
}): Promise<void> {
  const pctOfCap = args.thresholdUsd > 0 ? (args.spentUsd / args.thresholdUsd) * 100 : 0;
  const subject =
    args.severity === 'warn'
      ? `[SGS Land] Cảnh báo sớm: chi phí AI định giá đã đạt ${pctOfCap.toFixed(0)}% ngưỡng — tháng ${args.period}`
      : `[SGS Land] Chi phí AI định giá vượt ngưỡng — tháng ${args.period}`;
  const headline =
    args.severity === 'warn'
      ? `Chi phí AI định giá đã đạt <strong>${pctOfCap.toFixed(1)}%</strong> ngưỡng cảnh báo (${args.warnPercent}% sớm).`
      : `Chi phí AI định giá đã <strong>vượt ngưỡng</strong>.`;
  const capNote = args.hardCapEnabled && args.severity === 'over'
    ? `<p><strong>Chế độ tự động chặn đang bật:</strong> các yêu cầu định giá AI mới sẽ bị tạm dừng cho đến khi sang tháng hoặc nâng ngưỡng.</p>`
    : '';
  const body = `
    <p>Xin chào,</p>
    <p>${headline}</p>
    <p>Chi phí ước tính tháng <strong>${args.period}</strong>:
       <strong>$${args.spentUsd.toFixed(2)} USD</strong>
       / ngưỡng <strong>$${args.thresholdUsd.toFixed(2)} USD</strong>.</p>
    <p>Tổng số lượt định giá: <strong>${args.totalValuations}</strong>.</p>
    ${capNote}
    <p>Vào trang quản trị "Chi phí AI" để xem chi tiết.</p>
  `;
  try {
    const { emailService } = await import('./emailService');
    await emailService.sendEmail(args.tenantId, {
      to: args.to,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, ''),
    });
    logger.info(
      `[valuationUsage] ${args.severity === 'warn' ? 'Early-warning' : 'Threshold'} alert sent to ${args.to} ` +
      `(tenant=${args.tenantId}, $${args.spentUsd.toFixed(2)} / $${args.thresholdUsd.toFixed(2)})`
    );
  } catch (err: any) {
    logger.warn('[valuationUsage] Failed to send cost alert email:', err.message);
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
