import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bug, RefreshCw, CheckCheck, Trash2, Filter, AlertTriangle,
  AlertCircle, Info, Globe, Server, Zap, Clock, ChevronDown, ChevronUp,
  X, Check, ShieldAlert, CheckCircle2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorLogEntry {
  id: number;
  type: 'frontend' | 'backend' | 'unhandled_promise' | 'chunk_load';
  severity: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  component?: string;
  path?: string;
  userId?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  trend: { date: string; count: number }[];
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; dot: string }> = {
  frontend:         { label: 'Giao diện (Frontend)', icon: <Globe size={14} />,    color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',   dot: 'bg-blue-500' },
  backend:          { label: 'Máy chủ (Backend)',     icon: <Server size={14} />,   color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10', dot: 'bg-purple-500' },
  unhandled_promise:{ label: 'Bất đồng bộ (Promise)', icon: <Zap size={14} />,     color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', dot: 'bg-amber-500' },
  chunk_load:       { label: 'Tải module (Chunk)',    icon: <RefreshCw size={14} />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10',    dot: 'bg-cyan-500' },
};

const SEVERITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; dot: string }> = {
  warning:  { label: 'Cảnh báo',      icon: <Info size={14} />,         color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',     dot: 'bg-amber-400' },
  error:    { label: 'Lỗi',           icon: <AlertCircle size={14} />,  color: 'text-rose-600',  bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',         dot: 'bg-rose-500' },
  critical: { label: 'Nghiêm trọng',  icon: <AlertTriangle size={14} />,color: 'text-red-700',   bg: 'bg-red-50 dark:bg-red-600/10 border-red-300 dark:border-red-500/30',            dot: 'bg-red-600' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function relativeDiff(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

// ─── Sparkline 30 ngày ────────────────────────────────────────────────────────

function TrendSparkline({ trend }: { trend: { date: string; count: number }[] }) {
  if (!trend.length) return (
    <div className="flex items-end gap-[2px] h-8 opacity-20">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{ height: '2px' }} className="flex-1 rounded-sm bg-rose-400" />
      ))}
    </div>
  );
  const last30 = trend.slice(-30);
  const max = Math.max(...last30.map(t => t.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {last30.map((t, i) => (
        <div
          key={i}
          title={`${new Date(t.date).toLocaleDateString('vi-VN')}: ${t.count} lỗi`}
          style={{ height: `${Math.max(2, Math.round((t.count / max) * 32))}px` }}
          className="flex-1 rounded-sm bg-rose-400 dark:bg-rose-500 opacity-70 hover:opacity-100 transition-opacity cursor-default"
        />
      ))}
    </div>
  );
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  dotColor?: string;
}

interface FilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
}

function FilterDropdown({ value, onChange, options, placeholder }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const label = selected ? selected.label : placeholder;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`
          flex items-center gap-2 px-3 py-1.5 text-sm rounded-xl border transition-all
          ${value
            ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
            : 'border-[var(--glass-border)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
          }
        `}
      >
        {selected?.icon && <span className="flex-shrink-0 opacity-70">{selected.icon}</span>}
        {selected?.dotColor && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.dotColor}`} />
        )}
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[180px] bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-lg overflow-hidden animate-enter">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                ${opt.value === value
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'hover:bg-[var(--glass-surface-hover)] text-[var(--text-primary)]'
                }
              `}
            >
              {opt.dotColor && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dotColor}`} />}
              {opt.icon && <span className="flex-shrink-0 text-[var(--text-secondary)]">{opt.icon}</span>}
              <span className="flex-1">{opt.label}</span>
              {opt.value === value && <Check size={12} className="text-indigo-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Options ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Tất cả loại lỗi' },
  { value: 'frontend',          label: 'Giao diện (Frontend)',    icon: <Globe size={14} />,     dotColor: 'bg-blue-500' },
  { value: 'backend',           label: 'Máy chủ (Backend)',       icon: <Server size={14} />,    dotColor: 'bg-purple-500' },
  { value: 'unhandled_promise', label: 'Bất đồng bộ (Promise)',  icon: <Zap size={14} />,       dotColor: 'bg-amber-500' },
  { value: 'chunk_load',        label: 'Tải module (Chunk)',      icon: <RefreshCw size={14} />, dotColor: 'bg-cyan-500' },
];

const SEVERITY_OPTIONS: DropdownOption[] = [
  { value: '',         label: 'Tất cả mức độ' },
  { value: 'warning',  label: 'Cảnh báo',     icon: <Info size={14} />,          dotColor: 'bg-amber-400' },
  { value: 'error',    label: 'Lỗi',          icon: <AlertCircle size={14} />,   dotColor: 'bg-rose-500' },
  { value: 'critical', label: 'Nghiêm trọng', icon: <AlertTriangle size={14} />, dotColor: 'bg-red-600' },
];

const STATUS_OPTIONS: DropdownOption[] = [
  { value: 'false', label: 'Chưa xử lý', icon: <ShieldAlert size={14} />,   dotColor: 'bg-rose-500' },
  { value: 'true',  label: 'Đã xử lý',   icon: <CheckCircle2 size={14} />,  dotColor: 'bg-emerald-500' },
  { value: '',      label: 'Tất cả',     icon: <Filter size={14} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ErrorMonitor() {
  const [entries, setEntries]           = useState<ErrorLogEntry[]>([]);
  const [stats, setStats]               = useState<ErrorStats | null>(null);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [filterType, setFilterType]     = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('false');
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const PAGE_SIZE = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filterType)     params.set('type',     filterType);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterResolved) params.set('resolved', filterResolved);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/error-logs?${params}`, { credentials: 'include' }),
        fetch('/api/error-logs/stats',      { credentials: 'include' }),
      ]);

      if (!listRes.ok || !statsRes.ok) throw new Error('Không có quyền truy cập hoặc lỗi máy chủ');

      const [listData, statsData] = await Promise.all([listRes.json(), statsRes.json()]);
      setEntries(listData.items ?? []);
      setTotal(listData.total ?? 0);
      setStats(statsData);
    } catch (e: any) {
      setFetchError(e.message ?? 'Không thể tải danh sách lỗi');
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterSeverity, filterResolved]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (id: number) => {
    setActionLoading(true);
    try {
      await fetch(`/api/error-logs/${id}/resolve`, { method: 'PATCH', credentials: 'include' });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveAll = async () => {
    if (!window.confirm('Đánh dấu tất cả lỗi chưa xử lý là đã giải quyết?')) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolve-all', { method: 'POST', credentials: 'include' });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteResolved = async () => {
    if (!window.confirm('Xóa vĩnh viễn tất cả lỗi đã xử lý? Thao tác không thể hoàn tác.')) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolved', { method: 'DELETE', credentials: 'include' });
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => { setFilterType(''); setFilterSeverity(''); setFilterResolved('false'); setPage(1); };
  const hasActiveFilter = filterType !== '' || filterSeverity !== '' || filterResolved === '';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Derived stats
  const resolved  = stats ? stats.total - stats.unresolved : 0;
  const resolvedPct = stats && stats.total > 0 ? Math.round((resolved / stats.total) * 100) : 0;
  const unresolved = stats?.unresolved ?? 0;

  return (
    <div className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)] p-4 md:p-6 space-y-5">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 flex-shrink-0">
            <Bug size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Giám Sát Lỗi</h1>
            <p className="text-sm text-[var(--text-secondary)]">Theo dõi lỗi giao diện &amp; máy chủ theo thời gian thực</p>
          </div>
          {unresolved > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full flex-shrink-0">
              {unresolved.toLocaleString('vi-VN')} chưa xử lý
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] hover:bg-[var(--glass-surface-hover)] transition-all text-[var(--text-secondary)]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          {unresolved > 0 && (
            <button
              onClick={handleResolveAll}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-all"
            >
              <CheckCheck size={14} />
              Xử lý tất cả
            </button>
          )}
          <button
            onClick={handleDeleteResolved}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--glass-border)] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-300 transition-all text-[var(--text-secondary)]"
          >
            <Trash2 size={14} />
            Xóa đã xử lý
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Tổng lỗi */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading && !stats ? '—' : (stats?.total ?? 0).toLocaleString('vi-VN')}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Tổng lỗi đã ghi nhận</div>
        </div>

        {/* Chưa xử lý */}
        <div className={`rounded-2xl p-4 border ${unresolved > 0 ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5' : 'border-[var(--glass-border)] bg-[var(--bg-surface)]'}`}>
          <div className={`text-2xl font-bold ${unresolved > 0 ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}>
            {loading && !stats ? '—' : unresolved.toLocaleString('vi-VN')}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Chưa xử lý</div>
          {stats && stats.total > 0 && (
            <div className="mt-2 h-1 bg-rose-100 dark:bg-rose-500/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all"
                style={{ width: `${Math.round((unresolved / stats.total) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Đã xử lý */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
          <div className="text-2xl font-bold text-emerald-600">
            {loading && !stats ? '—' : resolved.toLocaleString('vi-VN')}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Đã xử lý
            {stats && stats.total > 0 && (
              <span className="ml-1 text-emerald-600 font-medium">({resolvedPct}%)</span>
            )}
          </div>
          {stats && stats.total > 0 && (
            <div className="mt-2 h-1 bg-emerald-100 dark:bg-emerald-500/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${resolvedPct}%` }}
              />
            </div>
          )}
        </div>

        {/* 30-ngày trend */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
          <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">Xu hướng 30 ngày qua</div>
          <TrendSparkline trend={stats?.trend ?? []} />
          {stats && stats.trend.length > 0 && (
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {stats.trend.slice(-1)[0]?.count ?? 0} lỗi hôm nay
            </div>
          )}
        </div>
      </div>

      {/* ── Breakdown bars ───────────────────────────────────────────── */}
      {stats && (stats.total > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Theo loại lỗi */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Phân loại theo nguồn gốc</div>
            <div className="space-y-2.5">
              {Object.entries(stats.byType).sort((a,b) => b[1]-a[1]).map(([k, v]) => {
                const cfg = TYPE_CONFIG[k];
                const pct = stats.total > 0 ? Math.round((v / stats.total) * 100) : 0;
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                        <span className={`w-2 h-2 rounded-full ${cfg?.dot ?? 'bg-slate-400'}`} />
                        {cfg?.label ?? k}
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono">{v.toLocaleString('vi-VN')} <span className="text-[var(--text-secondary)]/60">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cfg?.dot ?? 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Theo mức độ */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Phân loại theo mức độ</div>
            <div className="space-y-2.5">
              {(['critical', 'error', 'warning'] as const).map(sev => {
                const v = stats.bySeverity[sev] ?? 0;
                const cfg = SEVERITY_CONFIG[sev];
                const pct = stats.total > 0 ? Math.round((v / stats.total) * 100) : 0;
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono">{v.toLocaleString('vi-VN')} <span className="text-[var(--text-secondary)]/60">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cfg.dot}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bộ lọc ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)]">
        <Filter size={13} className="text-[var(--text-secondary)] flex-shrink-0" />
        <span className="text-xs text-[var(--text-secondary)] mr-1">Lọc:</span>

        <FilterDropdown
          value={filterType}
          onChange={v => { setFilterType(v); setPage(1); }}
          options={TYPE_OPTIONS}
          placeholder="Tất cả loại lỗi"
        />
        <FilterDropdown
          value={filterSeverity}
          onChange={v => { setFilterSeverity(v); setPage(1); }}
          options={SEVERITY_OPTIONS}
          placeholder="Tất cả mức độ"
        />
        <FilterDropdown
          value={filterResolved}
          onChange={v => { setFilterResolved(v); setPage(1); }}
          options={STATUS_OPTIONS}
          placeholder="Chưa xử lý"
        />

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-rose-500 transition-colors px-1"
          >
            <X size={12} /> Đặt lại
          </button>
        )}

        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          {loading ? '...' : `${total.toLocaleString('vi-VN')} kết quả`}
        </span>
      </div>

      {/* ── Thông báo lỗi tải ────────────────────────────────────────── */}
      {fetchError && (
        <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {fetchError}
        </div>
      )}

      {/* ── Danh sách lỗi ────────────────────────────────────────────── */}
      <div className="space-y-2">
        {loading && !entries.length
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] animate-pulse" />
            ))
          : entries.length === 0
          ? (
              <div className="text-center py-16 text-[var(--text-secondary)]">
                <Bug size={36} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Không có lỗi nào phù hợp với bộ lọc</p>
                <p className="text-xs mt-1 opacity-60">Thử thay đổi điều kiện lọc hoặc xem tất cả</p>
              </div>
            )
          : entries.map(entry => {
              const sev = SEVERITY_CONFIG[entry.severity];
              const typ = TYPE_CONFIG[entry.type];
              const isExpanded = expandedId === entry.id;
              const age = Date.now() - new Date(entry.createdAt).getTime();

              return (
                <div
                  key={entry.id}
                  className={`border rounded-2xl transition-all ${
                    entry.resolved
                      ? 'opacity-50 bg-[var(--bg-surface)] border-[var(--glass-border)]'
                      : `${sev?.bg ?? 'bg-[var(--bg-surface)] border-[var(--glass-border)]'}`
                  }`}
                >
                  {/* Hàng chính */}
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${sev?.color ?? 'text-[var(--text-secondary)]'}`}>
                      {sev?.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.message}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${typ?.color ?? ''}`}>
                          {typ?.icon} {typ?.label?.split(' (')[0]}
                        </span>
                        <span className={`text-xs font-medium ${sev?.color ?? ''}`}>{sev?.label}</span>
                        {entry.component && (
                          <span className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-[180px]">{entry.component}</span>
                        )}
                        {entry.path && (
                          <span className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-[200px] opacity-70">{entry.path}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[var(--text-secondary)] hidden sm:flex items-center gap-1">
                        <Clock size={11} />{relativeDiff(age)}
                      </span>
                      {!entry.resolved && (
                        <button
                          onClick={e => { e.stopPropagation(); handleResolve(entry.id); }}
                          disabled={actionLoading}
                          title="Đánh dấu đã xử lý"
                          className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/10 text-emerald-600 transition-colors"
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                      {isExpanded
                        ? <ChevronUp size={14} className="text-[var(--text-secondary)]" />
                        : <ChevronDown size={14} className="text-[var(--text-secondary)]" />
                      }
                    </div>
                  </div>

                  {/* Chi tiết mở rộng */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[var(--glass-border)] space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-[var(--text-secondary)] mb-0.5">Thời gian xảy ra</div>
                          <div className="font-mono">{formatDate(entry.createdAt)}</div>
                        </div>
                        {entry.userId && (
                          <div>
                            <div className="text-[var(--text-secondary)] mb-0.5">Mã người dùng</div>
                            <div className="font-mono truncate">{entry.userId}</div>
                          </div>
                        )}
                        {entry.resolved && (
                          <div>
                            <div className="text-[var(--text-secondary)] mb-0.5">Đã xử lý lúc</div>
                            <div className="font-mono">{entry.resolvedAt ? formatDate(entry.resolvedAt) : '—'}</div>
                          </div>
                        )}
                        {entry.userAgent && (
                          <div className="col-span-2 md:col-span-3">
                            <div className="text-[var(--text-secondary)] mb-0.5">Trình duyệt / User Agent</div>
                            <div className="font-mono truncate text-[10px] opacity-70">{entry.userAgent}</div>
                          </div>
                        )}
                      </div>

                      {entry.stack && (
                        <div>
                          <div className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Stack Trace</div>
                          <pre className="text-[10px] font-mono bg-black/5 dark:bg-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] max-h-48 leading-relaxed">
                            {entry.stack}
                          </pre>
                        </div>
                      )}

                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div>
                          <div className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Dữ liệu bổ sung (Metadata)</div>
                          <pre className="text-[10px] font-mono bg-black/5 dark:bg-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] max-h-32 leading-relaxed">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* ── Phân trang ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-1.5 text-sm rounded-xl border border-[var(--glass-border)] disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-all"
          >
            ← Trang trước
          </button>
          <span className="text-sm text-[var(--text-secondary)] px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-1.5 text-sm rounded-xl border border-[var(--glass-border)] disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-all"
          >
            Trang tiếp →
          </button>
        </div>
      )}
    </div>
  );
}
