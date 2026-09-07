import { describe, expect, it } from 'vitest';
import { DatabaseHealthTracker, isTransientDatabaseError } from '../dbHealth';

describe('database connection resilience', () => {
  it.each([
    Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' }),
    Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' }),
    new Error('server closed the connection unexpectedly'),
  ])('classifies %s as a recoverable database outage', (error) => {
    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('does not treat query and application errors as connection outages', () => {
    expect(isTransientDatabaseError(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }))).toBe(false);
    expect(isTransientDatabaseError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('keeps the server health unavailable during an outage and healthy after recovery', () => {
    const tracker = new DatabaseHealthTracker();
    const retryAt = new Date('2026-09-07T12:00:01.000Z');

    const unavailable = tracker.markUnavailable(new Error('Connection terminated unexpectedly'), retryAt, new Date('2026-09-07T12:00:00.000Z'));
    expect(unavailable).toMatchObject({
      available: false,
      status: 'unavailable',
      consecutiveFailures: 1,
      lastError: 'Connection terminated unexpectedly',
      nextRetryAt: retryAt.toISOString(),
    });

    const recovered = tracker.markHealthy(new Date('2026-09-07T12:00:02.000Z'));
    expect(recovered).toMatchObject({
      available: true,
      status: 'healthy',
      consecutiveFailures: 0,
      lastHealthyAt: '2026-09-07T12:00:02.000Z',
    });
  });
});