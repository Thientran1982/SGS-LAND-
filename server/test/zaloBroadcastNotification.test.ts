import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createForTenantAdmins, recordZaloReadinessNotificationRetry } = vi.hoisted(() => ({
  createForTenantAdmins: vi.fn(),
  recordZaloReadinessNotificationRetry: vi.fn(),
}));

vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: { createForTenantAdmins, recordZaloReadinessNotificationRetry },
}));

import { notifyZaloBroadcastNotReady } from '../services/notificationService';

describe('Zalo broadcast readiness notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createForTenantAdmins.mockResolvedValue(undefined);
    recordZaloReadinessNotificationRetry.mockResolvedValue(true);
  });

  it('sends admins only a safe reason code and verification timestamp', async () => {
    await notifyZaloBroadcastNotReady('tenant-1', {
      reasonCode: 'QUOTA_PERMISSION_DENIED',
      checkedAt: '2026-09-09T10:20:30.000Z',
    });

    expect(createForTenantAdmins).toHaveBeenCalledWith('tenant-1', {
      type: 'ZALO_BROADCAST_NOT_READY',
      title: 'Quyền broadcast Zalo OA không còn sẵn sàng',
      body: 'Mã lý do: QUOTA_PERMISSION_DENIED. Thời điểm kiểm tra: 2026-09-09T10:20:30.000Z.',
      metadata: {
        reasonCode: 'QUOTA_PERMISSION_DENIED',
        checkedAt: '2026-09-09T10:20:30.000Z',
      },
    });
    expect(JSON.stringify(createForTenantAdmins.mock.calls[0])).not.toContain('token');
    expect(JSON.stringify(createForTenantAdmins.mock.calls[0])).not.toContain('secret');
    expect(JSON.stringify(createForTenantAdmins.mock.calls[0])).not.toContain('payload');
  });

  it('rejects an invalid timestamp before creating a notification', async () => {
    await expect(notifyZaloBroadcastNotReady('tenant-1', {
      reasonCode: 'OA_REQUEST_FAILED',
      checkedAt: 'not-a-date',
    })).rejects.toThrow('Invalid Zalo broadcast notification timestamp');
    expect(createForTenantAdmins).not.toHaveBeenCalled();
  });

  it('records a failed transition with only the safe retry facts', async () => {
    const { recordZaloBroadcastNotReadyNotificationFailure } = await import('../services/notificationService');

    await recordZaloBroadcastNotReadyNotificationFailure('tenant-1', {
      reasonCode: 'OA_REQUEST_FAILED',
      checkedAt: '2026-09-09T10:20:30.000Z',
      transitionEventId: '11111111-1111-1111-1111-111111111111',
    });

    expect(recordZaloReadinessNotificationRetry).toHaveBeenCalledWith(
      'tenant-1',
      '11111111-1111-1111-1111-111111111111',
      {
        reasonCode: 'OA_REQUEST_FAILED',
        checkedAt: '2026-09-09T10:20:30.000Z',
      },
    );
    expect(JSON.stringify(recordZaloReadinessNotificationRetry.mock.calls[0])).not.toContain('token');
    expect(JSON.stringify(recordZaloReadinessNotificationRetry.mock.calls[0])).not.toContain('secret');
  });
});