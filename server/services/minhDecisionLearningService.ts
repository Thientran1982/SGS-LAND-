import { withTenantContext } from '../db';
import { logger } from '../middleware/logger';

export type MinhDecisionOutcome =
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'EXECUTION_FAILED'
  | 'ANSWERED';

export type MinhDecisionFeedbackInput = {
  eventKey: string;
  sourceSignalId?: string | null;
  approvalRequestId?: string | null;
  humanQuestionId?: string | null;
  actionType: string;
  outcome: MinhDecisionOutcome;
  feedbackCategory?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export type MinhDecisionLearningTrend = {
  windowDays: number;
  granularity: 'day';
  points: Array<{
    date: string;
    total: number;
    approved: number;
    rejected: number;
    executed: number;
    execution_failed: number;
    answered: number;
  }>;
  empty: boolean;
  rawPayloadIncluded: false;
  rawAnswerIncluded: false;
  providerPayloadIncluded: false;
};

export type MinhDecisionLearningSnapshot = MinhDecisionLearningTrend;

const ALLOWED_CATEGORIES = new Set([
  'OPERATOR_APPROVED',
  'OPERATOR_REJECTED',
  'MEMORY_APPROVED',
  'HUMAN_REVIEWED',
  'NO_PROVIDER_SIDE_EFFECT',
]);

function category(value: unknown): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : null;
}

export function normalizeMinhLearningWindow(days: unknown): number {
  const parsed = typeof days === 'number' ? days : Number(days);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(90, Math.trunc(parsed)));
}

export async function recordMinhDecisionFeedback(
  tenantId: string,
  input: MinhDecisionFeedbackInput,
): Promise<void> {
  await withTenantContext(tenantId, client => client.query(
    `INSERT INTO minh_decision_feedback
      (tenant_id, event_key, source_signal_id, approval_request_id, human_question_id,
       action_type, outcome, feedback_category, metadata_json, created_by)
     VALUES ($1::uuid,$2,$3::text,$4::uuid,$5::uuid,$6,$7,$8,$9::jsonb,$10::uuid)
     ON CONFLICT (tenant_id, event_key) DO NOTHING`,
    [
      tenantId,
      input.eventKey.slice(0, 180),
      input.sourceSignalId || null,
      input.approvalRequestId || null,
      input.humanQuestionId || null,
      input.actionType.slice(0, 100),
      input.outcome,
      category(input.feedbackCategory),
      JSON.stringify(input.metadata || {}),
      input.createdBy || null,
    ],
  ));
}

export async function recordMinhDecisionFeedbackSafely(
  tenantId: string,
  input: MinhDecisionFeedbackInput,
): Promise<void> {
  try {
    await recordMinhDecisionFeedback(tenantId, input);
  } catch (error: any) {
    logger.warn(`[MinhLearning] feedback write degraded tenant=${tenantId}: ${error?.message || error}`);
  }
}

async function queryMinhDecisionLearningTrend(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: MinhDecisionLearningTrend['points'] }> },
  tenantId: string,
  windowDays: number,
): Promise<MinhDecisionLearningTrend> {
  const result = await client.query(
    `SELECT
       to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE outcome='APPROVED')::int AS approved,
       COUNT(*) FILTER (WHERE outcome='REJECTED')::int AS rejected,
       COUNT(*) FILTER (WHERE outcome='EXECUTED')::int AS executed,
       COUNT(*) FILTER (WHERE outcome='EXECUTION_FAILED')::int AS execution_failed,
       COUNT(*) FILTER (WHERE outcome='ANSWERED')::int AS answered
      FROM minh_decision_feedback
     WHERE tenant_id=$1::uuid
       AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
     GROUP BY (created_at AT TIME ZONE 'UTC')::date
     ORDER BY (created_at AT TIME ZONE 'UTC')::date`,
    [tenantId, windowDays],
  );
  return {
    windowDays,
    granularity: 'day',
    points: result.rows,
    empty: result.rows.length === 0,
    rawPayloadIncluded: false,
    rawAnswerIncluded: false,
    providerPayloadIncluded: false,
  };
}

export async function getMinhDecisionLearningTrend(
  tenantId: string,
  days = 30,
): Promise<MinhDecisionLearningTrend> {
  const windowDays = normalizeMinhLearningWindow(days);
  return withTenantContext(tenantId, client => queryMinhDecisionLearningTrend(client, tenantId, windowDays));
}

/**
 * Build the archival export from the exact same bounded, categorical dataset
 * used by the operator trend. Keep this as a named service boundary so future
 * export formats cannot accidentally reach the learning ledger's raw fields.
 */
export async function getMinhDecisionLearningSnapshot(
  tenantId: string,
  days = 30,
): Promise<MinhDecisionLearningSnapshot> {
  return getMinhDecisionLearningTrend(tenantId, days);
}

export async function getMinhDecisionLearning(tenantId: string, days = 30) {
  const windowDays = normalizeMinhLearningWindow(days);
  return withTenantContext(tenantId, async client => {
    const [totals, byOutcome, byCategory, byAction, recent] = await Promise.all([
      client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE outcome='APPROVED')::int AS approved,
           COUNT(*) FILTER (WHERE outcome='REJECTED')::int AS rejected,
           COUNT(*) FILTER (WHERE outcome='EXECUTED')::int AS executed,
           COUNT(*) FILTER (WHERE outcome='EXECUTION_FAILED')::int AS execution_failed,
           COUNT(*) FILTER (WHERE outcome='ANSWERED')::int AS answered
         FROM minh_decision_feedback
        WHERE tenant_id=$1::uuid
          AND created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [tenantId, windowDays],
      ),
      client.query(
        `SELECT outcome, COUNT(*)::int AS count
           FROM minh_decision_feedback
          WHERE tenant_id=$1::uuid
            AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          GROUP BY outcome
          ORDER BY outcome`,
        [tenantId, windowDays],
      ),
      client.query(
        `SELECT COALESCE(NULLIF(feedback_category, ''), 'UNSPECIFIED') AS category,
                COUNT(*)::int AS count
           FROM minh_decision_feedback
          WHERE tenant_id=$1::uuid
            AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          GROUP BY COALESCE(NULLIF(feedback_category, ''), 'UNSPECIFIED')
          ORDER BY category`,
        [tenantId, windowDays],
      ),
      client.query(
        `SELECT action_type, outcome, COUNT(*)::int AS count
           FROM minh_decision_feedback
          WHERE tenant_id=$1::uuid
            AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          GROUP BY action_type, outcome
          ORDER BY action_type, outcome`,
        [tenantId, windowDays],
      ),
      client.query(
        `SELECT action_type, outcome, feedback_category, created_at
           FROM minh_decision_feedback
           WHERE tenant_id=$1::uuid
             AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 20`,
        [tenantId, windowDays],
      ),
    ]);
    return {
      windowDays,
      totals: totals.rows[0] || {
        total: 0, approved: 0, rejected: 0, executed: 0, execution_failed: 0, answered: 0,
      },
      byOutcome: byOutcome.rows,
      byCategory: byCategory.rows,
      byAction: byAction.rows,
      recent: recent.rows,
      rawPayloadIncluded: false,
      rawAnswerIncluded: false,
      providerPayloadIncluded: false,
    };
  });
}