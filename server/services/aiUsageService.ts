/**
 * Generic AI usage tracking — every Gemini call is recorded with a `feature`
 * label so the admin "Chi phí AI" page can show cost per feature, not just
 * per-valuation.
 *
 * Insert is fire-and-forget: callers do `recordAiUsage(...).catch(()=>{})`.
 */

import { pool } from '../db';
import { logger } from '../middleware/logger';

// Approximate $/1K-tokens by model — kept in sync with GENAI_CONFIG.MODEL_COSTS
// in server/ai.ts so cost numbers match the safety log.
const MODEL_COSTS: Record<string, number> = {
  'gemini-3.1-pro-preview':       0.008000,
  'gemini-3-pro-preview':         0.007000,
  'gemini-3.1-flash-lite-preview':0.000200,
  'gemini-3-flash-preview':       0.000500,
  'gemini-2.5-pro':               0.005000,
  'gemini-2.5-flash':             0.000375,
  'gemini-2.5-flash-lite':        0.000100,
  'gemini-2.0-flash':             0.000150,
  'gemini-2.0-flash-lite':        0.000075,
  'gemini-1.5-flash':             0.000200,
  'gemini-1.5-pro':               0.003500,
};

/** Estimate USD cost from prompt + response length, model rate, and call count. */
export function estimateAiCostUsd(
  model: string,
  promptLen: number,
  responseLen: number,
  callsMultiplier = 1,
): number {
  const tokens = Math.round((promptLen + responseLen) / 4);
  const ratePerK = MODEL_COSTS[model] ?? MODEL_COSTS['gemini-2.5-flash'];
  return parseFloat(((tokens / 1000) * ratePerK * Math.max(1, callsMultiplier)).toFixed(6));
}

export interface RecordAiUsageParams {
  tenantId?: string | null;
  userId?: string | null;
  feature: string;          // e.g. 'CHAT_ROUTER', 'LEAD_SCORING', 'VALUATION_AI'
  model: string;
  aiCalls?: number;
  costUsd?: number;         // if not provided, computed from prompt/response lengths
  promptLen?: number;
  responseLen?: number;
  latencyMs?: number;
  source?: string | null;   // free-form ('cache', 'AI_LIVE', 'fallback'…)
}

export async function recordAiUsage(params: RecordAiUsageParams): Promise<void> {
  const aiCalls = Math.max(1, params.aiCalls ?? 1);
  const cost = params.costUsd != null
    ? params.costUsd
    : estimateAiCostUsd(params.model, params.promptLen || 0, params.responseLen || 0, aiCalls);

  try {
    await pool.query(
      `INSERT INTO ai_usage_log
         (tenant_id, user_id, feature, model, ai_calls, cost_usd, latency_ms, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        params.tenantId || null,
        params.userId || null,
        (params.feature || 'UNKNOWN').slice(0, 60),
        (params.model || 'unknown').slice(0, 80),
        aiCalls,
        cost,
        params.latencyMs || 0,
        params.source ? String(params.source).slice(0, 60) : null,
      ],
    );
  } catch (err: any) {
    logger.warn('[aiUsage] recordAiUsage failed:', err?.message || err);
    return;
  }

  if (params.tenantId) {
    setImmediate(() => {
      import('./valuationUsageService')
        .then((m) => m.maybeSendCombinedThresholdAlert(params.tenantId!))
        .catch(() => {});
    });
  }
}

export async function getTotalAiSpend(
  period: string,
  tenantId?: string | null,
): Promise<{ totalCostUsd: number; totalAiCalls: number; calls: number }> {
  const { start, end } = periodBounds(period);
  const params: any[] = [start, end];
  let where = `created_at >= $1 AND created_at < $2`;
  if (tenantId) {
    params.push(tenantId);
    where += ` AND tenant_id = $${params.length}`;
  }
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int                    AS calls,
              COALESCE(SUM(ai_calls),0)::int   AS ai_calls,
              COALESCE(SUM(cost_usd),0)::float AS cost
         FROM ai_usage_log
        WHERE ${where}`,
      params,
    );
    const row = r.rows[0] || { calls: 0, ai_calls: 0, cost: 0 };
    return {
      totalCostUsd: Number(row.cost ?? 0),
      totalAiCalls: row.ai_calls ?? 0,
      calls: row.calls ?? 0,
    };
  } catch (err: any) {
    logger.warn('[aiUsage] getTotalAiSpend failed:', err?.message || err);
    return { totalCostUsd: 0, totalAiCalls: 0, calls: 0 };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregates for the admin "Chi phí AI" page
// ───────────────────────────────────────────────────────────────────────────

export interface FeatureCostRow {
  feature: string;
  calls: number;
  aiCalls: number;
  costUsd: number;
}

function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map((s) => parseInt(s, 10));
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
}

export async function getFeatureBreakdown(
  period: string,
  opts: { tenantId?: string | null } = {},
): Promise<{ rows: FeatureCostRow[]; totalCostUsd: number; totalAiCalls: number }> {
  const { start, end } = periodBounds(period);
  const params: any[] = [start, end];
  let where = `created_at >= $1 AND created_at < $2`;
  if (opts.tenantId) {
    params.push(opts.tenantId);
    where += ` AND tenant_id = $${params.length}`;
  }

  try {
    const r = await pool.query(
      `SELECT feature,
              COUNT(*)::int                     AS calls,
              COALESCE(SUM(ai_calls),0)::int    AS ai_calls,
              COALESCE(SUM(cost_usd),0)::float  AS cost
         FROM ai_usage_log
        WHERE ${where}
        GROUP BY feature
        ORDER BY cost DESC`,
      params,
    );
    const rows: FeatureCostRow[] = r.rows.map((row: any) => ({
      feature: row.feature,
      calls: row.calls,
      aiCalls: row.ai_calls,
      costUsd: Number(row.cost),
    }));
    const totalCostUsd = rows.reduce((s, r) => s + r.costUsd, 0);
    const totalAiCalls = rows.reduce((s, r) => s + r.aiCalls, 0);
    return { rows, totalCostUsd, totalAiCalls };
  } catch (err: any) {
    // Table may not exist on a fresh boot before the migration runs.
    logger.warn('[aiUsage] getFeatureBreakdown failed:', err?.message || err);
    return { rows: [], totalCostUsd: 0, totalAiCalls: 0 };
  }
}
