import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Download, Loader2, AlertTriangle, BarChart3, Building2, Users, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { TaskDashboardStats } from '../types';
import { CATEGORY_LABELS } from '../utils/taskUtils';
import { ROUTES } from '../config/routes';

interface ProjectReport {
  id: string;
  name: string;
  project_status: string;
  location?: string;
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  overdue: number;
  completion_rate: number;
}

interface UserSummary {
  user_id: string;
  name: string;
  email: string;
  department?: string;
  total_assigned: number;
  done: number;
  overdue: number;
  completion_rate: number;
}

function SkeletonKpi() {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm animate-pulse text-center">
      <div className="h-7 w-14 bg-[var(--glass-surface-hover)] rounded mx-auto mb-1.5" />
      <div className="h-2.5 w-24 bg-[var(--glass-surface-hover)] rounded mx-auto" />
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
            <div className="h-3 w-32 bg-[var(--glass-surface-hover)] rounded" />
            <div className="h-3 w-12 bg-[var(--glass-surface-hover)] rounded" />
          </div>
          <div className="h-1.5 bg-[var(--glass-surface-hover)] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TaskReports() {
  const [stats, setStats] = useState<TaskDashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectReport[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [s, p, u] = await Promise.all([
        api.get<TaskDashboardStats>('/api/dashboard/task-stats'),
        api.get<ProjectReport[]>('/api/reports/task-by-project'),
        api.get<UserSummary[]>('/api/reports/task-summary'),
      ]);
      setStats(s);
      setProjects(p || []);
      setUsers(u || []);
    } catch {
      setError('Không thể tải báo cáo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/reports/task-export/csv', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sgs-tasks-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totalTasks = stats?.overview.total_tasks ?? 0;
  const completionRate = totalTasks > 0 ? ((stats!.overview.done / totalTasks) * 100).toFixed(1) : '0';

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 animate-enter no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <PieChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Báo cáo Công việc</h1>
            <p className="text-sm text-[var(--text-secondary)]">Phân tích và thống kê toàn bộ công việc</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-[36px] px-3 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="h-[36px] px-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button onClick={() => load()} className="text-sm text-indigo-500 font-medium">Thử lại</button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : stats && (
          [
            { label: 'Tỷ lệ hoàn thành', value: `${completionRate}%`, color: 'text-emerald-500' },
            { label: 'Quá hạn', value: stats.overview.overdue_count, color: 'text-rose-500' },
            { label: 'Hoàn thành tuần này', value: stats.completion_rate_week, color: 'text-indigo-500' },
            { label: 'Hoàn thành hôm nay', value: stats.completion_rate_today, color: 'text-amber-500' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm text-center">
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{kpi.label}</p>
            </div>
          ))
        )}
      </div>

      {/* Category breakdown */}
      {loading ? (
        <SkeletonSection />
      ) : stats && Object.keys(stats.by_category).length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Công việc theo danh mục (đang mở)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(stats.by_category).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between p-3 bg-[var(--glass-surface-hover)] rounded-xl">
                <span className="text-sm text-[var(--text-secondary)]">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}</span>
                <span className="font-bold text-[var(--text-primary)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Project */}
      {loading ? (
        <SkeletonSection />
      ) : projects.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Công việc theo dự án
          </h3>
          <div className="space-y-3">
            {projects.filter(p => p.total > 0).slice(0, 10).map(proj => (
              <div key={proj.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-[var(--text-primary)] truncate">{proj.name}</span>
                    {proj.overdue > 0 && (
                      <span className="text-xs text-rose-500 font-medium flex-shrink-0">⚠ {proj.overdue} quá hạn</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[var(--text-tertiary)]">{proj.done}/{proj.total}</span>
                    <span className={`text-xs font-bold ${Number(proj.completion_rate) >= 70 ? 'text-emerald-500' : Number(proj.completion_rate) >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {proj.completion_rate}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${Number(proj.completion_rate) >= 70 ? 'bg-emerald-500' : Number(proj.completion_rate) >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${proj.completion_rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User performance summary */}
      {loading ? (
        <SkeletonSection />
      ) : users.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> Hiệu suất Nhân viên
            </h3>
            <button
              onClick={() => { window.location.hash = `#/${ROUTES.EMPLOYEES}`; }}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">
              Xem chi tiết →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--glass-border)] text-xs">
                  <th className="pb-2 font-medium">Nhân viên</th>
                  <th className="pb-2 font-medium text-center">Tổng</th>
                  <th className="pb-2 font-medium text-center">Hoàn thành</th>
                  <th className="pb-2 font-medium text-center">Quá hạn</th>
                  <th className="pb-2 font-medium text-right">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {users.slice(0, 10).map(u => (
                  <tr key={u.user_id} className="hover:bg-[var(--glass-surface-hover)] transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 flex-shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--text-primary)] text-xs">{u.name}</div>
                          {u.department && <div className="text-[10px] text-[var(--text-tertiary)]">{u.department}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-[var(--text-secondary)] text-xs">{u.total_assigned}</td>
                    <td className="py-2.5 text-center text-emerald-500 font-semibold text-xs">{u.done}</td>
                    <td className="py-2.5 text-center text-xs">
                      {u.overdue > 0
                        ? <span className="text-rose-500 font-semibold">{u.overdue}</span>
                        : <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-bold ${u.completion_rate >= 70 ? 'text-emerald-500' : u.completion_rate >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {u.completion_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
