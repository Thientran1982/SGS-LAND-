import { withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { getMinhBrainHealth } from '../ai/minhHealth';
import { listMinhOpportunities } from './minhOpportunityDetectors';
import { getMinhBrainSchedulerSnapshot } from './minhBrainScheduler';

// Tuan 6 - Command Center: 5-panel operational dashboard for Minh's Brain.
// Every panel must show one of 4 explicit states: available | unavailable |
// degraded | not_loaded, and must NEVER render a fake 0 when the underlying
// database/panel has not actually loaded. `not_loaded` only exists on the
// frontend before the first fetch resolves; this service only ever returns
// available | degraded | unavailable.
export type CommandCenterPanelState = 'available' | 'unavailable' | 'degraded' | 'not_loaded';

export interface CommandCenterPanel<T> {
  state: CommandCenterPanelState;
  data: T | null;
  message?: string;
}

function ok<T>(data: T): CommandCenterPanel<T> {
  return { state: 'available', data };
}
function partial<T>(data: T, message: string): CommandCenterPanel<T> {
  return { state: 'degraded', data, message };
}
function fail<T>(message: string): CommandCenterPanel<T> {
  return { state: 'unavailable', data: null, message };
}

export interface BrainHealthData {
  delegations7d: number;
  delegationSuccess7d: number;
  capabilityGaps7d: number;
  latencySloBreaches24h: number;
  pendingRuns: number | null;
  errors24h: number | null;
}

async function buildBrainHealthPanel(tenantId: string): Promise<CommandCenterPanel<BrainHealthData>> {
  let health: Awaited<ReturnType<typeof getMinhBrainHealth>>;
  try {
    health = await getMinhBrainHealth(tenantId);
  } catch (error: any) {
    logger.warn(`[CommandCenter] brain health unavailable tenant=${tenantId}: ${error?.message || error}`);
    return fail('Khong the tai Brain health; delegation/latency/error chua kha dung.');
  }
  const base = {
    delegations7d: health.delegations7d,
    delegationSuccess7d: health.delegationSuccess7d,
    capabilityGaps7d: health.capabilityGaps7d,
    latencySloBreaches24h: health.sloBreaches24h,
  };
  try {
    const execCounts = await withTenantContext(tenantId, client => client.query(
      `SELECT status, COUNT(*)::int AS count
         FROM agent_executions
        WHERE tenant_id=$1
          AND status='ERROR'
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY status`,
      [tenantId],
    ));
    const byStatus = new Map(execCounts.rows.map((row: any) => [String(row.status), Number(row.count)]));
    return ok({
      ...base,
      pendingRuns: byStatus.get('RUNNING') ?? 0,
      errors24h: byStatus.get('ERROR') ?? 0,
    });
  } catch (error: any) {
    logger.warn(`[CommandCenter] agent_executions counts degraded tenant=${tenantId}: ${error?.message || error}`);
    return partial(
      { ...base, pendingRuns: null, errors24h: null },
      'Delegation va capability gap da tai; pending runs/error tam thoi chua doc duoc.',
    );
  }
}

export interface OpportunityQueueItem {
  opportunityId: string;
  tenantId: string;
  detector: string | null;
  entityType: string | null;
  entityId: string | null;
  priority: string | number | null;
  confidence: number | null;
  evidence: unknown;
  expiresAt: string | null;
  suggestedAction: { type: string | null; payload?: unknown } | null;
  approvalStatus: string | null;
  activeBrainDecision: unknown;
}

async function buildOpportunityQueuePanel(tenantId: string): Promise<CommandCenterPanel<OpportunityQueueItem[]>> {
  try {
    const rows: any[] = await listMinhOpportunities(tenantId, 50);
    const items: OpportunityQueueItem[] = rows.map((row: any) => ({
      opportunityId: String(row.opportunityId || row.id),
      tenantId,
      detector: row.detector ?? null,
      entityType: row.entityType ?? row.subjectType ?? null,
      entityId: row.entityId ?? row.subjectId ?? null,
      priority: row.priority ?? null,
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
      evidence: row.evidence ?? row.summary ?? row.metrics ?? null,
      expiresAt: row.expiresAt ?? null,
      suggestedAction: row.suggestedAction ?? (row.approval?.actionType ? { type: row.approval.actionType } : null),
      approvalStatus: row.approval?.status ?? null,
      activeBrainDecision: row.activeBrainDecision ?? null,
    }));
    return ok(items);
  } catch (error: any) {
    logger.warn(`[CommandCenter] opportunity queue unavailable tenant=${tenantId}: ${error?.message || error}`);
    return fail('Khong the tai Opportunity queue; detector chua tra ve du lieu.');
  }
}

const HIGH_RISK_ACTIONS = new Set([
  'REVIEW_REPAIR_SPIKE',
  'PROMOTE_LEARNING_CANDIDATE',
  'ROLLBACK_LEARNING_CANDIDATE',
]);
const MEDIUM_RISK_ACTIONS = new Set([
  'REVIEW_LISTING_PRICE',
  'REVIEW_CSAT_DROP',
  'DRAFT_PROACTIVE_FOLLOWUP',
]);

function riskForActionType(actionType: string | null): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!actionType) return 'MEDIUM';
  if (HIGH_RISK_ACTIONS.has(actionType)) return 'HIGH';
  if (MEDIUM_RISK_ACTIONS.has(actionType)) return 'MEDIUM';
  // Unknown actions must fail closed. A new action should not silently
  // inherit the least restrictive approval requirement.
  return 'HIGH';
}

