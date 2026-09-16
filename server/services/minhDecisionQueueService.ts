import { withTenantContext } from '../db';
import { evaluateMarketingApproval } from '../ai/agentGuardrails';
import {
  approvalRequestRepository,
  MINH_PROACTIVE_CHANNEL,
  MINH_PROACTIVE_APPROVAL_TTL_HOURS,
  type HighImpactAction,
} from '../repositories/approvalRequestRepository';
import { logger } from '../middleware/logger';
import { notificationRepository } from '../repositories/notificationRepository';
import {
  reclassifyMinhActiveBrainAction,
  validateMinhActiveBrainDecision,
  type MinhActiveBrainDecision,
} from '../ai/minhActiveBrainContract';

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
  rollout: 'SHADOW' | 'CANARY_25' | 'CANARY_50' | 'LIVE';
  canarySkipped: number;
  rolloutSkipped: boolean;
};

export type MinhProactiveRollout = {
  rollout: 'SHADOW' | 'CANARY_25' | 'CANARY_50' | 'LIVE';
  active: boolean;
  capabilityKey: string;
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

function priorityLabel(priority: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
  const value = Number(priority);
  if (!Number.isFinite(value)) return 'MEDIUM';
  if (value >= 75) return 'HIGH';
  if (value >= 50) return 'MEDIUM';
  return 'LOW';
}

function buildApprovalData(signal: OpportunitySignalRow, actionType: HighImpactAction) {
  const payload = parseSignalPayload(signal.payload);
  const sourceDecision = payload.activeBrainDecision as MinhActiveBrainDecision | undefined;
  const contractErrors = validateMinhActiveBrainDecision(sourceDecision);
  if (contractErrors.length > 0) {
    const error = new Error(`MINH_ACTIVE_BRAIN_CONTRACT_INVALID:${contractErrors.join('|')}`);
    (error as any).code = 'MINH_ACTIVE_BRAIN_CONTRACT_INVALID';
    throw error;
  }
  const kind = safeText(payload.kind, 80);
  const expiresAt = new Date(Date.now() + MINH_PROACTIVE_APPROVAL_TTL_HOURS * 3600000);
  const title = safeText(payload.title, 240) || `Minh đề xuất xử lý ${kind}`;
  const rationale = safeText(payload.rationale, 1000);
  const evidence = payload.evidence && typeof payload.evidence === 'object' && !Array.isArray(payload.evidence)
    ? payload.evidence
    : {};
  const idempotencyKey = `minh-proactive:${signal.id}:${actionType}`;
  const activeBrainDecision = reclassifyMinhActiveBrainAction(sourceDecision!, {
    mode: 'SUGGEST',
    type: actionType,
    approvalRequired: true,
    approvalReason: 'Đây là đề xuất chủ động; broker phải xem và duyệt trước khi có hành động tiếp theo.',
    idempotencyKey,
    duplicateRecordBehavior: 'REPLAY_EXISTING_APPROVAL_REQUEST',
    duplicateMessageBehavior: 'NO_PROVIDER_MESSAGE_UNTIL_MANUAL_SEND',
  });

  const approvalPayload: Record<string, unknown> = {
    schemaVersion: 3,
    // Week 5 decision-queue schema fields, kept alongside the original
    // field names below so existing readers of this payload keep working.
    opportunityId: signal.id,
    entityType: signal.subject_type,
    entityId: signal.subject_id,
    detector: kind.toLowerCase(),
    priority: priorityLabel(payload.priority),
    confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : undefined,
    requiredApproval: true,
    expiresAt: expiresAt.toISOString(),
    dedupeKey: `${kind.toLowerCase()}:${signal.subject_type || 'unknown'}:${signal.subject_id}:${new Date().toISOString().slice(0, 10)}`,
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
    activeBrainDecision,
    draftText: actionType === 'DRAFT_PROACTIVE_FOLLOWUP'
      ? 'Soạn follow-up để xác minh lại nhu cầu và thời điểm phù hợp của khách; chưa gửi tin.'
      : undefined,
  };

  if (actionType === 'DRAFT_PROACTIVE_FOLLOWUP') {
    approvalPayload.suggestedActionPayload = { draftText: approvalPayload.draftText };
  }

  return {
    tenantId: '',
    leadId: signal.subject_type === 'lead' ? signal.subject_id : null,
    actionType,
    channel: MINH_PROACTIVE_CHANNEL,
    sourceSignalId: signal.id,
    subjectType: signal.subject_type,
    subjectId: signal.subject_id,
    idempotencyKey,
    reasoning: rationale || title,
    expiresAt,
    payload: approvalPayload,
  };
}

async function readBudget(tenantId: string): Promise<{
  used: number; budget: number; exceeded: boolean;
  proactiveDetectionsPerTenantPerDay: number;
  proactiveSuggestionsPerTenantPerDay: number;
  proactiveApprovalsPending: number;
  proactiveActionsExecutedPerDay: number;
}> {
  const counts = await withTenantContext(tenantId, async client => {
    const [suggestions, detections, pending, executed] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS n FROM approval_requests
          WHERE tenant_id=$1::uuid AND channel=$2 AND requested_at >= CURRENT_DATE`,
        [tenantId, MINH_PROACTIVE_CHANNEL],
      ),
      client.query(
        `SELECT COUNT(*)::int AS n FROM agent_signals
          WHERE tenant_id=$1::uuid AND signal_type='proactive_opportunity' AND created_at >= CURRENT_DATE`,
        [tenantId],
      ),
      client.query(
        `SELECT COUNT(*)::int AS n FROM approval_requests
          WHERE tenant_id=$1::uuid AND channel=$2 AND status='PENDING'`,
        [tenantId, MINH_PROACTIVE_CHANNEL],
      ),
      client.query(
        `SELECT COUNT(*)::int AS n FROM approval_requests
          WHERE tenant_id=$1::uuid AND channel=$2 AND status='APPROVED' AND resumed_at >= CURRENT_DATE`,
        [tenantId, MINH_PROACTIVE_CHANNEL],
      ),
    ]);
    return {
      suggestions: Number(suggestions.rows[0]?.n || 0),
      detections: Number(detections.rows[0]?.n || 0),
      pending: Number(pending.rows[0]?.n || 0),
      executed: Number(executed.rows[0]?.n || 0),
    };
  });
  return {
    used: counts.suggestions,
    budget: MINH_PROACTIVE_DAILY_BUDGET,
    exceeded: counts.suggestions >= MINH_PROACTIVE_DAILY_BUDGET,
    proactiveDetectionsPerTenantPerDay: counts.detections,
    proactiveSuggestionsPerTenantPerDay: counts.suggestions,
    proactiveApprovalsPending: counts.pending,
    proactiveActionsExecutedPerDay: counts.executed,
  };
}

export async function getMinhProactiveRollout(tenantId: string): Promise<MinhProactiveRollout> {
  const result = await withTenantContext(tenantId, client => client.query(
    `SELECT capability_key, rollout, active
       FROM marketing_growth_capabilities
      WHERE tenant_id=$1::uuid AND capability_key='MINH_PROACTIVE_DECISION_QUEUE'
      LIMIT 1`,
    [tenantId],
  ));
  const row = result.rows[0];
  if (!row) {
    return { capabilityKey: 'MINH_PROACTIVE_DECISION_QUEUE', rollout: 'SHADOW', active: false };
  }
  const rollout = ['SHADOW', 'CANARY_25', 'CANARY_50', 'LIVE'].includes(row.rollout)
    ? row.rollout
    : 'SHADOW';
  return { capabilityKey: row.capability_key, rollout, active: row.active === true };
}

function canaryBucket(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isSelectedForRollout(rollout: MinhProactiveRollout['rollout'], signalId: string): boolean {
  if (rollout === 'LIVE') return true;
  if (rollout === 'CANARY_50') return canaryBucket(signalId) < 50;
  if (rollout === 'CANARY_25') return canaryBucket(signalId) < 25;
  return false;
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
  const sourceContractErrors = validateMinhActiveBrainDecision(
    parseSignalPayload(signal.payload).activeBrainDecision,
  );
  if (sourceContractErrors.length > 0) {
    const error = new Error(`MINH_ACTIVE_BRAIN_CONTRACT_INVALID:${sourceContractErrors.join('|')}`);
    (error as any).code = 'MINH_ACTIVE_BRAIN_CONTRACT_INVALID';
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
  const rollout = await getMinhProactiveRollout(tenantId);
  const initialBudget = await readBudget(tenantId);
  const summary: MinhDecisionQueueSummary = {
    created: 0,
    existing: 0,
    skipped: 0,
    budgetUsed: initialBudget.used,
    budget: initialBudget.budget,
    budgetExceeded: initialBudget.exceeded,
    rollout: rollout.rollout,
    canarySkipped: 0,
    rolloutSkipped: !rollout.active || rollout.rollout === 'SHADOW',
  };
  if (summary.rolloutSkipped) return summary;

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

  for (const candidate of candidates) {
    if (!isSelectedForRollout(rollout.rollout, candidate.id)) {
      summary.canarySkipped++;
      continue;
    }
    const actionType = actionForKind(parseSignalPayload(candidate.payload).kind);
    if (!actionType) {
      summary.skipped++;
      continue;
    }
    try {
      // Week 5: the repository reports whether this suggestion was reused
      // (duplicate signal, or the lead's one-per-day cap) via `reused`, so a
      // second, racy existence check here is no longer needed.
      const request = await suggestMinhOpportunity(tenantId, candidate.id);
      if (request?.reused) summary.existing++;
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

  // Week 5 STOP_SUGGESTING rule: once the daily proactive budget is spent,
  // keep the underlying signals (they stay in agent_signals untouched) but
  // stop pushing new suggestions, and raise an operational alert so staff
  // know detection kept running while suggestion output is paused.
  if (summary.budgetExceeded) {
    try {
      await notificationRepository.createForTenantAdmins(tenantId, {
        type: 'MINH_PROACTIVE_BUDGET_EXCEEDED',
        title: 'Minh proactive budget da het cho hom nay',
        body: `Da dat gioi han ${summary.budget} de xuat proactive/ngay. Tin hieu van duoc luu, nhung se khong gui them de xuat moi cho den ngay mai.`,
        metadata: { budgetUsed: summary.budgetUsed, budget: summary.budget },
        dedupeKey: `minh-proactive-budget:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (error) {
      logger.warn(`[MinhDecisionQueue] failed to raise STOP_SUGGESTING alert tenant=${tenantId}: ${(error as any)?.message || error}`);
    }
  }

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