import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryCleanupPanel } from '../../components/GalleryCleanupPanel';
import { api } from '../../services/api/apiClient';

const jobs = [
  { id: 'pending-1', status: 'PENDING', attempts: 0, lastAttemptAt: null, createdAt: '2026-09-08T08:00:00.000Z', updatedAt: '2026-09-08T08:00:00.000Z' },
  { id: 'running-1', status: 'RUNNING', attempts: 2, lastAttemptAt: '2026-09-08T08:10:00.000Z', createdAt: '2026-09-08T07:00:00.000Z', updatedAt: '2026-09-08T08:10:00.000Z' },
  { id: 'failed-1', status: 'FAILED', attempts: 1, lastAttemptAt: '2026-09-08T07:00:00.000Z', createdAt: '2026-09-08T06:00:00.000Z', updatedAt: '2026-09-08T07:00:00.000Z' },
] as const;

describe('GalleryCleanupPanel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows cleanup counts, safe age details, and retry controls', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ jobs, counts: { pending: 4, retrying: 2, failed: 3 } });
    vi.spyOn(api, 'post').mockResolvedValue({ job: { ...jobs[2], status: 'SUCCEEDED' } });

    render(<GalleryCleanupPanel />);

    expect(await screen.findByText('Dọn dẹp ảnh gallery')).toBeVisible();
    expect(screen.getAllByText('Đang chờ').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Đang thử lại').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Thất bại').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Lần thử:/).some(element => element.textContent?.includes('2'))).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Thử lại' })).toHaveLength(2);
    expect(get).toHaveBeenCalledWith('/api/landing-pages/cleanup-failures', { limit: 100 });
  });

  it('supports an empty backlog and retry failures without hiding the jobs', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ jobs, counts: { pending: 1, retrying: 1, failed: 1 } });
    vi.spyOn(api, 'post').mockRejectedValue(new Error('storage unavailable'));
    const user = userEvent.setup();

    render(<GalleryCleanupPanel />);
    await screen.findByText('Dọn dẹp ảnh gallery');
    await user.click(screen.getAllByRole('button', { name: 'Thử lại' })[0]);

    expect(await screen.findByText('Không thể thử lại tác vụ này. Tác vụ vẫn được giữ trong hàng đợi.')).toBeVisible();
    expect(screen.getAllByText(/Lần thử:/).some(element => element.textContent?.includes('1'))).toBe(true);

    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({ jobs: [] });
    render(<GalleryCleanupPanel />);
    expect(await screen.findByText('Không có tác vụ dọn dẹp nào cần xử lý.')).toBeVisible();
  });

  it('shows a permission message when the protected endpoint denies access', async () => {
    const error = Object.assign(new Error('forbidden'), { status: 403 });
    vi.spyOn(api, 'get').mockRejectedValue(error);

    render(<GalleryCleanupPanel />);

    expect(await screen.findByText('Tài khoản của bạn không có quyền xem hàng đợi dọn dẹp ảnh.')).toBeVisible();
  });

  it('keeps a loading state while the protected endpoint is pending', async () => {
    let resolveRequest!: (value: { jobs: [] }) => void;
    vi.spyOn(api, 'get').mockReturnValue(new Promise(resolve => { resolveRequest = resolve; }));

    render(<GalleryCleanupPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải trạng thái dọn dẹp');
    resolveRequest({ jobs: [] });
    await waitFor(() => expect(screen.getByText('Không có tác vụ dọn dẹp nào cần xử lý.')).toBeVisible());
  });
});