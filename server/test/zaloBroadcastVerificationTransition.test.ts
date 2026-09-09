import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withTenantContext } = vi.hoisted(() => ({
  withTenantContext: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: {},
  withTenantContext,
}));

import { auditRepository } from '../repositories/auditRepository';

const client = { query: vi.fn() };

describe('Zalo broadcast verification transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTenantContext.mockImplementation(async (_tenantId: string, callback: (value: typeof client) => Promise<unknown>) => callback(client));
  });

  it('detects READY to NOT_READY while serializing tenant checks', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ details: 'status=READY;reason_code=READY;oa_check=PASS;quota_check=PASS' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(auditRepository.logZaloBroadcastVerificationAndDetectTransition('tenant-1', {
      actorId: 'admin-1',
      status: 'NOT_READY',
      reasonCode: 'QUOTA_REQUEST_FAILED',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    })).resolves.toEqual({
      transitionedToNotReady: true,
      previousStatus: 'READY',
    });

    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(client.query.mock.calls[1][0]).toContain('ORDER BY timestamp DESC, id DESC');
    expect(client.query.mock.calls[2][0]).toContain('INSERT INTO audit_logs');
  });

  it('does not report a duplicate transition after NOT_READY', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ details: 'status=NOT_READY;reason_code=QUOTA_REQUEST_FAILED;oa_check=PASS;quota_check=FAIL' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(auditRepository.logZaloBroadcastVerificationAndDetectTransition('tenant-1', {
      actorId: 'admin-1',
      status: 'NOT_READY',
      reasonCode: 'QUOTA_REQUEST_FAILED',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    })).resolves.toMatchObject({
      transitionedToNotReady: false,
      previousStatus: 'NOT_READY',
    });
  });
});