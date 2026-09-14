import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  pool: { query },
}));

import { notificationRepository } from '../repositories/notificationRepository';

describe('notificationRepository.createForTenantAdmins', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
  });

  it('uses one explicitly typed input row for deduplicated admin notifications', async () => {
    await notificationRepository.createForTenantAdmins(
      '00000000-0000-0000-0000-000000000999',
      {
        type: 'SOCIAL_PUBLICATION_TARGET_STALE_NOT_READY',
        title: 'Target social publication chưa sẵn sàng',
        body: 'Kiểm tra lại cấu hình nền tảng.',
        metadata: { transitionEventId: 'target-1' },
        dedupeKey: 'target-1',
      },
    );

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WITH input AS');
    expect(sql).toContain('$1::uuid AS tenant_id');
    expect(sql).toContain('$2::text AS notification_type');
    expect(sql).toContain('$5::jsonb AS notification_metadata');
    expect(sql).toContain('existing.type = input.notification_type');
    expect(params).toEqual([
      '00000000-0000-0000-0000-000000000999',
      'SOCIAL_PUBLICATION_TARGET_STALE_NOT_READY',
      'Target social publication chưa sẵn sàng',
      'Kiểm tra lại cấu hình nền tảng.',
      JSON.stringify({ transitionEventId: 'target-1' }),
      'target-1',
    ]);
  });
});