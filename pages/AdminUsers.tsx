import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { api } from '../services/api';
import { User, UserRole, CommonStatus, Department } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import {
    SettingsPage,
    SettingsHeader,
    SettingsCard,
    StatTile,
    StatGrid,
    DistributionBar,
    StatusBadge,
    EmptyState,
    TONE_COLOR,
    SERIES_COLORS,
} from '../components/settings/SettingsUI';
import type { Tone, Segment } from '../components/settings/SettingsUI';

interface AgentStatsData {
    deals: number;
    lost: number;
    totalLeads: number;
    inProgress: number;
    closeRate: number;
    revenue: number;
    avgResponseMinutes: number | null;
    slaScore: number;
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    completedThisMonth: number;
    workloadScore: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Status → badge tone (literal map so Tailwind/badge classes stay static).
const STATUS_TONE: Record<string, Tone> = {
    [CommonStatus.ACTIVE]: 'success',
    [CommonStatus.PENDING]: 'warning',
    [CommonStatus.INACTIVE]: 'danger',
    [CommonStatus.DEACTIVATED]: 'neutral',
    [CommonStatus.ARCHIVED]: 'neutral',
};

const avatarFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=40&background=6366f1&color=fff`;

const ICONS = {
    SEARCH: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    SEND: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    INFO: <svg className="w-4 h-4 text-sgs-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CHART: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    USERS: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    LOCK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    CHEVRON_LEFT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    CHEVRON_RIGHT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
};

const ICON_BTN = 'inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] disabled:cursor-not-allowed disabled:opacity-40';
const FIELD_LABEL = 'mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]';

// --- SUB-COMPONENT: PAGINATION ---
const PaginationControl = memo(({ page, total, pageSize, onPageChange, onPageSizeChange, t }: any) => {
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return (
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('adminusers.v2_pagination_aria')}>
            <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <span>{t('pagination.showing')}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">{total > 0 ? start : 0}–{end}</span>
                <span>{t('pagination.of')}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">{total}</span>
                <span>{t('pagination.results')}</span>
            </div>
            <div className="mx-auto flex items-center gap-1.5 sm:mx-0">
                <div className="hidden sm:block min-w-[64px] mr-1">
                    <Dropdown
                        value={pageSize}
                        onChange={(v) => onPageSizeChange(Number(v))}
                        options={[12, 24, 48, 100].map(n => ({ value: n, label: String(n) }))}
                        className="text-xs"
                        placement="top"
                        variant="minimal"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className={ICON_BTN}
                    aria-label={t('pagination.prev')}
                >
                    {ICONS.CHEVRON_LEFT}
                </button>
                <span className="min-w-[56px] text-center text-xs font-semibold tabular-nums text-[var(--text-primary)]" aria-live="polite">{page} / {totalPages || 1}</span>
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages || total === 0}
                    className={ICON_BTN}
                    aria-label={t('pagination.next')}
                >
                    {ICONS.CHEVRON_RIGHT}
                </button>
            </div>
        </nav>
    );
});

// --- SUB-COMPONENT: PERFORMANCE MODAL ---
const PerfTile: React.FC<{ label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; highlight?: boolean }> = ({ label, value, hint, tone = 'neutral', highlight }) => (
    <div className={`rounded-xl border p-3 sm:p-4 ${highlight ? 'border-[var(--ui-danger)] bg-[var(--glass-surface)]' : 'border-[var(--glass-border)] bg-[var(--glass-surface)]'}`}>
        <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">{label}</p>
        <p className="text-xl font-bold tabular-nums sm:text-2xl" style={{ color: tone === 'neutral' ? 'var(--text-primary)' : TONE_COLOR[tone] }}>{value}</p>
        {hint && <p className="mt-1 text-2xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
);

const PerformanceModal: React.FC<{ user: User; onClose: () => void; t: any }> = ({ user, onClose, t }) => {
    const [data, setData] = useState<AgentStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        setLoading(true);
        setError(false);
        setData(null);
        fetch(`/api/analytics/agent-stats/${user.id}`, { credentials: 'include' })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    }, [user.id]);
    const slaTone: Tone = data ? (data.slaScore >= 90 ? 'success' : data.slaScore >= 70 ? 'brand' : 'warning') : 'neutral';
    const circumference = 2 * Math.PI * 50;
    const formatRevenue = (n: number) =>
        n >= 1e9 ? `${(n / 1e9).toFixed(1)} ${t('profile.perf_billion')}`
            : n >= 1e6 ? `${(n / 1e6).toFixed(0)} ${t('profile.perf_million')}`
                : n.toLocaleString();
    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="perf-modal-title">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl animate-scale-up">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <img
                            src={user.avatar || avatarFallback(user.name)}
                            onError={e => { (e.currentTarget as HTMLImageElement).src = avatarFallback(user.name); }}
                            className="h-10 w-10 shrink-0 rounded-full border border-[var(--glass-border)] object-cover"
                            alt=""
                        />
                        <div className="min-w-0">
                            <h3 id="perf-modal-title" className="truncate text-base font-bold text-[var(--text-primary)]">{t('admin.users.perf_modal_title', { name: user.name })}</h3>
                            <p className="truncate text-xs text-[var(--text-tertiary)]">{user.email}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className={ICON_BTN} aria-label={t('adminusers.v2_close')}>
                        {ICONS.CLOSE}
                    </button>
                </div>
                <div className="space-y-5 overflow-y-auto px-5 py-5 no-scrollbar">
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16" role="status">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)]" aria-hidden="true" />
                            <p className="text-sm text-[var(--text-secondary)]">{t('profile.perf_loading')}</p>
                        </div>
                    )}
                    {!loading && error && (
                        <p className="py-16 text-center text-sm font-semibold text-[var(--ui-danger)]" role="alert">{t('admin.users.perf_error')}</p>
                    )}
                    {!loading && !error && !data && (
                        <EmptyState title={t('admin.users.perf_no_data')} />
                    )}
                    {!loading && !error && data && (
                        <>
                            {/* SLA ring */}
                            <div className="flex items-center gap-5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
                                <div
                                    className="relative h-24 w-24 shrink-0"
                                    role="meter"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={data.slaScore}
                                    aria-label={t('profile.perf_sla')}
                                >
                                    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--glass-border)" strokeWidth="10" />
                                        <circle
                                            cx="60" cy="60" r="50" fill="none"
                                            stroke={TONE_COLOR[slaTone]}
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={`${circumference}`}
                                            strokeDashoffset={`${circumference * (1 - Math.max(0, Math.min(100, data.slaScore)) / 100)}`}
                                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                                        <span className="text-2xl font-extrabold tabular-nums" style={{ color: TONE_COLOR[slaTone] }}>{data.slaScore}</span>
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">{t('profile.perf_sla')}</p>
                                    <p className="mb-1 text-lg font-bold" style={{ color: TONE_COLOR[slaTone] }}>
                                        {data.slaScore >= 90 ? t('profile.perf_sla_excellent') : data.slaScore >= 70 ? t('profile.perf_sla_good') : t('profile.perf_sla_needs_work')}
                                    </p>
                                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                                        {t('profile.perf_close_rate')}: <span className="font-semibold text-[var(--text-primary)]">{data.closeRate}%</span>
                                        {data.avgResponseMinutes != null && (
                                            <> · {t('profile.perf_avg_resp')}: <span className="font-semibold text-[var(--text-primary)]">{data.avgResponseMinutes} {t('dash.minutes')}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {/* Lead KPIs */}
                            <section>
                                <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('profile.perf_lead_section')}</h4>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <PerfTile label={t('profile.perf_deals')} value={data.deals} tone="brand" />
                                    <PerfTile label={t('profile.perf_close_rate')} value={`${data.closeRate}%`} hint={t('profile.perf_close_formula')} tone="brand" />
                                    <PerfTile label={t('profile.perf_revenue')} value={formatRevenue(data.revenue)} hint="VND" tone="brand" />
                                    <PerfTile label={t('profile.perf_total_leads')} value={data.totalLeads} />
                                    <PerfTile label={t('profile.perf_in_progress')} value={data.inProgress} tone="accent" />
                                    <PerfTile label={t('profile.perf_lost')} value={data.lost} tone="danger" />
                                </div>
                            </section>
                            {/* Workload */}
                            <section>
                                <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('profile.perf_task_section')}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <PerfTile label={t('profile.perf_tasks_active')} value={data.activeTasks} />
                                    <PerfTile label={t('profile.perf_tasks_overdue')} value={data.overdueTasks} tone={data.overdueTasks > 0 ? 'danger' : 'neutral'} highlight={data.overdueTasks > 0} />
                                    <PerfTile label={t('profile.perf_tasks_week')} value={data.completedThisWeek} tone="brand" />
                                    <PerfTile label={t('profile.perf_tasks_month')} value={data.completedThisMonth} tone="brand" />
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- SUB-COMPONENT: ROLE PERMISSIONS HINT ---
const RolePermissionsHint: React.FC<{ role: UserRole; t: any }> = ({ role, t }) => (
    <div className="flex gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3">
        <div className="mt-0.5 shrink-0">{ICONS.INFO}</div>
        <div>
            <h4 className="mb-0.5 text-xs font-semibold text-[var(--text-primary)]">{t('admin.users.role_permissions')}</h4>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t(`role_desc.${role}`)}</p>
        </div>
    </div>
);

// --- SUB-COMPONENT: INVITE MODAL ---
interface InviteFormData { name: string; email: string; role: UserRole; phone: string; departmentId?: string; }
interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: InviteFormData) => Promise<void>;
    t: any;
    callerRole?: string;
    departments: Department[];
}
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;

const InviteUserModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onConfirm, t, callerRole, departments }) => {
    const [name, setName]   = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole]   = useState<UserRole>(UserRole.SALES);
    const [departmentId, setDepartmentId] = useState<string>('');
    const [loading, setLoading]   = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    useEffect(() => {
        if (isOpen) {
            setName(''); setEmail(''); setPhone('');
            setRole(UserRole.SALES); setDepartmentId(''); setErrors({}); setLoading(false);
        }
    }, [isOpen]);
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = t('admin.users.name_required');
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = t('auth.error_email_invalid');
        if (phone && !VN_PHONE_RE.test(phone.replace(/\s/g, '')))
            errs.phone = t('admin.users.phone_invalid');
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            await onConfirm({ name: name.trim(), email: email.trim().toLowerCase(), role, phone: phone.trim(), departmentId: departmentId || undefined });
            onClose();
        } catch (err: any) {
            setErrors({ submit: err.message || t('common.error') });
        } finally {
            setLoading(false);
        }
    };
    const roleOptions = useMemo(() =>
        Object.values(UserRole)
            .filter(r => callerRole === UserRole.SUPER_ADMIN || r !== UserRole.SUPER_ADMIN)
            .map(r => ({ value: r, label: t(`role.${r}`) }))
    , [t, callerRole]);

    if (!isOpen) return null;
    const inputCls = (field: string) =>
        `w-full min-h-[44px] rounded-xl border px-4 py-2.5 text-sm outline-none transition-all bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-2 ${errors[field] ? 'border-[var(--ui-danger)] focus:ring-[var(--ui-danger)]/20' : 'border-[var(--glass-border)] focus:border-[var(--sgs-primary)] focus:ring-[var(--sgs-primary)]/20'}`;
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
            <div className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl animate-scale-up sm:max-w-sm sm:rounded-2xl" style={{ maxHeight: 'calc(100vh - 48px)' }}>
                {/* Header — fixed */}
                <div className="flex shrink-0 items-start justify-between gap-2 px-5 pt-5 pb-4">
                    <div>
                        <h3 id="invite-modal-title" className="text-lg font-bold text-[var(--text-primary)]">{t('admin.users.invite_title')}</h3>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t('admin.users.invite_hint')}</p>
                    </div>
                    <button type="button" onClick={onClose} className={ICON_BTN} aria-label={t('adminusers.v2_close')}>
                        {ICONS.CLOSE}
                    </button>
                </div>
                {/* Body — scrollable */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 no-scrollbar">
                    {errors.submit && (
                        <div className="mb-4 rounded-xl border border-[var(--ui-danger)] bg-[var(--glass-surface)] px-4 py-3 text-sm font-medium text-[var(--ui-danger)]" role="alert">
                            {errors.submit}
                        </div>
                    )}
                    <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label htmlFor="invite-name" className={FIELD_LABEL}>
                                {t('admin.users.name_label')} <span className="text-[var(--ui-danger)]" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="invite-name"
                                type="text"
                                className={inputCls('name')}
                                placeholder={t('common.placeholder_fullname')}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                aria-invalid={!!errors.name}
                                aria-required="true"
                                autoFocus
                            />
                            {errors.name && <p className="mt-1 text-xs font-medium text-[var(--ui-danger)]">{errors.name}</p>}
                        </div>
                        <div>
                            <label htmlFor="invite-email" className={FIELD_LABEL}>
                                {t('admin.users.email_label')} <span className="text-[var(--ui-danger)]" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="invite-email"
                                type="email"
                                className={inputCls('email')}
                                placeholder={t('admin.users.placeholder_email')}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                aria-invalid={!!errors.email}
                                aria-required="true"
                            />
                            {errors.email && <p className="mt-1 text-xs font-medium text-[var(--ui-danger)]">{errors.email}</p>}
                        </div>
                        <div>
                            <label htmlFor="invite-phone" className={FIELD_LABEL}>
                                {t('admin.users.phone_label')}
                                <span className="font-normal text-[var(--text-tertiary)]">{t('admin.users.phone_optional')}</span>
                            </label>
                            <input
                                id="invite-phone"
                                type="tel"
                                className={inputCls('phone')}
                                placeholder={t('common.placeholder_phone')}
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                aria-invalid={!!errors.phone}
                            />
                            {errors.phone && <p className="mt-1 text-xs font-medium text-[var(--ui-danger)]">{errors.phone}</p>}
                        </div>
                        <div>
                            <div className={FIELD_LABEL}>
                                {t('adminusers.v2_department')}
                                <span className="font-normal text-[var(--text-tertiary)]">{t('admin.users.phone_optional')}</span>
                            </div>
                            <Dropdown
                                value={departmentId}
                                onChange={(v) => setDepartmentId(v as string)}
                                options={[
                                    { value: '', label: departments.length === 0 ? t('adminusers.v2_no_departments') : t('adminusers.v2_not_selected') },
                                    ...departments.map(d => ({ value: d.id, label: d.name })),
                                ]}
                                disabled={departments.length === 0}
                                className="w-full"
                                placement="top"
                            />
                        </div>
                        <div className="space-y-2 pb-2">
                            <Dropdown
                                label={t('admin.users.role_label')}
                                value={role}
                                onChange={(v) => setRole(v as UserRole)}
                                options={roleOptions}
                                className="w-full"
                                placement="top"
                            />
                            <RolePermissionsHint role={role} t={t} />
                        </div>
                    </form>
                </div>
                {/* Footer — always visible */}
                <div className="shrink-0 border-t border-[var(--glass-border)] px-5 pt-3 pb-6 sm:pb-4">
                    <button
                        type="submit"
                        form="invite-user-form"
                        disabled={loading || !name.trim() || !email.trim()}
                        className="ui-button ui-button-primary ui-button-md inline-flex w-full min-h-[44px] items-center justify-center gap-2"
                    >
                        {loading
                            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                            : ICONS.SEND}
                        {loading ? t('admin.users.sending') : t('admin.users.btn_send')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export const AdminUsers: React.FC = () => {
    const { t, formatDateTime } = useTranslation();
    // Data state
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState({ activeCount: 0, pendingCount: 0 });
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [totalUsers, setTotalUsers] = useState(0);
    // Unfiltered member count, captured whenever a fetch runs without filters.
    const [teamTotal, setTeamTotal] = useState<number | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    // Filters & pagination
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [sort, setSort] = useState<{ field: string, order: 'asc' | 'desc' }>({ field: 'createdAt', order: 'desc' });
    // Modals & action states
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [userToStatusChange, setUserToStatusChange] = useState<User | null>(null);
    const [userToRoleChange, setUserToRoleChange] = useState<{ user: User, newRole: UserRole } | null>(null);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [perfUser, setPerfUser] = useState<User | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    useEffect(() => {
        api.get<{ data: Department[] }>('/api/departments')
            .then(r => setDepartments(r.data || []))
            .catch(() => setDepartments([]));
    }, []);
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, roleFilter, statusFilter, sort]);
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const me = await db.getCurrentUser();
            setCurrentUser(me);
            // If not super_admin, admin, or team_lead, don't fetch users
            if (me?.role !== UserRole.SUPER_ADMIN && me?.role !== UserRole.ADMIN && me?.role !== UserRole.TEAM_LEAD) {
                setLoading(false);
                return;
            }
            const usersData = await db.getTenantUsers(page, pageSize, debouncedSearch, roleFilter === 'ALL' ? undefined : roleFilter, sort, statusFilter === 'ALL' ? undefined : statusFilter);
            setUsers(usersData?.data || []);
            setTotalUsers(usersData?.total || 0);
            setStats(usersData?.stats || { activeCount: 0, pendingCount: 0 });
            if (!debouncedSearch && roleFilter === 'ALL' && statusFilter === 'ALL') {
                setTeamTotal(usersData?.total ?? null);
            }
            setHasLoaded(true);
        } catch (e) {
            notify(t('common.error_loading'), 'error');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, roleFilter, statusFilter, page, pageSize, sort]);
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    const handleSort = (field: string) => {
        setSort(prev => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };
    const handleRoleChange = async (id: string, newRole: UserRole) => {
        if (id === currentUser?.id) {
            notify(t('admin.users.self_lockout'), 'error');
            return;
        }
        const user = users.find(u => u.id === id);
        if (user) {
            setUserToRoleChange({ user, newRole });
        }
    };
    const confirmRoleChange = async () => {
        if (!userToRoleChange) return;
        const { user, newRole } = userToRoleChange;
        try {
            await db.updateUserProfile(user.id, { role: newRole });
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
            notify(t('admin.users.role_update'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setUserToRoleChange(null);
        }
    };
    const confirmStatusChange = async () => {
        if (!userToStatusChange) return;
        if (userToStatusChange.id === currentUser?.id) {
            notify(t('admin.users.self_status_error'), 'error');
            setUserToStatusChange(null);
            return;
        }
        const newStatus = userToStatusChange.status === CommonStatus.ACTIVE ? CommonStatus.INACTIVE : CommonStatus.ACTIVE;
        try {
            await db.updateUserProfile(userToStatusChange.id, { status: newStatus });
            setUsers(prev => prev.map(u => u.id === userToStatusChange.id ? { ...u, status: newStatus } : u));
            notify(t('admin.users.status_update'), 'success');
            // Refresh stats
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setUserToStatusChange(null);
        }
    };
    const handleDeleteClick = (user: User) => setUserToDelete(user);
    const confirmDelete = async () => {
        if (!userToDelete) return;
        if (userToDelete.id === currentUser?.id) {
            notify(t('admin.users.self_delete_error'), 'error');
            setUserToDelete(null);
            return;
        }
        try {
            await db.deleteUser(userToDelete.id);
            // Keep the cached team size in step while filters are active (an unfiltered refetch overwrites it).
            setTeamTotal(n => (n == null ? n : Math.max(0, n - 1)));
            notify(t('admin.users.delete_success'), 'success');
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setUserToDelete(null);
        }
    };
    const handleResendInvite = async (user: User) => {
        setResendingId(user.id);
        try {
            await db.resendInvite(user.id);
            notify(t('admin.users.invite_sent', { email: user.email }), 'success');
        } catch (e: any) {
            notify(e.message || t('common.error'), 'error');
        } finally {
            setResendingId(null);
        }
    };
    const handleInviteConfirm = async (data: InviteFormData) => {
        await db.inviteUser({ name: data.name, email: data.email, role: data.role, phone: data.phone || undefined, departmentId: data.departmentId });
        setTeamTotal(n => (n == null ? n : n + 1));
        notify(t('admin.users.invite_sent', { email: data.email }), 'success');
        fetchData();
    };
    const handleDepartmentChange = async (userId: string, newDeptId: string) => {
        const departmentId = newDeptId || null;
        const prev = users;
        setUsers(p => p.map(u => u.id === userId ? {
            ...u,
            departmentId,
            departmentName: departments.find(d => d.id === newDeptId)?.name || null,
        } : u));
        try {
            await db.updateUserProfile(userId, { departmentId });
        } catch (e: any) {
            setUsers(prev);
            notify(e.message || t('common.error'), 'error');
        }
    };
    const departmentOptions = useMemo(() => [
        { value: '', label: t('adminusers.v2_not_selected') },
        ...departments.map(d => ({ value: d.id, label: d.name })),
    ], [departments, t]);
    const roleOptions = useMemo(() => [
        { value: 'ALL', label: t('admin.users.all_roles') },
        ...Object.values(UserRole)
            .filter(r => currentUser?.role === UserRole.SUPER_ADMIN || r !== UserRole.SUPER_ADMIN)
            .map(r => ({ value: r, label: t(`role.${r}`) }))
    ], [t, currentUser?.role]);
    const statusOptions = useMemo(() => [
        { value: 'ALL', label: t('admin.users.all_statuses') },
        { value: CommonStatus.ACTIVE, label: t('admin.users.status_active') },
        { value: CommonStatus.PENDING, label: t('admin.users.status_pending') },
        { value: CommonStatus.INACTIVE, label: t('admin.users.status_inactive') },
        { value: CommonStatus.DEACTIVATED, label: t('admin.users.status_deactivated') },
        { value: CommonStatus.ARCHIVED, label: t('admin.users.status_archived') },
    ], [t]);
    const userRoleOptions = useMemo(() =>
        Object.values(UserRole)
            .filter(r => currentUser?.role === UserRole.SUPER_ADMIN || r !== UserRole.SUPER_ADMIN)
            .map(r => ({ value: r, label: t(`role.${r}`) }))
    , [t, currentUser?.role]);

    // --- Derived KPIs & visuals ---
    const hasFilters = !!debouncedSearch || roleFilter !== 'ALL' || statusFilter !== 'ALL';
    // stats.activeCount / pendingCount are tenant-wide (unfiltered) counts from the API.
    const otherCount = hasLoaded && teamTotal != null
        ? Math.max(0, teamTotal - stats.activeCount - stats.pendingCount)
        : null;
    const activeShare = hasLoaded && teamTotal ? Math.round((stats.activeCount / teamTotal) * 100) : null;
    const statusSegments: Segment[] = otherCount == null ? [] : [
        { label: t('admin.users.status_active'), value: stats.activeCount, color: TONE_COLOR.success },
        { label: t('admin.users.status_pending'), value: stats.pendingCount, color: TONE_COLOR.warning },
        { label: t('adminusers.v2_kpi_other'), value: otherCount, color: TONE_COLOR.neutral },
    ];
    // Role and sign-in charts only see the loaded page; label the scope honestly.
    const pageIsWholeTeam = !hasFilters && users.length > 0 && users.length >= totalUsers;
    const pageScopeLabel = pageIsWholeTeam
        ? t('adminusers.v2_scope_org')
        : t('adminusers.v2_scope_page', { n: users.length });
    const roleSegments: Segment[] = useMemo(() => {
        const counts = new Map<string, number>();
        users.forEach(u => counts.set(u.role, (counts.get(u.role) || 0) + 1));
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([role, value], i) => ({ label: t(`role.${role}`), value, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
    }, [users, t]);
    const activitySegments: Segment[] = useMemo(() => {
        const now = Date.now();
        let week = 0, month = 0, older = 0, never = 0;
        users.forEach(u => {
            const ts = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : NaN;
            if (!Number.isFinite(ts)) { never++; return; }
            const age = now - ts;
            if (age <= 7 * DAY_MS) week++;
            else if (age <= 30 * DAY_MS) month++;
            else older++;
        });
        return [
            { label: t('adminusers.v2_activity_7d'), value: week, color: TONE_COLOR.success },
            { label: t('adminusers.v2_activity_30d'), value: month, color: TONE_COLOR.info },
            { label: t('adminusers.v2_activity_older'), value: older, color: TONE_COLOR.neutral },
            { label: t('admin.users.never_logged_in'), value: never, color: TONE_COLOR.warning },
        ];
    }, [users, t]);

    const clearFilters = () => {
        setSearch('');
        setDebouncedSearch('');
        setRoleFilter('ALL');
        setStatusFilter('ALL');
    };
    const toggleStatusFilter = (status: CommonStatus) =>
        setStatusFilter(prev => (prev === status ? 'ALL' : status));
    const kpi = (n: number | null) => (hasLoaded && n != null ? n.toLocaleString() : '—');

    // Sortable header cell (rendered via call, not as a component, to avoid remounts).
    const renderSortHeader = (field: string, label: string, className = '') => {
        const activeSort = sort.field === field;
        return (
            <th
                scope="col"
                className={`px-4 py-3 ${className}`}
                aria-sort={activeSort ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
                <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="-mx-2 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 font-semibold hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                >
                    {label}
                    {activeSort && (
                        <span className={`text-[var(--sgs-primary)] transition-transform ${sort.order === 'desc' ? 'rotate-180' : ''}`} aria-hidden="true">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
                        </span>
                    )}
                </button>
            </th>
        );
    };

    // Status pill: clickable toggle for others, static for the current user.
    const renderStatus = (user: User) => {
        const label = t(`admin.users.status_${user.status.toLowerCase()}`);
        const badge = <StatusBadge tone={STATUS_TONE[user.status] || 'neutral'}>{label}</StatusBadge>;
        if (user.id === currentUser?.id) return <span className="inline-flex whitespace-nowrap">{badge}</span>;
        return (
            <button
                type="button"
                onClick={() => setUserToStatusChange(user)}
                className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                aria-label={t('adminusers.v2_change_status_aria', { name: user.name, status: label })}
                title={label}
            >
                {badge}
            </button>
        );
    };

    if (!loading && currentUser && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
        return (
            <SettingsPage width="narrow">
                <SettingsCard>
                    <EmptyState icon={ICONS.LOCK} title={t('common.access_denied')} description={t('admin.users.no_permission')} />
                </SettingsCard>
            </SettingsPage>
        );
    }
    return (
        <>
            <SeoHead title={t('adminusers.v2_seo_title')} description={t('adminusers.v2_seo_description')} canonicalPath="/admin/users" />
            <SettingsPage>
                <SettingsHeader
                    icon={ICONS.USERS}
                    title={t('adminusers.v2_title')}
                    description={t('adminusers.v2_description')}
                    actions={
                        <button type="button" onClick={() => setIsInviteOpen(true)} className="ui-button ui-button-primary ui-button-md inline-flex min-h-[40px] items-center gap-2">
                            {ICONS.ADD}
                            <span>{t('admin.users.invite')}</span>
                        </button>
                    }
                />

                {/* KPI tiles — active/pending double as quick status filters */}
                <StatGrid cols={4}>
                    <StatTile
                        label={hasFilters ? t('adminusers.v2_kpi_matching') : t('adminusers.v2_kpi_total')}
                        value={kpi(totalUsers)}
                        hint={hasFilters ? t('adminusers.v2_kpi_show_all') : t('adminusers.v2_scope_org')}
                        tone="brand"
                        onClick={hasFilters ? clearFilters : undefined}
                    />
                    <StatTile
                        label={t('admin.users.active_users')}
                        value={kpi(stats.activeCount)}
                        hint={activeShare != null ? t('adminusers.v2_kpi_active_share', { n: activeShare }) : t('adminusers.v2_kpi_filter_hint')}
                        tone="success"
                        onClick={() => toggleStatusFilter(CommonStatus.ACTIVE)}
                        active={statusFilter === CommonStatus.ACTIVE}
                    />
                    <StatTile
                        label={t('admin.users.pending_invites')}
                        value={kpi(stats.pendingCount)}
                        hint={t('adminusers.v2_kpi_filter_hint')}
                        tone="accent"
                        onClick={() => toggleStatusFilter(CommonStatus.PENDING)}
                        active={statusFilter === CommonStatus.PENDING}
                    />
                    <StatTile
                        label={t('adminusers.v2_kpi_other')}
                        value={kpi(otherCount)}
                        hint={t('adminusers.v2_kpi_other_hint')}
                    />
                </StatGrid>

                {/* Team visuals */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SettingsCard title={t('adminusers.v2_status_card_title')} description={t('adminusers.v2_scope_org')}>
                        {statusSegments.length > 0 ? (
                            <DistributionBar segments={statusSegments} ariaLabel={t('adminusers.v2_status_chart_aria')} emptyText={t('adminusers.v2_no_data')} />
                        ) : (
                            <p className="py-2 text-xs text-[var(--text-tertiary)]">{t('adminusers.v2_no_data')}</p>
                        )}
                    </SettingsCard>
                    <SettingsCard title={t('adminusers.v2_roles_card_title')} description={pageScopeLabel}>
                        <DistributionBar segments={roleSegments} ariaLabel={t('adminusers.v2_roles_chart_aria', { scope: pageScopeLabel })} emptyText={t('adminusers.v2_no_data')} />
                    </SettingsCard>
                    <SettingsCard title={t('adminusers.v2_activity_card_title')} description={pageScopeLabel}>
                        <DistributionBar segments={activitySegments} ariaLabel={t('adminusers.v2_activity_chart_aria', { scope: pageScopeLabel })} emptyText={t('adminusers.v2_no_data')} />
                    </SettingsCard>
                </div>

                {/* Member list */}
                <SettingsCard title={t('adminusers.v2_list_title')} bodyClassName="p-0">
                    {/* Filters bar */}
                    <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5" role="search" aria-label={t('adminusers.v2_filters_aria')}>
                        <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-tertiary)]">
                                {ICONS.SEARCH}
                            </div>
                            <input
                                type="search"
                                className="ui-input h-10 w-full pl-10 pr-10"
                                placeholder={t('admin.users.search_placeholder')}
                                aria-label={t('admin.users.search_placeholder')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <div className="absolute inset-y-0 right-0 flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className={ICON_BTN}
                                        aria-label={t('common.clear_search')}
                                        title={t('common.clear_search')}
                                    >
                                        {ICONS.X}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                            <div className="min-w-0 sm:w-44">
                                <Dropdown value={roleFilter} onChange={(v) => setRoleFilter(v as string)} options={roleOptions} variant="compact" emptyValue="ALL" />
                            </div>
                            <div className="min-w-0 sm:w-40">
                                <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as string)} options={statusOptions} variant="compact" emptyValue="ALL" />
                            </div>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto" aria-busy={loading}>
                        <table className="w-full text-left text-sm" aria-label={t('adminusers.v2_list_title')}>
                            <thead className="bg-[var(--glass-surface)] text-xs text-[var(--text-secondary)]">
                                <tr>
                                    {renderSortHeader('name', t('table.name'))}
                                    {renderSortHeader('role', t('table.role'), 'hidden sm:table-cell')}
                                    <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">{t('adminusers.v2_department')}</th>
                                    {renderSortHeader('status', t('table.status'), 'hidden sm:table-cell')}
                                    {renderSortHeader('lastLoginAt', t('table.last_active'), 'hidden md:table-cell')}
                                    <th scope="col" className="px-4 py-3 text-right font-semibold">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {users.map(user => {
                                    const isPending = user.status === CommonStatus.PENDING;
                                    const isSelf = user.id === currentUser?.id;
                                    return (
                                        <tr key={user.id} className="group transition-colors hover:bg-[var(--glass-surface)]">
                                            <td className="px-3 py-3 sm:px-4">
                                                <div className="flex items-start gap-3">
                                                    <img
                                                        src={user.avatar || avatarFallback(user.name)}
                                                        onError={e => { (e.currentTarget as HTMLImageElement).src = avatarFallback(user.name); }}
                                                        className="h-9 w-9 shrink-0 rounded-full border border-[var(--glass-border)] object-cover sm:h-10 sm:w-10"
                                                        alt=""
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                                                            <span className="max-w-[160px] truncate sm:max-w-[220px]">{user.name}</span>
                                                            {isSelf && <StatusBadge tone="info">{t('admin.users.you')}</StatusBadge>}
                                                        </div>
                                                        <div className="max-w-[160px] truncate text-xs text-[var(--text-tertiary)] sm:max-w-[220px]">{user.email}</div>
                                                        {/* Mobile: role + status stacked under the name */}
                                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
                                                            {isSelf ? (
                                                                <StatusBadge tone="neutral">{t(`role.${user.role}`)}</StatusBadge>
                                                            ) : (
                                                                <div className="w-40">
                                                                    <Dropdown
                                                                        value={user.role}
                                                                        onChange={(v) => handleRoleChange(user.id, v as UserRole)}
                                                                        options={userRoleOptions}
                                                                        variant="compact"
                                                                    />
                                                                </div>
                                                            )}
                                                            {renderStatus(user)}
                                                        </div>
                                                        <div className="mt-1 text-2xs text-[var(--text-tertiary)] md:hidden">
                                                            {t('table.last_active')}: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t('admin.users.never_logged_in')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 sm:table-cell">
                                                <div className="w-40 lg:w-48">
                                                    <Dropdown
                                                        value={user.role}
                                                        onChange={(v) => handleRoleChange(user.id, v as UserRole)}
                                                        options={userRoleOptions}
                                                        disabled={isSelf}
                                                        className="text-xs"
                                                        variant="compact"
                                                    />
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 lg:table-cell">
                                                <div className="w-40">
                                                    <Dropdown
                                                        value={user.departmentId || ''}
                                                        onChange={(v) => handleDepartmentChange(user.id, v as string)}
                                                        options={departmentOptions}
                                                        disabled={departments.length === 0}
                                                        className="text-xs"
                                                        variant="compact"
                                                        placeholder={departments.length === 0 ? t('adminusers.v2_no_departments') : t('adminusers.v2_not_selected')}
                                                    />
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 sm:table-cell">
                                                {renderStatus(user)}
                                            </td>
                                            <td className="hidden whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--text-secondary)] md:table-cell">
                                                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-[var(--text-tertiary)]">{t('admin.users.never_logged_in')}</span>}
                                            </td>
                                            <td className="px-2 py-3 text-right sm:px-4">
                                                <div className="flex justify-end gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                                    {/* View performance — only for non-pending users with lead-bearing roles */}
                                                    {!isPending && [UserRole.SALES, UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPerfUser(user)}
                                                            className={`${ICON_BTN} hover:text-sgs-primary`}
                                                            aria-label={`${t('admin.users.view_perf')}: ${user.name}`}
                                                            title={t('admin.users.view_perf')}
                                                        >
                                                            {ICONS.CHART}
                                                        </button>
                                                    )}
                                                    {/* Resend invite — pending users only */}
                                                    {isPending && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResendInvite(user)}
                                                            disabled={resendingId === user.id}
                                                            className={`${ICON_BTN} hover:text-sgs-primary`}
                                                            aria-label={`${t('admin.users.resend')}: ${user.email}`}
                                                            title={t('admin.users.resend')}
                                                        >
                                                            {resendingId === user.id ? (
                                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--glass-border)] border-t-[var(--sgs-primary)]" aria-hidden="true" />
                                                            ) : (
                                                                ICONS.SEND
                                                            )}
                                                        </button>
                                                    )}
                                                    {!isSelf && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteClick(user)}
                                                            className={`${ICON_BTN} hover:text-[var(--ui-danger)]`}
                                                            aria-label={`${t('admin.users.delete')}: ${user.name}`}
                                                            title={t('admin.users.delete')}
                                                        >
                                                            {ICONS.TRASH}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {users.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6}>
                                            <EmptyState icon={ICONS.USERS} title={t('admin.users.empty_search')} />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-[var(--glass-border)] px-3 py-2 sm:px-5">
                        <PaginationControl
                            page={page}
                            total={totalUsers}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }}
                            t={t}
                        />
                    </div>
                </SettingsCard>
            </SettingsPage>

            {/* Performance modal */}
            {perfUser && (
                <PerformanceModal
                    user={perfUser}
                    onClose={() => setPerfUser(null)}
                    t={t}
                />
            )}
            {/* Invite modal */}
            <InviteUserModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                onConfirm={handleInviteConfirm}
                t={t}
                callerRole={currentUser?.role}
                departments={departments}
            />
            {/* Delete confirmation */}
            <ConfirmModal
                isOpen={!!userToDelete}
                title={t('common.delete')}
                message={t('admin.users.confirm_delete', { email: userToDelete?.email || '' })}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmDelete}
                onCancel={() => setUserToDelete(null)}
                variant="danger"
            />
            {/* Status change confirmation */}
            <ConfirmModal
                isOpen={!!userToStatusChange}
                title={t('common.confirm')}
                message={userToStatusChange?.status === CommonStatus.ACTIVE
                    ? t('admin.users.confirm_deactivate', { name: userToStatusChange?.name ?? '' })
                    : t('admin.users.confirm_activate', { name: userToStatusChange?.name ?? '' })}
                confirmLabel={userToStatusChange?.status === CommonStatus.ACTIVE ? t('common.disabled') : t('common.enabled')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmStatusChange}
                onCancel={() => setUserToStatusChange(null)}
                variant={userToStatusChange?.status === CommonStatus.ACTIVE ? 'danger' : 'info'}
            />
            {/* Role change confirmation */}
            {userToRoleChange && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="role-change-title">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setUserToRoleChange(null)} aria-hidden="true" />
                    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-2xl animate-scale-up">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 id="role-change-title" className="text-lg font-bold text-[var(--text-primary)]">{t('common.confirm')}</h3>
                            <button type="button" onClick={() => setUserToRoleChange(null)} className={ICON_BTN} aria-label={t('adminusers.v2_close')}>
                                {ICONS.CLOSE}
                            </button>
                        </div>
                        <p className="mb-4 text-sm text-[var(--text-secondary)]">
                            {t('admin.users.confirm_role_change', { name: userToRoleChange.user.name, role: t(`role.${userToRoleChange.newRole}`) })}
                        </p>
                        <div className="mb-5">
                            <RolePermissionsHint role={userToRoleChange.newRole} t={t} />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setUserToRoleChange(null)} className="ui-button ui-button-secondary ui-button-md inline-flex min-h-[44px] flex-1 items-center justify-center">
                                {t('common.cancel')}
                            </button>
                            <button type="button" onClick={confirmRoleChange} className="ui-button ui-button-primary ui-button-md inline-flex min-h-[44px] flex-1 items-center justify-center">
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {createPortal(
                toast ? (
                    <div role="status" aria-live="polite" className={`fixed bottom-6 left-4 right-4 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-white shadow-2xl animate-enter sm:left-auto sm:right-6 ${toast.type === 'success' ? 'bg-[var(--sgs-primary-deep)] border-[var(--sgs-primary)]' : 'bg-[#8B2E2E] border-[#C0392B]'}`}>
                        <span className="text-sm font-semibold">{toast.msg}</span>
                    </div>
                ) : null,
                document.body
            )}
        </>
    );
};
