import { WfTaskStatus, TaskPriority, TaskCategory } from '../types';

export const STATUS_LABELS: Record<WfTaskStatus, string> = {
  todo: 'Chờ xử lý',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const STATUS_COLORS: Record<WfTaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

export const PRIORITY_LABELS_SHORT: Record<TaskPriority, string> = {
  urgent: 'Khẩn',
  high: 'Cao',
  medium: 'TB',
  low: 'Thấp',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  low: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-teal-500',
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  sales: 'Kinh doanh',
  legal: 'Pháp lý',
  marketing: 'Marketing',
  site_visit: 'Đi thực địa',
  customer_care: 'CSKH',
  finance: 'Tài chính',
  construction: 'Xây dựng',
  admin: 'Hành chính',
  other: 'Khác',
};

export const CATEGORY_LABELS_SHORT: Partial<Record<TaskCategory, string>> = {
  sales: 'KD', legal: 'PL', marketing: 'MKT', site_visit: 'TĐ',
  customer_care: 'CSKH', finance: 'TC', construction: 'XD', admin: 'HC', other: '—',
};

export const ALL_STATUSES: WfTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
export const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

export const VALID_TRANSITIONS: Record<WfTaskStatus, WfTaskStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['review', 'todo', 'cancelled'],
  review: ['done', 'in_progress'],
  done: [],
  cancelled: ['todo'],
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export function formatDeadlineRelative(
  deadline: string | null | undefined,
  isOverdue: boolean,
  days: number | null,
): string | null {
  if (!deadline) return null;
  if (isOverdue) return `Quá hạn ${Math.abs(days ?? 0)} ngày`;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Còn 1 ngày';
  return `Còn ${days ?? ''} ngày`;
}

export function formatDeadlineShort(
  deadline: string | null | undefined,
  isOverdue: boolean,
  days: number | null,
): string | null {
  if (!deadline) return null;
  if (isOverdue) return `Quá hạn ${Math.abs(days ?? 0)}n`;
  if (days === 0) return 'Hôm nay';
  return `Còn ${days ?? 0}n`;
}

export type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'normal';

export function isValidTransition(from: WfTaskStatus, to: WfTaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function calcUrgency(
  deadline: string | null | undefined,
  status: WfTaskStatus,
  daysUntil: number | null,
): UrgencyLevel {
  if (!deadline || status === 'done' || status === 'cancelled') return 'normal';
  if (daysUntil !== null && daysUntil < 0) return 'overdue';
  if (daysUntil !== null && daysUntil <= 2) return 'critical';
  if (daysUntil !== null && daysUntil <= 7) return 'warning';
  return 'normal';
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return timeAgo(dateStr);
}

export function exportTasksToCSV(tasks: import('../types').WfTask[]): void {
  const headers = ['Tiêu đề', 'Trạng thái', 'Ưu tiên', 'Deadline', 'Dự án', 'Phòng ban', 'Người thực hiện', 'Tạo lúc'];
  const rows = tasks.map(t => [
    `"${(t.title || '').replace(/"/g, '""')}"`,
    STATUS_LABELS[t.status] || t.status,
    PRIORITY_LABELS[t.priority] || t.priority,
    t.deadline ? t.deadline.toString().split('T')[0] : '',
    t.project_name || '',
    t.department_name || '',
    (t.assignees || []).map(a => a.name).join('; '),
    new Date(t.created_at).toLocaleDateString('vi-VN'),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cong-viec-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
