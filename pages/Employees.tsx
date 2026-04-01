import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertTriangle, UserCheck, Users, RefreshCw, ChevronUp, ChevronDown, AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';

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

type SortKey = 'name' | 'total_assigned' | 'done' | 'in_progress' | 'overdue' | 'completion_rate';
type SortDir = 'asc' | 'desc';

function WorkloadBar({ score }: { score: number }) {
  const max = 20;
  const pct = Math.min(100, (score / max) * 100);
  const color = score > 12 ? 'bg-rose-500' : score > 6 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = score > 12 ? 'text-rose-500' : score > 6 ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 md:px-6 py-4 flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[var(--glass-surface-hover)] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 bg-[var(--glass-surface-hover)] rounded" />
        <div className="h-2.5 w-24 bg-[var(--glass-surface-hover)] rounded" />
      </div>
      <div className="h-3 w-16 bg-[var(--glass-surface-hover)] rounded" />
    </div>
  );
}

function SortButton({ col, current, dir, onClick }: { col: SortKey; current: SortKey; dir: SortDir; onClick: (c: SortKey) => void }) {
  const active = col === current;
  return (
    <button
      onClick={() => onClick(col)}
      className={`flex items-center gap-0.5 text-xs font-medium transition-colors ${active ? 'text-indigo-500' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
      {active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
    </button>
  );
}

export function Employees() {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('overdue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await api.get<EmployeeSummary[]>('/api/reports/task-summary');
      setEmployees(data || []);
    } catch {
      setError('Không thể tải dữ liệu nhân viên');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col: SortKey) => {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const arr = !q ? employees : employees.filter(e =>
      e.name.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q)
    );
    return [...arr].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [employees, search, sortKey, sortDir]);

  const totalOverdue = employees.reduce((s, e) => s + e.overdue, 0);
  const totalDone = employees.reduce((s, e) => s + e.done, 0);
  const avgCompletion = employees.length > 0 ? employees.reduce((s, e) => s + e.completion_rate, 0) / employees.length : 0;

  const SortCol = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${sortKey === col ? 'text-indigo-500' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
      {label}
      {sortKey === col
        ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
        : <ChevronDown size={11} className="opacity-30" />}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--glass-border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-500" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Quản lý Nhân viên</h1>
          {!loading && <span className="text-sm text-[var(--text-tertiary)]">({employees.length})</span>}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="h-[32px] px-2.5 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Làm mới
        </button>
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

      {/* Sort header */}
      {!loading && !error && employees.length > 0 && (
        <div className="px-4 md:px-6 py-2 border-b border-[var(--glass-border)] flex-shrink-0 hidden md:flex items-center text-xs text-[var(--text-tertiary)] gap-4">
          <div className="flex-1">
            <SortCol col="name" label="Tên" />
          </div>
          <div className="w-16 text-center"><SortCol col="total_assigned" label="Tổng" /></div>
          <div className="w-20 text-center"><SortCol col="in_progress" label="Đang làm" /></div>
          <div className="w-16 text-center"><SortCol col="overdue" label="Quá hạn" /></div>
          <div className="w-24 text-right"><SortCol col="completion_rate" label="Hoàn thành" /></div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => load()} className="text-sm text-indigo-500 font-medium">Thử lại</button>
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
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
                    {emp.name?.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">{emp.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{emp.department || emp.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {emp.overdue > 0 && (
                          <span className="flex items-center gap-1 text-xs text-rose-500 font-semibold">
                            <AlertCircle size={12} /> {emp.overdue}
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${emp.completion_rate >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : emp.completion_rate >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                          {emp.completion_rate}%
                        </span>
                      </div>
                    </div>

                    {/* Task counts + workload */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-[var(--text-tertiary)]">Tổng: <b className="text-[var(--text-primary)]">{emp.total_assigned}</b></span>
                      <span className="text-xs text-indigo-500">Đang làm: <b>{emp.in_progress}</b></span>
                      <span className="text-xs text-emerald-500">Hoàn thành: <b>{emp.done}</b></span>
                      <span className="text-xs text-slate-400">Chờ: <b>{emp.todo}</b></span>
                      {emp.total_assigned > 0 && (
                        <WorkloadBar score={emp.in_progress + emp.overdue * 2} />
                      )}
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
