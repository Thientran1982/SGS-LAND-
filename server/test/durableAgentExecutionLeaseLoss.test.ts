import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execution: {
    id: 'execution-1',
    traceId: 'trace-1',
    claimToken: 'claim-1',
    status: 'RUNNING',
    attempt: 1,
    maxSteps: 5,
    leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
  },
  repository: {
    claim: vi.fn(),
    heartbeat: vi.fn(),
    getSteps: vi.fn(),
    saveStep: vi.fn(),
    finish: vi.fn(),
    reapExpiredRunning: vi.fn(),
  },
}));

vi.mock('../repositories/agentExecutionRepository', () => ({
  agentExecutionRepository: mocks.repository,
}));
vi.mock('../services/orchestrationMode', () => ({
  getOrchestrationDecision: () => ({
    mode: 'typescript',
    enabled: false,
    reason: 'test',
  }),
}));
vi.mock('../repositories/approvalRequestRepository', () => ({
  approvalRequestRepository: { create: vi.fn() },
}));
vi.mock('../repositories/agentOperatingRepository', () => ({
  agentOperatingRepository: { createHumanQuestion: vi.fn() },
}));
vi.mock('../services/subagentPolicy', () => ({
  runWithSubagentPolicy: vi.fn(),
}));

import { runDurableAgentExecution } from '../services/durableAgentExecutionService';

describe('durable agent execution lease fencing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.execution.status = 'RUNNING';
    mocks.repository.claim.mockReset();
    mocks.repository.heartbeat.mockReset();
    mocks.repository.getSteps.mockReset();
    mocks.repository.saveStep.mockReset();
    mocks.repository.finish.mockReset();
    mocks.repository.reapExpiredRunning.mockReset();
    mocks.repository.claim.mockResolvedValue({
      claimed: true,
      execution: mocks.execution,
      resumed: false,
      checkpointRows: [],
    });
    mocks.repository.saveStep.mockResolvedValue(undefined);
    mocks.repository.getSteps.mockResolvedValue([]);
    mocks.repository.finish.mockResolvedValue(undefined);
    mocks.repository.reapExpiredRunning.mockImplementation(async () => {
      mocks.execution.status = 'ERROR';
      return 1;
    });
    mocks.repository.heartbeat.mockRejectedValue(
      new Error('AGENT_EXECUTION_LEASE_LOST:execution-1'),
    );
  });

  it('does not let a deferred provider completion overwrite a reaped ERROR run', async () => {
    let providerResolve!: (value: any) => void;
    const provider = new Promise<{
      content: string;
      steps: any[];
      escalated: boolean;
    }>(resolve => {
      providerResolve = resolve;
    });

    const run = runDurableAgentExecution({
      tenantId: 'tenant-1',
      idempotencyKey: 'request-1',
      triggerSource: 'test',
      message: 'Xin tư vấn',
      execute: async () => provider,
    });

    await Promise.resolve();
    await expect(mocks.repository.reapExpiredRunning('tenant-1')).resolves.toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);

    providerResolve({
      content: 'Phản hồi trễ',
      steps: [],
      escalated: false,
    });

    await expect(run).rejects.toThrow('AGENT_EXECUTION_LEASE_LOST:execution-1');
    expect(mocks.repository.finish).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});