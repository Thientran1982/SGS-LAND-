import { withTenantContext } from '../db';
import { evaluateMarketingApproval } from '../ai/agentGuardrails';
import {
  approvalRequestRepository,
  MINH_PROACTIVE_CHANNEL,
  type HighImpactAction,
} from '../repositories/approvalRequestRepository';
import { logger } from '../middleware/logger';

export const DEFAULT_MINH_PROACTIVE_DAILY_BUDGET = 20;
export const MINH_PROACTIVE_DAILY_BUDGET = Math.max(
  1,
  Number(process.env.MINH_PROACTIVE_DAILY_BUDGET || DEFAULT_MINH_PROACTIVE_DAILY_BUDGET),
);

type OpportunitySignalRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  payload: Record<string, unknown> | string | null;
};

export type MinhDecisionQueueSummary = {
  created: number;
  existing: number;
  skipped: number;
  budgetUsed: number;
  budget: number;
  budgetExceeded: boolean;
};

function actionForKind(kind: unknown): HighImpactAction | null {
  if (kind === 'COLD_LEAD') return 'DRAFT_PROACTIVE_FOLLOWUP';
  if (kind === 'MARKET_PRICE_DRIFT') return 'REVIEW_LISTING_PRICE';
  if (kind === 'CSAT_DROP') return 'REVIEW_CSAT_DROP';
  return null;
}

function safeText(value: unknown, max = 1000): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseSignalPayload(value: OpportunitySignalRow['payload']): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function buildApprovalData(signal: OpportunitySignalRow, actionType: HighImpactAction) {
  const payload = parseSignalPayload(signal.payload);
  const kind = safeText(payload.kind, 80);
  const title = safeText(payload.title, 240) || `Minh đề xuất xử lý ${kind}`;
  const rationale = safeText(payload.rationale, 1000);
  const evidence = payload.evidence && typeof payload.evidence === 'object' && !Array.isArray(payload.evidence)
    ? payload.evidence
    : {};

  const approvalPayload: Record<string, unknown> = {
    schemaVersion: 1,
    sourceSignalId: signal.id,
    opportunityKind: kind,
    subjectType: signal.subject_type,
    subjectId: signal.subject_id,
    title,
    rationale,
    evidence,
    permission: 'SUGGEST',
    actionCreated: false,
    suggestedAction: actionType,
    draftText: actionType === 'DRAFT_PROACTIVE_FOLLOWUP'
      ? 'Soạn follow-up để xác minh lại nhu cầu và thời điểm phù hợp của khách; chưa gửi tin.'
      : undefined,
  };

  return {
    tenantId: '',
    leadId: signal.subject_type === 'lead' ? signal.subject_id : null,
    actionType,
    channel: MINH_PROACTIVE_CHANNEL,
    sourceSignalId: signal.id,
    subjectType: signal.subject_type,
    subjectId: signal.subject_id,
    idempotencyKey: `minh-proactive:${signal.id}:${actionType}`,
    reasoning: rationale || title,
    payload: approvalPayload,
  };
}

async function readBudget(tenantId: string): Promise<{ used: number; budget: number; exceeded: boolean }> {
  const result = await withTenantContext(tenantId, client => client.query(
    `SELECT COUNT(*)::int AS used
       FROM approval_requests
      WHERE tenant_id=$1::uuid AND channel=$2 AND requested_at >= CURRENT_DATE`,
    [tenantId, MINH_PROACTIVE_CHANNEL],
  ));
  const used = Number(result.rows[0]?.used || 0);
  return { used, budget: MINH_PROACTIVE_DAILY_BUDGET, exceeded: used >= MINH_PROACTIVE_DAILY_BUDGET };
}

export async function getMinhProactiveBudgetStatus(tenantId: string) {
  return readBudget(tenantId);
}

