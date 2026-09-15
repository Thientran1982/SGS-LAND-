import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(),
}));

vi.mock('../db', () => ({
  withTenantContext: mocks.withTenantContext,
}));

import { agentOperatingRepository } from '../repositories/agentOperatingRepository';

describe('Agent Cockpit failure isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenantContext.mockImplementation(async (_tenantId: string, callback: (client: { query: typeof mocks.query }) => unknown) =>
      callback({ query: mocks.query }),
    );
    mocks.query.mockImplementation(async (text: string) => {
      if (text.includes('agent_human_questions')) throw new Error('relation does not exist');
      return { rows: [] };
    });
  });

  it('keeps an individual panel failure explicit instead of converting it to an empty result', async () => {
    const summary = await agentOperatingRepository.cockpitSummary('tenant-1');

    expect(summary.degraded).toBe(true);
    expect(summary.humanQuestions).toEqual([]);
    expect(summary.availability.questions).toEqual({ available: false, error: 'QUERY_FAILED' });
    expect(summary.unavailablePanels).toEqual(['questions']);
    expect(summary.availability.events).toEqual({ available: true });
    expect(summary.availability.weeklyKpi).toEqual({ available: true });
  });

  it('keeps a successfully loaded empty panel distinguishable from a failed panel', async () => {
    const summary = await agentOperatingRepository.cockpitSummary('tenant-1');

    expect(summary.events).toEqual([]);
    expect(summary.availability.events).toEqual({ available: true });
    expect(summary.availability.questions.available).toBe(false);
  });
});