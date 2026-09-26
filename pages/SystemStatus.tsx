import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { db } from '../services/dbApi';
import { systemService } from '../services/systemService';
import { chaosService } from '../services/chaosService';
import { analyticsApi } from '../services/api/analyticsApi';
import { SystemHealth, ChaosConfig, LogEntry } from '../types';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import { RealtimeTrafficWidget } from './Dashboard';
import {
    SettingsPage,
    SettingsHeader,
    SettingsCard,
    StatTile,
    StatGrid,
    UsageMeter,
    DistributionBar,
    TrendBars,
    StatusBadge,
    EmptyState,
    TONE_COLOR,
} from '../components/settings/SettingsUI';
import type { Tone } from '../components/settings/SettingsUI';
import { DashboardValueBars, DashboardMetricRing } from '../components/dashboard/DashboardVisuals';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const ICONS = {
    SERVER: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    DOWNLOAD: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    UPLOAD: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    PLAY: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>,
    PAUSE: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
    TRASH: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

const HEALTH_TONE: Record<string, Tone> = { HEALTHY: 'success', DEGRADED: 'warning', CRITICAL: 'danger' };

/* ---------------- Live logs ---------------- */

const LogViewer = memo(({ logs, isPaused, togglePause, onClear, t }: { logs: LogEntry[], isPaused: boolean, togglePause: () => void, onClear: () => void, t: TFn }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
    };
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [logs, autoScroll]);
    const levelColor: Record<string, string> = {
        ERROR: TONE_COLOR.danger,
        WARN: TONE_COLOR.warning,
        INFO: TONE_COLOR.success,
    };
    return (
        <SettingsCard
            title={
                <span className="flex items-center gap-2">
                    <span>{t('system.live_logs')}</span>
                    <StatusBadge tone="neutral">{logs.length}</StatusBadge>
                    {isPaused && <StatusBadge tone="warning">{t('system.v2_logs_paused')}</StatusBadge>}
                </span>
            }
            description={t('system.v2_logs_desc')}
            actions={
                <>
                    <button
                        type="button"
                        onClick={togglePause}
                        className="ui-button ui-button-secondary ui-button-sm min-h-[40px] min-w-[40px]"
                        aria-label={isPaused ? t('system.btn_resume') : t('system.btn_pause')}
                        title={isPaused ? t('system.btn_resume') : t('system.btn_pause')}
                    >
                        {isPaused ? ICONS.PLAY : ICONS.PAUSE}
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        className="ui-button ui-button-ghost ui-button-sm min-h-[40px] min-w-[40px]"
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                    >
                        {ICONS.TRASH}
                    </button>
                </>
            }
            bodyClassName="p-0 sm:p-0"
        >
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="h-[420px] overflow-y-auto rounded-b-2xl bg-[var(--bg-app)] p-3 font-mono text-xs leading-relaxed sm:p-4"
                role="log"
                aria-live="polite"
                aria-label={t('system.live_logs')}
            >
                {logs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">{t('system.logs_waiting')}</div>
                ) : logs.map(log => (
                    <div key={log.id} className="flex flex-col gap-0.5 rounded-lg px-1.5 py-1 hover:bg-[var(--glass-surface)] sm:flex-row sm:gap-3">
                        <span className="flex shrink-0 gap-3">
                            <span className="w-14 text-[var(--text-tertiary)]">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="w-12 font-semibold" style={{ color: levelColor[log.level] || 'var(--text-secondary)' }}>{log.level}</span>
                        </span>
                        <span className="min-w-0 break-all text-[var(--text-secondary)]">
                            <span className="mr-2 font-semibold text-[var(--text-tertiary)]">[{log.source}]</span>
                            {log.message}
                            {log.context && <span className="ml-2 text-[var(--text-tertiary)]">{JSON.stringify(log.context)}</span>}
                        </span>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
});

/* ---------------- Health overview ---------------- */

const HealthOverview = memo(({ health, t, formatDateTime }: { health: SystemHealth | null, t: TFn, formatDateTime: (date: string) => string }) => {
    if (!health) {
        return (
            <SettingsCard title={t('system.overview')}>
                <div className="flex items-center gap-3" role="status">
                    <StatusBadge tone="neutral">{t('system.v2_checking')}</StatusBadge>
                </div>
            </SettingsCard>
        );
    }
    const tone = HEALTH_TONE[health.status] || 'neutral';
    const configs = health.config ?? [];
    const okCount = configs.filter(c => c.status === 'OK').length;
    const okPct = configs.length ? (okCount / configs.length) * 100 : null;
    const hours = Math.floor(health.uptime / 3600);
    const minutes = Math.floor((health.uptime % 3600) / 60);
    const checks: Array<{ label: string; ok: boolean }> = [
        { label: t('system.v2_check_db'), ok: !!health.checks?.database },
        { label: t('system.v2_check_ai'), ok: !!health.checks?.aiService },
    ];
    return (
        <SettingsCard
            title={t('system.overview')}
            description={health.timestamp ? t('system.v2_last_checked', { time: formatDateTime(health.timestamp) }) : undefined}
        >
            <div
                className="mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: TONE_COLOR[tone] }}
                role="status"
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[tone] }} aria-hidden="true" />
                        <span className="text-base font-bold" style={{ color: TONE_COLOR[tone] }}>{t(`system.status.${health.status}`)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t(`system.v2_status_hint_${health.status}`)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {checks.map(check => (
                        <StatusBadge key={check.label} tone={check.ok ? 'success' : 'danger'}>
                            {check.label}: {check.ok ? t('system.v2_connected') : t('system.v2_disconnected')}
                        </StatusBadge>
                    ))}
                </div>
            </div>
            <StatGrid cols={4}>
                <StatTile label={t('system.v2_version')} value={<span className="font-mono text-lg">{`v${health.version}`}</span>} />
                <StatTile label={t('system.v2_uptime')} value={<span className="text-lg">{t('system.v2_uptime_value', { h: hours, m: minutes })}</span>} />
                <StatTile label={t('system.v2_environment')} value={<span className="font-mono text-lg">{health.environment}</span>} />
                <StatTile
                    label={t('system.v2_config_passed')}
                    value={configs.length ? `${okCount}/${configs.length}` : '—'}
                    tone={configs.length && okCount < configs.length ? 'warning' : 'neutral'}
                    visual={<DashboardMetricRing value={okPct} label={t('system.v2_config_aria')} color={TONE_COLOR.success} size={48} />}
                />
            </StatGrid>
        </SettingsCard>
    );
});

const ConfigChecksCard = memo(({ health, t }: { health: SystemHealth | null, t: TFn }) => {
    const configs = health?.config ?? [];
    const okCount = configs.filter(c => c.status === 'OK').length;
    return (
        <SettingsCard title={t('system.config_title')}>
            {configs.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">—</p>
            ) : (
                <>
                    <DistributionBar
                        ariaLabel={t('system.v2_config_aria')}
                        segments={[
                            { label: t('system.v2_config_ok'), value: okCount, color: TONE_COLOR.success },
                            { label: t('system.v2_config_missing'), value: configs.length - okCount, color: TONE_COLOR.danger },
                        ]}
                    />
                    <ul className="mt-4 space-y-1">
                        {configs.map(conf => (
                            <li key={conf.key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--glass-surface)]">
                                <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]" title={conf.key}>{conf.key}</span>
                                <StatusBadge tone={conf.status === 'OK' ? 'success' : 'danger'}>
                                    {conf.status === 'OK' ? t('system.v2_config_ok') : t('system.v2_config_missing')}
                                </StatusBadge>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </SettingsCard>
    );
});

/** Backup/restore stay disabled until the feature ships; handlers are wired so enabling is a one-line change. */
const DisasterRecoveryCard = memo(({ onBackup, onRestore, isRestoring, t }: { onBackup: () => void, onRestore: () => void, isRestoring: boolean, t: TFn }) => (
    <SettingsCard title={t('system.dr_title')} description={t('system.backup_format')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <button type="button" onClick={onBackup} disabled className="ui-button ui-button-secondary ui-button-md min-h-[40px] w-full justify-center gap-2 opacity-60" title={t('system.coming_soon')}>
                {ICONS.DOWNLOAD} {t('system.btn_backup')}
            </button>
            <button type="button" onClick={onRestore} disabled aria-busy={isRestoring} className="ui-button ui-button-secondary ui-button-md min-h-[40px] w-full justify-center gap-2 opacity-60" title={t('system.coming_soon')}>
                {ICONS.UPLOAD} {t('system.btn_restore')}
            </button>
        </div>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('system.coming_soon')}</p>
    </SettingsCard>
));

/* ---------------- Lead email metrics ---------------- */

interface TenantEmailRow {
    tenantId: string;
    tenantName: string | null;
    total: number;
    success: number;
    failure: number;
    successRate: number;
    topReasons: Array<{ reason: string; count: number }>;
    lastFailureAt: string | null;
}
interface LeadEmailReport {
    windowDays: number;
    alertThreshold: number;
    generatedAt: string;
    totals: { total: number; success: number; failure: number; successRate: number };
    byTenant: TenantEmailRow[];
    alerts: TenantEmailRow[];
}

const EMAIL_DAY_OPTIONS = [1, 7, 14, 30];

const LeadEmailMetricsPanel: React.FC<{ t: TFn; formatDateTime: (date: string) => string }> = ({ t, formatDateTime }) => {
    const [report, setReport] = useState<LeadEmailReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(7);
    const [includeAutoreply, setIncludeAutoreply] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/admin/email-metrics/lead-send-rate?days=${days}&includeAutoreply=${includeAutoreply}`;
            const res = await fetch(url, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setReport(data);
        } catch (err: any) {
            setError(err?.message || t('system.v2_email_load_error'));
        } finally {
            setLoading(false);
        }
        // t is stable per language; excluded so switching language does not refetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days, includeAutoreply]);
    useEffect(() => { load(); }, [load]);
    const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
    const rateTone = (rate: number, threshold: number): Tone =>
        rate >= threshold ? 'success' : rate >= threshold - 0.1 ? 'warning' : 'danger';

    return (
        <SettingsCard
            title={t('system.v2_email_title')}
            description={
                <>
                    {includeAutoreply ? t('system.v2_email_desc_autoreply') : t('system.v2_email_desc_notify')}
                    {report && <> {t('system.v2_email_desc_threshold', { threshold: fmtPct(report.alertThreshold) })}</>}
                </>
            }
            actions={
                <>
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <input
                            type="checkbox"
                            checked={includeAutoreply}
                            onChange={(e) => setIncludeAutoreply(e.target.checked)}
                            className="h-4 w-4 accent-[var(--sgs-primary)]"
                        />
                        {t('system.v2_email_include_autoreply')}
                    </label>
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="ui-input min-h-[40px] w-auto text-xs"
                        aria-label={t('system.v2_email_window')}
                    >
                        {EMAIL_DAY_OPTIONS.map(n => (
                            <option key={n} value={n}>{t('system.v2_email_days_option', { n })}</option>
                        ))}
                    </select>
                    <button type="button" onClick={load} disabled={loading} className="ui-button ui-button-primary ui-button-sm min-h-[40px]">
                        {loading ? t('system.v2_email_loading') : t('system.v2_email_refresh')}
                    </button>
                </>
            }
        >
            {error && (
                <div className="mb-4 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: TONE_COLOR.danger, color: TONE_COLOR.danger }} role="alert">
                    {error}
                </div>
            )}
            {!report && loading && <p className="text-xs text-[var(--text-tertiary)]" role="status">{t('system.v2_email_loading')}</p>}
            {report && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <StatGrid cols={3}>
                            <StatTile label={t('system.v2_email_total')} value={report.totals.total.toLocaleString()} />
                            <StatTile label={t('system.v2_email_success')} value={report.totals.success.toLocaleString()} tone="success" />
                            <StatTile label={t('system.v2_email_failure')} value={report.totals.failure.toLocaleString()} tone={report.totals.failure > 0 ? 'danger' : 'neutral'} />
                        </StatGrid>
                        <div className="flex items-center gap-4 rounded-2xl border border-[var(--glass-border)] p-4">
                            <DashboardMetricRing
                                value={report.totals.total > 0 ? report.totals.successRate * 100 : null}
                                label={t('system.v2_email_rate_ring', { rate: report.totals.total > 0 ? fmtPct(report.totals.successRate) : '—' })}
                                color={TONE_COLOR[rateTone(report.totals.successRate, report.alertThreshold)]}
                                size={72}
                                centerValue={report.totals.total > 0 ? fmtPct(report.totals.successRate) : '—'}
                            />
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_email_rate')}</div>
                                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                                    {t('system.v2_email_threshold', { threshold: fmtPct(report.alertThreshold) })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DistributionBar
                        ariaLabel={t('system.v2_email_distribution_aria')}
                        emptyText={t('system.v2_email_empty', { n: report.windowDays })}
                        segments={[
                            { label: t('system.v2_email_success'), value: report.totals.success, color: TONE_COLOR.success },
                            { label: t('system.v2_email_failure'), value: report.totals.failure, color: TONE_COLOR.danger },
                        ]}
                    />
                    {report.alerts.length > 0 && (
                        <div className="rounded-xl border p-3" style={{ borderColor: TONE_COLOR.danger }} role="status">
                            <div className="mb-1 text-xs font-semibold" style={{ color: TONE_COLOR.danger }}>
                                {t('system.v2_email_alerts_title', { n: report.alerts.length, threshold: fmtPct(report.alertThreshold) })}
                            </div>
                            <ul className="list-disc space-y-0.5 pl-5 text-xs text-[var(--text-secondary)]">
                                {report.alerts.map((a) => (
                                    <li key={a.tenantId}>
                                        <span className="font-semibold text-[var(--text-primary)]">{a.tenantName || a.tenantId.slice(0, 8)}</span>:
                                        {' '}{fmtPct(a.successRate)} ({a.failure}/{a.total})
                                        {a.topReasons[0] && <> — {a.topReasons[0].reason}</>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {report.byTenant.length === 0 ? (
                        <EmptyState title={t('system.v2_email_empty', { n: report.windowDays })} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="border-b border-[var(--glass-border)] text-xs text-[var(--text-tertiary)]">
                                    <tr>
                                        <th className="py-2 text-left font-medium">{t('system.v2_email_col_tenant')}</th>
                                        <th className="py-2 text-right font-medium">{t('system.v2_email_col_total')}</th>
                                        <th className="py-2 text-right font-medium">{t('system.v2_email_col_ok')}</th>
                                        <th className="py-2 text-right font-medium">{t('system.v2_email_col_fail')}</th>
                                        <th className="py-2 pl-3 text-left font-medium">{t('system.v2_email_col_rate')}</th>
                                        <th className="py-2 pl-3 text-left font-medium">{t('system.v2_email_col_reasons')}</th>
                                        <th className="py-2 text-right font-medium">{t('system.v2_email_col_last')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.byTenant.map((row) => {
                                        const tone = rateTone(row.successRate, report.alertThreshold);
                                        return (
                                            <tr key={row.tenantId} className="border-b border-[var(--glass-border)] last:border-0">
                                                <td className="py-2">
                                                    <div className="text-xs font-semibold text-[var(--text-primary)]">{row.tenantName || t('system.v2_email_no_name')}</div>
                                                    <div className="font-mono text-xs text-[var(--text-tertiary)]">{row.tenantId.slice(0, 8)}…</div>
                                                </td>
                                                <td className="py-2 text-right font-mono tabular-nums">{row.total}</td>
                                                <td className="py-2 text-right font-mono tabular-nums" style={{ color: TONE_COLOR.success }}>{row.success}</td>
                                                <td className="py-2 text-right font-mono tabular-nums" style={{ color: row.failure > 0 ? TONE_COLOR.danger : undefined }}>{row.failure}</td>
                                                <td className="py-2 pl-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                                                            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.successRate * 100))}%`, background: TONE_COLOR[tone] }} />
                                                        </div>
                                                        <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: TONE_COLOR[tone] }}>{fmtPct(row.successRate)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 pl-3 text-xs text-[var(--text-secondary)]">
                                                    {row.topReasons.length === 0 ? '—' : row.topReasons.map((r, i) => (
                                                        <div key={i} className="max-w-xs truncate" title={r.reason}>× {r.count}: {r.reason}</div>
                                                    ))}
                                                </td>
                                                <td className="py-2 text-right font-mono text-xs text-[var(--text-tertiary)]">
                                                    {row.lastFailureAt ? formatDateTime(row.lastFailureAt) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                        {t('system.v2_email_updated', { time: formatDateTime(report.generatedAt) })}
                    </div>
                </div>
            )}
        </SettingsCard>
    );
};

