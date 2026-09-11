import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reapExpiredRunning, listEvents } = vi.hoisted(() => ({
  reapExpiredRunning: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock('../repositories/agentExecutionRepository', () => ({
  agentExecutionRepository: { reapExpiredRunning },
}));

vi.mock('../repositories/agentOperatingRepository', () => ({
  agentOperatingRepository: {
    listEvents,
    replayEvent: vi.fn(),
    createHumanQuestion: vi.fn(),
  },
}));

vi.mock('../repositories/approvalRequestRepository', () => ({
  approvalRequestRepository: { create: vi.fn() },
}));

vi.mock('../services/agentMemoryService', () => ({
  agentMemoryService: { remember: vi.fn(), recordSignal: vi.fn() },
  scrubPii: (value: unknown) => String(value ?? ''),
}));

vi.mock('../middleware/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { selfRepairTick } from '../services/selfRepairService';

describe('selfRepairTick stuck-execution cleanup', () => {
  beforeEach(() => {
    reapExpiredRunning.mockReset();
    listEvents.mockReset();
    listEvents.mockResolvedValue([]);
  });

  it('reaps expired RUNNING executions on every tick and reports the count', async () => {
    reapExpiredRunning.mockResolvedValue(2);

    const result = await selfRepairTick('tenant-1');

    expect(reapExpiredRunning).toHaveBeenCalledWith('tenant-1');
    expect(result.reapedExecutions).toBe(2);
  });

  it('keeps the rest of the tick working even when reaping fails', async () => {
    reapExpiredRunning.mockRejectedValue(new Error('db down'));

    const result = await selfRepairTick('tenant-1');

    expect(result.reapedExecutions).toBe(0);
    expect(result.replayed).toBe(0);
    expect(result.triaged).toBe(0);
  });
});
