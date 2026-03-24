import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, UserCheck, Users, BarChart3, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onNavigate?: (route: string) => void;
}

interface EmployeeSummary {
  user_id: string;
  name: string;
  email: string;
  avatar?: string;
  department?: string;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  total_assigned: number;
  completion_rate: number;
}

function WorkloadBar({ score }: { score: number }) {
  const max = 20;
  const pct = Math.min(100, (score / max) * 100);
  const color = score > 12 ? 'bg-rose-500' : score > 6 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold ${score > 12 ? 'text-rose-500' : score > 6 ? 'text-amber-500' : 'text-emerald-500'}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export function Employees({ onNavigate: _onNavigate }: Props) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<EmployeeSummary[]>('/api/reports/task-summary')
      .then(data => setEmployees(data || []))
      .catch(() => setError('Không thể tải dữ liệu nhân viên'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalOverdue = employees.reduce((s, e) => s + e.overdue, 0);
  const totalDone = employees.reduce((s, e) => s + e.done, 0);
  const avgCompletion = employees.length > 0 ? employees.reduce((s, e) => s + e.completion_rate, 0) / employees.length : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--glass-border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-500" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Quản lý Nhân viên</h1>
          <span className="text-sm text-[var(--text-tertiary)]">({employees.length})</span>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="px-4 md:px-6 py-4 grid grid-cols-3 gap-3 border-b border-[var(--glass-border)] flex-shrink-0">
          <div className="text-center">
            <p className="text-xl font-bold text-rose-500">{totalOverdue}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Công việc quá hạn</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-emerald-500">{totalDone}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Đã hoàn thành</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-500">{avgCompletion.toFixed(0)}%</p>
            <p className="text-xs text-[var(--text-tertiary)]">Tỷ lệ TB</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] flex-shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm nhân viên hoặc phòng ban..."
          className="w-full h-[38px] px-3 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={load} className="text-sm text-indigo-500 font-medium">Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Users className="w-9 h-9 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">Không tìm thấy nhân viên</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)]">
            {filtered.map(emp => (
              <div key={emp.user_id} className="px-4 md:px-6 py-4 hover:bg-[var(--glass-surface-hover)] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
                    {emp.name?.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">{emp.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{emp.department || emp.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {emp.overdue > 0 && (
                          <span className="flex items-center gap-1 text-xs text-rose-500 font-semibold">
                            <AlertCircle size={12} /> {emp.overdue} quá hạn
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${emp.completion_rate >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : emp.completion_rate >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                          {emp.completion_rate}%
                        </span>
                      </div>
                    </div>

                    {/* Task counts */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-[var(--text-tertiary)]">Tổng: <b className="text-[var(--text-primary)]">{emp.total_assigned}</b></span>
                      <span className="text-xs text-indigo-500">Đang làm: <b>{emp.in_progress}</b></span>
                      <span className="text-xs text-emerald-500">Hoàn thành: <b>{emp.done}</b></span>
                      <span className="text-xs text-slate-400">Chờ: <b>{emp.todo}</b></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
