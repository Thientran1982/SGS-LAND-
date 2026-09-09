import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createForTenantAdmins } = vi.hoisted(() => ({
  createForTenantAdmins: vi.fn(),
}));

vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: { createForTenantAdmins },
}));

import { notifyZaloBroadcastNotReady } from '../services/notificationService';

describe('Zalo broadcast readiness notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createForTenantAdmins.mockResolvedValue(undefined);
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
});