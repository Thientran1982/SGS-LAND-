/**
 * Bounded in-process accumulator for AI spend.
 *
 * The database write is injected so the buffering/retry/concurrency behavior
 * can be tested without importing the full AI runtime.
 */
export type SpendWriter = (tenantId: string, amountUsd: number) => Promise<void>;

export interface SpendFailureAlert {
  tenantId: string;
  pendingAmountUsd: number;
  retryCount: number;
  failedAt: Date;
}

export interface SpendFlushHooks {
  onRetryThresholdExceeded?: (alert: SpendFailureAlert) => Promise<void> | void;
  onFlushed?: (tenantId: string) => Promise<void> | void;
}

export class AiSpendBuffer {
  static readonly RETRY_ALERT_THRESHOLD = 3;
  private readonly pending = new Map<string, number>();
  private readonly retryCounts = new Map<string, number>();
  private flushPromise: Promise<void> | null = null;

  add(tenantId: string, amountUsd: number): void {
    if (!tenantId || !Number.isFinite(amountUsd) || amountUsd <= 0) return;
    this.pending.set(tenantId, (this.pending.get(tenantId) || 0) + amountUsd);
  }

  get size(): number {
    return this.pending.size;
  }

  async flush(write: SpendWriter, hooks: SpendFlushHooks = {}): Promise<void> {
    // A timer and a shutdown flush may overlap. Share one drain so a spend
    // batch can never be written twice by this worker.
    if (this.flushPromise) return this.flushPromise;
    if (this.pending.size === 0) return;

    const snapshot = new Map(this.pending);
    this.pending.clear();
    this.flushPromise = (async () => {
      try {
        const results = await Promise.allSettled(
          [...snapshot].map(([tenantId, amountUsd]) => write(tenantId, amountUsd)),
        );
        let firstError: unknown;
        const hookTasks: Promise<void>[] = [];
        results.forEach((result, index) => {
          const [tenantId, amountUsd] = [...snapshot][index];
          if (result.status === 'rejected') {
            // A failed database write must remain pending for the next flush.
            this.add(tenantId, amountUsd);
            const retryCount = (this.retryCounts.get(tenantId) || 0) + 1;
            this.retryCounts.set(tenantId, retryCount);
            if (retryCount >= AiSpendBuffer.RETRY_ALERT_THRESHOLD) {
              hookTasks.push(Promise.resolve(hooks.onRetryThresholdExceeded?.({
                tenantId,
                pendingAmountUsd: amountUsd,
                retryCount,
                failedAt: new Date(),
              })).then(() => undefined).catch(() => {}));
            }
            firstError ||= result.reason;
          } else {
            this.retryCounts.delete(tenantId);
            hookTasks.push(Promise.resolve(hooks.onFlushed?.(tenantId)).then(() => undefined).catch(() => {}));
          }
        });
        await Promise.all(hookTasks);
        if (firstError) throw firstError;
      } finally {
        this.flushPromise = null;
      }
    })();

    return this.flushPromise;
  }
}