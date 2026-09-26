import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, AlertTriangle, BarChart3, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SeoHead } from '../components/SeoHead';
import { db } from '../services/dbApi';
import { api } from '../services/api/apiClient';
import { useTranslation, type Language } from '../services/i18n';
import type { User } from '../types';

type Metrics = {
  sampleCount: number;
  evaluatedCount: number;
  rejectedCount: number;
  rejectRate: number;
  mae: number | null;
  mape: number | null;
  medianAbsoluteError: number | null;
  intervalCoverage: number | null;
};
type Group = Metrics & { locationKey: string; propertyType: string };
type GroupHistoryPoint = Metrics & { locationKey: string; propertyType: string };
type ResponseData = {
  report: Metrics & { evaluatedAt: string; groups: Group[]; thresholdVersion?: number; appliedThresholds?: Thresholds };
  history: Array<Metrics & { evaluatedAt: string; thresholdVersion: number | null; thresholds: Thresholds | null; groups?: GroupHistoryPoint[] }>;
  supportPolicy?: { minimumEvaluatedSamples?: number };
  drift: {
    status: 'CLEAR' | 'WARNING' | 'BLOCKED';
    promotionBlocked: boolean;
    thresholds: Thresholds;
    consecutiveRunsRequired: number;
    consecutiveMaeRuns: number;
    consecutiveMapeRuns: number;
    reasons: string[];
  };
  dataset: { name: string; sampleCount: number; unitLabel: string; sources: string[]; locationLabels?: Record<string, string> };
  disclaimer: string;
  thresholdConfig: { version: number; thresholds: Thresholds; updatedAt: string | null; updatedBy: string | null };
  thresholdHistory: Array<{ version: number; changedAt: string; authorId: string | null; oldThresholds: Thresholds | null; newThresholds: Thresholds }>;
};
type Thresholds = { maeVndPerM2: number; mape: number; consecutiveRuns: number };
type OperationalEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  payload: {
    thresholdVersion?: number;
    notification?: {
      title?: string;
      body?: string;
      type?: string;
      metadata?: {
        authorName?: string | null;
        version?: number;
        thresholds?: Thresholds;
      };
    };
  };
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;
const localeFor = (language: Language) => language === 'vn' ? 'vi-VN' : 'en-US';
const formatVnd = (value: number | null, language: Language) =>
  value == null ? '—' : `${Math.round(value).toLocaleString(localeFor(language))} VND/m²`;
const formatPercent = (value: number | null, language: Language) =>
  value == null ? '—' : `${new Intl.NumberFormat(localeFor(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value * 100)}%`;
