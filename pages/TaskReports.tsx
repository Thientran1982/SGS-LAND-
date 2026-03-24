import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Download, Loader2, AlertTriangle, BarChart3, Building2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { TaskDashboardStats } from '../types';

interface ProjectReport {
  id: string;
  name: string;
  project_status: string;
  property_type: string;
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  overdue: number;
  completion_rate: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Kinh doanh', legal: 'Pháp lý', marketing: 'Marketing',
  site_visit: 'Khảo sát', customer_care: 'CSKH', finance: 'Tài chính',
  construction: 'Kỹ thuật', admin: 'Hành chính', other: 'Khác',
};

export function TaskReports() {
  const [stats, setStats] = useState<TaskDashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<TaskDashboardStats>('/api/dashboard/task-stats'),
      api.get<ProjectReport[]>('/api/reports/task-by-project'),
    ])
      .then(([s, p]) => { setStats(s); setProjects(p || []); })
      .catch(() => setError('Không thể tải báo cáo'))
      .finally(() => setLoading(false));
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

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error || !stats) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-[var(--text-secondary)]">{error || 'Không có dữ liệu'}</p>
      <button onClick={load} className="text-sm text-indigo-500 font-medium">Thử lại</button>
    </div>
  );

  const totalTasks = stats.overview.total_tasks;
  const completionRate = totalTasks > 0 ? ((stats.overview.done / totalTasks) * 100).toFixed(1) : '0';

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
        <button
          onClick={handleExport}
          disabled={exporting}
          className="h-[36px] px-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Xuất CSV
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tỷ lệ hoàn thành', value: `${completionRate}%`, color: 'text-emerald-500' },
          { label: 'Quá hạn', value: stats.overview.overdue_count, color: 'text-rose-500' },
          { label: 'Hoàn thành tuần này', value: stats.completion_rate_week, color: 'text-indigo-500' },
          { label: 'Hoàn thành hôm nay', value: stats.completion_rate_today, color: 'text-amber-500' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Công việc theo danh mục (đang mở)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(stats.by_category).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between p-3 bg-[var(--glass-surface-hover)] rounded-xl">
              <span className="text-sm text-[var(--text-secondary)]">{CATEGORY_LABELS[cat] || cat}</span>
              <span className="font-bold text-[var(--text-primary)]">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Project */}
      {projects.length > 0 && (
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
                  <div className={`h-full rounded-full transition-all duration-500 ${Number(proj.completion_rate) >= 70 ? 'bg-emerald-500' : Number(proj.completion_rate) >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${proj.completion_rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
