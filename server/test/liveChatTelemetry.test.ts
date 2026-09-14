import { describe, expect, it, vi } from 'vitest';
import {
  LiveChatTelemetry,
  isDatabaseConnectionTimeout,
} from '../services/liveChatTelemetry';

function testLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    request: vi.fn(),
    audit: vi.fn(),
  } as any;
}

describe('live-chat telemetry', () => {
  it('aggregates acknowledge and final reply latency without exposing tenant identifiers', () => {
    let now = 1_000;
    const log = testLogger();
    const telemetry = new LiveChatTelemetry({
      now: () => now,
      log,
      windowMs: 10_000,
      historyThresholdMs: 500,
      messageThresholdMs: 500,
    });

    for (const [index, replyDelay] of [100, 200, 300].entries()) {
      const span = telemetry.begin({
        tenantId: `tenant-${index}`,
        requestId: `request-${index}`,
        endpoint: 'ai',
        at: now,
      });
      span.mark('history_read', now + 20);
      span.mark('ack_sent', now + 50);
      span.mark('reply_sent', now + replyDelay);
      now += 1;
    }

    const snapshot = telemetry.getSnapshot(now);
    expect(snapshot.acknowledgeLatency).toEqual({ count: 3, p50Ms: 50, p95Ms: 50 });
    expect(snapshot.finalReplyLatency).toEqual({ count: 3, p50Ms: 200, p95Ms: 290 });
    expect(snapshot.byTenant).toHaveLength(3);
    expect(snapshot.byTenant.map(item => item.tenantKey)).not.toContain('tenant-0');
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('request-0');
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('nội dung khách hàng');
  });

  it('warns once per window for slow history/message endpoints', () => {
    let now = 1_000;
    const log = testLogger();
    const telemetry = new LiveChatTelemetry({
      now: () => now,
      log,
      historyThresholdMs: 100,
      messageThresholdMs: 100,
    });
    const history = telemetry.begin({
      tenantId: 'tenant-a',
      requestId: 'history-a',
      endpoint: 'history',
      at: now,
    });
    history.mark('history_read', now + 101);
    history.mark('history_read', now + 102);
    const message = telemetry.begin({
      tenantId: 'tenant-a',
      requestId: 'message-a',
      endpoint: 'message',
      at: now,
    });
    message.mark('inbound_persisted', now + 150);

    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(telemetry.getSnapshot(now).slowEndpointAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endpoint: 'history', count: 2, thresholdMs: 100 }),
        expect.objectContaining({ endpoint: 'message', count: 1, thresholdMs: 100 }),
      ]),
    );
  });

  it('tracks a rolling database connection-timeout spike and removes expired samples', () => {
    let now = 1_000;
    const log = testLogger();
    const telemetry = new LiveChatTelemetry({
      now: () => now,
      log,
      databaseTimeoutWindowMs: 500,
      databaseTimeoutAlertThreshold: 2,
    });
    telemetry.recordDatabaseConnectionTimeout();
    now += 10;
    telemetry.recordDatabaseConnectionTimeout();
    expect(telemetry.getSnapshot().databaseConnectionTimeouts).toMatchObject({
      count: 2,
      threshold: 2,
      alertActive: true,
    });
    expect(log.warn).toHaveBeenCalledTimes(1);

    now += 501;
    expect(telemetry.getSnapshot().databaseConnectionTimeouts).toMatchObject({
      count: 0,
      alertActive: false,
    });
  });

  it('tracks status polling 429s by window and tenant without retaining visitor data', () => {
    let now = 1_000;
    const log = testLogger();
    const telemetry = new LiveChatTelemetry({
      now: () => now,
      log,
      statusRateLimitWindowMs: 1_000,
      statusRateLimitAlertThreshold: 2,
    });

    telemetry.recordStatusRateLimit({
      tenantId: 'tenant-a',
      limited: false,
      backend: 'redis',
    });
    now += 10;
    telemetry.recordStatusRateLimit({
      tenantId: 'tenant-a',
      limited: true,
      retryAfterSeconds: 7,
      backend: 'in-memory',
    });
    now += 10;
    telemetry.recordStatusRateLimit({
      tenantId: 'tenant-a',
      limited: true,
      retryAfterSeconds: 4,
      backend: 'in-memory',
    });

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.statusRateLimits).toMatchObject({
      endpoint: 'status_polling',
      requestCount: 3,
      limitedCount: 2,
      limitedRatePercent: 66.67,
      threshold: 2,
      alertActive: true,
      lastRetryAfterSeconds: 4,
      backend: 'mixed',
      backendCounts: { redis: 1, 'in-memory': 2 },
    });
    expect(snapshot.statusRateLimits.byTenant).toEqual([
      expect.objectContaining({
        tenantKey: expect.stringMatching(/^[a-f0-9]{16}$/),
        requestCount: 3,
        limitedCount: 2,
        lastRetryAfterSeconds: 4,
        backend: 'mixed',
      }),
    ]);
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('tenant-a');
    expect(JSON.stringify(snapshot)).not.toContain('visitor-ip');

    now += 1_001;
    expect(telemetry.getSnapshot().statusRateLimits).toMatchObject({
      requestCount: 0,
      limitedCount: 0,
      limitedRatePercent: 0,
      alertActive: false,
      lastRetryAfterSeconds: null,
      backend: 'unknown',
    });
  });

  it.each([
    Object.assign(new Error('timeout exceeded when trying to connect'), { code: 'ETIMEDOUT' }),
    new Error('database probe timed out after 800ms'),
  ])('recognizes %s as a database connection timeout', error => {
    expect(isDatabaseConnectionTimeout(error)).toBe(true);
  });

  it('does not classify a statement timeout as a connection timeout', () => {
    expect(isDatabaseConnectionTimeout(new Error('canceling statement due to statement timeout'))).toBe(false);
  });

  it('restores recent latency samples and alerts after a process restart', async () => {
    let now = 10_000;
    const telemetry = new LiveChatTelemetry({
      now: () => now,
      log: testLogger(),
      windowMs: 10_000,
      historyThresholdMs: 100,
      databaseTimeoutWindowMs: 5_000,
      databaseTimeoutAlertThreshold: 2,
    });
    telemetry.configurePersistence({
      load: async () => ({
        version: 1,
        savedAt: 9_900,
        databaseTimeoutAlertAt: 9_800,
        samples: [{
          key: 'safe-request-key',
          tenantKey: '0123456789abcdef',
          at: 9_500,
          acknowledgeMs: 80,
          finalReplyMs: 320,
        }],
        databaseTimeouts: [9_700, 9_800],
        slowEndpoints: [{
          endpoint: 'history',
          thresholdMs: 100,
          lastDurationMs: 250,
          lastAlertAt: 9_700,
          eventTimes: [9_700],
        }],
         statusRateLimitEvents: [
           { tenantKey: 'fedcba9876543210', at: 9_700, limited: true, retryAfterSeconds: 6, backend: 'redis' },
           { tenantKey: 'fedcba9876543210', at: 9_800, limited: true, retryAfterSeconds: 4, backend: 'in-memory' },
         ],
         statusRateLimitAlertAt: 9_800,
         statusRateLimitTenantAlerts: { 'fedcba9876543210': 9_800 },
      }),
      save: async () => undefined,
    });

    await expect(telemetry.hydrateFromPersistence()).resolves.toBe(true);
    const snapshot = telemetry.getSnapshot(now);

    expect(snapshot.acknowledgeLatency).toEqual({ count: 1, p50Ms: 80, p95Ms: 80 });
    expect(snapshot.finalReplyLatency).toEqual({ count: 1, p50Ms: 320, p95Ms: 320 });
    expect(snapshot.slowEndpointAlerts).toEqual([
      expect.objectContaining({ endpoint: 'history', count: 1, lastDurationMs: 250 }),
    ]);
    expect(snapshot.databaseConnectionTimeouts).toMatchObject({
      count: 2,
      alertActive: true,
    });
    expect(snapshot.statusRateLimits).toMatchObject({
      requestCount: 2,
      limitedCount: 2,
      limitedRatePercent: 100,
      lastRetryAfterSeconds: 4,
      backend: 'mixed',
      alertActive: true,
    });
  });
});