import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repository } = vi.hoisted(() => ({
  repository: {
    claimEvents: vi.fn(),
    finishEvent: vi.fn(),
    heartbeatEvent: vi.fn(),
  },
}));

vi.mock('../repositories/agentOperatingRepository', () => ({
  agentOperatingRepository: repository,
}));

vi.mock('../middleware/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { processAgentEvents, registerAgentEventHandler } from '../services/agentOperatorDaemon';

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-row-1',
    event_id: 'inbound:ZALO:provider-event-1',
    event_type: 'INBOUND_MESSAGE',
    tenant_id: 'tenant-1',
    lease_token: 'lease-1',
    attempts: 1,
    payload_json: {},
    ...overrides,
  };
}

describe('inbound durable worker lease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.finishEvent.mockResolvedValue(event({ status: 'DONE' }));
    repository.heartbeatEvent.mockResolvedValue(true);
    repository.claimEvents.mockResolvedValue([]);
  });

  it('keeps a slow inbound claim fenced while a second worker polls', async () => {
    let release!: () => void;
    const started = new Promise<void>(resolve => { release = resolve; });
    const handler = vi.fn(async () => {
      await started;
    });

    // This is the database behavior of SELECT ... FOR UPDATE SKIP LOCKED:
    // worker two sees no claimable row while worker one owns the lease.
    let claimed = false;
    repository.claimEvents.mockImplementation(async () => {
      if (claimed) return [];
      claimed = true;
      return [event()];
    });
    registerAgentEventHandler('INBOUND_MESSAGE', handler);

    const workerOne = processAgentEvents('tenant-1');
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    const workerTwo = await processAgentEvents('tenant-1');
    expect(workerTwo).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(1);
    release();
    await workerOne;
  });

  it('renews the event lease and finishes only with its lease token', async () => {
    vi.useFakeTimers();
    const inbound = event();
    let release!: () => void;
    const handler = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    repository.claimEvents.mockResolvedValue([inbound]);

    registerAgentEventHandler('INBOUND_MESSAGE', handler);

    const processing = processAgentEvents('tenant-1');
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(repository.heartbeatEvent).toHaveBeenCalledWith('tenant-1', 'event-row-1', 'lease-1');
    release();
    await processing;
    vi.useRealTimers();

    expect(repository.finishEvent).toHaveBeenCalledWith(
      'tenant-1', 'event-row-1', 'DONE', undefined, 'lease-1',
    );
  });

  it('allows a retry after a crashed worker without creating a second execution', async () => {
    const inbound = event();
    repository.claimEvents
      .mockResolvedValueOnce([inbound])
      .mockResolvedValueOnce([event({ lease_token: 'lease-2', attempts: 2 })]);
    repository.finishEvent.mockResolvedValueOnce(event({ status: 'FAILED' })).mockResolvedValueOnce(event({ status: 'DONE' }));
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('worker crashed'))
      .mockResolvedValueOnce(undefined);
    registerAgentEventHandler('INBOUND_MESSAGE', handler);

    await Promise.all([
      processAgentEvents('tenant-1'),
      processAgentEvents('tenant-1'),
    ]);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(repository.finishEvent).toHaveBeenCalledWith(
      'tenant-1', 'event-row-1', 'FAILED', 'worker crashed', 'lease-1',
    );
    expect(repository.finishEvent).toHaveBeenCalledWith(
      'tenant-1', 'event-row-1', 'DONE', undefined, 'lease-2',
    );
  });
});