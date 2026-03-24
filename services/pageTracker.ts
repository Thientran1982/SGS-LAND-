import { useEffect, useRef } from 'react';
import { api } from './api/apiClient';
import { ROUTES } from '../config/routes';

const PAGE_LABELS: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Bảng Điều Khiển',
  [ROUTES.LEADS]: 'Khách Hàng Tiềm Năng',
  [ROUTES.CONTRACTS]: 'Hợp Đồng',
  [ROUTES.INVENTORY]: 'Kho Bất Động Sản',
  [ROUTES.FAVORITES]: 'Danh Sách Yêu Thích',
  [ROUTES.INBOX]: 'Hộp Thư',
  [ROUTES.REPORTS]: 'Báo Cáo',
  [ROUTES.APPROVALS]: 'Phê Duyệt',
  [ROUTES.ROUTING_RULES]: 'Quy Tắc Phân Phối',
  [ROUTES.SEQUENCES]: 'Chuỗi Tự Động',
  [ROUTES.SCORING_RULES]: 'Quy Tắc Chấm Điểm',
  [ROUTES.KNOWLEDGE]: 'Cơ Sở Kiến Thức',
  [ROUTES.SYSTEM]: 'Trạng Thái Hệ Thống',
  [ROUTES.ADMIN_USERS]: 'Quản Lý Người Dùng',
  [ROUTES.ENTERPRISE_SETTINGS]: 'Cài Đặt Doanh Nghiệp',
  [ROUTES.BILLING]: 'Thanh Toán',
  [ROUTES.MARKETPLACE]: 'Marketplace',
  [ROUTES.DATA_PLATFORM]: 'Nền Tảng Dữ Liệu',
  [ROUTES.SECURITY]: 'Bảo Mật & Tuân Thủ',
  [ROUTES.AI_GOVERNANCE]: 'Quản Trị AI',
  [ROUTES.SEO_MANAGER]: 'Quản Lý SEO',
  [ROUTES.PROFILE]: 'Hồ Sơ Cá Nhân',
  [ROUTES.MOBILE_APP]: 'Ứng Dụng Di Động',
  [ROUTES.LISTING]: 'Chi Tiết Bất Động Sản',
};

function getPathFromHash(): string {
  let hash = window.location.hash.slice(1);
  if (hash.startsWith('/')) hash = hash.slice(1);
  if (hash.endsWith('/')) hash = hash.slice(0, -1);
  return hash.split('?')[0].split('/')[0] || '';
}

async function trackPageView(path: string): Promise<void> {
  if (!path) return;
  const pageLabel = PAGE_LABELS[path] || path;
  try {
    await api.post('/api/activity/pageview', { path, pageLabel });
  } catch {
    // Silent — tracking should never break the app
  }
}

export function usePageTracker(isAuthenticated: boolean) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const track = () => {
      const path = getPathFromHash();
      if (!path || path === lastTrackedRef.current) return;
      lastTrackedRef.current = path;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        trackPageView(path);
      }, 1000);
    };

    track();

    window.addEventListener('hashchange', track);
    return () => {
      window.removeEventListener('hashchange', track);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isAuthenticated]);
}
