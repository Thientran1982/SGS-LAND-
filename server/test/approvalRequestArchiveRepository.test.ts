import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: { query: mocks.query },
  withTenantContext: mocks.withTenantContext,
}));

import { approvalRequestRepository } from '../repositories/approvalRequestRepository';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const approvalId = '11111111-1111-4111-8111-111111111111';
const operatorId = '22222222-2222-4222-8222-222222222222';

describe('approval request soft archive repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenantContext.mockImplementation(async (_tenantId: string, callback: (client: { query: typeof mocks.query }) => unknown) =>
      callback({ query: mocks.query }),
    );
  });

  it('atomically rejects and archives a pending request without an expiry restriction', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: approvalId,
        tenant_id: tenantId,
        status: 'REJECTED',
        reviewed_by: operatorId,
        reviewed_at: '2026-09-26T10:00:00.000Z',
        review_note: 'Old request',
        archived_at: '2026-09-26T10:00:00.000Z',
        archived_by: operatorId,
        archive_reason: 'Old request',
      }],
    });

    const result = await approvalRequestRepository.archivePending(tenantId, approvalId, operatorId, 'Old request');

    expect(result).toMatchObject({
      id: approvalId,
      status: 'REJECTED',
      reviewedBy: operatorId,
      archiveReason: 'Old request',
      archivedBy: operatorId,
    });
    expect(mocks.withTenantContext).toHaveBeenCalledWith(tenantId, expect.any(Function));
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("SET status = 'REJECTED'");
    expect(sql).toContain('archived_at = NOW()');
    expect(sql).toContain("status = 'PENDING'");
    expect(sql).toContain('archived_at IS NULL');
    expect(sql).not.toContain('expires_at');
    expect(params).toEqual([tenantId, approvalId, operatorId, 'Old request']);
  });

  it('reuses an archived proactive request for its source signal instead of creating a new alert', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: approvalId,
        tenant_id: tenantId,
        action_type: 'REVIEW_LISTING_PRICE',
        status: 'REJECTED',
        source_signal_id: 'signal-archived',
        archived_at: '2026-09-26T10:00:00.000Z',
      }],
    });

    const result = await approvalRequestRepository.createProactive({
      tenantId,
      actionType: 'REVIEW_LISTING_PRICE',
      sourceSignalId: 'signal-archived',
    } as any, 10);

    expect(result).toMatchObject({ id: approvalId, status: 'REJECTED', reused: 'DUPLICATE_SOURCE_SIGNAL' });
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain('source_signal_id=$2::text');
    expect(sql).not.toContain('archived_at IS NULL');
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('lists only archived rejections for the requested tenant with the actor name', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: approvalId,
        tenant_id: tenantId,
        status: 'REJECTED',
        archived_at: '2026-09-26T10:00:00.000Z',
        archived_by: operatorId,
        archived_by_name: 'Review Manager',
        archive_reason: 'No longer relevant',
      }],
    });

    const result = await approvalRequestRepository.findArchivedByTenant(tenantId, 25, 50);

    expect(result).toMatchObject([{
      id: approvalId,
      status: 'REJECTED',
      archivedBy: operatorId,
      archivedByName: 'Review Manager',
      archiveReason: 'No longer relevant',
    }]);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('ar.tenant_id = $1');
    expect(sql).toContain("ar.status = 'REJECTED'");
    expect(sql).toContain('ar.archived_at IS NOT NULL');
    expect(sql).toContain('u.tenant_id = ar.tenant_id');
    expect(sql).toContain('ORDER BY ar.archived_at DESC');
    expect(params).toEqual([tenantId, 25, 50]);
  });

  it('counts archived rejections separately from pending requests', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ count: 3 }] });

    await expect(approvalRequestRepository.countArchivedByTenant(tenantId)).resolves.toBe(3);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('tenant_id = $1');
    expect(sql).toContain("status = 'REJECTED'");
    expect(sql).toContain('archived_at IS NOT NULL');
    expect(params).toEqual([tenantId]);
  });

  it('keeps archived requests out of the active queue and pending count', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 2 }] });

    await approvalRequestRepository.findPendingByTenant(tenantId);
    await approvalRequestRepository.countPending(tenantId);

    const [queueSql, queueParams] = mocks.query.mock.calls[0];
    const [countSql, countParams] = mocks.query.mock.calls[1];
    for (const sql of [queueSql, countSql]) {
      expect(sql).toContain("status = 'PENDING'");
      expect(sql).toContain('archived_at IS NULL');
    }
    expect(queueSql).toContain('tenant_id = $1');
    expect(countSql).toContain('tenant_id = $1');
    expect(queueParams[0]).toBe(tenantId);
    expect(countParams).toEqual([tenantId]);
  });
});