/* ---------------- Live-chat telemetry ---------------- */

interface LiveChatLatencySummary {
    count: number;
    p50Ms: number;
    p95Ms: number;
}
interface LiveChatTenantMetrics {
    tenantKey: string;
    acknowledgeLatency: LiveChatLatencySummary;
    finalReplyLatency: LiveChatLatencySummary;
}
type AttachmentProviderOutcome = 'primary' | 'fallback' | 'timeout' | 'outage' | 'not_attempted';
type AttachmentExtractionStatus = 'NOT_APPLICABLE' | 'READY' | 'EMPTY' | 'FAILED' | 'UNKNOWN';
type AttachmentFileType = 'image' | 'pdf' | 'docx' | 'document' | 'other';
interface AttachmentReadabilityBreakdown {
    total: number;
    unreadable: number;
    notProcessed: number;
    unreadableRatePercent: number;
    providerOutcomes: Record<AttachmentProviderOutcome, number>;
}
interface AttachmentReadabilitySnapshot {
    windowMs: number;
    overall: AttachmentReadabilityBreakdown;
    byTenant: Array<AttachmentReadabilityBreakdown & { tenantKey: string }>;
    byExtractionStatus: Array<AttachmentReadabilityBreakdown & { extractionStatus: AttachmentExtractionStatus }>;
    byFileType: Array<AttachmentReadabilityBreakdown & { fileType: AttachmentFileType }>;
}
interface LiveChatMetricsSnapshot {
    windowMs: number;
    generatedAt: string;
    acknowledgeLatency: LiveChatLatencySummary;
    finalReplyLatency: LiveChatLatencySummary;
    byTenant: LiveChatTenantMetrics[];
    slowEndpointAlerts: Array<{
        endpoint: 'history' | 'message' | 'ai';
        thresholdMs: number;
        count: number;
        lastDurationMs: number;
    }>;
    databaseConnectionTimeouts: {
        windowMs: number;
        count: number;
        threshold: number;
        alertActive: boolean;
    };
    statusRateLimits?: {
        endpoint: 'status_polling';
        environment: string;
        rateLimitName: string;
        windowMs: number;
        requestCount: number;
        limitedCount: number;
        limitedRatePercent: number;
        threshold: number;
        alertActive: boolean;
        lastRetryAfterSeconds: number | null;
        backend: 'redis' | 'in-memory' | 'mixed' | 'unknown';
        backendCounts: { redis: number; 'in-memory': number };
        byTenant: Array<{
            tenantKey: string;
            requestCount: number;
            limitedCount: number;
            limitedRatePercent: number;
            threshold: number;
            alertActive: boolean;
            lastRetryAfterSeconds: number | null;
            backend: 'redis' | 'in-memory' | 'mixed' | 'unknown';
            backendCounts: { redis: number; 'in-memory': number };
        }>;
    };
    attachmentReadability?: AttachmentReadabilitySnapshot;
}
interface SystemMetricsResponse {
    liveChat?: LiveChatMetricsSnapshot;
}