function requiredApproverForRisk(risk: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  return risk === 'HIGH' ? 'SUPER_ADMIN' : 'STAFF';
}

export interface ApprovalQueueItem {
  id: string;
  actionType: string | null;
  payload: unknown;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredApprover: string;
  status: string;
  rejectionReason: string | null;
  requestedAt: string | null;
  expiresAt: string | null;
}

async function buildApprovalQueuePanel(tenantId: string): Promise<CommandCenterPanel<ApprovalQueueItem[]>> {
  try {
    const result = await withTenantContext(tenantId, client => client.query(
      `SELECT id, action_type, payload, status, review_note, requested_at, expires_at
         FROM approval_requests
        WHERE tenant_id=$1 AND archived_at IS NULL
        ORDER BY requested_at DESC
        LIMIT 50`,
      [tenantId],
    ));
    const items: ApprovalQueueItem[] = result.rows.map((row: any) => {
      const risk = riskForActionType(row.action_type);
      return {
        id: row.id,
        actionType: row.action_type,
        payload: row.payload,
        risk,
        requiredApprover: requiredApproverForRisk(risk),
        status: row.status,
        rejectionReason: row.status === 'REJECTED' ? (row.review_note ?? null) : null,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
      };
    });
    return ok(items);
  } catch (error: any) {
    logger.warn(`[CommandCenter] approval queue unavailable tenant=${tenantId}: ${error?.message || error}`);
    return fail('Khong the tai Approval queue; approval_requests chua doc duoc.');
  }
}

export interface LearningStatusData {
  candidate: { id: string; agentKey: string; status: string; createdAt: string; gateSummary: unknown } | null;
  evaluation: { id: string; cycleKey: string; status: string; startedAt: string; finishedAt: string | null; summary: unknown } | null;
  gateStatus: 'PASSED' | 'FAILED' | 'PENDING' | null;
  canary: { candidateId: string; agentKey: string; since: string } | null;
  regression: { failures: string[] } | null;
  rollback: { candidateId: string; reason: string; createdAt: string } | null;
}

