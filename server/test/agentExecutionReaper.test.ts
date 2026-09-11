import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, withTenantContext } = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

vi.mock('../db', () => ({ withTenantContext }));

import { agentExecutionRepository } from '../repositories/agentExecutionRepository';

describe('agentExecutionRepository.reapExpiredRunning', () => {
  beforeEach(() => {
    query.mockReset();
    withTenantContext.mockClear();
  });

  it('marks stuck RUNNING executions past the lease grace period as ERROR', async () => {
    query.mockResolvedValue({ rowCount: 3 });

    const count = await agentExecutionRepository.reapExpiredRunning('tenant-1', 5 * 60 * 1000);

    expect(count).toBe(3);
    expect(withTenantContext).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain(`status = 'ERROR'`);
    expect(sql).toContain(`status = 'RUNNING'`);
    expect(params[0]).toBe('tenant-1');
    expect(params[1]).toBe(5 * 60 * 1000);
  });

  it('returns 0 when nothing needed reaping', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    const count = await agentExecutionRepository.reapExpiredRunning('tenant-1');
    expect(count).toBe(0);
  });
});
