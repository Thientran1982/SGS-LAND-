import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { TaskDashboardStats, Department } from '../types';
import { ROUTES } from '../config/routes';
import { STATUS_LABELS, PRIORITY_LABELS, PRIORITY_DOT } from '../utils/taskUtils';
import { SelectDropdown } from '../components/task/SelectDropdown';

interface Props {
  onNavigate?: (route: string) => void;
}

const navigateTo = (route: string) => { window.location.hash = `#/${route}`; };

const STATUS_BAR_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-indigo-500',
  review: 'bg-amber-400',
  done: 'bg-emerald-500',
  cancelled: 'bg-rose-400',
};

function StatCard({ label, value, sub, color, icon }: { label: string; value: number | string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--glass-border)] flex items-start gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
        {sub && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--glass-border)] flex items-start gap-4 shadow-sm animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-[var(--glass-surface-hover)] flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-6 w-16 bg-[var(--glass-surface-hover)] rounded" />
        <div className="h-3 w-28 bg-[var(--glass-surface-hover)] rounded" />
      </div>
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm animate-pulse space-y-3">
      <div className="h-4 w-40 bg-[var(--glass-surface-hover)] rounded" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-[var(--glass-surface-hover)] rounded" />
            <div className="h-3 w-8 bg-[var(--glass-surface-hover)] rounded" />
          </div>
          <div className="h-2 bg-[var(--glass-surface-hover)] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TaskDashboard({ onNavigate: onNavigateProp }: Props) {
  const onNavigate = onNavigateProp ?? navigateTo;
  const [stats, setStats] = useState<TaskDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get('dept') || ''; } catch { return ''; }
  });
  const fetchRef = useRef(0);

  useEffect(() => {
    api.get<{ data: Department[] }>('/api/departments')
      .then(r => setDepartments(r.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (silent = false, deptId = departmentId) => {
    const token = ++fetchRef.current;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const qs = deptId ? `?department_id=${encodeURIComponent(deptId)}` : '';
      const data = await api.get<TaskDashboardStats>(`/api/dashboard/task-stats${qs}`);
      if (fetchRef.current !== token) return;
      setStats(data);
    } catch {
      if (fetchRef.current !== token) return;
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      if (fetchRef.current === token) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [departmentId]);

  useEffect(() => { load(false, departmentId); }, [departmentId, load]);

  // URL sync
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (departmentId) qs.set('dept', departmentId); else qs.delete('dept');
    const search = qs.toString();
    window.history.replaceState(null, '', window.location.pathname + (search ? '?' + search : ''));
  }, [departmentId]);

  const { overview } = stats ?? {};
  const completionRate = overview && overview.total_tasks > 0
    ? Math.round((overview.done / overview.total_tasks) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 animate-enter no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Tổng quan Công việc</h1>
            <p className="text-sm text-[var(--text-secondary)]">Theo dõi tiến độ và phân công công việc</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {departments.length > 0 && (
            <div className="min-w-[180px]">
              <SelectDropdown
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="Tất cả phòng ban"
                height={34}
                options={[
                  { value: '', label: 'Tất cả phòng ban' },
                  ...departments.map(d => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-[34px] px-3 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button onClick={() => load(false, departmentId)} className="text-sm text-indigo-500 font-medium">Thử lại</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : overview ? (
          <>
            <StatCard label="Tổng công việc" value={overview.total_tasks} icon={<ClipboardList className="w-5 h-5 text-indigo-600" />} color="bg-indigo-100 dark:bg-indigo-900/30" />
            <StatCard label="Quá hạn" value={overview.overdue_count} sub="Cần xử lý ngay" icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} color="bg-rose-100 dark:bg-rose-900/30" />
            <StatCard label="Hoàn thành" value={`${completionRate}%`} sub={`${overview.done} / ${overview.total_tasks}`} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} color="bg-emerald-100 dark:bg-emerald-900/30" />
            <StatCard label="Đến hạn hôm nay" value={overview.due_today_count} icon={<Clock className="w-5 h-5 text-amber-600" />} color="bg-amber-100 dark:bg-amber-900/30" />
          </>
        ) : null}
      </div>

      {/* Status breakdown + Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <>
            <SkeletonSection />
            <SkeletonSection />
          </>
        ) : stats && (
          <>
            {/* Status breakdown */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Theo trạng thái</h3>
              <div className="space-y-3">
                {(['todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map(s => {
                  const count = (overview as any)[s] as number;
                  const pct = overview!.total_tasks > 0 ? (count / overview!.total_tasks) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">{STATUS_LABELS[s]}</span>
                        <span className="font-medium text-[var(--text-primary)]">{count}</span>
                      </div>
                      <div className="h-2 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${STATUS_BAR_COLORS[s]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority breakdown */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Theo độ ưu tiên (đang mở)</h3>
              <div className="space-y-3">
                {(['urgent', 'high', 'medium', 'low'] as const).map(p => {
                  const count = stats.by_priority[p] || 0;
                  const total = Object.values(stats.by_priority).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={p}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">{PRIORITY_LABELS[p]}</span>
                        <span className="font-medium text-[var(--text-primary)]">{count}</span>
                      </div>
                      <div className="h-2 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${PRIORITY_DOT[p]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Workload by User */}
      {!loading && stats?.workload_by_user && stats.workload_by_user.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Khối lượng công việc / Nhân viên</h3>
            <button onClick={() => onNavigate(ROUTES.EMPLOYEES)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">
              Xem tất cả →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--glass-border)]">
                  <th className="pb-2 font-medium">Nhân viên</th>
                  <th className="pb-2 font-medium text-center">Đang làm</th>
                  <th className="pb-2 font-medium text-center">Quá hạn</th>
                  <th className="pb-2 font-medium text-right">Điểm tải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {stats.workload_by_user.slice(0, 8).map(u => (
                  <tr key={u.user_id} className="hover:bg-[var(--glass-surface-hover)] transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 flex-shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{u.name}</div>
                          {u.department && <div className="text-xs text-[var(--text-tertiary)]">{u.department}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-[var(--text-secondary)]">{u.active_tasks}</td>
                    <td className="py-2.5 text-center">
                      {u.overdue_tasks > 0
                        ? <span className="text-rose-500 font-semibold">{u.overdue_tasks}</span>
                        : <span className="text-[var(--text-tertiary)]">0</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${u.workload_score > 10 ? 'text-rose-500' : u.workload_score > 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {u.workload_score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming Deadlines */}
      {!loading && stats?.upcoming_deadlines && stats.upcoming_deadlines.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Sắp đến hạn (7 ngày)</h3>
            <button onClick={() => onNavigate(ROUTES.TASKS)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">
              Xem tất cả →
            </button>
          </div>
          <div className="space-y-2">
            {stats.upcoming_deadlines.slice(0, 5).map(t => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--glass-surface-hover)] transition-colors cursor-pointer"
                onClick={() => { window.location.hash = `#/${ROUTES.TASKS}/${t.id}`; }}>
                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${t.days_until_deadline === 0 ? 'bg-rose-500' : (t.days_until_deadline ?? 99) <= 3 ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{t.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t.days_until_deadline === 0 ? 'Hôm nay' : `Còn ${t.days_until_deadline} ngày`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.days_until_deadline === 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                  {t.deadline?.toString().split('T')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
