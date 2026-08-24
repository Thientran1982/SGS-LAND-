import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) => fn({ query })),
}));

import { agentMemoryService } from '../services/agentMemoryService';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('agent signal health', () => {
  beforeEach(() => query.mockReset());

  it('reports active activity with a missing signal as an alert', async () => {
    query.mockResolvedValueOnce({ rows: [{
      action: 'contact', signal_type: 'match_chosen', expected_count: 2, recorded_count: 0,
    }] });
    query.mockResolvedValueOnce({ rows: [] });
    const report = await agentMemoryService.getSignalHealth(tenantId, { windowHours: 6 });
    expect(report.activityStatus).toBe('ACTIVE');
    expect(report.byAction[0]).toMatchObject({
      expectedSignals: 2, recordedSignals: 0, failedSignals: 0, status: 'SIGNAL_MISSING',
    });
    expect(report.alerts).toHaveLength(1);
  });

  it('keeps an empty window distinct from a signal gap', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] });
    const report = await agentMemoryService.getSignalHealth(tenantId, { windowHours: 6 });
    expect(report).toMatchObject({ activityStatus: 'NO_ACTIVITY', byAction: [], alerts: [] });
  });

  it('returns expected and recorded counts grouped by action and signal type', async () => {
    query.mockResolvedValueOnce({ rows: [{
      action: 'contact', signal_type: 'match_chosen', expected_count: 1, recorded_count: 1,
    }] });
    query.mockResolvedValueOnce({ rows: [] });
    const report = await agentMemoryService.getSignalHealth(tenantId, { windowHours: 1 });
    expect(report.byAction[0]).toMatchObject({
      action: 'contact', signalType: 'match_chosen', status: 'HEALTHY',
    });
    expect(query.mock.calls[0][1][0]).toBe(tenantId);
  });

  it('surfaces a durable write failure after a process restart', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{
      signal_type: 'match_chosen',
      failure_count: 2,
      first_failed_at: '2026-08-24T08:00:00.000Z',
      last_failed_at: '2026-08-24T09:00:00.000Z',
      last_error: 'provider unavailable',
    }] });

    const report = await agentMemoryService.getSignalHealth(tenantId, { windowHours: 6 });
    expect(report.writeFailures).toEqual([{
      signalType: 'match_chosen',
      count: 2,
      firstAt: '2026-08-24T08:00:00.000Z',
      lastAt: '2026-08-24T09:00:00.000Z',
      lastError: 'provider unavailable',
    }]);
    expect(report.alerts[0]).toMatchObject({
      signalType: 'match_chosen',
      failedSignals: 2,
      status: 'SIGNAL_WRITE_FAILED',
    });
  });
});