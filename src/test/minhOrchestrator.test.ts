import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordSignal } = vi.hoisted(() => ({
  recordSignal: vi.fn(),
}));

vi.mock('../../server/services/agentMemoryService', () => ({
  agentMemoryService: {
    recordSignal,
    memoryBlock: vi.fn().mockResolvedValue(''),
  },
}));

vi.mock('../../server/services/minhCalibrationService', () => ({
  getMinhCalibrationPromptLine: vi.fn().mockResolvedValue(''),
}));

vi.mock('../../server/middleware/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { minhChooseSpecialist } from '../../server/ai/minhOrchestrator';

describe('minhChooseSpecialist delegation signal', () => {
  beforeEach(() => {
    recordSignal.mockReset();
    recordSignal.mockResolvedValue({ id: 'signal-1' });
  });

  it('uses a unique dedupeKey per call instead of deriving it from message content', async () => {
    const generateFn = vi.fn().mockResolvedValue(
      JSON.stringify({ intent: 'SEARCH', reason: 'tim can ho', confidence: 0.8 }),
    );

    await minhChooseSpecialist({
      tenantId: 'tenant-1',
      message: 'tim can ho quan 9',
      sessionId: 'session-1',
      generateFn,
    });
    await minhChooseSpecialist({
      tenantId: 'tenant-1',
      message: 'tim can ho quan 9',
      sessionId: 'session-1',
      generateFn,
    });

    expect(recordSignal).toHaveBeenCalledTimes(2);
    const [firstCallArgs] = recordSignal.mock.calls[0];
    void firstCallArgs;
    const firstDedupeKey = recordSignal.mock.calls[0][1].dedupeKey;
    const secondDedupeKey = recordSignal.mock.calls[1][1].dedupeKey;
    expect(firstDedupeKey).toBeTruthy();
    expect(secondDedupeKey).toBeTruthy();
    expect(firstDedupeKey).not.toEqual(secondDedupeKey);
    expect(firstDedupeKey).toContain('minh_delegation:session-1:');
  });
});
