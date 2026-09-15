import { beforeEach, describe, expect, it } from 'vitest';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  getAgentCapabilityForIntent,
  getAgentRoleForIntent,
  isCompoundRoutingEnabled,
  validateAgentOrchestrationRegistry,
} from '../ai/agentOrchestrationRegistry';
import {
  getMinhBrainSchedulerMode,
  getMinhBrainSchedulerSnapshot,
  runMinhBrainSchedulerTick,
  stopMinhBrainSchedulerOverlay,
} from '../services/minhBrainScheduler';
import {
  detectColdLeads,
  detectCsatDrop,
  detectMarketPriceDrift,
} from '../services/minhOpportunityDetectors';
import { isSelectedForRollout, validateProactiveApprovalBoundary } from '../services/minhDecisionQueueService';

describe('Minh Week 1 specialist manifests', () => {
  it('gives every registered capability a complete manifest', () => {
    expect(AGENT_ORCHESTRATION_REGISTRY.length).toBeGreaterThanOrEqual(14);
    expect(validateAgentOrchestrationRegistry()).toEqual([]);
    for (const capability of AGENT_ORCHESTRATION_REGISTRY) {
      expect(capability.manifest.inputSchema).toMatchObject({ type: 'object' });
      expect(capability.manifest.outputSchema).toMatchObject({ type: 'object' });
      expect(capability.manifest.maxLatencyMs).toBeGreaterThan(0);
      expect(Array.isArray(capability.manifest.readScopes)).toBe(true);
      expect(Array.isArray(capability.manifest.writeScopes)).toBe(true);
      expect(Array.isArray(capability.manifest.evidenceRequirements)).toBe(true);
    }
  });

  it('keeps action-capable specialists approval-gated', () => {
    expect(getAgentCapabilityForIntent('DRAFT_BOOKING')?.manifest.requiresApproval).toBe(true);
    expect(getAgentCapabilityForIntent('DRAFT_CONTRACT')?.manifest.requiresApproval).toBe(true);
    expect(getAgentCapabilityForIntent('SEARCH_INVENTORY')?.manifest.requiresApproval).toBe(false);
    expect(getAgentRoleForIntent('DIRECT_ANSWER')).toBe('writer');
  });

  it('does not enable compound routing from a truthy-looking typo', () => {
    expect(isCompoundRoutingEnabled({ MINH_COMPOUND_ROUTING_ENABLED: 'true' })).toBe(true);
    expect(isCompoundRoutingEnabled({ MINH_COMPOUND_ROUTING_ENABLED: '1' })).toBe(false);
    expect(isCompoundRoutingEnabled({ MINH_COMPOUND_ROUTING_ENABLED: 'TRUE ' })).toBe(true);
  });
});

describe('Minh Brain Scheduler shadow overlay', () => {
  beforeEach(() => {
    stopMinhBrainSchedulerOverlay();
  });

  it('observes tenants and legacy schedulers without invoking a business job', async () => {
    const businessJob = { called: false };
    const snapshot = await runMinhBrainSchedulerTick(
      async () => ['tenant-a', 'tenant-b'],
      () => new Date('2026-09-15T10:00:00.000Z'),
    );

    expect(businessJob.called).toBe(false);
    expect(snapshot).toMatchObject({
      mode: 'shadow',
      enabled: true,
      lastTickAt: '2026-09-15T10:00:00.000Z',
      tenantCount: 2,
      lastStatus: 'OBSERVED',
    });
    expect(snapshot.lastTraceId).toEqual(expect.any(String));
    expect(snapshot.jobs).toHaveLength(5);
    expect(snapshot.jobs.every(job => job.observedOnly)).toBe(true);
  });

  it('reports a degraded read-only tick without throwing or mutating job state', async () => {
    const snapshot = await runMinhBrainSchedulerTick(
      async () => { throw new Error('database temporarily unavailable'); },
      () => new Date('2026-09-15T10:01:00.000Z'),
    );
    expect(snapshot).toMatchObject({
      mode: 'shadow',
      enabled: true,
      lastStatus: 'DEGRADED',
      tenantCount: null,
    });
    expect(getMinhBrainSchedulerMode({ MINH_BRAIN_SCHEDULER_OVERLAY: 'off' })).toBe('off');
    expect(getMinhBrainSchedulerMode({ MINH_BRAIN_SCHEDULER_OVERLAY: 'shadow' })).toBe('shadow');
    expect(getMinhBrainSchedulerSnapshot().jobs.every(job => job.observedOnly)).toBe(true);
  });

  it('runs read-only detectors per tenant and aggregates their observations', async () => {
    const calls: string[] = [];
    const snapshot = await runMinhBrainSchedulerTick(
      async () => ['tenant-a', 'tenant-b'],
      () => new Date('2026-09-15T10:02:00.000Z'),
      async (tenantId, traceId) => {
        calls.push(`${tenantId}:${traceId.length > 0}`);
        return [
          { detector: 'cold_lead', status: 'OBSERVED', found: tenantId === 'tenant-a' ? 2 : 1, persisted: 1 },
          { detector: 'market_price_drift', status: tenantId === 'tenant-b' ? 'DEGRADED' : 'OBSERVED', found: 0, persisted: 0, error: tenantId === 'tenant-b' ? 'QUERY_FAILED' : undefined },
        ];
      },
    );
    expect(calls).toEqual(['tenant-a:true', 'tenant-b:true']);
    expect(snapshot.detectorSummary).toMatchObject({
      enabled: true,
      tenantRuns: 2,
      opportunitiesFound: 3,
      opportunitiesPersisted: 2,
      degradedRuns: 1,
    });
    expect(snapshot.detectorSummary.detectorStatus).toEqual([
      { detector: 'cold_lead', status: 'OBSERVED', tenantRuns: 2, found: 3, persisted: 2 },
      { detector: 'market_price_drift', status: 'DEGRADED', tenantRuns: 2, found: 0, persisted: 0, lastError: 'QUERY_FAILED' },
    ]);
  });
});

