import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, withTenantContext } = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

vi.mock('../db', () => ({ withTenantContext }));

import { interactionRepository } from '../repositories/interactionRepository';

describe('interactionRepository.findByLeadCursor', () => {
  beforeEach(() => {
    query.mockReset();
    withTenantContext.mockClear();
  });

  it('returns chronological pages and a keyset cursor for older messages', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: '3', timestamp: '2026-09-17T10:02:00.000Z', direction: 'INBOUND' },
        { id: '2', timestamp: '2026-09-17T10:01:00.000Z', direction: 'OUTBOUND' },
        { id: '1', timestamp: '2026-09-17T10:00:00.000Z', direction: 'INBOUND' },
      ],
    });

    const first = await interactionRepository.findByLeadCursor('tenant-1', 'lead-1', { pageSize: 2 });

    expect(first.messages.map(message => message.id)).toEqual(['2', '3']);
    expect(first.hasNext).toBe(true);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(query.mock.calls[0][1]).toEqual(['lead-1', null, null, 3]);

    query.mockResolvedValueOnce({
      rows: [{ id: '1', timestamp: '2026-09-17T10:00:00.000Z', direction: 'INBOUND' }],
    });
    const second = await interactionRepository.findByLeadCursor(
      'tenant-1',
      'lead-1',
      { before: first.nextCursor || undefined, pageSize: 2 },
    );

    expect(second.messages.map(message => message.id)).toEqual(['1']);
    expect(second.hasNext).toBe(false);
    expect(second.nextCursor).toBeNull();
    expect(query.mock.calls[1][1][0]).toBe('lead-1');
    expect(query.mock.calls[1][1][1]).toBe('2026-09-17T10:01:00.000Z');
    expect(query.mock.calls[1][1][3]).toBe(3);
  });

  it('rejects malformed cursors instead of falling back to offset semantics', async () => {
    await expect(
      interactionRepository.findByLeadCursor('tenant-1', 'lead-1', { before: 'not-a-cursor' }),
    ).rejects.toThrow('INVALID_INTERACTION_CURSOR');
    expect(query).not.toHaveBeenCalled();
  });
});