import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../services/dbApi';
import { taskApi } from '../../services/taskApi';
import { api } from '../../services/api';
import { useTranslation } from '../../services/i18n';
import { ROUTES } from '../../config/routes';
import { LeadStage } from '../../types';

/**
 * Overview home (Phase 2 redesign).
 * Action-first dashboard: greeting, one urgent item, 4 KPIs, pipeline by stage,
 * today's lead queue and a context column. All numbers come from real APIs;
 * empty data renders an explanatory empty state instead of "0" / "--".
 */

type Tr = (key: string, vars?: Record<string, string | number>) => string;

const useTr = (): Tr => {
    const { t } = useTranslation();
    return (key, vars) => {
        let out = String(t(key) ?? key);
        if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
        return out;
    };
};

const href = (route: string) => `/${route}`;

const initials = (name: string) =>
    String(name || '?').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();

const toNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/* ---------- Page actions: rendered into the workspace top bar on desktop ---------- */
export const ShellPageActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(min-width: 1024px)');
        const update = () => setTarget(mq.matches ? document.querySelector<HTMLElement>('[data-shell-page-slot]') : null);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    if (!target) return <>{children}</>;
    return createPortal(
        <div className="sgs-dashboard sgs-dashboard-embed flex items-center gap-2 [&_.dashboard-date-filter-wrap]:w-32 [&_.dashboard-date-filter-wrap]:flex-none">{children}</div>,
        target,
    );
};

/* ---------- Greeting (rendered inside the page header) ---------- */
export const OverviewGreeting: React.FC<{ analytics: any }> = ({ analytics }) => {
    const tr = useTr();
    const todayTasks = useTodayTasks();
    const tasksToday = toNum((todayTasks.data as any)?.pagination?.total ?? (todayTasks.data as any)?.data?.length);
    const { language } = useTranslation();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    const now = new Date();
    const hour = now.getHours();
    const dateLine = now.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const fullName = typeof analytics?.user?.name === 'string' ? analytics.user.name.trim() : '';
    const parts = fullName.split(/\s+/).filter(Boolean);
    const shortName = parts.length ? (language === 'vn' ? parts[parts.length - 1] : parts[0]) : '';
    const greetKey = hour < 12 ? 'overview.greet_morning' : hour < 18 ? 'overview.greet_afternoon' : 'overview.greet_evening';
    const queue = analytics?.workQueue || {};
    const approvals = toNum(queue.approvals ?? analytics?.pendingApprovals);
    const followups = toNum(queue.followups ?? analytics?.unresponsiveLeadCount);
    const summary = [
        tasksToday > 0 ? tr('overview.summary_tasks', { n: tasksToday }) : '',
        approvals > 0 ? tr('overview.summary_approvals', { n: approvals }) : '',
        followups > 0 ? tr('overview.summary_followups', { n: followups }) : '',
    ].filter(Boolean).join(' · ');
    return (
        <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">{dateLine}</div>
            <h1 className="dashboard-title mt-1 text-[var(--text-primary)]">
                {shortName ? `${tr(greetKey)}, ${shortName}` : tr(greetKey)}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{summary || tr('overview.summary_clear')}</p>
        </div>
    );
};

