
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { api } from '../services/api';
import { User, UserRole, CommonStatus, Department } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';

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

function getRoleBadgeClass(role: string): string {
    switch (role) {
        case 'ADMIN':          return 'bg-rose-50 text-rose-700 border border-rose-200';
        case 'TEAM_LEAD':      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
        case 'SALES':          return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        case 'MARKETING':      return 'bg-amber-50 text-amber-700 border border-amber-200';
        case 'SUPPORTER':      return 'bg-sky-50 text-sky-700 border border-sky-200';
        case 'VIEWER':         return 'bg-slate-100 text-slate-600 border border-slate-200';
        case 'PARTNER_ADMIN':  return 'bg-violet-50 text-violet-700 border border-violet-200';
        case 'PARTNER_AGENT':  return 'bg-purple-50 text-purple-700 border border-purple-200';
        default:               return 'bg-[var(--glass-surface)] text-[var(--text-secondary)] border border-[var(--glass-border)]';
    }
}

const ICONS = {
    SEARCH: <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    SEND: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    INFO: <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SORT: <svg className="w-3 h-3 ml-1 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CHART: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
};

// --- SUB-COMPONENT: PAGINATION ---
const PaginationControl = memo(({ page, total, pageSize, onPageChange, onPageSizeChange, t }: any) => {
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    return (
        <>
            {/* Mobile: slim icon-only bar */}
            <div className="flex sm:hidden items-center w-fit mx-auto gap-3 px-4 py-1.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] shadow-sm">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-bold text-[var(--text-primary)] min-w-[56px] text-center">{page} / {totalPages || 1}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages || total === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Desktop: full bar */}
            <div className="hidden sm:flex flex-row justify-between items-center px-4 py-1.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] shadow-sm gap-2">
                <div className="flex text-xs text-[var(--text-tertiary)] font-medium items-center gap-1">
                    <span>{t('pagination.showing')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{total > 0 ? start : 0}-{end}</span>
                    <span>{t('pagination.of')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{total}</span>
                    <span>{t('pagination.results')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="min-w-[60px] mr-1">
                        <Dropdown
                            value={pageSize}
                            onChange={(v) => onPageSizeChange(Number(v))}
                            options={[10, 20, 50, 100].map(n => ({ value: n, label: String(n) }))}
                            className="text-xs"
                            placement="top"
                        />
                    </div>
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                    >
                        {t('pagination.prev')}
                    </button>
                    <div className="flex items-center gap-1 px-1">
                        <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{page} / {totalPages || 1}</span>
                    </div>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page === totalPages || total === 0}
                        className="px-3 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                    >
                        {t('pagination.next')}
                    </button>
                </div>
            </div>
        </>
    );
});

// --- SUB-COMPONENT: PERFORMANCE MODAL ---
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

    const slaColor = data
        ? data.slaScore >= 90 ? 'text-emerald-500' : data.slaScore >= 70 ? 'text-indigo-500' : 'text-amber-500'
        : 'text-[var(--text-secondary)]';
    const slaLabelColor = data
        ? data.slaScore >= 90 ? 'text-emerald-600 dark:text-emerald-400' : data.slaScore >= 70 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
        : '';
    const circumference = 2 * Math.PI * 50;

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="relative z-10 bg-[var(--bg-surface)] w-full max-w-xl rounded-[24px] shadow-2xl border border-[var(--glass-border)] animate-scale-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--glass-border)] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=6366f1&color=fff`}
                            onError={e => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=6366f1&color=fff`; }}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--glass-border)] shrink-0"
                            alt={user.name}
                        />
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-[var(--text-primary)] truncate">{t('admin.users.perf_modal_title', { name: user.name })}</h3>
                            <p className="text-xs text-[var(--text-tertiary)] truncate">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] transition-colors shrink-0 ml-2">
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 py-5 space-y-5 no-scrollbar">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-sm text-[var(--text-secondary)]">{t('profile.perf_loading')}</p>
                        </div>
                    )}
                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <p className="text-sm font-bold text-rose-600">{t('admin.users.perf_error')}</p>
                        </div>
                    )}
                    {!loading && !error && !data && (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <p className="text-sm text-[var(--text-secondary)]">{t('admin.users.perf_no_data')}</p>
                        </div>
                    )}
                    {!loading && !error && data && (
                        <>
                            {/* SLA Ring */}
                            <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-5 flex items-center gap-6">
                                <div className="relative shrink-0 w-24 h-24">
                                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--glass-border)" strokeWidth="10" />
                                        <circle
                                            cx="60" cy="60" r="50" fill="none"
                                            stroke="currentColor"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            className={slaColor}
                                            strokeDasharray={`${circumference}`}
                                            strokeDashoffset={`${circumference * (1 - data.slaScore / 100)}`}
                                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-2xl font-extrabold ${slaColor}`}>{data.slaScore}</span>
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{t('profile.perf_sla')}</p>
                                    <p className={`text-xl font-extrabold mb-1 ${slaLabelColor}`}>
                                        {data.slaScore >= 90 ? t('profile.perf_sla_excellent') : data.slaScore >= 70 ? t('profile.perf_sla_good') : t('profile.perf_sla_needs_work')}
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                        {t('profile.perf_close_rate')}: <span className="font-bold text-[var(--text-primary)]">{data.closeRate}%</span>
                                        {data.avgResponseMinutes != null && (
                                            <> · {t('profile.perf_avg_resp')}: <span className="font-bold text-[var(--text-primary)]">{data.avgResponseMinutes} {t('dash.minutes')}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Lead KPIs */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">{t('profile.perf_lead_section')}</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Deals */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_deals')}</p>
                                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.deals}</p>
                                    </div>
                                    {/* Close Rate */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_close_rate')}</p>
                                        <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{data.closeRate}<span className="text-sm font-bold">%</span></p>
                                        <p className="text-2xs text-[var(--text-secondary)] mt-1">{t('profile.perf_close_formula')}</p>
                                    </div>
                                    {/* Revenue */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_revenue')}</p>
                                        <p className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                                            {data.revenue >= 1e9
                                                ? `${(data.revenue / 1e9).toFixed(1)} ${t('profile.perf_billion')}`
                                                : data.revenue >= 1e6
                                                ? `${(data.revenue / 1e6).toFixed(0)} ${t('profile.perf_million')}`
                                                : data.revenue.toLocaleString()}
                                        </p>
                                        <p className="text-2xs text-[var(--text-secondary)] mt-1">VND</p>
                                    </div>
                                    {/* Total Leads */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_total_leads')}</p>
                                        <p className="text-2xl font-extrabold text-[var(--text-primary)]">{data.totalLeads}</p>
                                    </div>
                                    {/* In Progress */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_in_progress')}</p>
                                        <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{data.inProgress}</p>
                                    </div>
                                    {/* Lost */}
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_lost')}</p>
                                        <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{data.lost}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Workload */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">{t('profile.perf_task_section')}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={`rounded-2xl p-4 border ${data.activeTasks > 5 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' : 'bg-[var(--glass-surface)] border-[var(--glass-border)]'}`}>
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_tasks_active')}</p>
                                        <p className="text-2xl font-extrabold text-[var(--text-primary)]">{data.activeTasks}</p>
                                    </div>
                                    <div className={`rounded-2xl p-4 border ${data.overdueTasks > 0 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40' : 'bg-[var(--glass-surface)] border-[var(--glass-border)]'}`}>
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_tasks_overdue')}</p>
                                        <p className={`text-2xl font-extrabold ${data.overdueTasks > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>{data.overdueTasks}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_tasks_week')}</p>
                                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.completedThisWeek}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{t('profile.perf_tasks_month')}</p>
                                        <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{data.completedThisMonth}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

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
        `w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 transition-all bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
        ${errors[field] ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-400' : 'border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500'}`;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            {/* Card */}
            <div className="relative z-10 w-full sm:max-w-sm bg-[var(--bg-surface)] rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-[var(--glass-border)] animate-scale-up flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 48px)' }}>

                {/* Header — cố định, không cuộn */}
                <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('admin.users.invite_title')}</h3>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('admin.users.invite_hint')}</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--glass-surface-hover)] transition-colors">
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Body — cuộn được */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6">
                    {errors.submit && (
                        <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600 font-medium">
                            {errors.submit}
                        </div>
                    )}

                    <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Họ tên */}
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1.5">
                                {t('admin.users.name_label')} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={inputCls('name')}
                                placeholder={t('common.placeholder_fullname')}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                            />
                            {errors.name && <p className="text-xs text-rose-500 font-medium mt-1">{errors.name}</p>}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1.5">
                                {t('admin.users.email_label')} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                className={inputCls('email')}
                                placeholder={t('admin.users.placeholder_email')}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                            {errors.email && <p className="text-xs text-rose-500 font-medium mt-1">{errors.email}</p>}
                        </div>

                        {/* Số điện thoại (optional) */}
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1.5 flex items-center gap-1">
                                {t('admin.users.phone_label')}
                                <span className="text-3xs font-normal text-[var(--text-muted)] normal-case">{t('admin.users.phone_optional')}</span>
                            </label>
                            <input
                                type="tel"
                                className={inputCls('phone')}
                                placeholder={t('common.placeholder_phone')}
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                            {errors.phone && <p className="text-xs text-rose-500 font-medium mt-1">{errors.phone}</p>}
                        </div>

                        {/* Phòng ban */}
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1.5 flex items-center gap-1">
                                Phòng ban
                                <span className="text-3xs font-normal text-[var(--text-muted)] normal-case">(tuỳ chọn)</span>
                            </label>
                            <Dropdown
                                value={departmentId}
                                onChange={(v) => setDepartmentId(v as string)}
                                options={[
                                    { value: '', label: departments.length === 0 ? 'Chưa có phòng ban' : 'Chưa chọn' },
                                    ...departments.map(d => ({ value: d.id, label: d.name })),
                                ]}
                                disabled={departments.length === 0}
                                className="w-full"
                                placement="top"
                            />
                        </div>

                        {/* Vai trò */}
                        <div className="pb-2">
                            <Dropdown
                                label={t('admin.users.role_label')}
                                value={role}
                                onChange={(v) => setRole(v as UserRole)}
                                options={roleOptions}
                                className="w-full"
                                placement="top"
                            />
                            <div className="mt-2 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex gap-2">
                                <div className="shrink-0 mt-0.5">{ICONS.INFO}</div>
                                <div>
                                    <h4 className="text-xs2 font-bold text-indigo-700 uppercase tracking-wide mb-0.5">{t('admin.users.role_permissions')}</h4>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                        {t(`role_desc.${role}`)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer — cố định, luôn hiển thị */}
                <div className="px-6 pt-3 pb-6 sm:pb-4 shrink-0 border-t border-[var(--glass-border)]">
                    <button
                        type="submit"
                        form="invite-user-form"
                        disabled={loading || !name.trim() || !email.trim()}
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-slate-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {loading
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    
    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState({ activeCount: 0, pendingCount: 0 });
    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<{ field: string, order: 'asc' | 'desc' }>({ field: 'createdAt', order: 'desc' });

    // Modals & Action States
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
        { value: '', label: 'Chưa chọn' },
        ...departments.map(d => ({ value: d.id, label: d.name })),
    ], [departments]);

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

    // Header Helper
    const SortableHeader = ({ field, label, className = "" }: { field: string, label: string, className?: string }) => (
        <th 
            className={`p-4 cursor-pointer hover:bg-[var(--glass-surface-hover)] transition-colors select-none ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sort.field === field && (
                    <span className={`text-indigo-500 transition-transform ${sort.order === 'desc' ? 'rotate-180' : ''}`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                    </span>
                )}
            </div>
        </th>
    );

    if (!loading && currentUser && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.TEAM_LEAD) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    {ICONS.INFO}
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('common.access_denied')}</h2>
                <p className="text-[var(--text-tertiary)] max-w-md">
                    {t('admin.users.no_permission')}
                </p>
            </div>
        );
    }

    return (
        <>
        <div className="h-full flex flex-col relative animate-enter">

            {/* HEADER */}
            <div className="flex flex-col bg-[var(--bg-surface)] border-b border-[var(--glass-border)] shrink-0">

                {/* Row 1: Số liệu thành viên + nút mời */}
                <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 pb-3">
                    {/* Stat chips — compact on mobile, full label on sm+ */}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {/* Tổng */}
                        <div className="flex items-center gap-1 sm:gap-1.5 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-lg px-2 sm:px-3 py-1.5 shrink-0">
                            <span className="text-2xs sm:text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-wide">{t('admin.users.total')}</span>
                            <span className="text-xs sm:text-sm font-black text-[var(--text-primary)]">{totalUsers}</span>
                        </div>
                        {/* Hoạt động */}
                        <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2 sm:px-3 py-1.5 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="hidden sm:inline text-xs2 font-bold text-emerald-600 uppercase tracking-wide">{t('admin.users.active_users')}</span>
                            <span className="sm:hidden text-2xs font-bold text-emerald-600 uppercase">{t('admin.users.mobile_active')}</span>
                            <span className="text-xs sm:text-sm font-black text-emerald-700">{stats.activeCount}</span>
                        </div>
                        {/* Chờ duyệt */}
                        <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 sm:px-3 py-1.5 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                            <span className="hidden sm:inline text-xs2 font-bold text-amber-600 uppercase tracking-wide">{t('admin.users.pending_invites')}</span>
                            <span className="sm:hidden text-2xs font-bold text-amber-600 uppercase">{t('admin.users.mobile_pending')}</span>
                            <span className="text-xs sm:text-sm font-black text-amber-700">{stats.pendingCount}</span>
                        </div>
                    </div>

                    {/* Nút mời thành viên */}
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="shrink-0 px-3 sm:px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:bg-slate-800 transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap active:scale-95 min-h-[36px]"
                    >
                        {ICONS.ADD}
                        <span className="hidden sm:inline">{t('admin.users.invite')}</span>
                        <span className="sm:hidden">{t('admin.users.invite_short')}</span>
                    </button>
                </div>

                {/* Row 2: Thanh tìm kiếm + bộ lọc vai trò */}
                <div className="flex items-center gap-3 px-4 sm:px-5 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-surface)]/50">
                    {/* Ô tìm kiếm — kéo dài toàn bộ chiều ngang còn lại */}
                    <div className="relative flex-1 group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input
                            className="w-full pl-10 pr-10 py-2 min-h-[40px] bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none placeholder:text-[var(--text-muted)] shadow-sm"
                            placeholder={t('admin.users.search_placeholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('common.clear_search')}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Dropdown lọc vai trò */}
                    <div className="w-32 sm:w-44 shrink-0">
                        <Dropdown value={roleFilter} onChange={(v) => setRoleFilter(v as string)} options={roleOptions} className="text-xs" />
                    </div>
                    {/* Dropdown lọc trạng thái */}
                    <div className="w-28 sm:w-36 shrink-0">
                        <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as string)} options={statusOptions} className="text-xs" />
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto bg-[var(--glass-surface)]/50 no-scrollbar pt-3 px-3 sm:px-0">
                <div className="w-full overflow-x-auto no-scrollbar bg-[var(--bg-surface)] rounded-xl sm:rounded-none border border-[var(--glass-border)] sm:border-0 sm:border-b">
                    <table className="w-full min-w-[320px] text-left text-sm">
                        <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <SortableHeader field="name" label={t('table.name')} />
                                <SortableHeader field="role" label={t('table.role')} className="hidden sm:table-cell" />
                                <th className="hidden lg:table-cell p-4 select-none">Phòng ban</th>
                                <SortableHeader field="status" label={t('table.status')} />
                                <SortableHeader field="lastLoginAt" label={t('table.last_active')} className="hidden md:table-cell" />
                                <th className="p-4 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {users.map(user => {
                                const isPending = user.status === CommonStatus.PENDING;
                                
                                return (
                                    <tr key={user.id} className="hover:bg-[var(--glass-surface)] transition-colors group">
                                        <td className="p-3 sm:p-4">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <img
                                                    src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=6366f1&color=fff`}
                                                    onError={e => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=6366f1&color=fff`; }}
                                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-[var(--glass-border)] shrink-0"
                                                    alt={user.name}
                                                    aria-label={user.name}
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5 flex-wrap">
                                                        <span className="truncate max-w-[140px] sm:max-w-[200px] text-xs sm:text-sm">{user.name}</span>
                                                        {user.id === currentUser?.id && <span className="text-3xs sm:text-2xs bg-indigo-100 text-indigo-700 px-1 sm:px-1.5 py-0.5 rounded shrink-0">{t('admin.users.you')}</span>}
                                                    </div>
                                                    <div className="text-xs2 sm:text-xs text-[var(--text-tertiary)] truncate max-w-[140px] sm:max-w-[200px]">{user.email}</div>
                                                    {/* Role selector on mobile — interactive dropdown */}
                                                    <div className="sm:hidden mt-1.5" onClick={e => e.stopPropagation()}>
                                                        {user.id === currentUser?.id ? (
                                                            <span className={`inline-flex items-center text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${getRoleBadgeClass(user.role)}`}>
                                                                {t(`role.${user.role}`)}
                                                            </span>
                                                        ) : (
                                                            <Dropdown
                                                                value={user.role}
                                                                onChange={(v) => handleRoleChange(user.id, v as UserRole)}
                                                                options={userRoleOptions}
                                                                disabled={user.id === currentUser?.id}
                                                                className="text-2xs"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden sm:table-cell p-4">
                                            <div className="w-40 lg:w-48" onClick={e => e.stopPropagation()}>
                                                <Dropdown 
                                                    value={user.role} 
                                                    onChange={(v) => handleRoleChange(user.id, v as UserRole)} 
                                                    options={userRoleOptions} 
                                                    disabled={user.id === currentUser?.id}
                                                    className="text-xs"
                                                />
                                            </div>
                                        </td>
                                        <td className="hidden lg:table-cell p-4">
                                            <div className="w-40" onClick={e => e.stopPropagation()}>
                                                <Dropdown
                                                    value={(user as any).departmentId || ''}
                                                    onChange={(v) => handleDepartmentChange(user.id, v as string)}
                                                    options={departmentOptions}
                                                    disabled={departments.length === 0}
                                                    className="text-xs"
                                                    placeholder={departments.length === 0 ? 'Chưa có' : 'Chưa chọn'}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-3 sm:p-4">
                                            <button 
                                                onClick={() => user.id !== currentUser?.id && setUserToStatusChange(user)}
                                                disabled={user.id === currentUser?.id}
                                                className={`px-2 sm:px-3 py-1 rounded-full text-2xs sm:text-xs2 font-bold uppercase border whitespace-nowrap text-center transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5
                                                    ${user.status === CommonStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 
                                                      user.status === CommonStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' :
                                                      user.status === CommonStatus.DEACTIVATED ? 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100' :
                                                      user.status === CommonStatus.ARCHIVED ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200' :
                                                      'bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] border-[var(--glass-border)] hover:bg-slate-200'}
                                                    ${user.id !== currentUser?.id ? 'cursor-pointer hover:shadow-sm' : 'cursor-default opacity-70'}
                                                `}
                                                title={t(`admin.users.status_${user.status.toLowerCase()}`)}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${user.status === CommonStatus.ACTIVE ? 'bg-emerald-500' : user.status === CommonStatus.PENDING ? 'bg-amber-500' : user.status === CommonStatus.DEACTIVATED ? 'bg-orange-400' : user.status === CommonStatus.ARCHIVED ? 'bg-slate-400' : 'bg-slate-400'}`}></span>
                                                {/* Mobile: short label | Desktop: full label */}
                                                <span className="sm:hidden">
                                                    {user.status === CommonStatus.ACTIVE ? t('admin.users.mobile_active') : user.status === CommonStatus.PENDING ? t('admin.users.mobile_pending') : user.status === CommonStatus.DEACTIVATED ? t('admin.users.mobile_deactivated') : user.status === CommonStatus.ARCHIVED ? t('admin.users.mobile_archived') : t('admin.users.mobile_inactive')}
                                                </span>
                                                <span className="hidden sm:inline">{t(`admin.users.status_${user.status.toLowerCase()}`)}</span>
                                            </button>
                                        </td>
                                        <td className="hidden md:table-cell p-4 text-[var(--text-tertiary)] font-mono text-xs">
                                            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-[var(--text-secondary)] italic">{t('admin.users.never_logged_in')}</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1 sm:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* View Performance — only for non-pending users with lead-bearing roles */}
                                                {!isPending && [UserRole.SALES, UserRole.TEAM_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) && (
                                                    <button
                                                        onClick={() => setPerfUser(user)}
                                                        className="p-1.5 sm:p-2 text-[var(--text-secondary)] hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                        title={t('admin.users.view_perf')}
                                                    >
                                                        {ICONS.CHART}
                                                    </button>
                                                )}
                                                {/* Only show Resend Invite if Pending */}
                                                {isPending && (
                                                    <button 
                                                        onClick={() => handleResendInvite(user)}
                                                        disabled={resendingId === user.id}
                                                        className="p-1.5 sm:p-2 text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative group/btn" 
                                                        title={t('admin.users.resend')}
                                                    >
                                                        {resendingId === user.id ? (
                                                            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                                        ) : (
                                                            ICONS.SEND
                                                        )}
                                                    </button>
                                                )}
                                                {user.id !== currentUser?.id && (
                                                    <button onClick={() => handleDeleteClick(user)} className="p-1.5 sm:p-2 text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title={t('admin.users.delete')}>
                                                        {ICONS.TRASH}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {users.length === 0 && !loading && (
                                <tr><td colSpan={6} className="p-12 text-center text-[var(--text-secondary)] italic">{t('admin.users.empty_search')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* FOOTER - Pagination */}
            <div className="shrink-0 py-2 px-4 sm:px-5">
                <PaginationControl 
                    page={page} 
                    total={totalUsers} 
                    pageSize={pageSize} 
                    onPageChange={setPage} 
                    onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }}
                    t={t}
                />
            </div>

            {/* Performance Modal */}
            {perfUser && (
                <PerformanceModal
                    user={perfUser}
                    onClose={() => setPerfUser(null)}
                    t={t}
                />
            )}

            {/* Invite Modal */}
            <InviteUserModal 
                isOpen={isInviteOpen} 
                onClose={() => setIsInviteOpen(false)} 
                onConfirm={handleInviteConfirm}
                t={t}
                callerRole={currentUser?.role}
                departments={departments}
            />

            {/* Delete Confirmation Modal */}
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

             {/* Status Change Confirmation Modal */}
             <ConfirmModal 
                isOpen={!!userToStatusChange}
                title={t('common.confirm')}
                message={userToStatusChange?.status === CommonStatus.ACTIVE 
                    ? t('admin.users.confirm_deactivate', { name: userToStatusChange?.name }) 
                    : t('admin.users.confirm_activate', { name: userToStatusChange?.name })}
                confirmLabel={userToStatusChange?.status === CommonStatus.ACTIVE ? t('common.disabled') : t('common.enabled')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmStatusChange}
                onCancel={() => setUserToStatusChange(null)}
                variant={userToStatusChange?.status === CommonStatus.ACTIVE ? 'danger' : 'info'}
            />

            {/* Role Change Confirmation Modal */}
            {userToRoleChange && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setUserToRoleChange(null)} />
                    <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('common.confirm')}</h3>
                            <button onClick={() => setUserToRoleChange(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)]">
                                {ICONS.CLOSE}
                            </button>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                            {t('admin.users.confirm_role_change', { name: userToRoleChange.user.name, role: t(`role.${userToRoleChange.newRole}`) })}
                        </p>
                        
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex gap-2 mb-6">
                            <div className="shrink-0 mt-0.5">{ICONS.INFO}</div>
                            <div>
                                <h4 className="text-xs2 font-bold text-indigo-700 uppercase tracking-wide mb-1">{t('admin.users.role_permissions')}</h4>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {t(`role_desc.${userToRoleChange.newRole}`)}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setUserToRoleChange(null)}
                                className="flex-1 py-2.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                onClick={confirmRoleChange}
                                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-colors"
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
        {createPortal(
            toast ? (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
