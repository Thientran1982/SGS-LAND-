import { describe, expect, it, vi } from 'vitest';
import { preparePublicLiveChat } from '../services/publicLiveChatPreparation';

describe('public live-chat preparation under DB pool contention', () => {
  it('retries a transient connection timeout and reuses the persisted inbound row', async () => {
    const inbound = { id: 'inbound-1', direction: 'INBOUND', content: 'giá global city' };
    const findLead = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
      .mockResolvedValue({ id: 'lead-1', thread_status: 'AI_ACTIVE' });
    const findHistory = vi
      .fn()
      .mockResolvedValue([inbound]);
    const findInboundForAgentRun = vi.fn();
    const onRetry = vi.fn();

    const result = await preparePublicLiveChat({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      message: 'giá global city',
      inboundInteractionId: 'inbound-1',
      dependencies: { findLead, findHistory, findInboundForAgentRun },
      retryDelaysMs: [0],
      onRetry,
    });

    expect(result).toEqual({
      lead: { id: 'lead-1', thread_status: 'AI_ACTIVE' },
      history: [inbound],
      inboundInteraction: inbound,
    });
    expect(findLead).toHaveBeenCalledTimes(2);
    expect(findHistory).toHaveBeenCalledTimes(2);
    expect(findInboundForAgentRun).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      nextAttempt: 2,
      delayMs: 0,
    });
  });

  it('does not retry programming or query errors and does not create a second inbound lookup', async () => {
    const error = new Error('duplicate key value violates unique constraint');
    const findLead = vi.fn().mockRejectedValue(error);
    const findHistory = vi.fn().mockResolvedValue([]);
    const findInboundForAgentRun = vi.fn();

    await expect(preparePublicLiveChat({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      message: 'giá global city',
      inboundInteractionId: 'inbound-1',
      dependencies: { findLead, findHistory, findInboundForAgentRun },
      retryDelaysMs: [0],
    })).rejects.toBe(error);

    expect(findLead).toHaveBeenCalledTimes(1);
    expect(findHistory).toHaveBeenCalledTimes(1);
    expect(findInboundForAgentRun).not.toHaveBeenCalled();
  });

  it('keeps a terminal transient failure terminal after the bounded retry budget', async () => {
    const error = new Error('timeout exceeded when trying to connect');
    const findLead = vi.fn().mockRejectedValue(error);
    const findHistory = vi.fn().mockResolvedValue([]);
    const findInboundForAgentRun = vi.fn();

    await expect(preparePublicLiveChat({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      message: 'giá global city',
      inboundInteractionId: 'inbound-1',
      dependencies: { findLead, findHistory, findInboundForAgentRun },
      maxAttempts: 3,
      retryDelaysMs: [0],
    })).rejects.toBe(error);

    expect(findLead).toHaveBeenCalledTimes(3);
    expect(findHistory).toHaveBeenCalledTimes(3);
    expect(findInboundForAgentRun).not.toHaveBeenCalled();
  });
});