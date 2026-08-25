import { describe, expect, it, vi } from 'vitest';
import { AiSpendBuffer } from '../services/aiSpendBuffer';

describe('AI spend buffer', () => {
  it('flushes a first insert for each tenant', async () => {
    const buffer = new AiSpendBuffer();
    const write = vi.fn().mockResolvedValue(undefined);
    buffer.add('tenant-1', 0.012345);

    await buffer.flush(write);

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith('tenant-1', 0.012345);
    expect(buffer.size).toBe(0);
  });

  it('keeps a failed write pending and retries it', async () => {
    const buffer = new AiSpendBuffer();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(undefined);
    buffer.add('tenant-1', 0.02);

    await expect(buffer.flush(write)).rejects.toThrow('database unavailable');
    expect(buffer.size).toBe(1);

    await buffer.flush(write);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('tenant-1', 0.02);
    expect(buffer.size).toBe(0);
  });

  it('serializes overlapping flushes without duplicate writes', async () => {
    const buffer = new AiSpendBuffer();
    let releaseWrite!: () => void;
    const write = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { releaseWrite = resolve; }),
    );
    buffer.add('tenant-1', 0.03);

    const firstFlush = buffer.flush(write);
    const secondFlush = buffer.flush(write);
    expect(write).toHaveBeenCalledOnce();

    releaseWrite();
    await Promise.all([firstFlush, secondFlush]);
    expect(write).toHaveBeenCalledOnce();
    expect(buffer.size).toBe(0);
  });

  it('raises an alert only after the retry threshold', async () => {
    const buffer = new AiSpendBuffer();
    const write = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const onRetryThresholdExceeded = vi.fn();
    buffer.add('tenant-1', 0.03);

    for (let attempt = 0; attempt < AiSpendBuffer.RETRY_ALERT_THRESHOLD; attempt++) {
      await expect(buffer.flush(write, { onRetryThresholdExceeded })).rejects.toThrow();
    }

    expect(onRetryThresholdExceeded).toHaveBeenCalledOnce();
    expect(onRetryThresholdExceeded).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      pendingAmountUsd: 0.03,
      retryCount: AiSpendBuffer.RETRY_ALERT_THRESHOLD,
      failedAt: expect.any(Date),
    }));
  });

  it('notifies when a previously failed batch is flushed successfully', async () => {
    const buffer = new AiSpendBuffer();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(undefined);
    const onFlushed = vi.fn();
    buffer.add('tenant-1', 0.04);

    await expect(buffer.flush(write, { onFlushed })).rejects.toThrow();
    buffer.add('tenant-1', 0.04);
    await buffer.flush(write, { onFlushed });

    expect(onFlushed).toHaveBeenCalledWith('tenant-1');
    expect(buffer.size).toBe(0);
  });
});