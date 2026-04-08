import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../services/i18n';
import {
  Bug, RefreshCw, CheckCheck, Trash2, Filter, AlertTriangle,
  AlertCircle, Info, Globe, Server, Zap, Clock, ChevronDown, ChevronUp, X
} from 'lucide-react';

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

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  frontend: { label: 'Frontend', icon: <Globe size={14} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  backend: { label: 'Backend', icon: <Server size={14} />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
  unhandled_promise: { label: 'Promise', icon: <Zap size={14} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  chunk_load: { label: 'Chunk Load', icon: <RefreshCw size={14} />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' },
};

const SEVERITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  warning: { label: 'Cảnh báo', icon: <Info size={14} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
  error: { label: 'Lỗi', icon: <AlertCircle size={14} />, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' },
  critical: { label: 'Nghiêm trọng', icon: <AlertTriangle size={14} />, color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-600/10 border-red-300 dark:border-red-500/30' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function relativeDiff(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}ph trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}ng trước`;
}

// Spark-line mini chart for 30-day trend
function TrendBar({ trend }: { trend: { date: string; count: number }[] }) {
  if (!trend.length) return null;
  const max = Math.max(...trend.map(t => t.count), 1);
  const last30 = trend.slice(-30);

  return (
    <div className="flex items-end gap-[2px] h-8">
      {last30.map((t, i) => (
        <div
          key={i}
          title={`${t.date}: ${t.count} lỗi`}
          style={{ height: `${Math.max(2, Math.round((t.count / max) * 32))}px` }}
          className="flex-1 rounded-sm bg-rose-400 dark:bg-rose-500 opacity-70 hover:opacity-100 transition-opacity"
        />
      ))}
    </div>
  );
}

export default function ErrorMonitor() {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('false');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const PAGE_SIZE = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filterType) params.set('type', filterType);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterResolved) params.set('resolved', filterResolved);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/error-logs?${params}`, { credentials: 'include' }),
        fetch('/api/error-logs/stats', { credentials: 'include' }),
      ]);

      if (!listRes.ok || !statsRes.ok) throw new Error('Lỗi tải dữ liệu');

      const listData = await listRes.json();
      const statsData = await statsRes.json();

      setEntries(listData.items ?? []);
      setTotal(listData.total ?? 0);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message ?? 'Không thể tải danh sách lỗi');
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterSeverity, filterResolved]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (id: number) => {
    setActionLoading(true);
    try {
      await fetch(`/api/error-logs/${id}/resolve`, { method: 'PATCH', credentials: 'include' });
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveAll = async () => {
    if (!window.confirm('Đánh dấu tất cả lỗi chưa giải quyết là đã xử lý?')) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolve-all', { method: 'POST', credentials: 'include' });
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteResolved = async () => {
    if (!window.confirm('Xóa tất cả lỗi đã giải quyết? Thao tác này không thể hoàn tác.')) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolved', { method: 'DELETE', credentials: 'include' });
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const unresolved = stats?.unresolved ?? 0;

  return (
    <div className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center text-rose-600">
            <Bug size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Giám Sát Lỗi</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Theo dõi lỗi frontend & backend theo thời gian thực
            </p>
          </div>
          {unresolved > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">
              {unresolved} chưa xử lý
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total.toLocaleString('vi-VN')}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">Tổng lỗi đã ghi</div>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-rose-200 dark:border-rose-500/20">
            <div className="text-2xl font-bold text-rose-600">{stats.unresolved.toLocaleString('vi-VN')}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">Chưa xử lý</div>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Theo loại</div>
            <div className="space-y-0.5">
              {Object.entries(stats.byType).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{TYPE_CONFIG[k]?.label ?? k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--glass-border)]">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">30 ngày qua</div>
            <TrendBar trend={stats.trend} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)]">
        <Filter size={14} className="text-[var(--text-secondary)]" />
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="text-sm px-2 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] text-[var(--text-primary)]"
        >
          <option value="">Tất cả loại</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="unhandled_promise">Promise</option>
          <option value="chunk_load">Chunk Load</option>
        </select>
        <select
          value={filterSeverity}
          onChange={e => { setFilterSeverity(e.target.value); setPage(1); }}
          className="text-sm px-2 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] text-[var(--text-primary)]"
        >
          <option value="">Tất cả mức độ</option>
          <option value="warning">Cảnh báo</option>
          <option value="error">Lỗi</option>
          <option value="critical">Nghiêm trọng</option>
        </select>
        <select
          value={filterResolved}
          onChange={e => { setFilterResolved(e.target.value); setPage(1); }}
          className="text-sm px-2 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] text-[var(--text-primary)]"
        >
          <option value="false">Chưa xử lý</option>
          <option value="true">Đã xử lý</option>
          <option value="">Tất cả</option>
        </select>
        {(filterType || filterSeverity || filterResolved === '') && (
          <button
            onClick={() => { setFilterType(''); setFilterSeverity(''); setFilterResolved('false'); setPage(1); }}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-rose-500 transition-colors"
          >
            <X size={12} /> Xóa bộ lọc
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--text-secondary)]">{total.toLocaleString('vi-VN')} kết quả</span>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading && !entries.length ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] animate-pulse" />
          ))
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-secondary)]">
            <Bug size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không có lỗi nào trong bộ lọc này</p>
          </div>
        ) : (
          entries.map(entry => {
            const sev = SEVERITY_CONFIG[entry.severity];
            const typ = TYPE_CONFIG[entry.type];
            const isExpanded = expandedId === entry.id;
            const age = Date.now() - new Date(entry.createdAt).getTime();

            return (
              <div
                key={entry.id}
                className={`border rounded-2xl transition-all ${entry.resolved ? 'opacity-60 bg-[var(--bg-surface)]' : `${sev?.bg ?? 'bg-[var(--bg-surface)]'} border-[var(--glass-border)]`}`}
              >
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  {/* Severity icon */}
                  <div className={`mt-0.5 flex-shrink-0 ${sev?.color ?? 'text-[var(--text-secondary)]'}`}>
                    {sev?.icon}
                  </div>

                  {/* Message + tags */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.message}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Type badge */}
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${typ?.color ?? ''}`}>
                        {typ?.icon} {typ?.label}
                      </span>
                      {/* Severity badge */}
                      <span className={`text-xs font-medium ${sev?.color ?? ''}`}>{sev?.label}</span>
                      {/* Component */}
                      {entry.component && (
                        <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">
                          {entry.component}
                        </span>
                      )}
                      {/* Path */}
                      {entry.path && (
                        <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px] font-mono">
                          {entry.path}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      <Clock size={11} />
                      {relativeDiff(age)}
                    </span>
                    {!entry.resolved && (
                      <button
                        onClick={e => { e.stopPropagation(); handleResolve(entry.id); }}
                        disabled={actionLoading}
                        className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/10 text-emerald-600 transition-colors"
                        title="Đánh dấu đã xử lý"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-[var(--text-secondary)]" /> : <ChevronDown size={14} className="text-[var(--text-secondary)]" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[var(--glass-border)] pt-3 space-y-3">
                    {/* Meta grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-[var(--text-secondary)] mb-0.5">Thời gian</div>
                        <div className="font-mono">{formatDate(entry.createdAt)}</div>
                      </div>
                      {entry.userId && (
                        <div>
                          <div className="text-[var(--text-secondary)] mb-0.5">User ID</div>
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
                        <div className="col-span-2">
                          <div className="text-[var(--text-secondary)] mb-0.5">User Agent</div>
                          <div className="font-mono truncate text-[10px]">{entry.userAgent}</div>
                        </div>
                      )}
                    </div>

                    {/* Stack trace */}
                    {entry.stack && (
                      <div>
                        <div className="text-xs text-[var(--text-secondary)] mb-1">Stack Trace</div>
                        <pre className="text-[10px] font-mono bg-black/5 dark:bg-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] max-h-48">
                          {entry.stack}
                        </pre>
                      </div>
                    )}

                    {/* Metadata */}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div>
                        <div className="text-xs text-[var(--text-secondary)] mb-1">Metadata</div>
                        <pre className="text-[10px] font-mono bg-black/5 dark:bg-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] max-h-32">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 text-sm rounded-xl border border-[var(--glass-border)] disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-all"
          >
            ← Trước
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-3 py-1.5 text-sm rounded-xl border border-[var(--glass-border)] disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-all"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}