const dateTime = (value: string, language: Language) => new Date(value).toLocaleString(localeFor(language));
const formatCount = (value: number, language: Language) => value.toLocaleString(localeFor(language));
/** Readable place names for canonical keys such as "hcm|quan-1|ben-nghe" (sent by the server). */
const LocationLabelsContext = createContext<Record<string, string>>({});
const useLocationLabel = () => {
  const labels = useContext(LocationLabelsContext);
  return (key: string) => labels[key] || key;
};
/** Several runs can happen on the same day, so trend axes show date and time. */
const runLabel = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function DriftNotificationEvents({ language, t }: { language: Language; t: Translate }) {
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ events: OperationalEvent[] }>(
        '/api/valuation/admin/operational-events',
        { eventType: 'valuation_drift_threshold_notification_failed' },
      );
      setEvents(response.events || []);
    } catch {
      setError('valuationAccuracy.notifications.error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openCount = events.filter(event => !event.resolvedAt).length;
  const resolvedCount = events.length - openCount;
  const visibleEvents = events.filter(event => (
    statusFilter === 'all' ||
    (statusFilter === 'open' && !event.resolvedAt) ||
    (statusFilter === 'resolved' && Boolean(event.resolvedAt))
  ));

  const retry = async (event: OperationalEvent) => {
    setRetryingId(event.id);
    setFeedback(null);
    try {
      const response = await api.post<{ event: OperationalEvent; retried: boolean }>(
        `/api/valuation/admin/operational-events/${encodeURIComponent(event.id)}/retry`,
      );
      setEvents(current => current.map(item => item.id === event.id ? response.event : item));
      setFeedback({ id: event.id, message: 'retry-success', success: true });
    } catch {
      setFeedback({ id: event.id, message: 'retry-error', success: false });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-bold text-[var(--text-primary)]">{t('valuationAccuracy.notifications.title')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">{t('valuationAccuracy.notifications.description')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label={t('valuationAccuracy.notifications.summaryAria')}>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{t('valuationAccuracy.notifications.openCount', { count: formatCount(openCount, language) })}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">{t('valuationAccuracy.notifications.resolvedCount', { count: formatCount(resolvedCount, language) })}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <span>{t('valuationAccuracy.notifications.filter')}</span>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as 'all' | 'open' | 'resolved')}
              className="min-h-10 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]"
            >
              <option value="all">{t('valuationAccuracy.notifications.filterAll')}</option>
              <option value="open">{t('valuationAccuracy.notifications.filterOpen')}</option>
              <option value="resolved">{t('valuationAccuracy.notifications.filterResolved')}</option>
            </select>
          </label>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('valuationAccuracy.notifications.refresh')}
          </button>
        </div>
      </div>
      {error && <div className="mx-4 my-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:mx-5" role="alert">{t(error)}</div>}
      {loading ? (
        <div className="space-y-3 p-5" aria-label={t('valuationAccuracy.notifications.loading')}><div className="h-16 animate-pulse rounded-xl bg-[var(--glass-surface)]" /><div className="h-16 animate-pulse rounded-xl bg-[var(--glass-surface)]" /></div>
      ) : events.length === 0 ? (
        <div className="p-5 text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.notifications.empty')}</div>
      ) : visibleEvents.length === 0 ? (
        <div className="p-5 text-sm text-[var(--text-tertiary)]">
          {statusFilter === 'open'
            ? t('valuationAccuracy.notifications.filteredEmptyOpen')
            : t('valuationAccuracy.notifications.filteredEmptyResolved')}
        </div>
      ) : (
        <div className="divide-y divide-[var(--glass-border)]">
          {visibleEvents.map(event => {
            const open = !event.resolvedAt;
            const notification = event.payload?.notification;
            const notificationThresholds = notification?.metadata?.thresholds;
            const notificationTitle = notification?.type === 'drift_threshold_changed'
              ? t('valuationAccuracy.notifications.thresholdsUpdatedTitle')
              : t('valuationAccuracy.notifications.failedTitle');
            const notificationBody = notificationThresholds
              ? t('valuationAccuracy.notifications.thresholdsUpdatedBody', {
                  author: notification.metadata?.authorName || t('valuationAccuracy.notifications.actorFallback'),
                  version: notification.metadata?.version ?? event.payload?.thresholdVersion ?? '—',
                  mae: formatVnd(notificationThresholds.maeVndPerM2, language),
                  mape: formatPercent(notificationThresholds.mape, language),
                  runs: formatCount(notificationThresholds.consecutiveRuns, language),
                })
              : t('valuationAccuracy.notifications.failedBody');
            return (
              <div key={event.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${open ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {open ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {open ? t('valuationAccuracy.notifications.statusOpen') : t('valuationAccuracy.notifications.statusResolved')}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{dateTime(event.createdAt, language)}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-[var(--text-primary)]">{notificationTitle}</h3>
                    {notification?.body && <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{notificationBody}</p>}
                  </div>
                  {open && (
                    <button
                      onClick={() => retry(event)}
                      disabled={retryingId === event.id}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ui-brand)] px-3 py-2 text-xs font-bold text-[var(--ui-on-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${retryingId === event.id ? 'animate-spin' : ''}`} />
                      {retryingId === event.id ? t('valuationAccuracy.notifications.retrying') : t('valuationAccuracy.notifications.retry')}
                    </button>
                  )}
                </div>
                <dl className="mt-4 grid gap-3 break-words text-xs text-[var(--text-secondary)] sm:grid-cols-3">
                  <div><dt className="text-[var(--text-tertiary)]">{t('valuationAccuracy.notifications.tenant')}</dt><dd className="font-mono">{event.tenantId}</dd></div>
                  <div><dt className="text-[var(--text-tertiary)]">{t('valuationAccuracy.notifications.thresholdVersion')}</dt><dd className="font-semibold">{event.payload?.thresholdVersion == null ? '—' : `v${event.payload.thresholdVersion}`}</dd></div>
                  <div><dt className="text-[var(--text-tertiary)]">{open ? t('valuationAccuracy.notifications.eventId') : t('valuationAccuracy.notifications.resolvedAt')}</dt><dd className="font-mono">{open ? event.id : dateTime(event.resolvedAt!, language)}</dd></div>
                </dl>
                {feedback?.id === event.id && (
                  <p className={`mt-3 text-xs font-medium ${feedback.success ? 'text-emerald-700' : 'text-red-700'}`} role="status">
                    {feedback.message === 'retry-success'
                      ? t('valuationAccuracy.notifications.retrySuccess')
                      : t('valuationAccuracy.notifications.retryError')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, detail, comparison, t }: { label: string; value: string; detail?: string; comparison?: { actual: number | null; threshold: number; format: (value: number) => string }; t: Translate }) {
  const measured = comparison?.actual != null;
  const overThreshold = comparison?.actual != null && comparison.actual > comparison.threshold;
  return (
    <div className="min-w-0 rounded-[20px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 break-words text-xl font-extrabold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-2xl">{value}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">{detail}</p>}
      {comparison && (
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3 text-xs ${measured ? overThreshold ? 'text-rose-700' : 'text-emerald-700' : 'text-[var(--text-tertiary)]'}`}>
          <span>{measured ? overThreshold ? t('valuationAccuracy.metric.overThreshold') : t('valuationAccuracy.metric.withinThreshold') : t('valuationAccuracy.metric.unavailable')}</span>
          <span className="font-mono font-semibold">{t('valuationAccuracy.metric.threshold', { value: comparison.format(comparison.threshold) })}</span>
        </div>
      )}
    </div>
  );
}

function DriftStatus({ drift, language, t }: { drift: ResponseData['drift']; language: Language; t: Translate }) {
  const blocked = drift.status === 'BLOCKED';
  const warning = drift.status === 'WARNING';
  const colors = blocked
    ? 'border-rose-200 bg-rose-50 text-rose-950'
    : warning ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950';
  const title = blocked ? t('valuationAccuracy.drift.blockedTitle')
    : warning ? t('valuationAccuracy.drift.warningTitle') : t('valuationAccuracy.drift.clearTitle');
  const status = drift.status === 'BLOCKED'
    ? t('valuationAccuracy.drift.statusBlocked')
    : drift.status === 'WARNING'
      ? t('valuationAccuracy.drift.statusWarning')
      : t('valuationAccuracy.drift.statusClear');
  const reasons = drift.reasons.map(reason => {
    if (reason === 'mae_above_threshold_with_consecutive_increases') return t('valuationAccuracy.drift.reason.mae');
    if (reason === 'mape_above_threshold_with_consecutive_increases') return t('valuationAccuracy.drift.reason.mape');
    return t('valuationAccuracy.drift.reason.unknown');
  });
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 ${colors}`} aria-label={t('valuationAccuracy.drift.statusAria')}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm">
            {blocked
              ? t('valuationAccuracy.drift.blockedDescription')
              : warning
                ? t('valuationAccuracy.drift.warningDescription')
                : t('valuationAccuracy.drift.clearDescription')}
          </p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <span>MAE: {t('valuationAccuracy.drift.consecutiveIncrease', { count: formatCount(drift.consecutiveMaeRuns, language), required: formatCount(drift.consecutiveRunsRequired, language) })} · {t('valuationAccuracy.metric.threshold', { value: formatVnd(drift.thresholds.maeVndPerM2, language) })}</span>
            <span>MAPE: {t('valuationAccuracy.drift.consecutiveIncrease', { count: formatCount(drift.consecutiveMapeRuns, language), required: formatCount(drift.consecutiveRunsRequired, language) })} · {t('valuationAccuracy.metric.threshold', { value: formatPercent(drift.thresholds.mape, language) })}</span>
            <span>{t('valuationAccuracy.drift.auditStatus', { status })}</span>
          </div>
          {reasons.length > 0 && <p className="mt-3 text-xs font-medium">{t('valuationAccuracy.drift.reasonLabel', { reason: reasons.join(', ') })}</p>}
        </div>
      </div>
    </section>
  );
}

function TrendChart({ history, language, t }: { history: ResponseData['history']; language: Language; t: Translate }) {
  const locale = localeFor(language);
  const chartData = history.map(run => ({
    ...run,
    dateLabel: runLabel(run.evaluatedAt, locale),
    maeThreshold: run.thresholds?.maeVndPerM2 ?? null,
    mapePercent: run.mape == null ? null : run.mape * 100,
    mapeThresholdPercent: run.thresholds?.mape == null ? null : run.thresholds.mape * 100,
  }));
  const hasMae = chartData.some(run => run.mae != null || run.maeThreshold != null);
  const hasMape = chartData.some(run => run.mapePercent != null || run.mapeThresholdPercent != null);
  const renderTooltip = (metric: 'mae' | 'mapePercent') => ({ active, payload }: any) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    const value = point[metric] as number | null;
    const threshold = metric === 'mae' ? point.maeThreshold as number | null : point.mapeThresholdPercent as number | null;
    const format = metric === 'mae'
        ? (number: number | null) => formatVnd(number, language)
        : (number: number | null) => number == null ? '—' : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number)}%`;
    return (
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3 text-xs shadow-xl">
        <p className="mb-2 font-semibold text-[var(--text-primary)]">{dateTime(point.evaluatedAt, language)}</p>
        <p className="font-mono text-[var(--text-secondary)]">{t('valuationAccuracy.trend.measuredValue', { value: format(value) })}</p>
        <p className="font-mono text-[var(--text-secondary)]">{t('valuationAccuracy.trend.runThresholdValue', { value: format(threshold) })}</p>
        <p className="mt-1 text-[var(--text-tertiary)]">{point.thresholdVersion == null ? t('valuationAccuracy.trend.thresholdVersionMissing') : t('valuationAccuracy.trend.thresholdVersion', { version: point.thresholdVersion })}</p>
      </div>
    );
  };
  return (
    <div>
      {!history.length ? (
        <p className="rounded-xl bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-secondary)]">{t('valuationAccuracy.trend.noRuns')}</p>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 rounded-[18px] bg-[var(--glass-surface)] p-3 sm:p-4" aria-label={t('valuationAccuracy.trend.maeAria')}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">MAE · VND/m²</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--ui-brand)]" /> {t('valuationAccuracy.trend.measured')}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-amber-600" /> {t('valuationAccuracy.trend.runThreshold')}</span>
                </div>
              </div>
              <div className="h-60" role="img" aria-label={t('valuationAccuracy.trend.maeChartAria')}>
                {hasMae ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 12 }}>
                      <CartesianGrid stroke="var(--glass-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis width={78} domain={[0, 'auto']} tickFormatter={(value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 })} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={renderTooltip('mae')} />
                      <Line type="stepAfter" dataKey="maeThreshold" name={t('valuationAccuracy.trend.runThreshold')} stroke="#b7791f" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mae" name="MAE" stroke="var(--ui-brand)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.trend.noMae')}</p>}
              </div>
            </section>
            <section className="min-w-0 rounded-[18px] bg-[var(--glass-surface)] p-3 sm:p-4" aria-label={t('valuationAccuracy.trend.mapeAria')}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">MAPE · %</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sgs-primary" /> {t('valuationAccuracy.trend.measured')}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-amber-600" /> {t('valuationAccuracy.trend.runThreshold')}</span>
                </div>
              </div>
              <div className="h-60" role="img" aria-label={t('valuationAccuracy.trend.mapeChartAria')}>
                {hasMape ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="var(--glass-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis width={52} domain={[0, 'auto']} tickFormatter={(value) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value))}%`} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={renderTooltip('mapePercent')} />
                      <Line type="stepAfter" dataKey="mapeThresholdPercent" name={t('valuationAccuracy.trend.runThreshold')} stroke="#b7791f" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mapePercent" name="MAPE" stroke="#c47b16" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.trend.noMape')}</p>}
              </div>
            </section>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
            {t('valuationAccuracy.trend.chartNote')}
          </p>
        </>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs text-[var(--text-secondary)]">
          <thead className="border-b border-[var(--glass-border)] text-[var(--text-tertiary)]"><tr>
            <th className="py-2">{t('valuationAccuracy.trend.historyTime')}</th><th>{t('valuationAccuracy.trend.historyVersion')}</th><th>{t('valuationAccuracy.trend.maeMeasured')}</th><th>{t('valuationAccuracy.trend.mapeMeasured')}</th><th>{t('valuationAccuracy.trend.maeThreshold')}</th><th>{t('valuationAccuracy.trend.mapeThreshold')}</th><th>{t('valuationAccuracy.trend.consecutiveRuns')}</th>
          </tr></thead>
          <tbody>{[...history].reverse().map(run => <tr key={`threshold-${run.evaluatedAt}`} className="border-b border-[var(--glass-border)]">
            <td className="py-2">{dateTime(run.evaluatedAt, language)}</td>
            <td>{run.thresholdVersion == null ? t('valuationAccuracy.trend.versionMissing') : `v${run.thresholdVersion}`}</td>
            <td className="font-mono">{formatVnd(run.mae, language)}</td>
            <td className="font-mono">{formatPercent(run.mape, language)}</td>
            <td>{run.thresholds ? formatVnd(run.thresholds.maeVndPerM2, language) : '—'}</td>
            <td>{run.thresholds ? formatPercent(run.thresholds.mape, language) : '—'}</td>
            <td>{run.thresholds ? formatCount(run.thresholds.consecutiveRuns, language) : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

const propertyTypeLabels: Record<string, { vn: string; en: string }> = {
  apartment_center: { vn: 'Căn hộ trung tâm', en: 'Central apartment' },
  apartment_suburb: { vn: 'Căn hộ ven đô', en: 'Suburban apartment' },
  townhouse_suburb: { vn: 'Nhà phố ven đô', en: 'Suburban townhouse' },
  land_urban: { vn: 'Đất đô thị', en: 'Urban land' },
  land_suburban: { vn: 'Đất ven đô', en: 'Suburban land' },
  townhouse_center: { vn: 'Nhà phố trung tâm', en: 'City-center townhouse' },
  villa: { vn: 'Biệt thự', en: 'Villa' },
  shophouse: { vn: 'Nhà phố thương mại', en: 'Shophouse' },
  penthouse: { vn: 'Căn hộ áp mái', en: 'Penthouse' },
  office: { vn: 'Văn phòng', en: 'Office' },
  warehouse: { vn: 'Nhà kho', en: 'Warehouse' },
  land_agricultural: { vn: 'Đất nông nghiệp', en: 'Agricultural land' },
  land_industrial: { vn: 'Đất công nghiệp', en: 'Industrial land' },
  project: { vn: 'Dự án bất động sản', en: 'Real-estate project' },
};
const verificationSourceKeys: Record<string, string> = {
  owner_contract: 'valuationAccuracy.source.owner_contract',
  bank_disbursement: 'valuationAccuracy.source.bank_disbursement',
  notary_deed: 'valuationAccuracy.source.notary_deed',
};

function GroupMetricBreakdown({ groups, language, t }: { groups: Group[]; language: Language; t: Translate }) {
  const locationLabel = useLocationLabel();
  const propertyTypeLabel = (value: string) => propertyTypeLabels[value]?.[language] ?? value;
  const metrics = [
    {
      key: 'mae' as const,
      title: t('valuationAccuracy.group.maeHighest'),
      format: (value: number) => formatVnd(value, language),
      value: (group: Group) => group.mae,
    },
    {
      key: 'mape' as const,
      title: t('valuationAccuracy.group.mapeHighest'),
      format: (value: number) => formatPercent(value, language),
      value: (group: Group) => group.mape,
    },
  ];
  return (
    <div className="grid gap-4 border-b border-[var(--glass-border)] p-4 sm:p-5 lg:grid-cols-2">
      {metrics.map(metric => {
        const ranked = groups
          .filter(group => metric.value(group) != null)
          .sort((a, b) => (metric.value(b) as number) - (metric.value(a) as number))
          .slice(0, 5);
        const max = Math.max(0, ...ranked.map(group => metric.value(group) as number));
        return (
          <div key={metric.key} className="rounded-[18px] bg-[var(--glass-surface)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{metric.title}</h3>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('valuationAccuracy.group.limit')}</p>
            {ranked.length ? (
              <div className="mt-4 space-y-3">
                {ranked.map(group => {
                  const value = metric.value(group) as number;
                  const width = max > 0 ? value / max * 100 : 0;
                  return (
                    <div key={`${group.locationKey}-${group.propertyType}-${metric.key}`} className="grid grid-cols-[minmax(0,1fr)_minmax(4rem,1.2fr)_auto] items-center gap-2">
                      <span className="truncate text-xs text-[var(--text-secondary)]" title={`${locationLabel(group.locationKey)} · ${propertyTypeLabel(group.propertyType)}`}>{locationLabel(group.locationKey)} · {propertyTypeLabel(group.propertyType)}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]" role="img" aria-label={`${locationLabel(group.locationKey)} ${metric.title}: ${metric.format(value)}`}>
                        <div className="h-full rounded-full bg-sgs-primary" style={{ width: `${width}%` }} />
                      </div>
                      <span className="max-w-[8rem] truncate text-right font-mono text-[11px] font-semibold text-[var(--text-primary)]" title={metric.format(value)}>{metric.format(value)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-4 rounded-xl bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-tertiary)]">{t('valuationAccuracy.group.noMetric')}</p>}
          </div>
        );
      })}
    </div>
  );
}

function GroupHistoryTrends({
  history,
  latestGroups,
  language,
  t,
  minimumEvaluatedSamples,
}: {
  history: ResponseData['history'];
  latestGroups: Group[];
  language: Language;
  t: Translate;
  minimumEvaluatedSamples: number | null;
}) {
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const locale = localeFor(language);
  const locationLabel = useLocationLabel();
  const groupOptions = new Map<string, { key: string; locationKey: string; propertyType: string }>();
  for (const run of history) {
    for (const group of run.groups ?? []) {
      const key = JSON.stringify([group.locationKey, group.propertyType]);
      groupOptions.set(key, { key, locationKey: group.locationKey, propertyType: group.propertyType });
    }
  }
  for (const group of latestGroups) {
    const key = JSON.stringify([group.locationKey, group.propertyType]);
    groupOptions.set(key, { key, locationKey: group.locationKey, propertyType: group.propertyType });
  }
  const options = [...groupOptions.values()].sort((a, b) =>
    `${a.locationKey}\u0000${a.propertyType}`.localeCompare(`${b.locationKey}\u0000${b.propertyType}`, locale),
  );
  const activeKey = options.some(option => option.key === selectedGroupKey)
    ? selectedGroupKey
    : options[0]?.key ?? '';
  const selectedGroup = options.find(option => option.key === activeKey);
  const propertyTypeLabel = (value: string) => propertyTypeLabels[value]?.[language] ?? value;
  const selectedLabel = selectedGroup
    ? `${locationLabel(selectedGroup.locationKey)} · ${propertyTypeLabel(selectedGroup.propertyType)}`
    : '';
  const chartData = history.map(run => {
    const group = (run.groups ?? []).find(item =>
      item.locationKey === selectedGroup?.locationKey && item.propertyType === selectedGroup?.propertyType,
    );
    return {
      evaluatedAt: run.evaluatedAt,
      dateLabel: runLabel(run.evaluatedAt, locale),
      sampleCount: group?.sampleCount ?? null,
      evaluatedCount: group?.evaluatedCount ?? null,
      mae: group?.mae ?? null,
      mapePercent: group?.mape == null ? null : group.mape * 100,
    };
  });
  const hasMae = chartData.some(point => point.mae != null);
  const hasMape = chartData.some(point => point.mapePercent != null);
  const metricCharts = [
    {
      key: 'mae' as const,
      title: 'MAE · VND/m²',
      aria: 'valuationAccuracy.groupTrend.maeAria',
      chartAria: 'valuationAccuracy.groupTrend.maeChartAria',
      dataKey: 'mae',
      hasData: hasMae,
      noData: 'valuationAccuracy.groupTrend.noMae',
      tickFormatter: (value: number) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 }),
      format: (value: number | null) => formatVnd(value, language),
      color: 'var(--ui-brand)',
    },
    {
      key: 'mape' as const,
      title: 'MAPE · %',
      aria: 'valuationAccuracy.groupTrend.mapeAria',
      chartAria: 'valuationAccuracy.groupTrend.mapeChartAria',
      dataKey: 'mapePercent',
      hasData: hasMape,
      noData: 'valuationAccuracy.groupTrend.noMape',
      tickFormatter: (value: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value))}%`,
      format: (value: number | null) => value == null
        ? '—'
        : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`,
      color: '#c47b16',
    },
  ];
  const renderTooltip = (metric: typeof metricCharts[number]) => ({ active, payload }: any) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    const value = point[metric.dataKey] as number | null;
    return (
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3 text-xs shadow-xl">
        <p className="mb-2 font-semibold text-[var(--text-primary)]">{dateTime(point.evaluatedAt, language)}</p>
        <p className="font-mono text-[var(--text-secondary)]">{t('valuationAccuracy.groupTrend.measured', { value: metric.format(value) })}</p>
        <p className="mt-1 text-[var(--text-tertiary)]">
          {t('valuationAccuracy.groupTrend.samples', {
            evaluated: point.evaluatedCount == null ? t('valuationAccuracy.groupTrend.unavailable') : formatCount(point.evaluatedCount, language),
            verified: point.sampleCount == null ? t('valuationAccuracy.groupTrend.unavailable') : formatCount(point.sampleCount, language),
          })}
        </p>
      </div>
    );
  };

  return (
    <section className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-[var(--text-primary)]">{t('valuationAccuracy.groupTrend.title')}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-tertiary)]">{t('valuationAccuracy.groupTrend.description')}</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-tertiary)]">
            {minimumEvaluatedSamples == null
              ? t('valuationAccuracy.groupTrend.policyUnavailable')
              : t('valuationAccuracy.groupTrend.supportPolicy', { minimum: formatCount(minimumEvaluatedSamples, language) })}
          </p>
        </div>
        {options.length > 0 && (
          <label className="min-w-[min(100%,18rem)] text-xs font-semibold text-[var(--text-secondary)]">
            <span>{t('valuationAccuracy.groupTrend.select')}</span>
            <select
              value={activeKey}
              onChange={event => setSelectedGroupKey(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]"
            >
              {options.map(option => (
                <option key={option.key} value={option.key}>
                  {locationLabel(option.locationKey)} · {propertyTypeLabel(option.propertyType)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!options.length ? (
        <p className="mt-4 rounded-xl bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.groupTrend.noGroups')}</p>
      ) : (
        <>
          {history.length === 0 && (
            <p className="mt-4 rounded-xl bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.groupTrend.noHistory')}</p>
          )}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {metricCharts.map(metric => (
              <section key={metric.key} className="min-w-0 rounded-[18px] bg-[var(--glass-surface)] p-3 sm:p-4" aria-label={t(metric.aria)}>
                <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">{metric.title}</h3>
                <div className="h-56" role="img" aria-label={t(metric.chartAria, { group: selectedLabel })}>
                  {metric.hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke="var(--glass-border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                        <YAxis width={metric.key === 'mae' ? 78 : 56} domain={[0, 'auto']} tickFormatter={metric.tickFormatter} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip content={renderTooltip(metric)} />
                        <Line type="monotone" dataKey={metric.dataKey} name={metric.title} stroke={metric.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">{t(metric.noData)}</p>
                  )}
                </div>
              </section>
            ))}
          </div>
          {history.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs text-[var(--text-secondary)]">
                <thead className="border-b border-[var(--glass-border)] text-[var(--text-tertiary)]"><tr>
                  <th className="py-2">{t('valuationAccuracy.groupTrend.time')}</th>
                  <th>{t('valuationAccuracy.groupTrend.samplesLabel')}</th>
                  <th>MAE · VND/m²</th>
                  <th>MAPE · %</th>
                </tr></thead>
                <tbody>{history.map(run => {
                  const group = (run.groups ?? []).find(item =>
                    item.locationKey === selectedGroup?.locationKey && item.propertyType === selectedGroup?.propertyType,
                  );
                  const lowSupport = group != null
                    && minimumEvaluatedSamples != null
                    && group.evaluatedCount < minimumEvaluatedSamples;
                  return (
                    <tr key={`group-${run.evaluatedAt}`} className="border-b border-[var(--glass-border)]">
                      <td className="py-2">{dateTime(run.evaluatedAt, language)}</td>
                      <td>
                        {group ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{t('valuationAccuracy.groupTrend.samples', {
                              evaluated: formatCount(group.evaluatedCount, language),
                              verified: formatCount(group.sampleCount, language),
                            })}</span>
                            {lowSupport && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                {t('valuationAccuracy.groupTrend.lowSupport')}
                              </span>
                            )}
                          </span>
                        ) : t('valuationAccuracy.groupTrend.unavailable')}
                      </td>
                      <td className="font-mono">{group ? formatVnd(group.mae, language) : t('valuationAccuracy.groupTrend.unavailable')}</td>
                      <td className="font-mono">{group ? formatPercent(group.mape, language) : t('valuationAccuracy.groupTrend.unavailable')}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LocationName({ value }: { value: string }) {
  const locationLabel = useLocationLabel();
  return <span title={value}>{locationLabel(value)}</span>;
}

const ValuationAccuracyReport: React.FC = () => {
  const { language, t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [userResolved, setUserResolved] = useState(false);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const configuredMinimum = data?.supportPolicy?.minimumEvaluatedSamples;
  const minimumEvaluatedSamples = typeof configuredMinimum === 'number'
    && Number.isInteger(configuredMinimum)
    && configuredMinimum > 0
    ? configuredMinimum
    : null;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<Thresholds | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ResponseData>('/api/valuation/admin/evaluation-report');
      setData(response);
      setThresholdDraft(response.thresholdConfig.thresholds);
    } catch {
      setError('valuationAccuracy.error.load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    db.getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setUserResolved(true));
    load();
  }, [load]);

  const runBacktest = async () => {
    setRunning(true);
    await load();
    setRunning(false);
  };

  const saveThresholds = async () => {
    if (!thresholdDraft) return;
    setSavingThresholds(true);
    setError('');
    try {
      const response = await api.put<{ config: ResponseData['thresholdConfig']; thresholdHistory: ResponseData['thresholdHistory'] }>(
        '/api/valuation/admin/drift-thresholds', thresholdDraft,
      );
      setData(current => current ? { ...current, thresholdConfig: response.config, thresholdHistory: response.thresholdHistory } : current);
    } catch {
      setError('valuationAccuracy.error.saveThresholds');
    } finally {
      setSavingThresholds(false);
    }
  };

  const report = data?.report;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  if (userResolved && !isAdmin) {
    return <div className="min-h-[100dvh] bg-[var(--bg-app)] p-6 text-[var(--text-secondary)] sm:p-8">{t('valuationAccuracy.accessDenied')}</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-app)] p-4 text-[var(--text-primary)] sm:p-6 md:p-8">
      <SeoHead title={t('valuationAccuracy.seoTitle')} description={t('valuationAccuracy.seoDescription')} />
      <LocationLabelsContext.Provider value={data?.dataset.locationLabels ?? {}}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--ui-brand)]">{t('valuationAccuracy.eyebrow')}</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">{t('valuationAccuracy.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
              {t('valuationAccuracy.intro')}
            </p>
          </div>
          <button onClick={runBacktest} disabled={loading || running}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ui-brand)] px-4 py-2.5 text-sm font-bold text-[var(--ui-on-brand)] shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            {running ? t('valuationAccuracy.backtest.running') : t('valuationAccuracy.backtest.run')}
          </button>
        </header>

        <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>{t('valuationAccuracy.disclaimer.title')}</strong> {t('valuationAccuracy.disclaimer.body')}</p>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            <span>{t(error)}</span>
            {!data && <button type="button" onClick={load} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">{t('valuationAccuracy.retry')}</button>}
          </div>
        )}
        {isAdmin && thresholdDraft && data?.thresholdConfig && (
          <section className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-[var(--text-primary)]">{t('valuationAccuracy.threshold.title')}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">{t('valuationAccuracy.threshold.versionNotice', { version: data.thresholdConfig.version })}</p>
              </div>
              <button onClick={saveThresholds} disabled={savingThresholds}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--ui-brand)] px-3 py-2 text-sm font-bold text-[var(--ui-on-brand)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" /> {savingThresholds ? t('valuationAccuracy.threshold.saving') : t('valuationAccuracy.threshold.save')}
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">MAE (VND/m²)
                <input type="number" min="1" max="1000000000" step="100000"
                  value={thresholdDraft.maeVndPerM2}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, maeVndPerM2: Number(event.target.value) })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
              <label className="text-sm font-semibold text-[var(--text-secondary)]">MAPE (%)
                <input type="number" min="0.01" max="200" step="0.1"
                  value={thresholdDraft.mape * 100}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, mape: Number(event.target.value) / 100 })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
              <label className="text-sm font-semibold text-[var(--text-secondary)]">{t('valuationAccuracy.threshold.consecutiveRuns')}
                <input type="number" min="1" max="100" step="1"
                  value={thresholdDraft.consecutiveRuns}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, consecutiveRuns: Number(event.target.value) })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
            </div>
            {data.thresholdHistory.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{t('valuationAccuracy.threshold.history')}</h3>
                <table className="w-full min-w-[620px] text-left text-xs text-[var(--text-secondary)]">
                  <thead className="border-b border-[var(--glass-border)] text-[var(--text-tertiary)]"><tr><th className="py-2">{t('valuationAccuracy.threshold.version')}</th><th>{t('valuationAccuracy.threshold.time')}</th><th>{t('valuationAccuracy.threshold.author')}</th><th>{t('valuationAccuracy.threshold.old')}</th><th>{t('valuationAccuracy.threshold.new')}</th></tr></thead>
                  <tbody>{data.thresholdHistory.map(change => <tr key={change.version} className="border-b border-[var(--glass-border)]">
                    <td className="py-2 font-medium">v{change.version}</td><td>{dateTime(change.changedAt, language)}</td><td>{change.authorId || '—'}</td>
                    <td>{change.oldThresholds ? `${formatVnd(change.oldThresholds.maeVndPerM2, language)} · ${formatPercent(change.oldThresholds.mape, language)} · ${formatCount(change.oldThresholds.consecutiveRuns, language)}` : '—'}</td>
                    <td>{formatVnd(change.newThresholds.maeVndPerM2, language)} · {formatPercent(change.newThresholds.mape, language)} · {formatCount(change.newThresholds.consecutiveRuns, language)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {loading ? (
          <div className="space-y-4" aria-label={t('valuationAccuracy.loading')}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-surface)]" />)}
            </div>
            <div className="h-64 animate-pulse rounded-[22px] border border-[var(--glass-border)] bg-[var(--glass-surface)]" />
          </div>
        ) : isAdmin && report && (
          <>
            {data?.drift && <DriftStatus drift={data.drift} language={language} t={t} />}
            {report.thresholdVersion != null && report.appliedThresholds && (
              <p className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                {t('valuationAccuracy.threshold.applied', {
                  version: report.thresholdVersion,
                  mae: formatVnd(report.appliedThresholds.maeVndPerM2, language),
                  mape: formatPercent(report.appliedThresholds.mape, language),
                  runs: formatCount(report.appliedThresholds.consecutiveRuns, language),
                })}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard t={t} label="MAE" value={formatVnd(report.mae, language)} detail={t('valuationAccuracy.metric.mae')} comparison={report.appliedThresholds ? { actual: report.mae, threshold: report.appliedThresholds.maeVndPerM2, format: value => formatVnd(value, language) } : undefined} />
              <MetricCard t={t} label="MAPE" value={formatPercent(report.mape, language)} detail={t('valuationAccuracy.metric.mape')} comparison={report.appliedThresholds ? { actual: report.mape, threshold: report.appliedThresholds.mape, format: value => formatPercent(value, language) } : undefined} />
              <MetricCard t={t} label={t('valuationAccuracy.metric.medianLabel')} value={formatVnd(report.medianAbsoluteError, language)} detail={t('valuationAccuracy.metric.medianAbsoluteError')} />
              <MetricCard t={t} label={t('valuationAccuracy.metric.coverageLabel')} value={formatPercent(report.intervalCoverage, language)} detail={t('valuationAccuracy.metric.intervalCoverage')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard t={t} label={t('valuationAccuracy.dataset.samples')} value={formatCount(report.sampleCount, language)} detail={`${t('valuationAccuracy.dataset.verifiedGoldSet')} · ${data?.dataset.unitLabel}`} />
              <MetricCard t={t} label={t('valuationAccuracy.dataset.evaluated')} value={formatCount(report.evaluatedCount, language)} detail={t('valuationAccuracy.dataset.ofTotal', { value: report.sampleCount > 0 ? formatPercent(report.evaluatedCount / report.sampleCount, language) : '—' })} />
              <MetricCard t={t} label={t('valuationAccuracy.dataset.rejected')} value={formatCount(report.rejectedCount, language)} detail={t('valuationAccuracy.dataset.rejectRate', { value: formatPercent(report.rejectRate, language) })} />
            </div>
            <section className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-bold text-[var(--text-primary)]">{t('valuationAccuracy.trend.title')}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('valuationAccuracy.trend.description')}</p></div>
                <span className="rounded-full bg-[var(--glass-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">{t('valuationAccuracy.trend.savedRuns', { count: formatCount(data.history.length, language) })}</span>
              </div>
              <TrendChart history={data.history} language={language} t={t} />
            </section>
            <GroupHistoryTrends
              history={data.history}
              latestGroups={report.groups}
              language={language}
              t={t}
              minimumEvaluatedSamples={minimumEvaluatedSamples}
            />
            <DriftNotificationEvents language={language} t={t} />

            <section className="overflow-hidden rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-4 sm:px-5">
                <div><h2 className="font-bold text-[var(--text-primary)]">{t('valuationAccuracy.breakdown.title')}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('valuationAccuracy.breakdown.unit')}</p></div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4" /> {t('valuationAccuracy.breakdown.verified')}</span>
              </div>
              <GroupMetricBreakdown groups={report.groups} language={language} t={t} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-[var(--glass-surface)] text-xs font-semibold text-[var(--text-tertiary)]"><tr>
                    <th className="px-5 py-3">{t('valuationAccuracy.breakdown.locationKey')}</th><th className="px-5 py-3">{t('valuationAccuracy.breakdown.propertyType')}</th><th className="px-5 py-3">{t('valuationAccuracy.breakdown.samples')}</th><th className="px-5 py-3">MAE</th><th className="px-5 py-3">MAPE</th><th className="px-5 py-3">{t('valuationAccuracy.breakdown.coverage')}</th><th className="px-5 py-3">{t('valuationAccuracy.breakdown.reject')}</th>
                  </tr></thead>
                  <tbody>{report.groups.length ? report.groups.map(group => <tr key={`${group.locationKey}-${group.propertyType}`} className="border-t border-[var(--glass-border)] hover:bg-[var(--glass-surface)]">
                    <td className="px-5 py-3 font-medium text-[var(--text-primary)]"><LocationName value={group.locationKey} /></td><td className="px-5 py-3 text-[var(--text-secondary)]">{propertyTypeLabels[group.propertyType]?.[language] ?? group.propertyType}</td><td className="px-5 py-3 tabular-nums">{formatCount(group.sampleCount, language)}</td><td className="px-5 py-3 font-mono">{formatVnd(group.mae, language)}</td><td className="px-5 py-3 font-mono">{formatPercent(group.mape, language)}</td><td className="px-5 py-3 font-mono">{formatPercent(group.intervalCoverage, language)}</td><td className="px-5 py-3 font-mono">{formatCount(group.rejectedCount, language)} ({formatPercent(group.rejectRate, language)})</td>
                  </tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">{t('valuationAccuracy.breakdown.empty')}</td></tr>}</tbody>
                </table>
              </div>
            </section>
            <footer className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <BarChart3 className="h-4 w-4" /> {t('valuationAccuracy.footer.runAt')} {dateTime(report.evaluatedAt, language)} · {t('valuationAccuracy.footer.sources')} {data?.dataset.sources.map(source => verificationSourceKeys[source] ? t(verificationSourceKeys[source]) : source).join(', ')}
            </footer>
          </>
        )}
        {!loading && !report && !error && (
          <div className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-secondary)]">
            {t('valuationAccuracy.noResult')}
          </div>
        )}
      </div>
      </LocationLabelsContext.Provider>
    </div>
  );
};

export default ValuationAccuracyReport;