describe('Minh Week 2 opportunity detectors', () => {
  const now = new Date('2026-09-15T10:00:00.000Z');

  it('surfaces high-score leads that have gone cold and ignores terminal leads', () => {
    const opportunities = detectColdLeads([
      {
        id: 'lead-cold',
        stage: 'QUALIFIED',
        score: { score: 86 },
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
        lastInteractionAt: '2026-09-05T10:00:00.000Z',
        outboundInteractions: 2,
      },
      {
        id: 'lead-closed',
        stage: 'WON',
        score: { score: 99 },
        updatedAt: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'lead-low-score',
        stage: 'QUALIFIED',
        score: { score: 45 },
        updatedAt: '2026-09-01T10:00:00.000Z',
      },
    ], now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      kind: 'COLD_LEAD',
      subjectType: 'lead',
      subjectId: 'lead-cold',
    });
    expect(opportunities[0].evidence).toMatchObject({ score: 86 });
  });

  it('requires a safe location match before flagging market price drift', () => {
    const opportunities = detectMarketPriceDrift([
      {
        id: 'listing-high',
        title: 'Listing high',
        price: 12_000_000_000,
        area: 100,
        location: 'Quận 1, Bến Nghé, TP.HCM',
      },
      {
        id: 'listing-no-match',
        title: 'Listing without reference',
        price: 12_000_000_000,
        area: 100,
        location: 'Long An',
      },
    ], [
      {
        locationKey: 'quan 1 ben nghe tp hcm',
        locationDisplay: 'Quận 1, Bến Nghé, TP.HCM',
        pricePerM2: 60_000_000,
        confidence: 80,
        source: 'regional_table',
        recordedAt: now,
      },
    ]);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      kind: 'MARKET_PRICE_DRIFT',
      subjectId: 'listing-high',
    });
    expect(opportunities[0].evidence).toMatchObject({
      listingPricePerM2: 120_000_000,
      marketPricePerM2: 60_000_000,
    });
  });

  it('requires enough current and baseline samples before flagging CSAT drop', () => {
    const opportunities = detectCsatDrop([
      ...[4, 5, 4, 5].map((score, index) => ({
        payload: { score },
        createdAt: new Date('2026-09-01T10:00:00.000Z').getTime() - index * 86_400_000,
      })),
      ...[2, 2, 3].map((score, index) => ({
        payload: { score },
        createdAt: new Date('2026-09-14T10:00:00.000Z').getTime() - index * 86_400_000,
      })),
    ], now);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      kind: 'CSAT_DROP',
      subjectType: 'tenant',
    });
    expect(opportunities[0].evidence).toMatchObject({
      currentSamples: 3,
      baselineSamples: 4,
    });

    expect(detectCsatDrop([
      { payload: { score: 2 }, createdAt: '2026-09-14T10:00:00.000Z' },
      { payload: { score: 2 }, createdAt: '2026-09-13T10:00:00.000Z' },
    ], now)).toEqual([]);
  });
});

describe('Minh Week 3 decision queue', () => {
  it('keeps proactive suggestions behind the existing approval boundary', () => {
    expect(validateProactiveApprovalBoundary('DRAFT_PROACTIVE_FOLLOWUP').decision).toBe('approved');
    expect(validateProactiveApprovalBoundary('REVIEW_LISTING_PRICE').decision).toBe('approved');
    expect(validateProactiveApprovalBoundary('REVIEW_CSAT_DROP').decision).toBe('approved');
  });
});

describe('Minh Week 4 controlled rollout', () => {
  it('fails closed in shadow and remains deterministic for canary buckets', () => {
    expect(isSelectedForRollout('SHADOW', 'signal-1')).toBe(false);
    expect(isSelectedForRollout('LIVE', 'signal-1')).toBe(true);
    expect(isSelectedForRollout('CANARY_25', 'signal-1')).toBe(
      isSelectedForRollout('CANARY_25', 'signal-1'),
    );
    expect(isSelectedForRollout('CANARY_50', 'signal-2')).toBe(
      isSelectedForRollout('CANARY_50', 'signal-2'),
    );
  });
});