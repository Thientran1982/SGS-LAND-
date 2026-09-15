import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withTenantContext, getMinhBrainHealth, listMinhOpportunities, getMinhBrainSchedulerSnapshot } = vi.hoisted(() => ({
  withTenantContext: vi.fn(),
  getMinhBrainHealth: vi.fn(),
  listMinhOpportunities: vi.fn(),
  getMinhBrainSchedulerSnapshot: vi.fn(),
}));

vi.mock('../db', () => ({ withTenantContext }));
vi.mock('../middleware/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('../ai/minhHealth', () => ({ getMinhBrainHealth }));
vi.mock('../services/minhOpportunityDetectors', () => ({ listMinhOpportunities }));
vi.mock('../services/minhBrainScheduler', () => ({ getMinhBrainSchedulerSnapshot }));

import { getCommandCenterSummary } from '../services/commandCenterService';

const TENANT_ID = 'tenant-a';

function healthyBrain() {
  return {
    tenantId: TENANT_ID,
    mode: 'legacy',
    budget: { used: 1, budget: 10, exceeded: false },
    calibration: 'ok',
    delegations7d: 4,
    delegationSuccess7d: 3,
    capabilityGaps7d: 1,
    sloBreaches24h: 2,
    byIntent: [],
  };
}

function schedulerSnapshot() {
  return {
    mode: 'shadow',
    enabled: true,
    startedAt: '2026-09-15T09:00:00.000Z',
    lastTickAt: '2026-09-15T10:00:00.000Z',
    tickCount: 4,
    lastStatus: 'OBSERVED',
    tenantCount: 1,
    lastTraceId: 'trace-1',
    jobs: [],
  };
}

type QueryHandler = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

function setupDatabase(queryHandler?: QueryHandler) {
  const query = vi.fn<QueryHandler>(queryHandler || (async (sql: string) => {
    if (sql.includes('agent_executions')) return { rows: [{ status: 'ERROR', count: 2 }] };
    if (sql.includes('approval_requests')) {
      return {
        rows: [{
          id: 'approval-1',
          action_type: 'NEW_ACTION_NOT_YET_CLASSIFIED',
          payload: { source: 'test' },
          status: 'PENDING',
          review_note: null,
          requested_at: '2026-09-15T09:00:00.000Z',
          expires_at: null,
        }],
      };
    }
    if (sql.includes('ai_learning_candidates') && sql.includes("status='CANARY'")) {
      return { rows: [] };
    }
    if (sql.includes('ai_learning_candidates')) {
      return {
        rows: [{
          id: 'candidate-1',
          agent_key: 'writer',
          status: 'CANDIDATE',
          gate_summary: { passed: true },
          created_at: '2026-09-15T08:00:00.000Z',
        }],
      };
    }
    if (sql.includes('ai_learning_cycles')) {
      return {
        rows: [{
          id: 'cycle-1',
          cycle_key: 'cycle-1',
          status: 'PASSED',
          summary_json: {},
          started_at: '2026-09-15T07:00:00.000Z',
          finished_at: '2026-09-15T07:30:00.000Z',
        }],
      };
    }
    if (sql.includes('ai_promotion_decisions')) return { rows: [] };
    if (sql.includes('agent_operating_events')) {
      return { rows: [{ dead_letter: 0, stale_lease: 0, last_done_at: null }] };
    }
    if (sql.includes('agent_signals')) return { rows: [{ c: 0 }] };
    return { rows: [] };
  }));

  withTenantContext.mockImplementation(async (tenantId: string, callback: (client: { query: QueryHandler }) => unknown) => {
    return callback({ query });
  });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  getMinhBrainHealth.mockResolvedValue(healthyBrain());
  listMinhOpportunities.mockResolvedValue([]);
  getMinhBrainSchedulerSnapshot.mockReturnValue(schedulerSnapshot());
  setupDatabase();
});

