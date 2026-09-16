import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../db', () => ({
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) => fn({ query })),
}));

import {
  getOutreachAuditExportFailureSummary,
  normalizeOutreachAuditExportFailureWindow,
  recordOutreachAuditExportFailure,
} from '../services/outreachAuditExportTelemetry';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('outreach audit export telemetry', () => {
  beforeEach(() => query.mockReset());

  it('normalizes the operator window to a bounded integer range', () => {
    expect(normalizeOutreachAuditExportFailureWindow(undefined)).toBe(24);
    expect(normalizeOutreachAuditExportFailureWindow('12.9')).toBe(12);
    expect(normalizeOutreachAuditExportFailureWindow(0)).toBe(1);
    expect(normalizeOutreachAuditExportFailureWindow(999)).toBe(720);
  });

  it('records only a stable category and cleans old buckets', async () => {
    query.mockResolvedValue({ rows: [] });

    await recordOutreachAuditExportFailure(tenantId, 'AUDIT_HISTORY_LOOKUP');

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual([tenantId, 'AUDIT_HISTORY_LOOKUP']);
    expect(String(query.mock.calls[0][0])).not.toContain('provider');
    expect(String(query.mock.calls[1][1][0])).toBe(tenantId);
  });

  it('returns a tenant-scoped rate and category time window without payloads', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          category: 'AUDIT_HISTORY_LOOKUP',
          count: 3,
          first_failed_at: '2026-09-16T10:00:00.000Z',
          last_failed_at: '2026-09-16T10:20:00.000Z',
        },
        {
          category: 'APPROVAL_LOOKUP',
          count: 1,
          first_failed_at: '2026-09-16T09:00:00.000Z',
          last_failed_at: '2026-09-16T09:00:00.000Z',
        },
      ],
    });

    const summary = await getOutreachAuditExportFailureSummary(tenantId, 6);

    expect(summary).toMatchObject({
      windowHours: 6,
      totalFailures: 4,
      failureRatePerHour: 0.67,
      rawPayloadIncluded: false,
      approvalContentsIncluded: false,
      providerPayloadIncluded: false,
    });
    expect(summary.categories).toEqual([
      {
        category: 'AUDIT_HISTORY_LOOKUP',
        count: 3,
        firstFailedAt: '2026-09-16T10:00:00.000Z',
        lastFailedAt: '2026-09-16T10:20:00.000Z',
      },
      {
        category: 'APPROVAL_LOOKUP',
        count: 1,
        firstFailedAt: '2026-09-16T09:00:00.000Z',
        lastFailedAt: '2026-09-16T09:00:00.000Z',
      },
    ]);
    expect(query.mock.calls[0][1]).toEqual([tenantId, 6]);
  });
});