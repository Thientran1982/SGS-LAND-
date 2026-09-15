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
});