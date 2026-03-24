import { useEffect, useRef } from 'react';
import { api } from './api/apiClient';

const PAGE_LABELS: Record<string, string> = {
  'dashboard': 'Bảng Điều Khiển',
  'leads': 'Khách Hàng Tiềm Năng',
  'contracts': 'Hợp Đồng',
  'inventory': 'Kho Bất Động Sản',
  'favorites': 'Danh Sách Yêu Thích',
  'inbox': 'Hộp Thư',
  'reports': 'Báo Cáo',
  'approvals': 'Phê Duyệt',
  'routing-rules': 'Quy Tắc Phân Phối',
  'sequences': 'Chuỗi Tự Động',
  'scoring-rules': 'Quy Tắc Chấm Điểm',
  'knowledge': 'Cơ Sở Kiến Thức',
  'system': 'Trạng Thái Hệ Thống',
  'admin-users': 'Quản Lý Người Dùng',
  'enterprise-settings': 'Cài Đặt Doanh Nghiệp',
  'billing': 'Thanh Toán',
  'marketplace-apps': 'Marketplace',
  'data-platform': 'Nền Tảng Dữ Liệu',
  'security': 'Bảo Mật & Tuân Thủ',
  'ai-governance': 'Quản Trị AI',
  'seo-manager': 'Quản Lý SEO',
  'profile': 'Hồ Sơ Cá Nhân',
  'mobile-app': 'Ứng Dụng Di Động',
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