async function buildLearningStatusPanel(tenantId: string): Promise<CommandCenterPanel<LearningStatusData>> {
  const failures: string[] = [];
  let candidateRow: any = null;
  let cycleRow: any = null;
  let canaryRow: any = null;
  let rollbackRow: any = null;

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT id, agent_key, status, gate_summary, created_at
         FROM ai_learning_candidates
        WHERE tenant_id=$1
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId],
    ));
    candidateRow = res.rows[0] || null;
  } catch (error: any) {
    failures.push('candidate');
    logger.warn(`[CommandCenter] ai_learning_candidates read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT id, cycle_key, status, summary_json, started_at, finished_at
         FROM ai_learning_cycles
        WHERE tenant_id=$1
        ORDER BY started_at DESC
        LIMIT 1`,
      [tenantId],
    ));
    cycleRow = res.rows[0] || null;
  } catch (error: any) {
    failures.push('evaluation');
    logger.warn(`[CommandCenter] ai_learning_cycles read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT id, agent_key, created_at
         FROM ai_learning_candidates
        WHERE tenant_id=$1 AND status='CANARY'
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId],
    ));
    canaryRow = res.rows[0] || null;
  } catch (error: any) {
    failures.push('canary');
    logger.warn(`[CommandCenter] canary read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT candidate_id, reason, created_at
         FROM ai_promotion_decisions
        WHERE tenant_id=$1 AND decision='ROLLBACK'
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId],
    ));
    rollbackRow = res.rows[0] || null;
  } catch (error: any) {
    failures.push('rollback');
    logger.warn(`[CommandCenter] ai_promotion_decisions read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  if (failures.length === 4) {
    return fail('Khong the tai Learning status; cac bang ai_learning_* chua doc duoc.');
  }

  const gateSummary: any = candidateRow?.gate_summary || null;
  let gateStatus: 'PASSED' | 'FAILED' | 'PENDING' | null = null;
  if (gateSummary && typeof gateSummary === 'object') {
    if (gateSummary.passed === true) gateStatus = 'PASSED';
    else if (gateSummary.passed === false) gateStatus = 'FAILED';
  }
  if (!gateStatus && cycleRow) {
    if (cycleRow.status === 'PASSED') gateStatus = 'PASSED';
    else if (cycleRow.status === 'FAILED') gateStatus = 'FAILED';
    else if (cycleRow.status === 'RUNNING') gateStatus = 'PENDING';
  }

  const regressionFailures: string[] = Array.isArray(gateSummary?.failures)
    ? gateSummary.failures.filter((f: any) => typeof f === 'string' && f.includes('regression'))
    : [];

  const data: LearningStatusData = {
    candidate: candidateRow ? {
      id: candidateRow.id,
      agentKey: candidateRow.agent_key,
      status: candidateRow.status,
      createdAt: candidateRow.created_at,
      gateSummary: candidateRow.gate_summary,
    } : null,
    evaluation: cycleRow ? {
      id: cycleRow.id,
      cycleKey: cycleRow.cycle_key,
      status: cycleRow.status,
      startedAt: cycleRow.started_at,
      finishedAt: cycleRow.finished_at,
      summary: cycleRow.summary_json,
    } : null,
    gateStatus,
    canary: canaryRow ? { candidateId: canaryRow.id, agentKey: canaryRow.agent_key, since: canaryRow.created_at } : null,
    regression: regressionFailures.length > 0 ? { failures: regressionFailures } : null,
    rollback: rollbackRow ? { candidateId: rollbackRow.candidate_id, reason: rollbackRow.reason, createdAt: rollbackRow.created_at } : null,
  };

  if (failures.length > 0) {
    return partial(data, `Mot so du lieu Learning status chua doc duoc: ${failures.join(', ')}.`);
  }
  return ok(data);
}

export interface SchedulerRepairData {
  timer: {
    mode: string;
    enabled: boolean;
    startedAt: string | null;
    lastTickAt: string | null;
    tickCount: number;
    lastStatus: string;
  };
  deadLetterCount: number | null;
  staleLeaseCount: number | null;
  repairSpikeCount7d: number | null;
  lastSuccessfulRunAt: string | null;
}

async function buildSchedulerRepairPanel(tenantId: string): Promise<CommandCenterPanel<SchedulerRepairData>> {
  let timer: SchedulerRepairData['timer'];
  try {
    const snapshot = getMinhBrainSchedulerSnapshot();
    timer = {
      mode: snapshot.mode,
      enabled: snapshot.enabled,
      startedAt: snapshot.startedAt,
      lastTickAt: snapshot.lastTickAt,
      tickCount: snapshot.tickCount,
      lastStatus: snapshot.lastStatus,
    };
  } catch (error: any) {
    logger.warn(`[CommandCenter] scheduler snapshot unavailable: ${error?.message || error}`);
    return fail('Khong the doc trang thai scheduler (minhBrainScheduler).');
  }

  const failures: string[] = [];
  let deadLetterCount: number | null = null;
  let staleLeaseCount: number | null = null;
  let repairSpikeCount7d: number | null = null;
  let lastSuccessfulRunAt: string | null = null;

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='DEAD_LETTER')::int AS dead_letter,
         COUNT(*) FILTER (WHERE lease_expires_at IS NOT NULL AND lease_expires_at < NOW()
                            AND status NOT IN ('DONE','DEAD_LETTER'))::int AS stale_lease,
         MAX(updated_at) FILTER (WHERE status='DONE') AS last_done_at
       FROM agent_operating_events
       WHERE tenant_id=$1`,
      [tenantId],
    ));
    const row: any = res.rows[0] || {};
    deadLetterCount = Number(row.dead_letter || 0);
    staleLeaseCount = Number(row.stale_lease || 0);
    lastSuccessfulRunAt = row.last_done_at || null;
  } catch (error: any) {
    failures.push('dead-letter/stale-lease');
    logger.warn(`[CommandCenter] agent_operating_events read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  try {
    const res = await withTenantContext(tenantId, client => client.query(
      `SELECT COUNT(*)::int AS c FROM agent_signals
        WHERE tenant_id=$1 AND signal_type='repair_spike_detected' AND created_at > NOW() - INTERVAL '7 days'`,
      [tenantId],
    ));
    repairSpikeCount7d = Number(res.rows[0]?.c || 0);
  } catch (error: any) {
    failures.push('repair-spike');
    logger.warn(`[CommandCenter] repair spike read failed tenant=${tenantId}: ${error?.message || error}`);
  }

  const data: SchedulerRepairData = { timer, deadLetterCount, staleLeaseCount, repairSpikeCount7d, lastSuccessfulRunAt };
  if (failures.length > 0) {
    return partial(data, `Mot so du lieu Scheduler/Repair chua doc duoc: ${failures.join(', ')}.`);
  }
  return ok(data);
}

export interface CommandCenterSummary {
  generatedAt: string;
  brainHealth: CommandCenterPanel<BrainHealthData>;
  opportunityQueue: CommandCenterPanel<OpportunityQueueItem[]>;
  approvalQueue: CommandCenterPanel<ApprovalQueueItem[]>;
  learningStatus: CommandCenterPanel<LearningStatusData>;
  schedulerRepair: CommandCenterPanel<SchedulerRepairData>;
}

export async function getCommandCenterSummary(tenantId: string): Promise<CommandCenterSummary> {
  const [brainHealth, opportunityQueue, approvalQueue, learningStatus, schedulerRepair] = await Promise.all([
    buildBrainHealthPanel(tenantId).catch((error: any) => {
      logger.warn(`[CommandCenter] brain health panel crashed tenant=${tenantId}: ${error?.message || error}`);
      return fail<BrainHealthData>('Loi khong xac dinh khi tai Brain health.');
    }),
    buildOpportunityQueuePanel(tenantId).catch((error: any) => {
      logger.warn(`[CommandCenter] opportunity queue panel crashed tenant=${tenantId}: ${error?.message || error}`);
      return fail<OpportunityQueueItem[]>('Loi khong xac dinh khi tai Opportunity queue.');
    }),
    buildApprovalQueuePanel(tenantId).catch((error: any) => {
      logger.warn(`[CommandCenter] approval queue panel crashed tenant=${tenantId}: ${error?.message || error}`);
      return fail<ApprovalQueueItem[]>('Loi khong xac dinh khi tai Approval queue.');
    }),
    buildLearningStatusPanel(tenantId).catch((error: any) => {
      logger.warn(`[CommandCenter] learning status panel crashed tenant=${tenantId}: ${error?.message || error}`);
      return fail<LearningStatusData>('Loi khong xac dinh khi tai Learning status.');
    }),
    buildSchedulerRepairPanel(tenantId).catch((error: any) => {
      logger.warn(`[CommandCenter] scheduler/repair panel crashed tenant=${tenantId}: ${error?.message || error}`);
      return fail<SchedulerRepairData>('Loi khong xac dinh khi tai Scheduler/Repair.');
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    brainHealth,
    opportunityQueue,
    approvalQueue,
    learningStatus,
    schedulerRepair,
  };
}