const STALE_AFTER_MS = 2 * 60_000;
const HASHED_TENANT_KEY = /^[a-f0-9]{16}$/i;

const isLiveChatSnapshot = (value: unknown): value is LiveChatMetricsSnapshot => {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as Partial<LiveChatMetricsSnapshot>;
    return typeof snapshot.generatedAt === 'string'
        && typeof snapshot.windowMs === 'number'
        && !!snapshot.acknowledgeLatency
        && !!snapshot.finalReplyLatency
        && Array.isArray(snapshot.byTenant)
        && Array.isArray(snapshot.slowEndpointAlerts)
        && !!snapshot.databaseConnectionTimeouts;
};

const finiteOrZero = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);

const latencyValue = (summary: LiveChatLatencySummary | undefined, key: 'p50Ms' | 'p95Ms'): number =>
    finiteOrZero(summary?.[key]);

const attachmentValue = (
    breakdown: AttachmentReadabilityBreakdown | undefined,
    key: 'total' | 'unreadable' | 'notProcessed' | 'unreadableRatePercent',
): number => finiteOrZero(breakdown?.[key]);

const attachmentProviderOutcomes: AttachmentProviderOutcome[] = ['primary', 'fallback', 'timeout', 'outage', 'not_attempted'];
const attachmentExtractionStatuses: AttachmentExtractionStatus[] = ['NOT_APPLICABLE', 'READY', 'EMPTY', 'FAILED', 'UNKNOWN'];
const attachmentFileTypes: AttachmentFileType[] = ['image', 'pdf', 'docx', 'document', 'other'];
const PROVIDER_COLORS: Record<AttachmentProviderOutcome, string> = {
    primary: TONE_COLOR.success,
    fallback: TONE_COLOR.info,
    timeout: TONE_COLOR.warning,
    outage: TONE_COLOR.danger,
    not_attempted: TONE_COLOR.neutral,
};