export async function suggestMinhOpportunity(
  tenantId: string,
  signalId: string,
  requestedBy?: string,
): Promise<any> {
  const signal = await withTenantContext(tenantId, async client => {
    const result = await client.query(
      `SELECT id, subject_type, subject_id, payload
         FROM agent_signals
        WHERE tenant_id=$1::uuid AND id=$2::text AND signal_type='proactive_opportunity'
        LIMIT 1`,
      [tenantId, signalId],
    );
    return result.rows[0] as OpportunitySignalRow | undefined;
  });
  if (!signal) {
    const error = new Error('MINH_OPPORTUNITY_NOT_FOUND');
    (error as any).code = 'MINH_OPPORTUNITY_NOT_FOUND';
    throw error;
  }
  const actionType = actionForKind(parseSignalPayload(signal.payload).kind);
  if (!actionType) {
    const error = new Error('MINH_OPPORTUNITY_ACTION_UNSUPPORTED');
    (error as any).code = 'MINH_OPPORTUNITY_ACTION_UNSUPPORTED';
    throw error;
  }
  const data = buildApprovalData(signal, actionType);
  data.tenantId = tenantId;
  if (requestedBy) data.payload.requestedBy = requestedBy;
  return approvalRequestRepository.createProactive(data, MINH_PROACTIVE_DAILY_BUDGET);
}

export async function enqueueMinhOpportunitySuggestions(
  tenantId: string,
  limit = MINH_PROACTIVE_DAILY_BUDGET,
): Promise<MinhDecisionQueueSummary> {
  const candidates = await withTenantContext(tenantId, async client => {
    const result = await client.query(
      `SELECT s.id, s.subject_type, s.subject_id, s.payload
         FROM agent_signals s
        WHERE s.tenant_id=$1::uuid
          AND s.signal_type='proactive_opportunity'
          AND s.created_at >= CURRENT_DATE
          AND NOT EXISTS (
            SELECT 1 FROM approval_requests ar
             WHERE ar.tenant_id=$1::uuid AND ar.source_signal_id=s.id
          )
        ORDER BY COALESCE((s.payload::jsonb->>'priority')::int, 0) DESC, s.created_at ASC
        LIMIT $2`,
      [tenantId, Math.max(1, Math.min(50, limit))],
    );
    return result.rows as OpportunitySignalRow[];
  });

  const summary: MinhDecisionQueueSummary = {
    created: 0,
    existing: 0,
    skipped: 0,
    budgetUsed: 0,
    budget: MINH_PROACTIVE_DAILY_BUDGET,
    budgetExceeded: false,
  };
  for (const candidate of candidates) {
    const actionType = actionForKind(parseSignalPayload(candidate.payload).kind);
    if (!actionType) {
      summary.skipped++;
      continue;
    }
    try {
      const existing = await withTenantContext(tenantId, client => client.query(
        `SELECT id FROM approval_requests
          WHERE tenant_id=$1::uuid AND source_signal_id=$2::text
          LIMIT 1`,
        [tenantId, candidate.id],
      ));
      const request = await suggestMinhOpportunity(tenantId, candidate.id);
      if (existing.rows[0]) summary.existing++;
      else if (request) summary.created++;
    } catch (error: any) {
      if (error?.code === 'MINH_PROACTIVE_BUDGET_EXCEEDED') {
        summary.budgetExceeded = true;
        break;
      }
      summary.skipped++;
      logger.warn(`[MinhDecisionQueue] suggestion skipped tenant=${tenantId}: ${error?.message || error}`);
    }
  }
  const budget = await readBudget(tenantId).catch(() => ({
    used: summary.created,
    budget: MINH_PROACTIVE_DAILY_BUDGET,
    exceeded: summary.budgetExceeded,
  }));
  summary.budgetUsed = budget.used;
  summary.budget = budget.budget;
  summary.budgetExceeded ||= budget.exceeded;
  return summary;
}

export async function listMinhDecisionQueue(tenantId: string, limit = 50) {
  return approvalRequestRepository.findPendingProactiveByTenant(tenantId, Math.max(1, Math.min(100, limit)));
}

export function validateProactiveApprovalBoundary(actionType: string, consentValid?: boolean) {
  if (actionType === 'DRAFT_PROACTIVE_FOLLOWUP') {
    return evaluateMarketingApproval({
      capability: 'PROACTIVE_DRAFT',
    });
  }
  return evaluateMarketingApproval({ capability: 'PROACTIVE_REVIEW' });
}