import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DatabaseHealthTracker,
  DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS,
  getDatabaseOutageAlertThresholdMs,
  isTransientDatabaseError,
} from '../dbHealth';

describe('database connection resilience', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('uses a bounded configurable threshold and falls back for invalid values', () => {
    expect(getDatabaseOutageAlertThresholdMs({ DB_OUTAGE_ALERT_THRESHOLD_MS: '1200.9' })).toBe(1200);
    expect(getDatabaseOutageAlertThresholdMs({ DB_OUTAGE_ALERT_THRESHOLD_MS: '' }))
      .toBe(DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS);
    expect(getDatabaseOutageAlertThresholdMs({ DB_OUTAGE_ALERT_THRESHOLD_MS: '-1' }))
      .toBe(DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS);
    expect(getDatabaseOutageAlertThresholdMs({ DB_OUTAGE_ALERT_THRESHOLD_MS: 'not-a-number' }))
      .toBe(DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS);
  });

  it('emits one sanitized outage alert after the threshold and a matching recovery signal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00.000Z'));
    const alerts: Array<{
      type: string;
      alertKey: string;
      service: string;
      component: string;
      severity: string;
      occurredAt: string;
      outageStartedAt: string;
      outageDurationMs: number;
      thresholdMs: number;
      consecutiveFailures: number;
    }> = [];
    const tracker = new DatabaseHealthTracker({
      outageAlertThresholdMs: 1_000,
      onOperationalAlert: (alert) => alerts.push(alert),
    });

    tracker.markUnavailable(
      new Error('postgres://user:password@db.example/production?sslmode=require'),
      undefined,
      new Date('2026-09-07T12:00:00.000Z'),
    );
    tracker.markUnavailable(new Error('another connection failure'), undefined, new Date('2026-09-07T12:00:00.500Z'));
    vi.advanceTimersByTime(999);
    expect(alerts).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'database_outage',
      alertKey: 'database-availability',
      service: 'sgs-land-api',
      component: 'database',
      severity: 'critical',
      outageStartedAt: '2026-09-07T12:00:00.000Z',
      outageDurationMs: 1_000,
      thresholdMs: 1_000,
      consecutiveFailures: 2,
    });
    expect(JSON.stringify(alerts[0])).not.toContain('postgres://');
    expect(JSON.stringify(alerts[0])).not.toContain('password');

    vi.setSystemTime(new Date('2026-09-07T12:00:03.250Z'));
    tracker.markHealthy(new Date('2026-09-07T12:00:03.250Z'));
    expect(alerts).toHaveLength(2);
    expect(alerts[1]).toMatchObject({
      type: 'database_recovered',
      alertKey: 'database-availability',
      severity: 'info',
      outageStartedAt: '2026-09-07T12:00:00.000Z',
      outageDurationMs: 3_250,
      thresholdMs: 1_000,
      consecutiveFailures: 2,
    });
  });

  it('does not alert or recover for an outage shorter than the threshold', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00.000Z'));
    const onOperationalAlert = vi.fn();
    const tracker = new DatabaseHealthTracker({
      outageAlertThresholdMs: 1_000,
      onOperationalAlert,
    });

    tracker.markUnavailable(new Error('connection refused'));
    vi.advanceTimersByTime(999);
    tracker.markHealthy(new Date('2026-09-07T12:00:00.999Z'));
    vi.advanceTimersByTime(10_000);

    expect(onOperationalAlert).not.toHaveBeenCalled();
  });
});
