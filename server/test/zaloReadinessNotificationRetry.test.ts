import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  claim: vi.fn(),
  markDelivered: vi.fn(),
  markFailed: vi.fn(),
  recordExhausted: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: {
    claimDueZaloReadinessNotificationRetries: state.claim,
    markZaloReadinessNotificationRetryDelivered: state.markDelivered,
    markZaloReadinessNotificationRetryFailed: state.markFailed,
    recordZaloReadinessNotificationExhausted: state.recordExhausted,
  },
}));

vi.mock('../services/notificationService', () => ({
  notificationService: {
    notifyZaloBroadcastNotReady: state.notify,
  },
}));

vi.mock('../db', () => ({
  withRlsBypass: vi.fn(),
  withTenantContext: vi.fn(),
  withDistributedLock: vi.fn(),
}));

vi.mock('../services/emailService', () => ({ emailService: {} }));
vi.mock('../repositories/agentOperatingRepository', () => ({ agentOperatingRepository: {} }));

import { retryZaloReadinessNotificationAlerts } from '../services/dailyAdminReportService';

const retry = {
  id: 'retry-1',
  tenantId: 'tenant-1',
  transitionEventId: '11111111-1111-1111-1111-111111111111',
  reasonCode: 'OA_REQUEST_FAILED',
  checkedAt: '2026-09-09T10:20:30.000Z',
  attemptCount: 1,
};

describe('Zalo readiness notification retry worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.claim.mockResolvedValue([]);
    state.markDelivered.mockResolvedValue(undefined);
    state.markFailed.mockResolvedValue('PENDING');
    state.recordExhausted.mockResolvedValue(undefined);
    state.notify.mockResolvedValue(undefined);
  });

  it('replays the persisted alert without invoking provider verification', async () => {
    state.claim.mockResolvedValue([retry]);

    await expect(retryZaloReadinessNotificationAlerts()).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
      exhausted: 0,
    });

    expect(state.notify).toHaveBeenCalledWith('tenant-1', {
      reasonCode: 'OA_REQUEST_FAILED',
      checkedAt: retry.checkedAt,
      transitionEventId: retry.transitionEventId,
    });
    expect(state.markDelivered).toHaveBeenCalledWith('retry-1');
    expect(state.markFailed).not.toHaveBeenCalled();
  });

  it('records a sanitized operational signal after the bounded attempts', async () => {
    state.claim.mockResolvedValue([{ ...retry, attemptCount: 3 }]);
    state.notify.mockRejectedValue(new Error('provider details must not persist'));
    state.markFailed.mockResolvedValue('EXHAUSTED');

    await expect(retryZaloReadinessNotificationAlerts()).resolves.toEqual({
      claimed: 1,
      delivered: 0,
      failed: 1,
      exhausted: 1,
    });

    expect(state.recordExhausted).toHaveBeenCalledWith('tenant-1', {
      transitionEventId: retry.transitionEventId,
      reasonCode: retry.reasonCode,
      checkedAt: retry.checkedAt,
      attempts: 3,
    });
    expect(JSON.stringify(state.recordExhausted.mock.calls[0])).not.toContain('provider details');
  });
});