describe('Command Center service contract', () => {
  it('keeps all panel reads tenant-scoped and preserves available data', async () => {
    const query = setupDatabase();
    listMinhOpportunities.mockResolvedValue([{
      id: 'opportunity-1',
      detector: 'cold_lead',
      priority: 'HIGH',
      confidence: 0.9,
      evidence: { count: 1 },
    }]);

    const summary = await getCommandCenterSummary(TENANT_ID);

    expect(summary.brainHealth.state).toBe('available');
    expect(summary.opportunityQueue).toMatchObject({
      state: 'available',
      data: [{ opportunityId: 'opportunity-1', tenantId: TENANT_ID }],
    });
    expect(summary.approvalQueue.data?.[0]).toMatchObject({
      risk: 'HIGH',
      requiredApprover: 'SUPER_ADMIN',
    });
    expect(withTenantContext).toHaveBeenCalled();
    expect(withTenantContext.mock.calls.every(([tenantId]) => tenantId === TENANT_ID)).toBe(true);
    expect(listMinhOpportunities).toHaveBeenCalledWith(TENANT_ID, 50);
    expect(query.mock.calls.every(([, params]) => params?.[0] === TENANT_ID)).toBe(true);
  });

  it('keeps panel availability independent when individual sources degrade or fail', async () => {
    getMinhBrainHealth.mockRejectedValue(new Error('health unavailable'));
    listMinhOpportunities.mockRejectedValue(new Error('opportunity unavailable'));
    getMinhBrainSchedulerSnapshot.mockReturnValue(schedulerSnapshot());

    const query = setupDatabase(async (sql: string) => {
      if (sql.includes('approval_requests')) throw new Error('approval unavailable');
      if (sql.includes('ai_learning_candidates') && !sql.includes("status='CANARY'")) {
        throw new Error('candidate unavailable');
      }
      if (sql.includes('agent_operating_events')) throw new Error('events unavailable');
      if (sql.includes('agent_executions')) throw new Error('execution counts unavailable');
      if (sql.includes('ai_learning_candidates') && sql.includes("status='CANARY'")) return { rows: [] };
      if (sql.includes('ai_learning_cycles')) return { rows: [] };
      if (sql.includes('ai_promotion_decisions')) return { rows: [] };
      if (sql.includes('agent_signals')) return { rows: [{ c: 1 }] };
      return { rows: [] };
    });

    const summary = await getCommandCenterSummary(TENANT_ID);

    expect(summary.brainHealth).toMatchObject({ state: 'unavailable', data: null });
    expect(summary.opportunityQueue).toMatchObject({ state: 'unavailable', data: null });
    expect(summary.approvalQueue).toMatchObject({ state: 'unavailable', data: null });
    expect(summary.learningStatus.state).toBe('degraded');
    expect(summary.schedulerRepair.state).toBe('degraded');
    expect(summary.schedulerRepair.data).toMatchObject({
      deadLetterCount: null,
      staleLeaseCount: null,
      repairSpikeCount7d: 1,
    });
    expect(query).toHaveBeenCalled();
  });

  it('limits brain error counts to the 24-hour window and does not count scheduler observation as a successful run', async () => {
    const query = setupDatabase(async (sql: string) => {
      if (sql.includes('agent_executions')) return { rows: [{ status: 'ERROR', count: 3 }] };
      if (sql.includes('agent_operating_events')) {
        return { rows: [{ dead_letter: 0, stale_lease: 0, last_done_at: null }] };
      }
      if (sql.includes('agent_signals')) return { rows: [{ c: 0 }] };
      return { rows: [] };
    });

    const summary = await getCommandCenterSummary(TENANT_ID);
    const executionQuery = query.mock.calls.find(([sql]) => String(sql).includes('agent_executions'));

    expect(executionQuery?.[0]).toMatch(/created_at\s*>=\s*NOW\(\)\s*-\s*INTERVAL '24 hours'/);
    expect(executionQuery?.[0]).toContain("status='ERROR'");
    expect(summary.brainHealth.data).toMatchObject({ errors24h: 3 });
    expect(summary.schedulerRepair.data).toMatchObject({
      timer: { lastStatus: 'OBSERVED' },
      lastSuccessfulRunAt: null,
    });
  });
});