/* ---------- Shared bits ---------- */
const Delta: React.FC<{ value: unknown }> = ({ value }) => {
    const tr = useTr();
    const v = Math.round(toNum(value) * 10) / 10;
    if (v === 0) return <span className="text-[var(--text-tertiary)]">{tr('overview.delta_flat')}</span>;
    return (
        <span className={`font-semibold ${v > 0 ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>
            {v > 0 ? '▲' : '▼'} {Math.abs(v)}% {tr('overview.delta_suffix')}
        </span>
    );
};

const KpiCell: React.FC<{ label: string; value?: React.ReactNode; meta?: React.ReactNode; emptyText?: string; emptyLink?: { to: string; label: string }; accent?: boolean; footer?: React.ReactNode }> = ({ label, value, meta, emptyText, emptyLink, accent, footer }) => (
    <div className="dashboard-kpi">
        <div className="kpi-label">{label}</div>
        {value !== undefined ? (
            <>
                <div className={`kpi-value dash-number break-words ${accent ? 'text-[var(--sgs-primary)]' : ''}`}>{value}</div>
                <div className="kpi-meta">{meta}</div>
            </>
        ) : (
            <>
                <div className="mt-2 text-sm font-semibold text-[var(--text-tertiary)]">{emptyText}</div>
                {emptyLink && <a href={emptyLink.to} className="mt-1 inline-flex min-h-[28px] items-center text-xs font-semibold text-[var(--sgs-primary)] underline-offset-4 hover:underline">{emptyLink.label} →</a>}
            </>
        )}
        {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
);

const SideLabel: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
    <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="dashboard-subhead">{children}</span>
        {action}
    </div>
);

/* ---------- Main overview ---------- */
const STAGES: Array<{ stage: LeadStage; key: string; gold?: boolean }> = [
    { stage: LeadStage.NEW, key: 'overview.stage_new' },
    { stage: LeadStage.CONTACTED, key: 'overview.stage_contacted' },
    { stage: LeadStage.QUALIFIED, key: 'overview.stage_qualified' },
    { stage: LeadStage.PROPOSAL, key: 'overview.stage_proposal' },
    { stage: LeadStage.NEGOTIATION, key: 'overview.stage_negotiation' },
    { stage: LeadStage.WON, key: 'overview.stage_won', gold: true },
];
const OPEN_STAGES = [LeadStage.NEW, LeadStage.CONTACTED, LeadStage.QUALIFIED, LeadStage.PROPOSAL, LeadStage.NEGOTIATION];

export const useTodayTasks = () => {
    const range = useMemo(() => {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        return { from: s.toISOString(), to: e.toISOString() };
    }, []);
    return useQuery({
        queryKey: ['overviewTodayTasks', range.from],
        queryFn: () => taskApi.list({ deadline_from: range.from, deadline_to: range.to, sort_by: 'deadline', sort_dir: 'asc', limit: 5 }),
        staleTime: 60000,
        retry: 0,
    });
};

export const OverviewHome: React.FC<{ analytics: any; formatCompactNumber: (n: number) => string; leaderboardMode?: 'individual' | 'team'; days?: number }> = ({ analytics, formatCompactNumber, leaderboardMode = 'individual', days = 30 }) => {
    const tr = useTr();
    const { language } = useTranslation();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    const [queueFilter, setQueueFilter] = useState<'all' | 'overdue' | 'hot'>('all');

    const stageQuery = useQuery({
        queryKey: ['overviewStageCounts'],
        queryFn: async () => {
            const results = await Promise.all(STAGES.map(s => db.getLeads(1, 1, { stage: s.stage }).then((r: any) => toNum(r?.total)).catch(() => 0)));
            return STAGES.map((s, i) => ({ ...s, count: results[i] }));
        },
        staleTime: 60000,
    });

    const queueQuery = useQuery({
        queryKey: ['overviewLeadQueue'],
        queryFn: async () => {
            const r: any = await db.getLeads(1, 30, { stages: OPEN_STAGES });
            return Array.isArray(r?.data) ? r.data : [];
        },
        staleTime: 30000,
    });

    const tasksQuery = useTodayTasks();

    const depositQuery = useQuery({
        queryKey: ['overviewDeposits', days],
        queryFn: () => api.get<{ paidCount: number; paidAmount: number; pendingCount: number; prevPaidCount: number }>(`/api/bookings/summary?days=${days}`),
        staleTime: 60000,
        retry: 0,
    });

    const queue = analytics?.workQueue || {};
    const approvals = toNum(queue.approvals ?? analytics?.pendingApprovals);
    const followups = toNum(queue.followups ?? analytics?.unresponsiveLeadCount);
    const contracts = toNum(queue.contracts ?? analytics?.pendingContracts);
    const expiring = toNum(analytics?.expiringContractCount);

    // One urgent item, highest priority first.
    const urgent = approvals > 0
        ? { title: tr('overview.urgent_approvals', { n: approvals }), body: tr('overview.urgent_approvals_body'), primary: { to: href(ROUTES.APPROVALS), label: tr('overview.open_approvals') } }
        : followups > 0
            ? { title: tr('overview.urgent_followups', { n: followups }), body: tr('overview.urgent_followups_body'), primary: { to: href(ROUTES.LEADS), label: tr('overview.open_leads') } }
            : (contracts > 0 || expiring > 0)
                ? { title: tr('overview.urgent_contracts', { n: contracts || expiring }), body: tr('overview.urgent_contracts_body'), primary: { to: href(ROUTES.CONTRACTS), label: tr('overview.open_contracts') } }
                : null;

    const leads: any[] = queueQuery.data || [];
    const scoreOf = (l: any) => toNum(l?.score?.score ?? l?.score);
    const overdueCount = leads.filter(l => l.slaBreached).length;
    const hotCount = leads.filter(l => scoreOf(l) >= 70).length;
    const rows = leads
        .filter(l => queueFilter === 'overdue' ? l.slaBreached : queueFilter === 'hot' ? scoreOf(l) >= 70 : true)
        .sort((a, b) => (Number(!!b.slaBreached) - Number(!!a.slaBreached)) || (scoreOf(b) - scoreOf(a)))
        .slice(0, 5);

    const stages = stageQuery.data || [];
    const maxStage = Math.max(1, ...stages.map(s => s.count));
    const hasStages = stages.some(s => s.count > 0);

    const totalLeads = toNum(analytics?.totalLeads);
    const revenue = toNum(analytics?.revenue);
    const revenueTarget = toNum(analytics?.targets?.revenue?.monthly_target ?? analytics?.targets?.revenue?.monthlyTarget);
    const revenueTargetProgress = revenueTarget > 0 ? Math.round((revenue / revenueTarget) * 100) : 0;

    const healthCount = toNum(analytics?.unresponsiveLeadCount ?? analytics?.slaBreachedCount ?? followups);
    const healthLevel = healthCount === 0 ? 0 : healthCount <= 10 ? 1 : 2;
    const levelLabels = [tr('overview.level_low'), tr('overview.level_medium'), tr('overview.level_high')];
    const levelColor = ['var(--ui-success)', 'var(--sgs-accent)', 'var(--ui-danger)'];

    const lbRows: any[] = (leaderboardMode === 'team' ? analytics?.teamLeaderboard : analytics?.agentLeaderboard) || [];
    const topAgents = lbRows.filter(a => toNum(a?.deals) > 0).slice(0, 3);

    const tasks: any[] = (tasksQuery.data as any)?.data || [];
    const stageLabel = (s: string) => {
        const found = STAGES.find(x => x.stage === s);
        return found ? tr(found.key) : s;
    };
    const stageTone = (s: string) =>
        s === LeadStage.NEGOTIATION || s === LeadStage.PROPOSAL
            ? 'bg-[var(--sgs-accent)]/15 text-[var(--sgs-accent-text)]'
            : 'bg-[var(--ui-info)]/10 text-[var(--ui-info)]';

    const chip = (id: 'all' | 'overdue' | 'hot', label: string) => (
        <button
            key={id}
            type="button"
            onClick={() => setQueueFilter(id)}
            aria-pressed={queueFilter === id}
            className={`inline-flex min-h-[32px] items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] ${queueFilter === id ? 'bg-[var(--sgs-primary)] text-[var(--ui-on-brand)]' : 'bg-[var(--glass-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_272px]">
            <div className="min-w-0 space-y-5">
                {urgent && (
                    <section aria-label={tr('overview.attention')} className="flex flex-col gap-3 rounded-xl border border-[var(--sgs-accent)]/40 bg-[var(--sgs-champagne)] px-4 py-3 dark:bg-[var(--glass-surface)] sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1 text-sm leading-5">
                            <div className="font-semibold text-[var(--ui-text)] dark:text-[var(--text-primary)]">{urgent.title}</div>
                            <div className="text-[var(--ui-text-secondary)] dark:text-[var(--text-secondary)]">{urgent.body}</div>
                        </div>
                        <a href={urgent.primary.to} className="ui-button ui-button-primary ui-button-sm shrink-0">{urgent.primary.label}</a>
                    </section>
                )}

                <section className="dashboard-panel overflow-hidden" aria-label={tr('overview.kpi_title')}>
                    <div className="dashboard-kpis">
                        <KpiCell
                            label={tr('overview.kpi_revenue')}
                            accent
                            value={revenue > 0 ? formatCompactNumber(revenue) : undefined}
                            meta={<Delta value={analytics?.revenueDelta} />}
                            emptyText={tr('overview.empty_revenue')}
                            footer={revenueTarget > 0 ? (
                                <div className="space-y-1">
                                    <div className="text-xs text-[var(--text-tertiary)]">{tr('overview.target_progress', { n: revenueTargetProgress })}</div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]">
                                        <div className="h-full rounded-full bg-[var(--sgs-primary)]" style={{ width: `${Math.min(100, Math.max(0, revenueTargetProgress))}%` }} />
                                    </div>
                                </div>
                            ) : undefined}
                        />
                        <KpiCell
                            label={tr('overview.kpi_leads')}
                            value={totalLeads > 0 ? totalLeads.toLocaleString(locale) : undefined}
                            meta={<Delta value={analytics?.totalLeadsDelta} />}
                            emptyText={tr('overview.empty_leads')}
                            emptyLink={{ to: href(ROUTES.LEADS), label: tr('overview.empty_leads_cta') }}
                        />
                        <KpiCell
                            label={tr('overview.kpi_conversion')}
                            value={totalLeads > 0 ? `${toNum(analytics?.conversionRate).toLocaleString(locale)}%` : undefined}
                            meta={<span className="text-[var(--text-tertiary)]">{tr('overview.kpi_conversion_meta')}</span>}
                            emptyText={tr('overview.empty_conversion')}
                        />
                        {(() => {
                            const d: any = depositQuery.data;
                            if (depositQuery.isLoading) return <KpiCell label={tr('overview.kpi_deposit')} emptyText="…" />;
                            if (depositQuery.isError || !d) return <KpiCell label={tr('overview.kpi_deposit')} emptyText={tr('overview.deposit_error')} />;
                            const paid = toNum(d.paidCount);
                            const pending = toNum(d.pendingCount);
                            const prev = toNum(d.prevPaidCount);
                            if (paid === 0 && pending === 0) {
                                return <KpiCell label={tr('overview.kpi_deposit')} emptyText={tr('overview.empty_deposit')} emptyLink={{ to: href(ROUTES.INVENTORY), label: tr('overview.empty_deposit_cta') }} />;
                            }
                            const delta = prev > 0 ? ((paid - prev) / prev) * 100 : 0;
                            return (
                                <KpiCell
                                    label={tr('overview.kpi_deposit')}
                                    value={tr('overview.deposit_value', { n: paid.toLocaleString(locale) })}
                                    meta={<span className="text-[var(--text-tertiary)]">{tr('overview.deposit_meta', { amount: formatCompactNumber(toNum(d.paidAmount)), pending })}{prev > 0 ? <> · <Delta value={delta} /></> : null}</span>}
                                />
                            );
                        })()}
                    </div>
                </section>

                <section className="dashboard-panel" aria-label={tr('overview.pipeline_title')}>
                    <div className="dashboard-panel-head">
                        <h2>{tr('overview.pipeline_title')}</h2>
                        <a href={href(ROUTES.LEADS)} className="text-xs font-semibold text-[var(--sgs-primary)]">{tr('overview.pipeline_open')} →</a>
                    </div>
                    <div className="dashboard-panel-body space-y-2.5">
                        {stageQuery.isLoading ? (
                            <div className="h-40 animate-pulse rounded-lg bg-[var(--glass-surface)]" />
                        ) : hasStages ? stages.map(s => (
                            <div key={s.stage} className="grid grid-cols-[minmax(96px,120px)_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                                <span className="truncate text-[var(--text-secondary)]">{tr(s.key)}</span>
                                <div className="h-3.5 rounded bg-[var(--glass-surface)]" aria-hidden="true">
                                    <div className="h-3.5 rounded" style={{ width: `${Math.max(s.count > 0 ? 3 : 0, (s.count / maxStage) * 100)}%`, background: s.gold ? 'var(--sgs-accent)' : 'var(--sgs-primary)' }} />
                                </div>
                                <span className="dash-number text-right font-semibold text-[var(--text-primary)]">{s.count.toLocaleString(locale)}</span>
                            </div>
                        )) : (
                            <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                                {tr('overview.pipeline_empty')} <a href={href(ROUTES.LEADS)} className="font-semibold text-[var(--sgs-primary)]">{tr('overview.empty_leads_cta')} →</a>
                            </div>
                        )}
                    </div>
                </section>

                <section className="dashboard-panel" aria-label={tr('overview.queue_title')}>
                    <div className="dashboard-panel-head flex-wrap">
                        <h2>{tr('overview.queue_title')}</h2>
                        <div className="flex flex-wrap gap-1.5">
                            {chip('all', tr('overview.queue_all'))}
                            {chip('overdue', `${tr('overview.queue_overdue')} · ${overdueCount}`)}
                            {chip('hot', `${tr('overview.queue_hot')} · ${hotCount}`)}
                        </div>
                    </div>
                    {queueQuery.isLoading ? (
                        <div className="m-4 h-40 animate-pulse rounded-lg bg-[var(--glass-surface)]" />
                    ) : rows.length ? (
                        <ul>
                            {rows.map((l: any) => (
                                <li key={l.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3 last:border-0 sm:grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1fr)_72px_auto] sm:px-5">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--glass-surface-hover)] text-xs font-bold text-[var(--sgs-primary)]" aria-hidden="true">{initials(l.name)}</span>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{l.name}</div>
                                        <div className={`truncate text-xs ${l.slaBreached ? 'font-semibold text-[var(--ui-danger)]' : 'text-[var(--text-tertiary)]'}`}>
                                            {l.slaBreached ? tr('overview.queue_sla') : (l.source || '')}
                                        </div>
                                    </div>
                                    <span className={`hidden justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex ${stageTone(l.stage)}`}>{stageLabel(l.stage)}</span>
                                    <span className="dash-number hidden text-sm font-semibold text-[var(--text-secondary)] sm:block">{scoreOf(l) > 0 ? tr('overview.queue_score', { n: scoreOf(l) }) : '—'}</span>
                                    {l.phone ? (
                                        <a href={`tel:${String(l.phone).replace(/\s+/g, '')}`} className="ui-button ui-button-secondary ui-button-sm justify-self-end" aria-label={tr('overview.queue_call_aria', { name: l.name })}>{tr('overview.queue_call')}</a>
                                    ) : (
                                        <a href={href(ROUTES.LEADS)} className="ui-button ui-button-secondary ui-button-sm justify-self-end">{tr('overview.queue_view')}</a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-5 py-8 text-center text-sm text-[var(--text-tertiary)]">{tr('overview.queue_empty')}</div>
                    )}
                </section>
            </div>

            <aside className="min-w-0 space-y-5 text-sm xl:border-l xl:border-[var(--glass-border)] xl:pl-6" aria-label={tr('overview.context')}>
                <section>
                    <SideLabel>{tr('overview.today_title')}</SideLabel>
                    {tasks.length ? (
                        <ul className="space-y-3">
                            {tasks.map((task: any) => {
                                const d = task.deadline ? new Date(task.deadline) : null;
                                const color = task.urgency_level === 'overdue' || task.urgency_level === 'critical' ? 'var(--ui-danger)' : task.urgency_level === 'warning' ? 'var(--sgs-accent)' : 'var(--sgs-primary)';
                                return (
                                    <li key={task.id} className="flex gap-3">
                                        <span className="dash-number w-11 shrink-0 font-semibold text-[var(--text-tertiary)]">{d ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                        <div className="min-w-0 border-l-2 pl-3" style={{ borderColor: color }}>
                                            <div className="truncate font-semibold text-[var(--text-primary)]">{task.title}</div>
                                            {task.project_name && <div className="truncate text-xs text-[var(--text-tertiary)]">{task.project_name}</div>}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-[var(--text-tertiary)]">{tasksQuery.isLoading ? '…' : tr('overview.today_empty')}</p>
                    )}
                </section>

                <div className="h-px bg-[var(--glass-border)]" />
                <section>
                    <SideLabel>{tr('overview.health_title')}</SideLabel>
                    <p className="mb-3 leading-5 text-[var(--text-primary)]">{healthCount > 0 ? tr('overview.health_text', { n: healthCount }) : tr('overview.health_ok')}</p>
                    <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                        {[0, 1, 2].map(i => <div key={i} className="h-1.5 rounded-full" style={{ background: i === healthLevel ? levelColor[i] : 'var(--glass-surface-hover)' }} />)}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-xs text-[var(--text-tertiary)]">
                        {levelLabels.map((label, i) => <span key={label} className={i === healthLevel ? 'font-bold text-[var(--text-primary)]' : ''}>{label}</span>)}
                    </div>
                </section>

                <div className="h-px bg-[var(--glass-border)]" />
                <section>
                    <SideLabel action={<a href={href(ROUTES.EMPLOYEES)} className="text-xs font-semibold text-[var(--sgs-primary)]">{tr('overview.see_all')}</a>}>{tr('overview.team_title')}</SideLabel>
                    {topAgents.length ? (
                        <ol className="space-y-2.5">
                            {topAgents.map((a: any, i: number) => (
                                <li key={a.id ?? a.userId ?? a.name ?? i} className="flex items-center gap-2.5">
                                    <span className={`dash-number w-4 font-bold ${i === 0 ? 'text-[var(--sgs-accent-text)]' : 'text-[var(--text-tertiary)]'}`}>{i + 1}</span>
                                    <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-primary)]">{a.name}</span>
                                    <span className="dash-number text-[var(--text-secondary)]">{tr('overview.team_deals', { n: toNum(a.deals) })}</span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-[var(--text-tertiary)]">{tr('overview.team_empty')}</p>
                    )}
                </section>

                <div className="h-px bg-[var(--glass-border)]" />
                <section>
                    <SideLabel>{tr('overview.quick_title')}</SideLabel>
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { to: href(ROUTES.CONTRACTS), label: tr('overview.quick_contract') },
                            { to: href(ROUTES.AI_ADVISOR), label: tr('overview.quick_ai') },
                            { to: href(ROUTES.MY_LANDING), label: tr('overview.quick_landing') },
                            { to: href(ROUTES.CAMPAIGNS), label: tr('overview.quick_campaigns') },
                            { to: href(ROUTES.APPROVALS), label: approvals > 0 ? `${tr('overview.quick_approvals')} · ${approvals}` : tr('overview.quick_approvals') },
                        ].map(link => (
                            <a key={link.to} href={link.to} className="inline-flex min-h-[32px] items-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--ui-border-strong)] hover:text-[var(--text-primary)]">
                                {link.label}
                            </a>
                        ))}
                    </div>
                </section>
            </aside>
        </div>
    );
};

export default OverviewHome;
