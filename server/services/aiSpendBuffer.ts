/**
 * Bounded in-process accumulator for AI spend.
 *
 * The database write is injected so the buffering/retry/concurrency behavior
 * can be tested without importing the full AI runtime.
 */
export type SpendWriter = (tenantId: string, amountUsd: number) => Promise<void>;

export class AiSpendBuffer {
  private readonly pending = new Map<string, number>();
  private flushPromise: Promise<void> | null = null;

  add(tenantId: string, amountUsd: number): void {
    if (!tenantId || !Number.isFinite(amountUsd) || amountUsd <= 0) return;
    this.pending.set(tenantId, (this.pending.get(tenantId) || 0) + amountUsd);
  }

  get size(): number {
    return this.pending.size;
  }

  async flush(write: SpendWriter): Promise<void> {
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
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            // A failed database write must remain pending for the next flush.
            const [tenantId, amountUsd] = [...snapshot][index];
            this.add(tenantId, amountUsd);
            firstError ||= result.reason;
          }
        });
        if (firstError) throw firstError;
      } finally {
        this.flushPromise = null;
      }
    })();

    return this.flushPromise;
  }
}