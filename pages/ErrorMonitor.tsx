import { uiConfirm } from '../utils/uiDialog';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMonitorApi } from '../services/api/errorMonitorApi';
import {
  Bug, RefreshCw, CheckCheck, Trash2, Filter, AlertTriangle,
  AlertCircle, Info, Globe, Server, Zap, Clock, ChevronDown,
  X, Check, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { SeoHead } from '../components/SeoHead';
import { useTranslation } from '../services/i18n';
import {
  SettingsPage, SettingsHeader, SettingsCard, StatTile, StatGrid, DistributionBar,
  TrendBars, Sparkline, StatusBadge, EmptyState, TONE_COLOR, SERIES_COLORS,
  type Tone, type Segment, type TrendPoint,
} from '../components/settings/SettingsUI';
import { DashboardMetricRing } from '../components/dashboard/DashboardVisuals';

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

// ─── Config maps (labels are i18n keys) ──────────────────────────────────────
const TYPE_ORDER = ['frontend', 'backend', 'unhandled_promise', 'chunk_load'] as const;
const TYPE_CONFIG: Record<string, { labelKey: string; shortKey: string; icon: React.ReactNode; color: string }> = {
  frontend:          { labelKey: 'errmon.type_frontend',          shortKey: 'errmon.type_frontend_short',          icon: <Globe size={14} />,     color: TONE_COLOR.info },
  backend:           { labelKey: 'errmon.type_backend',           shortKey: 'errmon.type_backend_short',           icon: <Server size={14} />,    color: TONE_COLOR.brand },
  unhandled_promise: { labelKey: 'errmon.type_unhandled_promise', shortKey: 'errmon.type_unhandled_promise_short', icon: <Zap size={14} />,       color: TONE_COLOR.accent },
  chunk_load:        { labelKey: 'errmon.type_chunk_load',        shortKey: 'errmon.type_chunk_load_short',        icon: <RefreshCw size={14} />, color: TONE_COLOR.neutral },
};
const SEVERITY_ORDER = ['critical', 'error', 'warning'] as const;
const SEVERITY_CONFIG: Record<string, { labelKey: string; icon: React.ReactNode; tone: Tone; color: string }> = {
  critical: { labelKey: 'errmon.sev_critical', icon: <AlertTriangle size={16} />, tone: 'danger',  color: TONE_COLOR.danger },
  // Lighter red so "error" stays distinguishable from "critical" in charts.
  error:    { labelKey: 'errmon.sev_error',    icon: <AlertCircle size={16} />,   tone: 'danger',  color: 'color-mix(in srgb, var(--ui-danger) 55%, transparent)' },
  warning:  { labelKey: 'errmon.sev_warning',  icon: <Info size={16} />,          tone: 'warning', color: TONE_COLOR.warning },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Normalise a DATE value from the stats endpoint to a local YYYY-MM-DD key. */
function trendDayKey(raw: string): string {
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : localDayKey(d);
}

// ─── Filter dropdown ─────────────────────────────────────────────────────────
interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}
interface FilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
  ariaLabel: string;
}
function FilterDropdown({ value, onChange, options, placeholder, ariaLabel }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const selected = options.find(o => o.value === value);
  const label = selected ? selected.label : placeholder;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${label}`}
        className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] ${
          value
            ? 'border-[var(--sgs-primary)] bg-[var(--glass-surface)] text-[var(--sgs-primary)]'
            : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
        }`}
      >
        {selected?.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: selected.color }} aria-hidden="true" />}
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] py-1 shadow-lg"
        >
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex min-h-10 w-full items-center gap-2.5 px-3 text-left text-sm transition-colors focus-visible:bg-[var(--glass-surface-hover)] focus-visible:outline-none ${
                  isSel ? 'bg-[var(--glass-surface)] text-[var(--sgs-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)]'
                }`}
              >
                {opt.color
                  ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: opt.color }} aria-hidden="true" />
                  : <span className="w-2 shrink-0" aria-hidden="true" />}
                {opt.icon && <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true">{opt.icon}</span>}
                <span className="flex-1">{opt.label}</span>
                {isSel && <Check size={14} className="shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Error row ───────────────────────────────────────────────────────────────
function DetailField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-0.5 text-[var(--text-tertiary)]">{label}</div>
      <div className="break-words font-mono text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

function ErrorRow({ entry, expanded, onToggle, onResolve, disabled }: {
  entry: ErrorLogEntry;
  expanded: boolean;
  onToggle: () => void;
  onResolve: () => void;
  disabled: boolean;
}) {
  const { t, language, formatTime } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  const sev = SEVERITY_CONFIG[entry.severity];
  const typ = TYPE_CONFIG[entry.type];
  const detailsId = `errmon-details-${entry.id}`;
  return (
    <li
      className={`overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] ${entry.resolved ? 'opacity-60' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: entry.resolved ? 'var(--glass-border)' : (sev?.color ?? 'var(--glass-border)') }}
    >
      <div className="flex items-start gap-1 p-2 sm:p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex min-h-10 min-w-0 flex-1 items-start gap-3 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
        >
          <span className="mt-0.5 shrink-0" style={{ color: sev?.color ?? 'var(--text-tertiary)' }} aria-hidden="true">{sev?.icon ?? <AlertCircle size={16} />}</span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-sm font-medium text-[var(--text-primary)]">{entry.message}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              {sev && <StatusBadge tone={sev.tone}>{t(sev.labelKey)}</StatusBadge>}
              {typ && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--glass-surface)] px-1.5 py-0.5">
                  <span aria-hidden="true">{typ.icon}</span>{t(typ.shortKey)}
                </span>
              )}
              {entry.resolved && <StatusBadge tone="success">{t('errmon.status_resolved')}</StatusBadge>}
              <span className="inline-flex items-center gap-1 text-[var(--text-tertiary)]" title={fmt(entry.createdAt)}>
                <Clock size={12} aria-hidden="true" />{formatTime(entry.createdAt)}
              </span>
            </span>
            {(entry.path || entry.component) && (
              <span className="mt-1 block truncate font-mono text-xs text-[var(--text-tertiary)]">
                {[entry.component, entry.path].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          <ChevronDown size={16} className={`mt-0.5 shrink-0 text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {!entry.resolved && (
          <button
            type="button"
            onClick={onResolve}
            disabled={disabled}
            aria-label={t('errmon.mark_resolved')}
            title={t('errmon.mark_resolved')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--ui-success)] transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] disabled:opacity-40"
          >
            <CheckCheck size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {expanded && (
        <div id={detailsId} className="space-y-3 border-t border-[var(--glass-border)] px-3 pb-3 pt-3 sm:px-4">
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label={t('errmon.detail_time')}>{fmt(entry.createdAt)}</DetailField>
            {typ && <DetailField label={t('errmon.detail_type')}>{t(typ.labelKey)}</DetailField>}
            {entry.userId && <DetailField label={t('errmon.detail_user')}>{entry.userId}</DetailField>}
            {entry.resolved && <DetailField label={t('errmon.detail_resolved_at')}>{entry.resolvedAt ? fmt(entry.resolvedAt) : '—'}</DetailField>}
            {entry.component && <DetailField label={t('errmon.detail_component')}>{entry.component}</DetailField>}
            {entry.path && <DetailField label={t('errmon.detail_path')} className="sm:col-span-2">{entry.path}</DetailField>}
            {entry.userAgent && (
              <DetailField label={t('errmon.detail_user_agent')} className="sm:col-span-2 lg:col-span-4">
                <span className="text-[10px] text-[var(--text-secondary)]">{entry.userAgent}</span>
              </DetailField>
            )}
          </div>
          {entry.stack && (
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">{t('errmon.detail_stack')}</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-app)] p-3 font-mono text-[10px] leading-relaxed text-[var(--text-secondary)]">
                {entry.stack}
              </pre>
            </div>
          )}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">{t('errmon.detail_metadata')}</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-app)] p-3 font-mono text-[10px] leading-relaxed text-[var(--text-secondary)]">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ErrorMonitor() {
  const { t, language } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const num = (n: number) => n.toLocaleString(locale);

  const [page, setPage]                 = useState(1);
  const [filterType, setFilterType]     = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterResolved, setFilterResolved] = useState<string>('false');
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const PAGE_SIZE = 30;
  const queryClient = useQueryClient();
  const { data: logsData, isLoading: loading, error: logsQueryError, refetch: refetchLogs } = useQuery<any>({
    queryKey: ['errorLogs', page, filterType, filterSeverity, filterResolved],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filterType)     params.set('type',     filterType);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterResolved) params.set('resolved', filterResolved);
      return errorMonitorApi.getLogs(Object.fromEntries(params));
    },
    staleTime: 30_000,
  });
  const { data: stats, refetch: refetchStats } = useQuery<ErrorStats>({
    queryKey: ['errorLogStats'],
    queryFn: () => errorMonitorApi.getStats() as Promise<ErrorStats>,
    staleTime: 30_000,
  });
  const entries: ErrorLogEntry[] = logsData?.items ?? [];
  const total: number = logsData?.total ?? 0;
  const fetchError = logsQueryError ? (logsQueryError as Error).message : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['errorLogs'] });
    queryClient.invalidateQueries({ queryKey: ['errorLogStats'] });
  };
  const handleResolve = async (id: number) => {
    setActionLoading(true);
    try {
      await fetch(`/api/error-logs/${id}/resolve`, { method: 'PATCH', credentials: 'include' });
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };
  const handleResolveAll = async () => {
    if (!(await uiConfirm(t('errmon.confirm_resolve_all')))) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolve-all', { method: 'POST', credentials: 'include' });
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };
  const handleDeleteResolved = async () => {
    if (!(await uiConfirm(t('errmon.confirm_delete_resolved')))) return;
    setActionLoading(true);
    try {
      await fetch('/api/error-logs/resolved', { method: 'DELETE', credentials: 'include' });
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };
  const handleRefresh = () => { refetchLogs(); refetchStats(); };
  const clearFilters = () => { setFilterType(''); setFilterSeverity(''); setFilterResolved('false'); setPage(1); };
  const hasActiveFilter = filterType !== '' || filterSeverity !== '' || filterResolved === '';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Derived stats (undefined while stats are not loaded → rendered as '—')
  const hasStats = !!stats;
  const statTotal = stats?.total ?? 0;
  const unresolved = stats?.unresolved ?? 0;
  const resolved = hasStats ? statTotal - unresolved : 0;
  const resolvedPct = hasStats && statTotal > 0 ? Math.round((resolved / statTotal) * 100) : null;
  const unresolvedPct = hasStats && statTotal > 0 ? Math.round((unresolved / statTotal) * 100) : null;

  // 30-day series: the endpoint returns only days that had errors (SQL GROUP BY over the
  // last 30 days), so a day absent from the window is a real zero.
  const trendPoints: TrendPoint[] = useMemo(() => {
    if (!stats?.trend) return [];
    const byDay = new Map<string, number>();
    for (const row of stats.trend) {
      const k = trendDayKey(row.date);
      byDay.set(k, (byDay.get(k) ?? 0) + (Number(row.count) || 0));
    }
    const today = new Date();
    const out: TrendPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push({
        label: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
        value: byDay.get(localDayKey(d)) ?? 0,
      });
    }
    return out;
  }, [stats, locale]);
  const trendValues = trendPoints.map(p => p.value ?? 0);
  const todayCount = trendPoints.length ? trendValues[trendValues.length - 1] : null;
  const sum30 = trendValues.reduce((s, v) => s + v, 0);
  const peakIdx = trendValues.length ? trendValues.indexOf(Math.max(...trendValues)) : -1;
  const avg30 = trendPoints.length ? sum30 / trendPoints.length : null;

  const typeSegments: Segment[] = useMemo(() => {
    if (!stats) return [];
    const keys = [...TYPE_ORDER, ...Object.keys(stats.byType ?? {}).filter(k => !TYPE_CONFIG[k])];
    return keys.map((k, i) => ({
      label: TYPE_CONFIG[k] ? t(TYPE_CONFIG[k].labelKey) : k,
      value: stats.byType?.[k] ?? 0,
      color: TYPE_CONFIG[k]?.color ?? SERIES_COLORS[(i + 2) % SERIES_COLORS.length],
    }));
  }, [stats, t]);
  const severitySegments: Segment[] = useMemo(() => {
    if (!stats) return [];
    return SEVERITY_ORDER.map(k => ({
      label: t(SEVERITY_CONFIG[k].labelKey),
      value: stats.bySeverity?.[k] ?? 0,
      color: SEVERITY_CONFIG[k].color,
    }));
  }, [stats, t]);

  const typeOptions: DropdownOption[] = [
    { value: '', label: t('errmon.filter_all_types') },
    ...TYPE_ORDER.map(k => ({ value: k, label: t(TYPE_CONFIG[k].labelKey), icon: TYPE_CONFIG[k].icon, color: TYPE_CONFIG[k].color })),
  ];
  const severityOptions: DropdownOption[] = [
    { value: '', label: t('errmon.filter_all_severities') },
    ...SEVERITY_ORDER.map(k => ({ value: k, label: t(SEVERITY_CONFIG[k].labelKey), icon: SEVERITY_CONFIG[k].icon, color: SEVERITY_CONFIG[k].color })),
  ];
  const statusOptions: DropdownOption[] = [
    { value: 'false', label: t('errmon.status_unresolved'), icon: <ShieldAlert size={14} />,  color: TONE_COLOR.danger },
    { value: 'true',  label: t('errmon.status_resolved'),   icon: <CheckCircle2 size={14} />, color: TONE_COLOR.success },
    { value: '',      label: t('errmon.status_all'),        icon: <Filter size={14} /> },
  ];

  const dash = '—';

  return (
    <SettingsPage>
      <SeoHead
        title={t('errmon.seo_title')}
        description={t('errmon.seo_description')}
        canonicalPath="/error-monitor"
      />

      <SettingsHeader
        icon={<Bug size={20} />}
        title={t('errmon.title')}
        description={t('errmon.subtitle')}
        meta={unresolved > 0 ? <StatusBadge tone="danger">{t('errmon.unresolved_badge', { n: num(unresolved) })}</StatusBadge> : undefined}
        actions={
          <>
            <button type="button" onClick={handleRefresh} disabled={loading} className="ui-button ui-button-secondary ui-button-md min-h-10">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              {t('errmon.refresh')}
            </button>
            {unresolved > 0 && (
              <button type="button" onClick={handleResolveAll} disabled={actionLoading} className="ui-button ui-button-primary ui-button-md min-h-10">
                <CheckCheck size={14} aria-hidden="true" />
                {t('errmon.resolve_all')}
              </button>
            )}
            <button type="button" onClick={handleDeleteResolved} disabled={actionLoading} className="ui-button ui-button-ghost ui-button-md min-h-10">
              <Trash2 size={14} aria-hidden="true" />
              {t('errmon.delete_resolved')}
            </button>
          </>
        }
      />

      {/* KPI tiles */}
      <StatGrid cols={4}>
        <StatTile
          label={t('errmon.kpi_total')}
          value={hasStats ? num(statTotal) : dash}
          hint={trendPoints.length ? t('errmon.kpi_total_hint', { n: num(sum30) }) : undefined}
        />
        <StatTile
          label={t('errmon.kpi_unresolved')}
          value={hasStats ? num(unresolved) : dash}
          tone={unresolved > 0 ? 'danger' : 'neutral'}
          hint={unresolvedPct != null ? t('errmon.kpi_unresolved_hint', { n: unresolvedPct }) : undefined}
        />
        <StatTile
          label={t('errmon.kpi_resolved')}
          value={hasStats ? num(resolved) : dash}
          tone="success"
          hint={resolvedPct != null ? t('errmon.kpi_resolved_hint', { n: resolvedPct }) : undefined}
          visual={
            <DashboardMetricRing
              value={resolvedPct}
              label={resolvedPct != null ? t('errmon.kpi_resolved_ring', { n: resolvedPct }) : t('errmon.no_data')}
              color={TONE_COLOR.success}
              size={48}
            />
          }
        />
        <StatTile
          label={t('errmon.kpi_today')}
          value={todayCount != null ? num(todayCount) : dash}
          tone={todayCount ? 'warning' : 'neutral'}
          hint={avg30 != null ? t('errmon.kpi_today_hint', { n: avg30.toLocaleString(locale, { maximumFractionDigits: 1 }) }) : undefined}
          visual={
            <Sparkline
              values={trendValues.slice(-7)}
              width={64}
              height={28}
              color={TONE_COLOR.brand}
              ariaLabel={t('errmon.kpi_today_spark')}
            />
          }
        />
      </StatGrid>

      {/* 30-day trend */}
      <SettingsCard
        title={t('errmon.trend_title')}
        description={
          trendPoints.length
            ? peakIdx >= 0 && trendValues[peakIdx] > 0
              ? t('errmon.trend_desc_peak', { n: num(sum30), peak: num(trendValues[peakIdx]), day: trendPoints[peakIdx].label })
              : t('errmon.trend_desc', { n: num(sum30) })
            : undefined
        }
      >
        <TrendBars
          points={trendPoints}
          ariaLabel={t('errmon.trend_aria', { n: num(sum30), today: todayCount != null ? num(todayCount) : dash })}
          formatValue={n => t('errmon.errors_count', { n: num(n) })}
          emptyText={hasStats ? t('errmon.no_data') : t('errmon.loading')}
          height={112}
        />
      </SettingsCard>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SettingsCard title={t('errmon.by_source_title')}>
          <DistributionBar
            segments={typeSegments}
            ariaLabel={t('errmon.by_source_title')}
            formatValue={num}
            emptyText={hasStats ? t('errmon.no_errors_recorded') : t('errmon.loading')}
          />
        </SettingsCard>
        <SettingsCard title={t('errmon.by_severity_title')}>
          <DistributionBar
            segments={severitySegments}
            ariaLabel={t('errmon.by_severity_title')}
            formatValue={num}
            emptyText={hasStats ? t('errmon.no_errors_recorded') : t('errmon.loading')}
          />
        </SettingsCard>
      </div>

      {/* Error list with filters */}
      <SettingsCard
        title={t('errmon.list_title')}
        actions={
          <span className="text-xs text-[var(--text-secondary)]" aria-live="polite">
            {loading ? t('errmon.loading') : t('errmon.results', { n: num(total) })}
          </span>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Filter size={14} className="shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
          <span className="mr-1 text-xs text-[var(--text-secondary)]">{t('errmon.filter_label')}</span>
          <FilterDropdown
            value={filterType}
            onChange={v => { setFilterType(v); setPage(1); }}
            options={typeOptions}
            placeholder={t('errmon.filter_all_types')}
            ariaLabel={t('errmon.filter_type_aria')}
          />
          <FilterDropdown
            value={filterSeverity}
            onChange={v => { setFilterSeverity(v); setPage(1); }}
            options={severityOptions}
            placeholder={t('errmon.filter_all_severities')}
            ariaLabel={t('errmon.filter_severity_aria')}
          />
          <FilterDropdown
            value={filterResolved}
            onChange={v => { setFilterResolved(v); setPage(1); }}
            options={statusOptions}
            placeholder={t('errmon.status_unresolved')}
            ariaLabel={t('errmon.filter_status_aria')}
          />
          {hasActiveFilter && (
            <button type="button" onClick={clearFilters} className="ui-button ui-button-ghost ui-button-sm min-h-10">
              <X size={14} aria-hidden="true" /> {t('errmon.reset_filters')}
            </button>
          )}
        </div>

        {fetchError && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] p-3 text-sm" style={{ color: TONE_COLOR.danger }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{fetchError}</span>
          </div>
        )}

        {loading && !entries.length ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)]" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Bug size={20} />}
            title={t('errmon.empty_title')}
            description={t('errmon.empty_desc')}
            action={hasActiveFilter ? (
              <button type="button" onClick={clearFilters} className="ui-button ui-button-secondary ui-button-sm min-h-10">{t('errmon.reset_filters')}</button>
            ) : undefined}
          />
        ) : (
          <ul className="space-y-2">
            {entries.map(entry => (
              <ErrorRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onResolve={() => handleResolve(entry.id)}
                disabled={actionLoading}
              />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-4 flex items-center justify-center gap-2" aria-label={t('errmon.pagination_aria')}>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="ui-button ui-button-secondary ui-button-sm min-h-10"
            >
              <ChevronLeft size={14} aria-hidden="true" />{t('errmon.prev_page')}
            </button>
            <span className="px-2 text-sm tabular-nums text-[var(--text-secondary)]">
              {t('errmon.page_of', { page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="ui-button ui-button-secondary ui-button-sm min-h-10"
            >
              {t('errmon.next_page')}<ChevronRight size={14} aria-hidden="true" />
            </button>
          </nav>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