const formatMs = (value: number) => `${Math.round(Math.max(0, value))}ms`;

/** Paired P50/P95 bars on a shared scale, with the endpoint alert threshold as a reference line when known. */
const LatencyPairs: React.FC<{
    groups: Array<{ label: string; summary: LiveChatLatencySummary | undefined }>;
    thresholdMs: number | null;
    t: TFn;
}> = ({ groups, thresholdMs, t }) => {
    const rows = groups.map(g => {
        const count = finiteOrZero(g.summary?.count);
        return {
            label: g.label,
            count,
            p50: count > 0 ? latencyValue(g.summary, 'p50Ms') : null,
            p95: count > 0 ? latencyValue(g.summary, 'p95Ms') : null,
        };
    });
    const scale = Math.max(1, thresholdMs ?? 0, ...rows.flatMap(r => [r.p50 ?? 0, r.p95 ?? 0]));
    const thresholdPct = thresholdMs ? Math.min(100, (thresholdMs / scale) * 100) : null;
    return (
        <div className="space-y-4" role="group" aria-label={t('system.v2_latency_title')}>
            {rows.map(row => (
                <div key={row.label}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">{row.label}</span>
                        <span className="text-[var(--text-tertiary)]">{t('system.live_chat_metrics.samples', { count: row.count })}</span>
                    </div>
                    {([['P50', row.p50, 'var(--sgs-primary)'], ['P95', row.p95, 'var(--sgs-accent)']] as const).map(([name, value, color]) => {
                        const over = value != null && thresholdMs != null && value > thresholdMs;
                        return (
                            <div key={name} className="mb-1 flex items-center gap-3">
                                <span className="w-9 shrink-0 text-xs text-[var(--text-tertiary)]">{name}</span>
                                <div className="relative h-2.5 flex-1 overflow-visible rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                                    {value != null && (
                                        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(1, (value / scale) * 100)}%`, background: over ? TONE_COLOR.danger : color }} />
                                    )}
                                    {thresholdPct != null && (
                                        <div className="absolute -bottom-1 -top-1 w-0.5 rounded" style={{ left: `calc(${thresholdPct}% - 1px)`, background: TONE_COLOR.danger }} />
                                    )}
                                </div>
                                <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                                    {value == null ? '—' : formatMs(value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--sgs-primary)]" aria-hidden="true" />P50</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--sgs-accent)]" aria-hidden="true" />P95</span>
                {thresholdMs != null && (
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-0.5 rounded" style={{ background: TONE_COLOR.danger }} aria-hidden="true" />
                        {t('system.v2_threshold_marker', { threshold: thresholdMs })}
                    </span>
                )}
            </div>
        </div>
    );
};

/** Compact list of breakdown rows: label, unreadable-rate bar and file count. */
const ReadabilityRows: React.FC<{
    items: Array<{ key: string; label: string; breakdown: AttachmentReadabilityBreakdown }>;
    ariaLabel: string;
    emptyText: string;
    t: TFn;
}> = ({ items, ariaLabel, emptyText, t }) => {
    const visible = items.filter(item => attachmentValue(item.breakdown, 'total') > 0);
    if (!visible.length) return <p className="text-xs text-[var(--text-tertiary)]">{emptyText}</p>;
    return (
        <ul className="space-y-2.5" aria-label={ariaLabel}>
            {visible.map(item => {
                const rate = attachmentValue(item.breakdown, 'unreadableRatePercent');
                return (
                    <li key={item.key}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-medium text-[var(--text-secondary)]">{item.label}</span>
                            <span className="shrink-0 font-mono tabular-nums text-[var(--text-primary)]">
                                {`${rate}%`}
                                <span className="ml-1 text-[var(--text-tertiary)]">· {t('system.v2_files_count', { count: attachmentValue(item.breakdown, 'total') })}</span>
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, rate))}%`, background: rate > 0 ? TONE_COLOR.danger : TONE_COLOR.success }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const thClass = 'pb-2 font-medium text-[var(--text-tertiary)]';

export const LiveChatTelemetryPanel: React.FC<{
    t: (key: string, params?: Record<string, string | number>) => string;
    formatDateTime: (date: string) => string;
}> = ({ t, formatDateTime }) => {
    const [snapshot, setSnapshot] = useState<LiveChatMetricsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const response = await analyticsApi.getSystemMetrics() as SystemMetricsResponse;
            if (!isLiveChatSnapshot(response?.liveChat)) {
                throw new Error(t('system.live_chat_metrics.invalid'));
            }
            setSnapshot(response.liveChat);
            setError(null);
        } catch (err: any) {
            setError(err?.message || t('system.live_chat_metrics.load_error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        let mounted = true;
        const loadWhenVisible = async () => {
            if (!mounted || document.hidden) return;
            await load();
        };
        loadWhenVisible();
        const interval = setInterval(loadWhenVisible, 30_000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [load]);

    const ageMs = snapshot ? Date.now() - new Date(snapshot.generatedAt).getTime() : Number.POSITIVE_INFINITY;
    const isStale = !snapshot || !Number.isFinite(ageMs) || ageMs > STALE_AFTER_MS;
    const hasSamples = !!snapshot && (
        snapshot.acknowledgeLatency.count > 0
        || snapshot.finalReplyLatency.count > 0
        || snapshot.slowEndpointAlerts.some(alert => alert.count > 0)
        || snapshot.databaseConnectionTimeouts.count > 0
        || (snapshot.statusRateLimits?.limitedCount ?? 0) > 0
        || (snapshot.attachmentReadability?.overall.total ?? 0) > 0
    );
    const endpointAlertCount = snapshot?.slowEndpointAlerts.length ?? 0;
    const endpointEventCount = snapshot?.slowEndpointAlerts.reduce((total, alert) => total + (Number.isFinite(alert.count) ? alert.count : 0), 0) ?? 0;
    const endpointThresholdMs = snapshot?.slowEndpointAlerts.length
        ? Math.max(...snapshot.slowEndpointAlerts.map(alert => finiteOrZero(alert.thresholdMs)))
        : null;
    const validTenantMetrics = (snapshot?.byTenant ?? []).filter(item => HASHED_TENANT_KEY.test(item.tenantKey));
    const dataState = loading && !snapshot
        ? 'loading'
        : error && !snapshot
            ? 'error'
            : isStale || !!error
                ? 'stale'
                : !hasSamples
                    ? 'empty'
                    : 'live';
    const stateTone: Record<typeof dataState, Tone> = {
        live: 'success',
        stale: 'warning',
        error: 'danger',
        empty: 'neutral',
        loading: 'neutral',
    };
    const dataStateLabel = {
        loading: t('system.live_chat_metrics.loading'),
        error: t('system.live_chat_metrics.error'),
        empty: t('system.live_chat_metrics.empty'),
        stale: t('system.live_chat_metrics.stale'),
        live: t('system.live_chat_metrics.live'),
    }[dataState];

    const dbTimeouts = snapshot?.databaseConnectionTimeouts;
    const statusRateLimits = snapshot?.statusRateLimits;
    const statusTenants = (statusRateLimits?.byTenant ?? []).filter(item => HASHED_TENANT_KEY.test(item.tenantKey));
    const attachmentReadability = snapshot?.attachmentReadability;
    const attachmentOverall = attachmentReadability?.overall;
    const attachmentTotal = attachmentValue(attachmentOverall, 'total');
    const attachmentUnreadable = attachmentValue(attachmentOverall, 'unreadable');
    const attachmentNotProcessed = attachmentValue(attachmentOverall, 'notProcessed');
    const attachmentTenantMetrics = (attachmentReadability?.byTenant ?? []).filter(item => HASHED_TENANT_KEY.test(item.tenantKey));
    const attachmentWindowMinutes = Math.round((attachmentReadability?.windowMs ?? snapshot?.windowMs ?? 0) / 60_000);
    const windowMinutes = Math.round((snapshot?.windowMs ?? 0) / 60_000);
    const endpointLabel = (endpoint: 'history' | 'message' | 'ai') => t(`system.live_chat_metrics.endpoint.${endpoint}`);

    return (
        <section aria-labelledby="live-chat-telemetry-title" className="space-y-5">
            <SettingsCard
                title={
                    <span className="flex flex-wrap items-center gap-2">
                        <span id="live-chat-telemetry-title">{t('system.live_chat_metrics.title')}</span>
                        <StatusBadge tone="neutral">{t('system.live_chat_metrics.super_admin')}</StatusBadge>
                    </span>
                }
                description={t('system.live_chat_metrics.subtitle')}
                actions={<span role="status"><StatusBadge tone={stateTone[dataState]}>{dataStateLabel}</StatusBadge></span>}
            >
                {error && snapshot && (
                    <div className="mb-4 rounded-xl border px-3 py-2 text-xs text-[var(--text-secondary)]" style={{ borderColor: TONE_COLOR.warning }} role="status">
                        {t('system.live_chat_metrics.refresh_error')} {error}
                    </div>
                )}
                {!snapshot && dataState === 'error' && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: TONE_COLOR.danger, color: TONE_COLOR.danger }} role="alert">
                        <span>{error || t('system.live_chat_metrics.load_error')}</span>
                        <button type="button" onClick={load} className="ui-button ui-button-secondary ui-button-sm min-h-[40px]">
                            {t('common.retry')}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="rounded-xl border border-[var(--glass-border)] p-4">
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('system.v2_latency_title')}</h4>
                            <span className="text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.window', { minutes: windowMinutes })}</span>
                        </div>
                        <LatencyPairs
                            t={t}
                            thresholdMs={endpointThresholdMs}
                            groups={[
                                { label: t('system.live_chat_metrics.acknowledge'), summary: snapshot?.acknowledgeLatency },
                                { label: t('system.live_chat_metrics.final_reply'), summary: snapshot?.finalReplyLatency },
                            ]}
                        />
                    </div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <StatTile
                                label={t('system.live_chat_metrics.slow_endpoints')}
                                value={snapshot ? String(endpointAlertCount) : '—'}
                                tone={endpointAlertCount > 0 ? 'warning' : 'neutral'}
                                hint={t('system.live_chat_metrics.slow_events', { count: endpointEventCount })}
                            />
                            <StatTile
                                label={t('system.live_chat_metrics.db_timeouts')}
                                value={!dbTimeouts ? '—' : dbTimeouts.alertActive ? t('system.live_chat_metrics.active') : t('system.live_chat_metrics.normal')}
                                tone={!dbTimeouts ? 'neutral' : dbTimeouts.alertActive ? 'danger' : 'success'}
                                hint={t('system.live_chat_metrics.timeout_count', { count: dbTimeouts?.count ?? 0, threshold: dbTimeouts?.threshold ?? 0 })}
                            />
                        </div>
                        {dbTimeouts && (
                            <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                <UsageMeter label={t('system.v2_db_meter')} used={finiteOrZero(dbTimeouts.count)} limit={finiteOrZero(dbTimeouts.threshold) || null} />
                            </div>
                        )}
                    </div>
                </div>
            </SettingsCard>

            {statusRateLimits && (
                <SettingsCard
                    title={t('system.live_chat_metrics.status_rate_limit')}
                    description={t('system.live_chat_metrics.status_rate_limit_scope', {
                        environment: statusRateLimits.environment,
                        rateLimitName: statusRateLimits.rateLimitName,
                    })}
                    actions={
                        <StatusBadge tone={statusRateLimits.alertActive ? 'danger' : 'success'}>
                            {statusRateLimits.alertActive ? t('system.live_chat_metrics.active') : t('system.live_chat_metrics.normal')}
                        </StatusBadge>
                    }
                >
                    <StatGrid cols={4}>
                        <StatTile
                            label={t('system.live_chat_metrics.status_rate')}
                            value={`${statusRateLimits.limitedRatePercent}%`}
                            tone={statusRateLimits.alertActive ? 'danger' : 'neutral'}
                            hint={t('system.live_chat_metrics.status_count', { count: statusRateLimits.limitedCount, requests: statusRateLimits.requestCount })}
                        />
                        <StatTile
                            label={t('system.live_chat_metrics.status_threshold')}
                            value={String(statusRateLimits.threshold)}
                            hint={t('system.live_chat_metrics.status_window', { minutes: Math.round(statusRateLimits.windowMs / 60_000) })}
                        />
                        <StatTile
                            label={t('system.live_chat_metrics.retry_after')}
                            value={statusRateLimits.lastRetryAfterSeconds === null ? '—' : `${statusRateLimits.lastRetryAfterSeconds}s`}
                            hint={t('system.live_chat_metrics.last_429')}
                        />
                        <StatTile
                            label={t('system.live_chat_metrics.rate_limit_backend')}
                            value={<span className="font-mono text-lg">{statusRateLimits.backend}</span>}
                            hint={t('system.live_chat_metrics.backend_counts', {
                                redis: statusRateLimits.backendCounts.redis,
                                memory: statusRateLimits.backendCounts['in-memory'],
                            })}
                        />
                    </StatGrid>
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-[var(--glass-border)] p-4">
                            <UsageMeter
                                label={t('system.v2_limited_vs_threshold')}
                                used={finiteOrZero(statusRateLimits.limitedCount)}
                                limit={finiteOrZero(statusRateLimits.threshold) || null}
                            />
                        </div>
                        <div className="rounded-xl border border-[var(--glass-border)] p-4">
                            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_backend_split')}</div>
                            <DistributionBar
                                ariaLabel={t('system.v2_backend_split')}
                                emptyText="—"
                                segments={[
                                    { label: 'Redis', value: finiteOrZero(statusRateLimits.backendCounts.redis), color: 'var(--sgs-primary)' },
                                    { label: t('system.v2_backend_memory'), value: finiteOrZero(statusRateLimits.backendCounts['in-memory']), color: 'var(--sgs-accent)' },
                                ]}
                            />
                        </div>
                    </div>
                    {statusTenants.length > 0 && (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[480px] text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--glass-border)]">
                                        <th className={`${thClass} text-left`}>{t('system.live_chat_metrics.tenant_key')}</th>
                                        <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.status_rate')}</th>
                                        <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.retry_after')}</th>
                                        <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.rate_limit_backend')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statusTenants.map(item => (
                                        <tr key={item.tenantKey} className="border-b border-[var(--glass-border)] last:border-0">
                                            <td className="py-2 font-mono text-[var(--text-secondary)]">{item.tenantKey}</td>
                                            <td className="py-2 text-right font-mono" style={{ color: item.alertActive ? TONE_COLOR.danger : 'var(--text-secondary)', fontWeight: item.alertActive ? 700 : undefined }}>
                                                {item.limitedRatePercent}% ({item.limitedCount}/{item.requestCount})
                                            </td>
                                            <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                                                {item.lastRetryAfterSeconds === null ? '—' : `${item.lastRetryAfterSeconds}s`}
                                            </td>
                                            <td className="py-2 text-right font-mono text-[var(--text-secondary)]">{item.backend}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SettingsCard>
            )}

            <SettingsCard
                title={<span id="attachment-readability-title">{t('system.live_chat_metrics.attachment_readability')}</span>}
                description={t('system.live_chat_metrics.attachment_window', { minutes: attachmentWindowMinutes })}
                actions={<StatusBadge tone="info">{t('system.live_chat_metrics.standardized_dimensions')}</StatusBadge>}
            >
                {!attachmentReadability ? (
                    <div className="rounded-xl border px-3 py-2 text-xs text-[var(--text-secondary)]" style={{ borderColor: TONE_COLOR.warning }} role="status">
                        {t('system.live_chat_metrics.attachment_unavailable')}
                    </div>
                ) : (
                    <div className="space-y-5">
                        <StatGrid cols={3}>
                            <StatTile
                                label={t('system.live_chat_metrics.unreadable_rate')}
                                value={`${attachmentValue(attachmentOverall, 'unreadableRatePercent')}%`}
                                tone={attachmentUnreadable > 0 ? 'danger' : 'neutral'}
                                hint={t('system.live_chat_metrics.unreadable_count', { count: attachmentUnreadable })}
                            />
                            <StatTile
                                label={t('system.live_chat_metrics.not_processed')}
                                value={String(attachmentNotProcessed)}
                                tone={attachmentNotProcessed > 0 ? 'warning' : 'neutral'}
                                hint={t('system.live_chat_metrics.attachment_total', { count: attachmentTotal })}
                            />
                            <div className="col-span-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 lg:col-span-1">
                                <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_attachment_outcomes')}</div>
                                <DistributionBar
                                    ariaLabel={t('system.v2_attachment_outcomes')}
                                    emptyText={t('system.v2_no_attachment_data')}
                                    segments={[
                                        { label: t('system.v2_readable'), value: Math.max(0, attachmentTotal - attachmentUnreadable - attachmentNotProcessed), color: TONE_COLOR.success },
                                        { label: t('system.v2_unreadable'), value: attachmentUnreadable, color: TONE_COLOR.danger },
                                        { label: t('system.live_chat_metrics.not_processed'), value: attachmentNotProcessed, color: TONE_COLOR.warning },
                                    ]}
                                />
                            </div>
                        </StatGrid>

                        <div className="rounded-xl border border-[var(--glass-border)] p-4">
                            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.live_chat_metrics.provider_outcomes')}</div>
                            <DistributionBar
                                ariaLabel={t('system.live_chat_metrics.provider_outcomes')}
                                emptyText={t('system.v2_no_attachment_data')}
                                segments={attachmentProviderOutcomes.map(outcome => ({
                                    label: t(`system.live_chat_metrics.provider.${outcome}`),
                                    value: finiteOrZero(attachmentOverall?.providerOutcomes?.[outcome]),
                                    color: PROVIDER_COLORS[outcome],
                                }))}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                <h5 className="mb-3 text-xs font-semibold text-[var(--text-primary)]">{t('system.live_chat_metrics.attachment_by_tenant')}</h5>
                                {attachmentTenantMetrics.length === 0 ? (
                                    <p className="text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.no_attachment_tenants')}</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[var(--glass-border)]">
                                                    <th className={`${thClass} text-left`}>{t('system.live_chat_metrics.tenant_key')}</th>
                                                    <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.unreadable_rate')}</th>
                                                    <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.not_processed')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {attachmentTenantMetrics.map(item => (
                                                    <tr key={item.tenantKey} className="border-b border-[var(--glass-border)] last:border-0">
                                                        <td className="py-2 font-mono text-[var(--text-secondary)]">{item.tenantKey}</td>
                                                        <td className="py-2 text-right font-mono">{`${attachmentValue(item, 'unreadableRatePercent')}%`}</td>
                                                        <td className="py-2 text-right font-mono">{attachmentValue(item, 'notProcessed')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                <h5 className="mb-3 text-xs font-semibold text-[var(--text-primary)]">{t('system.live_chat_metrics.attachment_by_extraction')}</h5>
                                <ReadabilityRows
                                    t={t}
                                    ariaLabel={t('system.live_chat_metrics.attachment_by_extraction')}
                                    emptyText={t('system.v2_no_attachment_data')}
                                    items={(attachmentReadability.byExtractionStatus ?? [])
                                        .filter(item => attachmentExtractionStatuses.includes(item.extractionStatus))
                                        .map(item => ({ key: item.extractionStatus, label: t(`system.live_chat_metrics.extraction.${item.extractionStatus}`), breakdown: item }))}
                                />
                            </div>
                            <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                <h5 className="mb-3 text-xs font-semibold text-[var(--text-primary)]">{t('system.live_chat_metrics.attachment_by_type')}</h5>
                                <ReadabilityRows
                                    t={t}
                                    ariaLabel={t('system.live_chat_metrics.attachment_by_type')}
                                    emptyText={t('system.v2_no_attachment_data')}
                                    items={(attachmentReadability.byFileType ?? [])
                                        .filter(item => attachmentFileTypes.includes(item.fileType))
                                        .map(item => ({ key: item.fileType, label: t(`system.live_chat_metrics.file_type.${item.fileType}`), breakdown: item }))}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.attachment_privacy')}</p>
                    </div>
                )}
            </SettingsCard>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SettingsCard
                    title={t('system.live_chat_metrics.endpoint_detail')}
                    actions={<span className="text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.window', { minutes: windowMinutes })}</span>}
                >
                    {endpointAlertCount === 0 ? (
                        <p className="text-sm text-[var(--text-tertiary)]">{t('system.live_chat_metrics.no_slow_endpoints')}</p>
                    ) : (
                        <ul className="space-y-3">
                            {snapshot?.slowEndpointAlerts.map(alert => (
                                <li key={alert.endpoint} className="rounded-xl bg-[var(--glass-surface)] p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                                        <span className="font-semibold text-[var(--text-primary)]">{endpointLabel(alert.endpoint)}</span>
                                        <StatusBadge tone="warning">{`${alert.count}×`}</StatusBadge>
                                    </div>
                                    <UsageMeter
                                        label={t('system.v2_last_vs_threshold')}
                                        used={finiteOrZero(alert.lastDurationMs)}
                                        limit={finiteOrZero(alert.thresholdMs) || null}
                                        formatValue={formatMs}
                                    />
                                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.threshold', { threshold: alert.thresholdMs })}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SettingsCard>
                <SettingsCard
                    title={t('system.live_chat_metrics.tenant_detail')}
                    actions={<span className="text-xs text-[var(--text-tertiary)]">{t('system.live_chat_metrics.hashed_only')}</span>}
                >
                    {validTenantMetrics.length === 0 ? (
                        <p className="text-sm text-[var(--text-tertiary)]">{t('system.live_chat_metrics.no_tenants')}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[360px] text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--glass-border)]">
                                        <th className={`${thClass} text-left`}>{t('system.live_chat_metrics.tenant_key')}</th>
                                        <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.ack_short')}</th>
                                        <th className={`${thClass} text-right`}>{t('system.live_chat_metrics.reply_short')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {validTenantMetrics.map(item => (
                                        <tr key={item.tenantKey} className="border-b border-[var(--glass-border)] last:border-0">
                                            <td className="py-2 font-mono text-[var(--text-secondary)]">{item.tenantKey}</td>
                                            <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                                                {formatMs(latencyValue(item.acknowledgeLatency, 'p50Ms'))} / {formatMs(latencyValue(item.acknowledgeLatency, 'p95Ms'))}
                                            </td>
                                            <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                                                {formatMs(latencyValue(item.finalReplyLatency, 'p50Ms'))} / {formatMs(latencyValue(item.finalReplyLatency, 'p95Ms'))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SettingsCard>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]">
                <span>{t('system.live_chat_metrics.snapshot', { time: snapshot ? formatDateTime(snapshot.generatedAt) : '—' })}</span>
                <span>{t('system.live_chat_metrics.privacy')}</span>
            </div>
        </section>
    );
};

/* ---------------- Visitor geography ---------------- */

interface VisitorStats {
    totalVisits: number;
    uniqueIps: number;
    topCountries: Array<{ country: string; countryCode: string; count: number }>;
    topCities: Array<{ city: string; count: number }>;
    dailyVisits: Array<{ date: string; count: number }>;
}

const VISITOR_DAYS = 30;

const VisitorGeoCard: React.FC<{ t: TFn; locale: string }> = ({ t, locale }) => {
    const [stats, setStats] = useState<VisitorStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        let mounted = true;
        analyticsApi.getVisitorStats(VISITOR_DAYS)
            .then((data: VisitorStats) => { if (mounted) setStats(data); })
            .catch(() => { if (mounted) setError(true); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);
    const number = new Intl.NumberFormat(locale);
    const total = finiteOrZero(stats?.totalVisits);
    const unique = finiteOrZero(stats?.uniqueIps);
    const share = (count: number) => (total > 0 ? `${number.format(count)} · ${Math.round((count / total) * 100)}%` : number.format(count));
    const topCountry = stats?.topCountries?.[0];
    return (
        <SettingsCard title={t('system.v2_geo_title')} description={t('system.v2_geo_desc', { n: VISITOR_DAYS })}>
            {loading && !stats ? (
                <p className="text-xs text-[var(--text-tertiary)]" role="status">{t('system.v2_geo_loading')}</p>
            ) : error || !stats ? (
                <p className="text-xs" style={{ color: TONE_COLOR.danger }} role="status">{t('system.v2_geo_error')}</p>
            ) : (
                <div className="space-y-5">
                    <StatGrid cols={4}>
                        <StatTile label={t('system.v2_geo_total_visits')} value={number.format(total)} />
                        <StatTile label={t('system.v2_geo_unique_ips')} value={number.format(unique)} />
                        <StatTile label={t('system.v2_geo_visits_per_ip')} value={unique > 0 ? (total / unique).toFixed(1) : '—'} />
                        <StatTile
                            label={t('system.v2_geo_top_country')}
                            value={<span className="text-lg">{topCountry ? topCountry.country : '—'}</span>}
                            hint={topCountry && total > 0 ? t('system.v2_geo_share', { pct: Math.round((topCountry.count / total) * 100) }) : undefined}
                        />
                    </StatGrid>
                    <div>
                        <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_geo_daily')}</div>
                        <TrendBars
                            ariaLabel={t('system.v2_geo_daily')}
                            emptyText={t('system.v2_geo_empty')}
                            formatValue={n => number.format(n)}
                            points={(stats.dailyVisits ?? []).map(d => ({ label: d.date.slice(5), value: finiteOrZero(d.count) }))}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div>
                            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_geo_top_countries')}</div>
                            <DashboardValueBars
                                locale={locale}
                                ariaLabel={t('system.v2_geo_top_countries')}
                                emptyText={t('system.v2_geo_empty')}
                                formatValue={share}
                                items={(stats.topCountries ?? []).slice(0, 8).map(c => ({ label: c.country, value: finiteOrZero(c.count) }))}
                            />
                        </div>
                        <div>
                            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('system.v2_geo_top_cities')}</div>
                            <DashboardValueBars
                                locale={locale}
                                ariaLabel={t('system.v2_geo_top_cities')}
                                emptyText={t('system.v2_geo_empty')}
                                formatValue={share}
                                items={(stats.topCities ?? []).slice(0, 8).map(c => ({ label: c.city, value: finiteOrZero(c.count), color: 'var(--sgs-accent)' }))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </SettingsCard>
    );
};

/* ---------------- Chaos engineering ---------------- */

const ChaosPanel = memo(({ config, onChange, t }: { config: ChaosConfig, onChange: (c: Partial<ChaosConfig>) => void, t: TFn }) => (
    <SettingsCard
        title={t('system.chaos_title')}
        description={t('system.chaos_desc')}
        className={config.enabled ? 'ring-1 ring-[var(--ui-danger)]' : undefined}
        actions={
            <div className="flex items-center gap-3">
                <StatusBadge tone={config.enabled ? 'danger' : 'neutral'}>{config.enabled ? t('system.armed') : t('system.safe_mode')}</StatusBadge>
                <button
                    type="button"
                    role="switch"
                    aria-checked={config.enabled}
                    aria-label={t('system.v2_chaos_toggle')}
                    onClick={() => onChange({ enabled: !config.enabled })}
                    className="flex min-h-[40px] items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                >
                    <span className="relative h-6 w-12 rounded-full transition-colors" style={{ background: config.enabled ? TONE_COLOR.danger : 'var(--ui-border-strong)' }}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${config.enabled ? 'left-7' : 'left-1'}`} />
                    </span>
                </button>
            </div>
        }
    >
        <div className={`grid grid-cols-1 gap-5 transition-opacity duration-300 sm:grid-cols-2 ${config.enabled ? 'opacity-100' : 'pointer-events-none opacity-50'}`}>
            <div>
                <label htmlFor="chaos-latency" className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">{t('system.latency')} (ms)</label>
                <input
                    id="chaos-latency"
                    type="range" min="0" max="2000" step="100"
                    value={config.latencyMs}
                    disabled={!config.enabled}
                    onChange={e => onChange({ latencyMs: Number(e.target.value) })}
                    className="h-2 w-full cursor-pointer accent-[var(--ui-danger)]"
                />
                <div className="mt-1 text-right font-mono text-xs font-semibold text-[var(--text-secondary)]">{config.latencyMs}ms</div>
            </div>
            <div>
                <label htmlFor="chaos-error-rate" className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">{t('system.error_rate')} (%)</label>
                <input
                    id="chaos-error-rate"
                    type="range" min="0" max="1" step="0.05"
                    value={config.errorRate}
                    disabled={!config.enabled}
                    onChange={e => onChange({ errorRate: Number(e.target.value) })}
                    className="h-2 w-full cursor-pointer accent-[var(--ui-danger)]"
                />
                <div className="mt-1 text-right font-mono text-xs font-semibold text-[var(--text-secondary)]">{(config.errorRate * 100).toFixed(0)}%</div>
            </div>
        </div>
    </SettingsCard>
));

/* ---------------- Page ---------------- */

const RUNBOOK_TONE: Record<string, Tone> = { warning: 'warning', neutral: 'neutral', danger: 'danger' };

export const SystemStatus: React.FC = () => {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [chaosConfig, setChaosConfig] = useState<ChaosConfig>(chaosService.getConfig());
    const [isPaused, setIsPaused] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [confirmClearLogs, setConfirmClearLogs] = useState(false);
    const [confirmFailover, setConfirmFailover] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t, formatDateTime, language } = useTranslation();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    const { chartTheme } = useTheme();
    useEffect(() => {
        const init = async () => {
            const user = await db.getCurrentUser();
            setIsAdmin(['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? ''));
            setIsSuperAdmin(user?.role === 'SUPER_ADMIN');
            const h = await systemService.checkHealth();
            setHealth(h);
        };
        init();
        const interval = setInterval(async () => {
            if (!document.hidden) {
                const h = await systemService.checkHealth();
                setHealth(h);
                if (!isPaused) {
                    setLogs(systemService.getRecentLogs());
                }
            }
        // Reliability fix: 1s -> 30s. Polling every second per tab keeps the database
        // from autosuspending and costs ~3 Upstash commands/second through the rate limiter.
        }, 30_000);
        return () => clearInterval(interval);
    }, [isPaused]);
    const notify = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    const updateChaos = (newConfig: Partial<ChaosConfig>) => {
        chaosService.configure(newConfig);
        setChaosConfig(chaosService.getConfig());
    };
    const handleBackup = async () => {
        try {
            await systemService.downloadBackup();
            notify(t('system.alert.backup_success'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };
    const handleRestore = () => setConfirmRestore(true);
    const handleClearLogs = () => setConfirmClearLogs(true);
    const executeClearLogs = () => {
        systemService.clearLogs();
        setLogs([]);
        notify(t('system.clear_logs_success'), 'success');
        setConfirmClearLogs(false);
    };
    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsRestoring(true);
        try {
            await systemService.processRestoreFile(file);
            notify(t('system.alert.restore_success'), 'success');
            // Wait a moment before reloading to show the success message
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            notify(`${t('system.alert.restore_fail')} ${error.message}`, 'error');
            setIsRestoring(false); // Only reset on failure; success triggers a reload
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    const runbooks = [
        { id: 1, title: t('system.runbook.sop1_title'), code: 'SOP-001', variant: 'warning', action: () => setConfirmFailover(true) },
        { id: 2, title: t('system.runbook.sop2_title'), code: 'SOP-002', variant: 'neutral', action: () => notify(t('system.runbook.sop2_success'), 'success') },
        { id: 3, title: t('system.runbook.sop3_title'), code: 'SOP-003', variant: 'danger', action: () => notify(t('system.runbook.sop3_success'), 'success') },
    ];
    return (
        <SettingsPage>
            <SeoHead title={`${t('system.title')} | SGS LAND`} description={t('system.v2_seo_desc')} canonicalPath="/system-status" />

            {toast && (
                <div
                    className="fixed bottom-6 left-4 right-4 z-[100] rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl sm:left-auto sm:right-6"
                    style={{ background: toast.type === 'success' ? TONE_COLOR.success : TONE_COLOR.danger }}
                    role="status"
                    aria-live="polite"
                >
                    {toast.msg}
                </div>
            )}

            <SettingsHeader
                icon={ICONS.SERVER}
                title={t('system.title')}
                description={t('system.subtitle')}
                meta={
                    <StatusBadge tone={health ? HEALTH_TONE[health.status] || 'neutral' : 'neutral'}>
                        {health ? t(`system.status.${health.status}`) : t('system.v2_checking')}
                    </StatusBadge>
                }
                actions={
                    <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: TONE_COLOR.success }} aria-hidden="true" />
                        {t('system.auto_refresh')}
                    </span>
                }
            />

            <HealthOverview health={health} t={t} formatDateTime={formatDateTime} />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <ConfigChecksCard health={health} t={t} />
                <DisasterRecoveryCard onBackup={handleBackup} onRestore={handleRestore} isRestoring={isRestoring} t={t} />
                <SettingsCard title={t('system.runbook_title')}>
                    <div className="grid grid-cols-1 gap-3">
                        {runbooks.map(book => (
                            <button
                                key={book.id}
                                type="button"
                                onClick={book.action}
                                className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] px-4 py-3 text-left transition-colors hover:border-[var(--ui-border-strong)] hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                            >
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{book.title}</span>
                                <StatusBadge tone={RUNBOOK_TONE[book.variant]}>{book.code}</StatusBadge>
                            </button>
                        ))}
                    </div>
                </SettingsCard>
            </div>

            {isAdmin && <ChaosPanel config={chaosConfig} onChange={updateChaos} t={t} />}

            {isSuperAdmin && (
                <>
                    <LiveChatTelemetryPanel t={t} formatDateTime={formatDateTime} />
                    <LeadEmailMetricsPanel t={t} formatDateTime={formatDateTime} />
                </>
            )}

            {isAdmin && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <VisitorGeoCard t={t} locale={locale} />
                    <div className="sgs-dashboard sgs-dashboard-embed min-w-0">
                        <RealtimeTrafficWidget t={t} theme={chartTheme} />
                    </div>
                </div>
            )}

            <LogViewer
                logs={logs}
                isPaused={isPaused}
                togglePause={() => setIsPaused(!isPaused)}
                onClear={handleClearLogs}
                t={t}
            />

            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onFileSelected} />
            <ConfirmModal
                isOpen={confirmRestore}
                title={t('system.alert.restore_title')}
                message={t('system.alert.restore_message')}
                confirmLabel={t('common.confirm')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => { setConfirmRestore(false); fileInputRef.current?.click(); }}
                onCancel={() => setConfirmRestore(false)}
                variant="warning"
            />
            <ConfirmModal
                isOpen={confirmClearLogs}
                title={t('system.clear_logs_title')}
                message={t('system.clear_logs_message')}
                confirmLabel={t('common.confirm')}
                cancelLabel={t('common.cancel')}
                onConfirm={executeClearLogs}
                onCancel={() => setConfirmClearLogs(false)}
                variant="warning"
            />
            <ConfirmModal
                isOpen={confirmFailover}
                title={t('system.alert.failover_title')}
                message={t('system.alert.failover_message')}
                confirmLabel={t('common.confirm')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => { setConfirmFailover(false); notify(t('system.alert.failover_triggered'), 'success'); }}
                onCancel={() => setConfirmFailover(false)}
                variant="danger"
            />
        </SettingsPage>
    );
};
