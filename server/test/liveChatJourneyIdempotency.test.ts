import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../db', () => ({
  pool: {},
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) =>
    fn({ query }),
  ),
}));

vi.mock('../middleware/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { agentRepository } from '../repositories/agentRepository';

const tenantId = '11111111-1111-4111-8111-111111111111';

function journeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'journey-1',
    tenant_id: tenantId,
    lead_id: 'lead-1',
    agent_id: 'LIVE_CHAT',
    session_id: 'session-1',
    event_type: 'CHAT_INTERACTION',
    summary: 'Khách hỏi giá',
    signals: {},
    metadata: {},
    source: 'live_chat',
    created_at: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('live-chat lead journey idempotency', () => {
  beforeEach(() => query.mockReset());

  it('returns the original event when a session replay hits the unique key', async () => {
    const original = journeyRow();
    query.mockResolvedValueOnce({ rows: [original] });

    const first = await agentRepository.saveLeadJourneyEvent(
      tenantId,
      'lead-1',
      'LIVE_CHAT',
      'CHAT_INTERACTION',
      'Khách hỏi giá',
      {},
      {},
      'session-1',
      'live_chat',
    );

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [original] });
    const replay = await agentRepository.saveLeadJourneyEvent(
      tenantId,
      'lead-1',
      'LIVE_CHAT',
      'CHAT_INTERACTION',
      'Khách hỏi giá lần retry',
      {},
      {},
      'session-1',
      'live_chat',
    );

    expect(first).toMatchObject({ id: 'journey-1', sessionId: 'session-1' });
    expect(replay).toEqual(first);
    const insertQueries = query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO lead_journey_memory'));
    expect(insertQueries).toHaveLength(2);
    expect(insertQueries[0][0]).toContain('ON CONFLICT (tenant_id, session_id, event_type, source)');
    expect(insertQueries[0][1]).toEqual([
      tenantId,
      'lead-1',
      'LIVE_CHAT',
      'session-1',
      'CHAT_INTERACTION',
      'Khách hỏi giá',
      '{}',
      '{}',
      'live_chat',
    ]);
  });
});