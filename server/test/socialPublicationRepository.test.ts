import { describe, expect, it, vi } from 'vitest';
import {
  recordSocialAttempt,
  updateSocialTarget,
} from '../repositories/socialPublicationRepository';

describe('social publication repository parameter typing', () => {
  it('keeps attempt and target status parameters explicitly typed', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ publication_id: 'publication-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const pool = { query } as any;

    await recordSocialAttempt(pool, 'target-1', {
      attemptNumber: 1,
      requestId: 'social:publication-1:1',
      providerRequestId: undefined,
      statusCode: undefined,
      resultStatus: 'FAILED_RETRYABLE',
      errorCode: 'WORKER_ERROR',
      errorMessage: 'provider timeout',
    });

    await updateSocialTarget(pool, 'target-1', {
      status: 'FAILED_RETRYABLE',
      nextRetryAt: new Date('2026-09-10T13:30:00.000Z'),
      providerRequestId: undefined,
      errorCode: 'WORKER_ERROR',
      errorMessage: 'provider timeout',
    });

    const attemptSql = String(query.mock.calls[0][0]);
    expect(attemptSql).toContain('$1::uuid');
    expect(attemptSql).toContain('$2::integer');
    expect(attemptSql).toContain('$3::varchar');
    expect(attemptSql).toContain('$5::integer');
    expect(attemptSql).toContain('$6::varchar');

    const targetSql = String(query.mock.calls[1][0]);
    expect(targetSql).toContain('$2::varchar');
    expect(targetSql).toContain('$3::varchar');
    expect(targetSql).toContain('$4::text');
    expect(targetSql).toContain('$6::timestamptz');
    expect(targetSql).toContain('$7::varchar');
    expect(targetSql).toContain('$8::text');
  });
});