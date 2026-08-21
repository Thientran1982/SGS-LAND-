import React, { useEffect, useState, memo, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Line, ComposedChart, Legend, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../services/dbApi';
import { analyticsApi } from '../services/api/analyticsApi';
import { AnalyticsSummary } from '../types';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { DashboardSkeleton } from '../components/Skeleton';
import { GlassBento as BentoCard } from '../components/GlassBento';
import { Dropdown } from '../components/Dropdown';
import { useSocket, socket } from '../services/websocket';
import { SeoHead } from '../components/SeoHead';
// --- ICONS ---
const ICONS = {
    TREND_UP: <svg className="w-3 h-3 text-sgs-verified dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TREND_DOWN: <svg className="w-3 h-3 text-[var(--ui-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    REFRESH: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    CLOUD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    AI: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
    WARNING: <svg className="w-6 h-6 text-sgs-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    EMPTY: <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
};
// --- SUB-COMPONENTS ---
const TrendIndicator = ({ value, label }: { value: number; label: string }) => {
    const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
    const isPositive = safeValue >= 0;
    return (
        <div className={`flex items-center gap-1 text-xs2 font-bold uppercase tracking-wider ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isPositive ? ICONS.TREND_UP : ICONS.TREND_DOWN}
            <span>{Math.abs(safeValue)}%</span>
            <span className="text-[var(--text-tertiary)] dark:text-slate-400 font-medium normal-case ml-1">{label}</span>
        </div>
    );
};
/** Client-side locale-aware relative time formatter (replaces server-hardcoded Vietnamese). */
function useTimeAgo() {
    const { language } = useTranslation();
    return React.useCallback((isoOrDate: string) => {
        const date = new Date(isoOrDate);
        if (isNaN(date.getTime())) return isoOrDate;
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const isVN = language === 'vn';
        if (diffMin < 1) return isVN ? 'vừa xong' : 'just now';
        if (diffMin < 60) return isVN ? `${diffMin} phút trước` : `${diffMin}m ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return isVN ? `${diffHours} giờ trước` : `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return isVN ? `${diffDays} ngày trước` : `${diffDays}d ago`;
    }, [language]);
}
const ActivityItem: React.FC<{ activity: any }> = ({ activity }) => {
    const getIcon = (type: string) => {
        switch(type) {
            case 'LEAD': return { icon: ICONS.USER, bg: 'bg-sgs-primary/10 text-sgs-primary dark:bg-sgs-primary/20 dark:text-sgs-on-dark-muted' };
            case 'DEAL': return { icon: ICONS.CHECK, bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
            case 'SYSTEM': return { icon: ICONS.CLOUD, bg: 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] dark:bg-slate-800 dark:text-slate-300' };
            default: return { icon: ICONS.AI, bg: 'bg-[var(--sgs-primary)]/12 text-[var(--sgs-primary)] dark:bg-[var(--sgs-primary)]/25 dark:text-[var(--sgs-primary)]' };
        }
    };
    const style = getIcon(activity.type);
    const timeAgo = useTimeAgo();
    return (
        <div className="flex gap-3 py-3 border-b border-[var(--glass-border)] dark:border-slate-800/50 last:border-0 hover:bg-[var(--glass-surface)]/50 dark:hover:bg-slate-800/30 transition-colors rounded-lg px-2 -mx-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}>
                {style.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] dark:text-slate-200 truncate">{activity.content}</p>
                <p className="text-xs2 text-[var(--text-tertiary)] dark:text-slate-400 font-mono mt-0.5">{timeAgo(activity.time)}</p>
            </div>
        </div>
    );
};
const CustomTooltip = memo(({ active, payload, label, t, formatCurrency, language }: any) => {
    if (active && Array.isArray(payload) && payload.length) {
        return (
            <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--glass-border)] shadow-md text-xs z-50">
                <p className="font-bold mb-2 text-[var(--text-secondary)] dark:text-slate-200 uppercase tracking-wider">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                            <span className="text-[var(--text-secondary)] dark:text-slate-400 capitalize">{p.name}:</span>
                        </div>
                        <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">
                            {p.value > 1000 ? (formatCurrency ? formatCurrency(p.value) : p.value.toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US')) : p.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
});
const ScatterTooltip = memo(({ active, payload, t }: any) => {
    if (active && Array.isArray(payload) && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--glass-border)] shadow-md text-xs z-50">
                <p className="font-bold mb-2 text-[var(--text-secondary)] dark:text-slate-200 uppercase tracking-wider">{data.location}</p>
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">{t('dash.scatter_area')}:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">{data.area} m²</span>
                </div>
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">{t('dash.scatter_price')}:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">
                        {typeof data.price === 'number'
                            ? data.price.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
                            : data.price} {t('dash.scatter_price_unit')}
                    </span>
                </div>
                {data.pricePerM2 > 0 && (
                    <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-[var(--text-secondary)] dark:text-slate-400">Giá/m²:</span>
                        <span className="font-mono font-bold text-sgs-primary dark:text-sgs-text-muted">{Math.round(data.pricePerM2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} tr/m²</span>
                    </div>
                )}
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">{t('dash.scatter_interest')}:</span>
                    <span className="font-mono font-bold text-sgs-verified dark:text-emerald-400">{data.interest} {t('dash.scatter_interest_unit')}</span>
                </div>
            </div>
        );
    }
    return null;
});
const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-full w-full opacity-60">
        {ICONS.EMPTY}
        <p className="text-xs text-[var(--text-tertiary)] mt-2 font-medium">{message}</p>
    </div>
);
// --- AGENT AVATAR with initials fallback ---
const AVATAR_COLORS = [
    'bg-sgs-primary', 'bg-[var(--sgs-accent)]', 'bg-sky-500', 'bg-emerald-500',
    'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-teal-600',
];
const AgentAvatar = ({ name, avatar }: { name: string; avatar?: string }) => {
    const [broken, setBroken] = React.useState(false);
    const initials = (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const colorClass = AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
    const isValidSrc = !broken && avatar && avatar.trim() !== '';
    return isValidSrc ? (
        <img
            src={avatar}
            alt={name}
            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm object-cover"
            onError={() => setBroken(true)}
        />
    ) : (
        <div className={`w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center ${colorClass} select-none`}>
            <span className="text-xs font-bold text-white tracking-tight">{initials}</span>
        </div>
    );
};

const ProgressBar = ({ value, label, muted = false }: { value: number; label: string; muted?: boolean }) => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div className="mt-3">
            <div className="flex items-center justify-between gap-2 text-xs2 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                <span>{label}</span>
                <span className={muted ? 'text-[var(--text-tertiary)]' : 'text-[var(--sgs-primary)]'}>{muted ? '—' : `${safeValue}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]">
                <div className="h-full rounded-full bg-[var(--sgs-primary)] transition-all" style={{ width: `${safeValue}%` }} />
            </div>
        </div>
    );
};

const SegmentToggle = ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--glass-surface)] p-1" role="tablist">
        {options.map(option => (
            <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={value === option.value}
                onClick={() => onChange(option.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${value === option.value ? 'bg-[var(--bg-surface)] text-[var(--sgs-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

const DashboardMiniCard = ({ label, value, href, tone = 'default', surface = 'glass' }: { label: string; value: number | string; href?: string; tone?: 'default' | 'warning' | 'danger'; surface?: 'glass' | 'panel' }) => {
    const content = (
        <div className={`rounded-xl border px-3 py-3 text-center transition-colors ${tone === 'danger' ? 'border-[var(--ui-danger)]/25 bg-[var(--ui-danger)]/5' : tone === 'warning' ? 'border-[var(--sgs-accent)]/25 bg-[var(--sgs-accent)]/5' : `border-[var(--glass-border)] ${surface === 'panel' ? 'bg-[var(--bg-surface)]' : 'bg-[var(--glass-surface)]'}`} ${href ? 'hover:border-[var(--sgs-primary)]/40' : ''}`}>
            <div className="text-xs2 font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
            <div className={`mt-1 text-xl font-extrabold ${tone === 'danger' ? 'text-[var(--ui-danger)]' : 'text-[var(--text-primary)]'}`}>{value}</div>
        </div>
    );
    return href ? <a href={href} className="block min-w-0">{content}</a> : content;
};

const PriorityAlertCenter = ({ analytics, language }: { analytics: any; language: string }) => {
    const copy = language === 'vn'
        ? { title: 'Trung Tâm Cảnh Báo Ưu Tiên', empty: 'Không có cảnh báo ưu tiên', system: 'Hệ thống', followup: 'Khách chưa phản hồi', contract: 'Hợp đồng sắp hết hạn', ai: 'Cảnh báo AI' }
        : { title: 'Priority Alert Center', empty: 'No priority alerts', system: 'System', followup: 'Unresponsive leads', contract: 'Expiring contracts', ai: 'AI alert' };
    const alerts = Array.isArray(analytics?.dashboardAlerts) ? analytics.dashboardAlerts : [];
    return (
        <section className="dashboard-panel border-l-4 border-l-[var(--sgs-accent)] px-4 py-3 sm:px-5" aria-label={copy.title}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 shrink-0">
                    {ICONS.WARNING}
                    <h2 className="dashboard-subhead">{copy.title}</h2>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {(alerts.length ? alerts : [
                        analytics?.systemAlertCount > 0 ? { severity: 'high', label: copy.system, count: analytics.systemAlertCount } : null,
                        analytics?.unresponsiveLeadCount > 0 ? { severity: 'medium', label: copy.followup, count: analytics.unresponsiveLeadCount } : null,
                        analytics?.expiringContractCount > 0 ? { severity: 'medium', label: copy.contract, count: analytics.expiringContractCount } : null,
                        analytics?.aiAlertCount > 0 ? { severity: 'low', label: copy.ai, count: analytics.aiAlertCount } : null,
                    ].filter(Boolean)).map((alert: any, index: number) => (
                        <span key={`${alert.label}-${index}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${alert.severity === 'high' ? 'border-[var(--ui-danger)]/25 bg-[var(--ui-danger)]/5 text-[var(--ui-danger)]' : alert.severity === 'medium' ? 'border-[var(--sgs-accent)]/30 bg-[var(--sgs-accent)]/5 text-[var(--sgs-accent-text)]' : 'border-[var(--sgs-primary)]/20 bg-[var(--sgs-primary)]/5 text-[var(--sgs-primary)]'}`}>
                            {alert.label} <strong>{alert.count ?? ''}</strong>
                        </span>
                    ))}
                    {!alerts.length && !analytics?.systemAlertCount && !analytics?.unresponsiveLeadCount && !analytics?.expiringContractCount && !analytics?.aiAlertCount && <span className="text-xs text-[var(--text-tertiary)]">{copy.empty}</span>}
                </div>
            </div>
        </section>
    );
};

const WorkQueueStrip = ({ analytics, language }: { analytics: any; language: string }) => {
    const copy = language === 'vn'
        ? { title: 'Việc Cần Làm & Phê Duyệt', contracts: 'Hợp đồng cần xử lý', approvals: 'Yêu cầu chờ duyệt', followups: 'Khách cần follow-up' }
        : { title: 'Tasks & Approvals', contracts: 'Contracts to handle', approvals: 'Pending approvals', followups: 'Leads to follow up' };
    const queue = analytics?.workQueue || {};
    return (
        <section aria-label={copy.title}>
            <div className="mb-2 dashboard-subhead">{copy.title}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <DashboardMiniCard label={copy.contracts} value={queue.contracts ?? analytics?.pendingContracts ?? 0} href="/contracts" tone="danger" />
                <DashboardMiniCard label={copy.approvals} value={queue.approvals ?? analytics?.pendingApprovals ?? 0} href="/approvals" tone="danger" />
                <DashboardMiniCard label={copy.followups} value={queue.followups ?? analytics?.unresponsiveLeadCount ?? 0} href="/leads" tone={(queue.followups ?? 0) > 0 ? 'danger' : 'default'} />
            </div>
        </section>
    );
};

const InventoryOverviewWidget = ({ analytics, language }: { analytics: any; language: string }) => {
    const copy = language === 'vn'
        ? { title: 'Kho Bất Động Sản', active: 'Đang hoạt động', sold: 'Đã bán', rented: 'Đã cho thuê', expired: 'Hết hạn', pending: 'Tin chờ duyệt', top: 'Xem nhiều tuần này', empty: 'Chưa có dữ liệu nổi bật' }
        : { title: 'Property Inventory', active: 'Active', sold: 'Sold', rented: 'Rented', expired: 'Expired', pending: 'Pending approval', top: 'Most viewed this week', empty: 'No featured data yet' };
    const inventory = analytics?.inventoryOverview || {};
    const topListings = Array.isArray(inventory.topListings) ? inventory.topListings : [];
    return (
        <section className="dashboard-panel min-w-0" aria-label={copy.title}>
            <div className="dashboard-panel-head">
                <h2>{copy.title}</h2>
                <a href="/inventory" className="text-xs font-semibold text-[var(--sgs-primary)]">{copy.active}</a>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4">
                <DashboardMiniCard label={copy.active} value={inventory.active ?? analytics?.availableListings ?? 0} surface="panel" />
                <DashboardMiniCard label={copy.sold} value={inventory.sold ?? 0} surface="panel" />
                <DashboardMiniCard label={copy.rented} value={inventory.rented ?? 0} surface="panel" />
                <DashboardMiniCard label={copy.expired} value={inventory.expired ?? 0} surface="panel" />
            </div>
            <a href="/approvals" className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-[var(--sgs-accent)]/25 bg-[var(--sgs-accent)]/5 px-3 py-2 text-xs font-semibold text-[var(--sgs-accent-text)]">
                <span>{copy.pending}</span><strong>{inventory.pendingApproval ?? 0}</strong>
            </a>
            <div className="mx-4 mt-4 dashboard-subhead">{copy.top}</div>
            <div className="mx-4 mt-2 space-y-2 pb-4">
                {topListings.length ? topListings.slice(0, 5).map((listing: any, index: number) => (
                    <div key={listing.id ?? index} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-[var(--text-primary)]">{listing.title || listing.name}</span>
                        <span className="shrink-0 font-mono text-[var(--text-tertiary)]">{listing.views ?? listing.viewCount ?? 0}</span>
                    </div>
                )) : <div className="py-3 text-xs text-[var(--text-tertiary)]">{copy.empty}</div>}
            </div>
        </section>
    );
};

const InboxOverviewWidget = ({ analytics, language }: { analytics: any; language: string }) => {
    const copy = language === 'vn' ? { title: 'Hộp Thư Đa Kênh', response: 'Phản hồi trung bình', empty: 'Chưa có tin nhắn chưa đọc' } : { title: 'Omnichannel Inbox', response: 'Average response', empty: 'No unread messages' };
    const inbox = analytics?.inboxOverview || {};
    const safeCount = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };
    const channels = [
        { key: 'Zalo', value: safeCount(inbox.zalo) },
        { key: 'Facebook', value: safeCount(inbox.facebook) },
        { key: 'Web chat', value: safeCount(inbox.webChat ?? inbox.web_chat) },
    ];
    return (
        <section className="dashboard-panel min-w-0" aria-label={copy.title}>
            <div className="dashboard-panel-head"><h2>{copy.title}</h2><a href="/inbox" className="text-xs font-semibold text-[var(--sgs-primary)]">Inbox</a></div>
            <div className="grid grid-cols-3 gap-2 px-4">{channels.map(channel => <DashboardMiniCard key={channel.key} label={channel.key} value={channel.value} surface="panel" />)}</div>
            <div className="mx-4 mt-4 mb-4 flex items-center justify-between rounded-xl bg-[var(--bg-surface)] px-3 py-2 pb-3 text-xs">
                <span className="text-[var(--text-tertiary)]">{copy.response}</span>
                <strong className="font-mono text-[var(--text-primary)]">{inbox.avgResponseMinutes != null ? `${inbox.avgResponseMinutes}m` : '—'}</strong>
            </div>
            {!channels.some(channel => channel.value > 0) && <div className="mx-4 mt-3 pb-4 text-xs text-[var(--text-tertiary)]">{copy.empty}</div>}
        </section>
    );
};

const SearchAnalyticsWidget = ({ analytics, language }: { analytics: any; language: string }) => {
    const data = analytics?.searchAnalytics || {};
    const groups = [
        {
            title: language === 'vn' ? 'Top 10 BĐS được xem' : 'Top 10 viewed properties',
            items: Array.isArray(data.topViewedListings) ? data.topViewedListings : [],
            label: (item: any) => item.title,
            value: (item: any) => `${item.views ?? 0} ${language === 'vn' ? 'lượt' : 'views'}`,
        },
        {
            title: language === 'vn' ? 'Top 10 từ khóa tìm kiếm' : 'Top 10 search keywords',
            items: Array.isArray(data.topSearches) ? data.topSearches : [],
            label: (item: any) => item.query,
            value: (item: any) => `${item.searches ?? 0}`,
        },
        {
            title: language === 'vn' ? 'Top 10 tìm kiếm theo danh mục' : 'Top 10 searches by category',
            items: Array.isArray(data.topCategorySearches) ? data.topCategorySearches : [],
            label: (item: any) => `${item.query} · ${item.category}`,
            value: (item: any) => `${item.searches ?? 0}`,
        },
    ];
    return (
        <section className="dashboard-panel" aria-label={language === 'vn' ? 'Phân tích tìm kiếm' : 'Search analytics'}>
            <div className="dashboard-panel-head">
                <h2>{language === 'vn' ? 'Hành vi tìm kiếm trên trang' : 'On-site search behavior'}</h2>
                <span className="text-xs text-[var(--text-tertiary)]">{language === 'vn' ? '30 ngày gần nhất' : 'Last 30 days'}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-3">
                {groups.map((group) => (
                    <div key={group.title} className="min-w-0 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3">
                        <div className="mb-3 text-xs font-semibold text-[var(--text-secondary)]">{group.title}</div>
                        {group.items.length ? (
                            <div data-export-expand className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                {group.items.slice(0, 10).map((item: any, index: number) => (
                                    <div key={`${group.title}-${index}`} className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] pb-2 text-xs last:border-0 last:pb-0">
                                        <span className="min-w-0 truncate text-[var(--text-primary)]">{index + 1}. {group.label(item)}</span>
                                        <span className="shrink-0 font-mono text-[var(--text-tertiary)]">{group.value(item)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-6 text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Chưa có dữ liệu tìm kiếm' : 'No search data yet'}</div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
};

const AiAdvisorWidget = ({ analytics, language }: { analytics: any; language: string }) => {
    const copy = language === 'vn' ? { title: 'Cố Vấn AI', suggestions: 'Gợi ý trong ngày', anomaly: 'Cảnh báo bất thường', empty: 'Chưa có gợi ý mới' } : { title: 'AI Advisor', suggestions: 'Suggestions today', anomaly: 'Anomaly alerts', empty: 'No new suggestions' };
    const advisor = analytics?.aiAdvisor || {};
    const suggestions = Array.isArray(advisor.suggestions) ? advisor.suggestions : [];
    return (
        <section className="dashboard-panel" aria-label={copy.title}>
            <div className="dashboard-panel-head"><h2>{copy.title}</h2><a href="/ai-governance" className="text-xs font-semibold text-[var(--sgs-primary)]">AI</a></div>
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]" aria-hidden="true">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                </div>
                <div><div className="text-2xl font-extrabold text-[var(--text-primary)]">{advisor.count ?? suggestions.length}</div><div className="text-xs text-[var(--text-tertiary)]">{copy.suggestions}</div></div>
                <div className="ml-auto text-right"><div className="text-lg font-bold text-[var(--ui-danger)]">{advisor.anomalies ?? 0}</div><div className="text-xs text-[var(--text-tertiary)]">{copy.anomaly}</div></div>
            </div>
            <div className="mt-4 space-y-2">{suggestions.slice(0, 3).map((item: any, index: number) => <div key={index} className="rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">{item.title || item.message || item}</div>)}</div>
            {!suggestions.length && <div className="mt-4 text-xs text-[var(--text-tertiary)]">{copy.empty}</div>}
        </section>
    );
};

const KpiTargetSettings = ({ user, language, notify }: { user: any; language: string; notify: (message: string, type?: 'success' | 'error') => void }) => {
    const canEdit = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user?.role);
    const [open, setOpen] = useState(false);
    const [period, setPeriod] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    });
    const [draft, setDraft] = useState<Record<string, { monthlyTarget: string; quarterTarget: string }>>({});
    const queryClient = useQueryClient();
    const targetsQuery = useQuery({
        queryKey: ['dashboardKpiTargets', period.year, period.month],
        queryFn: () => analyticsApi.getKpiTargets(period.year, period.month),
        enabled: open && canEdit,
        staleTime: 30000,
    });
    useEffect(() => {
        const next: Record<string, { monthlyTarget: string; quarterTarget: string }> = {};
        for (const item of targetsQuery.data || []) {
            next[item.metric] = { monthlyTarget: String(item.monthlyTarget ?? 0), quarterTarget: String(item.quarterTarget ?? 0) };
        }
        setDraft(next);
    }, [targetsQuery.data]);
    const saveMutation = useMutation({
        mutationFn: () => analyticsApi.updateKpiTargets({
            year: period.year,
            month: period.month,
            targets: ['revenue', 'pipeline', 'salesVelocity'].map(metric => ({
                metric,
                monthlyTarget: Number(draft[metric]?.monthlyTarget || 0),
                quarterTarget: Number(draft[metric]?.quarterTarget || 0),
            })),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboardKpiTargets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardAnalytics'] });
            notify(language === 'vn' ? 'Đã lưu mục tiêu KPI' : 'KPI targets saved');
            setOpen(false);
        },
        onError: () => notify(language === 'vn' ? 'Không thể lưu mục tiêu KPI' : 'Unable to save KPI targets', 'error'),
    });
    if (!canEdit) return null;
    const copy = language === 'vn'
        ? { button: 'Cấu hình KPI', title: 'Cấu hình mục tiêu KPI', month: 'Tháng áp dụng', monthly: 'Mục tiêu tháng', quarter: 'Mục tiêu quý', revenue: 'Doanh thu', pipeline: 'Giá trị pipeline', velocity: 'Sales velocity (ngày)', cancel: 'Hủy', save: 'Lưu mục tiêu', loading: 'Đang tải...' }
        : { button: 'Configure KPI', title: 'KPI target settings', month: 'Effective month', monthly: 'Monthly target', quarter: 'Quarter target', revenue: 'Revenue', pipeline: 'Pipeline value', velocity: 'Sales velocity (days)', cancel: 'Cancel', save: 'Save targets', loading: 'Loading...' };
    const labels: Record<string, string> = { revenue: copy.revenue, pipeline: copy.pipeline, salesVelocity: copy.velocity };
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="dashboard-control px-3 py-2.5 text-xs font-semibold text-[var(--sgs-primary)]">{copy.button}</button>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={copy.title}>
                    <div className="w-full max-w-2xl rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div><h2 className="text-lg font-bold text-[var(--text-primary)]">{copy.title}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Mục tiêu được lưu riêng cho tenant và tháng đã chọn.' : 'Targets are saved per tenant and selected month.'}</p></div>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-lg text-[var(--text-tertiary)] hover:bg-[var(--glass-surface)]" aria-label={copy.cancel}>×</button>
                        </div>
                        <label className="mt-5 block text-xs font-semibold text-[var(--text-secondary)]">{copy.month}
                            <input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={event => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) setPeriod({ year, month }); }} className="mt-1.5 block w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                        </label>
                        {targetsQuery.isLoading ? <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">{copy.loading}</div> : (
                            <div className="mt-5 space-y-3">
                                {['revenue', 'pipeline', 'salesVelocity'].map(metric => (
                                    <div key={metric} className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">{labels[metric]}</div>
                                        <label className="text-xs text-[var(--text-tertiary)]">{copy.monthly}<input type="number" min="0" step="any" value={draft[metric]?.monthlyTarget ?? ''} onChange={event => setDraft(current => ({ ...current, [metric]: { monthlyTarget: event.target.value, quarterTarget: current[metric]?.quarterTarget ?? '' } }))} className="mt-1 block w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-primary)]" /></label>
                                        <label className="text-xs text-[var(--text-tertiary)]">{copy.quarter}<input type="number" min="0" step="any" value={draft[metric]?.quarterTarget ?? ''} onChange={event => setDraft(current => ({ ...current, [metric]: { monthlyTarget: current[metric]?.monthlyTarget ?? '', quarterTarget: event.target.value } }))} className="mt-1 block w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-primary)]" /></label>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="dashboard-control px-4 py-2 text-xs font-semibold">{copy.cancel}</button><button type="button" disabled={saveMutation.isPending || targetsQuery.isLoading} onClick={() => saveMutation.mutate()} className="rounded-lg bg-[var(--sgs-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saveMutation.isPending ? copy.loading : copy.save}</button></div>
                    </div>
                </div>
            )}
        </>
    );
};
// --- GEOLOCATION TABLE ---
const GeoLocationTable = memo(({ t, days }: { t: any; days: number }) => {
    const { data: visitorStats, isLoading, isError } = useQuery({
        queryKey: ['visitorStats', days],
        queryFn: () => analyticsApi.getVisitorStats(days),
        staleTime: 60000,
        refetchInterval: 120000, // Auto-refresh every 2 minutes
        retry: 1,
    });
    const countries: { country: string; countryCode: string; count: number }[] = visitorStats?.topCountries || [];
    const cities: { city: string; count: number }[] = visitorStats?.topCities || [];
    const totalVisits: number = visitorStats?.totalVisits || 0;
    const uniqueIps: number = visitorStats?.uniqueIps || 0;
    const geoVisits: number = countries.reduce((sum, c) => sum + c.count, 0);
    const geoCoverage: number = totalVisits > 0 ? Math.round((geoVisits / totalVisits) * 100) : 0;
    return (
        <BentoCard
            title={t('dash.geo_title')}
            className="dashboard-panel dashboard-status-widget h-full overflow-hidden flex flex-col"
            icon={<svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        >
            {isLoading ? (
                <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-sgs-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-tertiary)]">
                    <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs">{t('dash.geo_error')}</span>
                </div>
            ) : (
                <div className="flex flex-col gap-4 flex-1 min-h-0">
                    <div className="flex gap-3">
                        <div className="dashboard-geo-metric flex-1 bg-[var(--glass-surface)] dark:bg-slate-800/50 rounded-xl p-3 border border-[var(--glass-border)] dark:border-slate-700/50">
                            <div className="text-xs2 font-bold uppercase text-[var(--text-tertiary)] tracking-wider mb-1">{t('dash.geo_total_visits')}</div>
                            <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white">{totalVisits.toLocaleString()}</div>
                            <div className="text-3xs text-[var(--text-tertiary)] mt-0.5">{t('dash.geo_last_30d')}</div>
                        </div>
                        <div className="dashboard-geo-metric flex-1 bg-[var(--glass-surface)] dark:bg-slate-800/50 rounded-xl p-3 border border-[var(--glass-border)] dark:border-slate-700/50">
                            <div className="text-xs2 font-bold uppercase text-[var(--text-tertiary)] tracking-wider mb-1">{t('dash.geo_unique_ips')}</div>
                            <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white">{uniqueIps.toLocaleString()}</div>
                            <div className="text-3xs text-[var(--text-tertiary)] mt-0.5">{t('dash.geo_ip_source')}</div>
                        </div>
                        <div className="dashboard-geo-metric flex-1 bg-[var(--glass-surface)] dark:bg-slate-800/50 rounded-xl p-3 border border-[var(--glass-border)] dark:border-slate-700/50">
                            <div className="text-xs2 font-bold uppercase text-[var(--text-tertiary)] tracking-wider mb-1">{t('dash.geo_coverage')}</div>
                            <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white">{geoCoverage}<span className="text-sm ml-0.5">%</span></div>
                            <div className="text-3xs text-[var(--text-tertiary)] mt-0.5">{geoVisits}/{totalVisits} {t('dash.geo_visits_unit')}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                        <div className="flex flex-col min-h-0">
                            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('dash.geo_top_countries')}</div>
                            {countries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-20 gap-1">
                                    <span className="text-xs text-[var(--text-tertiary)] opacity-60">{t('dash.geo_no_ip')}</span>
                                    <span className="text-3xs text-[var(--text-tertiary)] opacity-40">{t('dash.geo_localhost_hint')}</span>
                                </div>
                            ) : (
                                <div className="overflow-y-auto no-scrollbar space-y-1.5 flex-1">
                                    {countries.slice(0, 8).map((c, i) => {
                                        return (
                                            <div key={i} className="flex items-center gap-2 group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-xs2 font-medium text-[var(--text-primary)] dark:text-slate-200 truncate">{c.country || t('dash.geo_unknown')}</span>
                                                        <span className="text-xs2 font-mono font-bold text-[var(--text-tertiary)] ml-1 shrink-0">{c.count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-h-0">
                            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('dash.geo_top_cities')}</div>
                            {cities.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-20 gap-1">
                                    <span className="text-xs text-[var(--text-tertiary)] opacity-60">{t('dash.geo_no_cities')}</span>
                                    <span className="text-3xs text-[var(--text-tertiary)] opacity-40">{t('dash.geo_localhost_hint')}</span>
                                </div>
                            ) : (
                                <div className="overflow-y-auto no-scrollbar space-y-1.5 flex-1">
                                    {cities.slice(0, 8).map((c, i) => {
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full flex items-center justify-center bg-sky-100 dark:bg-sky-900/40 shrink-0">
                                                    <span className="text-3xs font-bold text-sky-600 dark:text-sky-400">{i + 1}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-xs2 font-medium text-[var(--text-primary)] dark:text-slate-200 truncate">{c.city || t('dash.geo_unknown')}</span>
                                                        <span className="text-xs2 font-mono font-bold text-[var(--text-tertiary)] ml-1 shrink-0">{c.count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </BentoCard>
    );
});
// --- REALTIME TRAFFIC WIDGET ---
const RealtimeTrafficWidget = memo(({ t, theme }: any) => {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState({ rps: 0, latency: 0, dbLatency: 0, errors: 0 });
    const colors = theme?.colors || {};
    const { isConnected } = useSocket();
    const { language } = useTranslation();
    // Poll real server metrics every 5 seconds
    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const m = await analyticsApi.getSystemMetrics();
                const rps = typeof m.rps === 'number' ? m.rps : 0;
                const latency = typeof m.avgLatencyMs === 'number' ? m.avgLatencyMs : 0;
                const dbLatency = typeof m.dbLatencyMs === 'number' ? m.dbLatencyMs : 0;
                const errors = typeof m.errorCount === 'number' ? m.errorCount : 0;
                setStats({ rps, latency, dbLatency, errors });
                setData(prev => {
                    const timeLabel = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
                    const newData = [...prev, { time: timeLabel, rps, latency }];
                    if (newData.length > 20) newData.shift();
                    return newData;
                });
            } catch {
                // Leave stats unchanged if API fails
            }
        };
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30_000); // reliability fix: 5s -> 30s
        return () => clearInterval(interval);
    }, []);
    return (
        <BentoCard 
            title={t('dash.traffic_title')}
             className="dashboard-panel dashboard-status-widget h-full"
            contentClassName="justify-start"
             icon={<svg className="w-5 h-5 text-[var(--sgs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-5 flex-wrap">
                    <div>
                        <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">{stats.rps}</div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.requests_sec')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">{stats.latency}<span className="text-sm text-[var(--text-tertiary)] ml-1">ms</span></div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.avg_latency')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-sgs-primary dark:text-sgs-text-muted tracking-tight">{stats.dbLatency}<span className="text-sm text-[var(--text-tertiary)] ml-1">ms</span></div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.traffic_db_latency')}</div>
                    </div>
                    <div>
                        <div className={`text-2xl font-extrabold tracking-tight ${stats.errors > 0 ? 'text-red-500' : 'text-emerald-500 dark:text-emerald-400'}`}>{stats.errors}</div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.traffic_errors')}</div>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-full border shrink-0 ${isConnected ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800'}`}>
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className={`text-xs2 font-bold uppercase ${isConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {isConnected ? t('dash.live_status') : t('dash.connecting')}
                    </span>
                </div>
            </div>            
            <div className="mb-4 h-[130px] w-full -ml-2 relative">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={130} minHeight={100} minWidth={150}>
                        <ComposedChart data={data}>
                            <defs>
                            </defs>
                            <XAxis dataKey="time" hide />
                            <Tooltip content={<CustomTooltip t={t} language={language} />} cursor={{stroke: colors.grid || 'var(--sgs-border)', strokeWidth: 1}} />
                            <Area 
                                type="monotone" 
                                dataKey="latency" 
                                name={t('dash.avg_latency')}
                                 stroke="var(--sgs-primary)"
                                strokeWidth={2}
                                 fill="var(--sgs-subtle-bg)"
                                isAnimationActive={false} 
                            />
                            <Line 
                                type="step" 
                                dataKey="rps" 
                                name={t('dash.requests_sec')}
                                 stroke="var(--sgs-accent)"
                                strokeWidth={2} 
                                dot={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState message={t('dash.traffic_waiting')} />
                )}
            </div>
        </BentoCard>
    );
});
function safeFunnelNumber(value: unknown): number {
    try {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : 0;
    } catch {
        return 0;
    }
}

function safeFunnelFilterOptions(value: unknown): { value: string }[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is { value: string } => (
        item !== null
        && typeof item === 'object'
        && typeof (item as { value?: unknown }).value === 'string'
        && (item as { value: string }).value.length > 0
    ));
}

export const VisitorFunnelWidget = memo(({ days, language }: { days: number; language: string }) => {
    const [projectCode, setProjectCode] = useState('');
    const [source, setSource] = useState('');
    const query = useQuery({
        queryKey: ['visitorFunnel', days, projectCode, source],
        queryFn: () => analyticsApi.getVisitorFunnel(days, { ...(projectCode ? { projectCode } : {}), ...(source ? { source } : {}) }),
        staleTime: 60000,
        refetchInterval: 120000,
        retry: 1,
    });
    const data = query.data;
    const isVn = language === 'vn';
    const sessions = safeFunnelNumber(data?.sessions);
    const pageLeaves = safeFunnelNumber(data?.pageLeaves);
    const exitRate = sessions ? Math.round((pageLeaves / sessions) * 100) : 0;
    const avgSeconds = Math.round(safeFunnelNumber(data?.averageTimeOnPageMs) / 1000);
    const topProjects = useMemo(() => safeFunnelFilterOptions(data?.topProjects), [data?.topProjects]);
    const topSources = useMemo(() => safeFunnelFilterOptions(data?.topSources), [data?.topSources]);
    useEffect(() => {
        if (!data) return;
        if (projectCode && !topProjects.some(item => item.value === projectCode)) {
            setProjectCode('');
        }
        if (source && !topSources.some(item => item.value === source)) {
            setSource('');
        }
    }, [projectCode, source, topProjects, topSources]);
    const stages = [
        [isVn ? 'Lượt xem tin' : 'Property views', safeFunnelNumber(data?.propertyViews), 'bg-[var(--sgs-primary)]'],
        [isVn ? 'Phiên truy cập' : 'Sessions', sessions, 'bg-cyan-500'],
        [isVn ? 'Phiên đọc sâu' : 'Engaged sessions', safeFunnelNumber(data?.engagedSessions), 'bg-emerald-500'],
        [isVn ? 'Cuộn 50%' : 'Scrolled 50%', safeFunnelNumber(data?.scroll50), 'bg-amber-500'],
        [isVn ? 'Tương tác CTA' : 'CTA interactions', safeFunnelNumber(data?.ctaInteractions), 'bg-violet-500'],
    ];
    return <section className="dashboard-panel" aria-label={isVn ? 'Funnel hành vi người xem' : 'Viewer behavior funnel'}>
        <div className="dashboard-panel-head flex-wrap gap-3">
            <div><h2>{isVn ? 'Funnel hành vi người xem' : 'Viewer behavior funnel'}</h2><p className="mt-1 text-xs font-normal text-[var(--text-tertiary)]">{isVn ? 'Chất lượng phiên đọc và tín hiệu mua hàng.' : 'Reading quality and buying signals.'}</p></div>
            <div className="flex flex-wrap gap-2">
                <select aria-label={isVn ? 'Lọc theo tin' : 'Filter by listing'} value={projectCode} onChange={e => setProjectCode(e.target.value)} className="dashboard-control px-2.5 py-2 text-xs text-[var(--text-primary)]">
                    <option value="">{isVn ? 'Tất cả tin' : 'All listings'}</option>
                    {topProjects.map(item => <option key={item.value} value={item.value}>{item.value}</option>)}
                </select>
                <select aria-label={isVn ? 'Lọc theo nguồn traffic' : 'Filter by traffic source'} value={source} onChange={e => setSource(e.target.value)} className="dashboard-control px-2.5 py-2 text-xs text-[var(--text-primary)]">
                    <option value="">{isVn ? 'Tất cả nguồn' : 'All sources'}</option>
                    {topSources.map(item => <option key={item.value} value={item.value}>{item.value === 'direct' ? (isVn ? 'Trực tiếp' : 'Direct') : item.value}</option>)}
                </select>
            </div>
        </div>
        {query.isLoading ? <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--sgs-primary)] border-t-transparent" /></div> : query.isError ? <div className="px-4 py-10 text-center text-xs text-[var(--text-tertiary)]">{isVn ? 'Không thể tải dữ liệu funnel.' : 'Unable to load funnel data.'}</div> : <>
            <div className="grid grid-cols-2 gap-3 px-4 pt-1 sm:grid-cols-4">
                {[
                    [isVn ? 'Phiên đọc sâu' : 'Engaged sessions', safeFunnelNumber(data?.engagedSessions).toLocaleString()],
                    [isVn ? 'Thời gian xem TB' : 'Avg. view time', avgSeconds >= 60 ? `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s` : `${avgSeconds}s`],
                    [isVn ? 'Tỷ lệ rời trang' : 'Exit rate', `${exitRate}%`],
                    [isVn ? 'Tương tác CTA' : 'CTA interactions', safeFunnelNumber(data?.ctaInteractions).toLocaleString()],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div><div className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{value}</div></div>)}
            </div>
            <div className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_220px]">
                <div className="space-y-3">{stages.map(([label, value, color]) => {
                    const width = sessions ? Math.min(100, Math.max(2, (Number(value) / sessions) * 100)) : 2;
                    return <div key={label}><div className="mb-1 flex justify-between text-xs"><span className="text-[var(--text-secondary)]">{label}</span><strong className="font-mono text-[var(--text-primary)]">{Number(value).toLocaleString()}</strong></div><div className="h-2.5 rounded-full bg-[var(--glass-surface-hover)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
                })}</div>
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3"><div className="text-xs font-bold text-[var(--text-primary)]">{isVn ? 'Khách quay lại' : 'Returning visitors'}</div><div className="mt-2 text-2xl font-extrabold text-[var(--sgs-primary)]">{safeFunnelNumber(data?.returningVisitors48h).toLocaleString()}</div><div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{isVn ? 'trong vòng 48 giờ' : 'within 48 hours'}</div></div>
            </div>
        </>}
    </section>;
});
// --- MAIN DASHBOARD ---
/**
 * Read the current user's tenantId from the JWT cookie without an extra API call.
 * Returns null if the cookie is absent or the token is malformed.
 * Used only to namespace the React Query cache key — prevents tenant A's cached
 * analytics from bleeding into tenant B's session after a same-browser login switch.
 */
function getTenantIdFromCookie(): string | null {
    try {
        const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (!match) return null;
        const payload = JSON.parse(atob(match[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return (payload.tenantId as string) ?? null;
    } catch {
        return null;
    }
}
export const Dashboard: React.FC = () => {
    const [timeRange, setTimeRange] = useState('30d');
    const selectedDays = timeRange === 'all' ? 365 : Number.parseInt(timeRange, 10) || 30;
    const [pipelineMode, setPipelineMode] = useState<'overview' | 'source'>('overview');
    const [leaderboardMode, setLeaderboardMode] = useState<'individual' | 'team'>('individual');
    const [isExporting, setIsExporting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);
    const dashboardRef = useRef<HTMLDivElement>(null);
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const { chartTheme } = useTheme();
    // Namespaces the React Query cache by tenant so that switching between
    // admin accounts in the same browser never shows a stale tenant's data.
    const cacheTenantId = useMemo(() => getTenantIdFromCookie(), []);
    const handleExport = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);      
        try {
            // Give a small delay for any animations to settle
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2, // Retina quality
                useCORS: true,
                logging: false,
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim(),
                onclone: (clonedDoc) => {
                    const root = clonedDoc.querySelector('[data-dashboard-export-root]');
                    if (root) {
                        const header = clonedDoc.createElement('div');
                        header.setAttribute('data-export-header', '');
                        header.style.cssText = 'padding:24px 28px 18px;border-bottom:1px solid #d7dde5;background:#ffffff;color:#172033;font-family:Arial,sans-serif;';
                        const title = language === 'vn' ? 'SGS LAND — Báo cáo Tổng quan' : 'SGS LAND — Dashboard Report';
                        const period = language === 'vn' ? `Kỳ dữ liệu: ${timeRange}` : `Data period: ${timeRange}`;
                        const scope = analytics?.scopeLabel ? `${language === 'vn' ? 'Phạm vi' : 'Scope'}: ${analytics.scopeLabel}` : '';
                        header.innerHTML = `<div style="font-size:20px;font-weight:700;">${title}</div><div style="margin-top:8px;font-size:12px;color:#657184;">${period}${scope ? ` &nbsp;•&nbsp; ${scope}` : ''} &nbsp;•&nbsp; ${language === 'vn' ? 'Xuất lúc' : 'Generated'}: ${new Date().toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US')}</div>`;
                        root.prepend(header);
                    }
                    clonedDoc.querySelectorAll('[data-export-expand]').forEach((element) => {
                        const node = element as HTMLElement;
                        node.style.maxHeight = 'none';
                        node.style.overflow = 'visible';
                    });
                    // Ensure fonts are loaded in the clone
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                         @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
                         * { font-family: 'Be Vietnam Pro', sans-serif !important; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });           
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });            
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`SGS_LAND_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export failed:', error);
            notify(t('dash.export_error'), 'error');
        } finally {
            setIsExporting(false);
        }
    };
    // Use React Query for data fetching, caching, and auto-refresh
    const { data: analytics, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
        queryKey: ['dashboardAnalytics', timeRange, language, cacheTenantId],
        queryFn: async () => {
            const [data, user] = await Promise.all([
                db.getAnalytics(timeRange, language),
                db.getCurrentUser(),
            ]);
            return { ...data, user };
        },
        refetchInterval: 30000, // Auto-refresh every 30s as baseline
        staleTime: 10000,
    });
    // Socket-triggered refetch: immediately react to lead/deal changes without waiting up to 30s
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleRefetch = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        // Debounce 2s so rapid bulk changes (imports, routing) generate only one API call
        refreshTimerRef.current = setTimeout(() => refetch(), 2000);
    }, [refetch]);
    useEffect(() => {
        // Lead events — affects totalLeads, salesVelocity, pipeline
        socket.on('lead_created', scheduleRefetch);
        socket.on('lead_updated', scheduleRefetch);
        socket.on('lead_scored', scheduleRefetch);
        // Proposal approved — affects pipelineValue (open deals change when approved)
        socket.on('proposal_approved', scheduleRefetch);
        // Inbound message — triggers AI auto-reply, affects aiDeflectionRate
        socket.on('new_inbound_message', scheduleRefetch);
        return () => {
            socket.off('lead_created', scheduleRefetch);
            socket.off('lead_updated', scheduleRefetch);
            socket.off('lead_scored', scheduleRefetch);
            socket.off('proposal_approved', scheduleRefetch);
            socket.off('new_inbound_message', scheduleRefetch);
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, [scheduleRefetch]);
    if (isLoading) return <DashboardSkeleton />;
    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    {ICONS.WARNING}
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] dark:text-white mb-2">{t('common.error')}</h2>
                <p className="text-[var(--text-tertiary)] dark:text-slate-400 mb-6 max-w-md">
                    {t('dash.error_message')}
                </p>
                <button 
                    onClick={() => refetch()}
                    className="px-6 py-2.5 bg-sgs-primary text-white font-bold rounded-xl shadow-md hover:bg-sgs-primary transition-all active:scale-95"
                >
                    {t('common.system_reload')}
                </button>
            </div>
        );
    }
    if (!analytics) return null;
    const lastUpdated = new Date(dataUpdatedAt || Date.now());
    const currentUser = (analytics as any)?.user;
    const userName = currentUser?.name ? currentUser.name.split(' ').slice(-1)[0] : '';
    const scopeKey: string = (analytics as any)?.scopeLabel || 'company';
    const scopeLabel = scopeKey === 'personal' ? t('dash.scope_personal') : t('dash.scope_company');
    const overview: any = analytics;
    const ui = language === 'vn'
        ? { quick: 'Thao tác nhanh', addLead: '+ Thêm khách hàng', contract: '+ Tạo hợp đồng', listing: '+ Đăng tin BĐS', target: 'mục tiêu tháng', targetUnset: 'Chưa thiết lập mục tiêu', source: 'Theo nguồn', overview: 'Tổng quan', project: 'Theo dự án', demand: 'Nhu cầu theo khu vực', team: 'Theo team', individual: 'Theo cá nhân', overloaded: 'Quá tải' }
        : { quick: 'Quick actions', addLead: '+ Add lead', contract: '+ Create contract', listing: '+ Add listing', target: 'monthly target', targetUnset: 'Target not set', source: 'By source', overview: 'Overview', project: 'By project', demand: 'Demand by area', team: 'By team', individual: 'By person', overloaded: 'Overloaded' };
    const kpiTarget = (key: string, actual: number) => {
        const target = Number(overview?.targets?.[key]?.monthly_target ?? overview?.targets?.[key]?.monthlyTarget ?? 0);
        return { target, progress: target > 0 ? Math.round((actual / target) * 100) : 0 };
    };
    const revenueTarget = kpiTarget('revenue', Number(overview.revenue || 0));
    const pipelineTarget = kpiTarget('pipeline', Number(overview.pipelineValue || 0));
    const velocityTarget = kpiTarget('salesVelocity', Number(overview.salesVelocity || 0));
    const sourceData = Object.entries(overview.leadsBySource || {}).sort(([, a]: any, [, b]: any) => b - a);
    return (
    <>
      <SeoHead title="Dashboard | SGS LAND" description="Bảng điều khiển tổng quan SGS LAND - quản lý bất động sản, phân tích thị trường và theo dõi hiệu suất kinh doanh." canonicalPath="/dashboard" />
        <div className="sgs-dashboard min-h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 pb-24 animate-enter">
            <div className="mx-auto max-w-[1480px] space-y-6">
                <header className="dashboard-header flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="dash-eyebrow text-[var(--text-tertiary)]">{scopeLabel}</div>
                        <h1 className="dashboard-title mt-2 text-[var(--text-primary)]">
                            {userName ? `${t('dash.greeting_morning')} ${userName}` : t('dash.greeting_morning')}
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{t('dash.overview_subtitle')}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            {ICONS.REFRESH}
                            <span>{lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                        <div className="hidden items-center gap-2 xl:flex">
                            <a href="/leads" className="dashboard-control px-3 py-2.5 text-xs font-semibold text-[var(--sgs-primary)]">{ui.addLead}</a>
                            <a href="/contracts" className="dashboard-control px-3 py-2.5 text-xs font-semibold text-[var(--sgs-primary)]">{ui.contract}</a>
                            <a href="/inventory" className="dashboard-control px-3 py-2.5 text-xs font-semibold text-[var(--sgs-primary)]">{ui.listing}</a>
                        </div>
                        <KpiTargetSettings user={currentUser} language={language} notify={notify} />
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="dashboard-control dashboard-export flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={isExporting ? t('dash.exporting') : t('common.export')}
                        >
                            {isExporting ? (
                                <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            )}
                            {isExporting ? t('dash.exporting') : t('common.export')}
                        </button>
                        <div className="min-w-0 flex-1 sm:w-36">
                            <Dropdown
                                value={timeRange}
                                onChange={(val) => setTimeRange(val as string)}
                                options={[
                                    { value: '7d', label: t('dash.filter_7d') },
                                    { value: '30d', label: t('dash.filter_30d') },
                                    { value: '90d', label: language === 'vn' ? '90 ngày' : '90 days' },
                                    { value: 'all', label: t('dash.filter_all') }
                                ]}
                                 className="dashboard-control dashboard-date-filter w-full text-xs"
                            />
                        </div>
                    </div>
                </header>

                <PriorityAlertCenter analytics={overview} language={language} />
                <div className="xl:hidden">
                    <div className="mb-2 dashboard-subhead">{ui.quick}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <a href="/leads" className="dashboard-control px-3 py-2.5 text-center text-xs font-semibold text-[var(--sgs-primary)]">{ui.addLead}</a>
                        <a href="/contracts" className="dashboard-control px-3 py-2.5 text-center text-xs font-semibold text-[var(--sgs-primary)]">{ui.contract}</a>
                        <a href="/inventory" className="dashboard-control px-3 py-2.5 text-center text-xs font-semibold text-[var(--sgs-primary)]">{ui.listing}</a>
                    </div>
                </div>
                <WorkQueueStrip analytics={overview} language={language} />

                {(analytics.totalLeads ?? 0) < 5 && !localStorage.getItem('sgs_guide_dismissed') && (
                    <div className="dashboard-guide flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-guide-banner>
                        <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {language === 'vn' ? 'Bắt đầu với SGS LAND' : 'Getting started with SGS LAND'}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                {language === 'vn' ? 'Xem hướng dẫn sử dụng 12 tính năng — hoàn thành trong 15 phút.' : 'Read the full feature guide — complete in 15 minutes.'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <a href="/huong-dan-su-dung" className="text-xs font-semibold text-[var(--sgs-primary)] underline underline-offset-4">
                                {language === 'vn' ? 'Xem hướng dẫn' : 'View guide'}
                            </a>
                            <button
                                onClick={(e) => {
                                    localStorage.setItem('sgs_guide_dismissed', '1');
                                    (e.currentTarget.closest('[data-guide-banner]') as HTMLElement | null)?.remove();
                                }}
                                className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                title={language === 'vn' ? 'Ẩn' : 'Dismiss'}
                                aria-label={language === 'vn' ? 'Ẩn hướng dẫn' : 'Dismiss guide'}
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                )}

                <div ref={dashboardRef} data-dashboard-export-root className="space-y-6">
                    <section className="dashboard-kpis" aria-label={t('dash.overview_subtitle')}>
                        <div className="dashboard-kpi">
                            <div className="kpi-label">{t('dash.revenue_title')}</div>
                            <div className="kpi-value dash-number break-words">{formatCompactNumber(analytics.revenue || 0)}</div>
                            <div className="kpi-meta"><TrendIndicator value={analytics.revenueDelta || 0} label={t('dash.vs_last_period')} /></div>
                            <ProgressBar value={revenueTarget.progress} label={revenueTarget.target > 0 ? `${revenueTarget.progress}% ${ui.target}` : ui.targetUnset} muted={revenueTarget.target === 0} />
                        </div>
                        <div className="dashboard-kpi">
                            <div className="kpi-label">{t('dash.pipeline_value')}</div>
                            <div className="kpi-value dash-number break-words">{formatCompactNumber(analytics.pipelineValue || 0)}</div>
                            <div className="kpi-meta">{t('dash.win_probability')}: <strong className="dash-number text-[var(--sgs-primary)]">{analytics.winProbability || 0}%</strong></div>
                            <ProgressBar value={pipelineTarget.progress} label={pipelineTarget.target > 0 ? `${pipelineTarget.progress}% ${ui.target}` : ui.targetUnset} muted={pipelineTarget.target === 0} />
                        </div>
                        <div className="dashboard-kpi">
                            <div className="kpi-label">{t('dash.ai_deflection_rate')}</div>
                            <div className="kpi-value dash-number">{analytics.aiDeflectionRate || 0}%</div>
                            <div className="kpi-meta"><TrendIndicator value={analytics.aiDeflectionRateDelta || 0} label={t('dash.vs_last_period')} /></div>
                        </div>
                        <div className="dashboard-kpi">
                            <div className="kpi-label">{t('dash.sales_velocity')}</div>
                            <div className="kpi-value dash-number">{analytics.salesVelocity > 0 && analytics.salesVelocity < 1 ? '< 1' : (analytics.salesVelocity || '--')}</div>
                            <div className="kpi-meta">{analytics.salesVelocity > 0 ? t('dash.days_to_close') : t('dash.no_closed_deals')} <TrendIndicator value={analytics.salesVelocityDelta || 0} label="" /></div>
                            <ProgressBar value={velocityTarget.progress} label={velocityTarget.target > 0 ? `${velocityTarget.progress}% ${ui.target}` : ui.targetUnset} muted={velocityTarget.target === 0} />
                        </div>
                    </section>

                    <section className="dashboard-panel" aria-label={t('dash.pipeline_title')}>
                        <div className="dashboard-panel-head">
                            <h2>{t('dash.pipeline_title')}</h2>
                            <div className="flex items-center gap-3 text-right">
                                <SegmentToggle value={pipelineMode} onChange={(value) => setPipelineMode(value as 'overview' | 'source')} options={[{ value: 'overview', label: ui.overview }, { value: 'source', label: ui.source }]} />
                                <div>
                                    <div className="dashboard-subhead">{t('dash.total_leads')}</div>
                                    <div className="dash-number mt-1 text-lg font-semibold text-[var(--text-primary)]">{analytics.totalLeads}</div>
                                </div>
                                <div className="hidden sm:block">
                                    <div className="dashboard-subhead">{t('dash.conversion')}</div>
                                    <div className="dash-number mt-1 text-lg font-semibold text-[var(--sgs-verified)]">{!isNaN(analytics.conversionRate) ? analytics.conversionRate : 0}%</div>
                                </div>
                            </div>
                        </div>
                        <div className="dashboard-workbench">
                            <div className="dashboard-chart">
                                <div className="mb-3 flex items-center justify-between">
                                    <TrendIndicator value={analytics.totalLeadsDelta} label={t('dash.total_leads')} />
                                    <span className="dashboard-subhead">{timeRange}</span>
                                </div>
                                <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
                                    {pipelineMode === 'source' ? (
                                        <div className="max-h-[285px] space-y-3 overflow-y-auto px-2 pt-4 pr-3">
                                            {sourceData.length ? sourceData.map(([source, count]: any) => (
                                                <div key={source}>
                                                    <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--text-secondary)]">{source}</span><strong className="font-mono text-[var(--text-primary)]">{count}</strong></div>
                                                    <div className="h-2 rounded-full bg-[var(--glass-surface-hover)]"><div className="h-full rounded-full bg-[var(--sgs-primary)]" style={{ width: `${analytics.totalLeads ? Math.min(100, (count / analytics.totalLeads) * 100) : 0}%` }} /></div>
                                                </div>
                                            )) : <EmptyState message={language === 'vn' ? 'Chưa có dữ liệu nguồn khách hàng' : 'No lead source data'} />}
                                        </div>
                                    ) : analytics.leadsTrend && analytics.leadsTrend.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                                            <ComposedChart data={analytics.leadsTrend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.colors.grid} opacity={0.5} />
                                                <XAxis dataKey="date" hide />
                                                <Tooltip content={<CustomTooltip t={t} formatCurrency={formatCurrency} language={language} />} cursor={{fill: 'transparent'}} />
                                                <Bar dataKey="count" fill="var(--sgs-primary)" barSize={18} radius={[2, 2, 0, 0]} name={t('dash.chart_new_leads')} />
                                                <Line type="monotone" dataKey="count" stroke="var(--sgs-accent)" strokeWidth={2} dot={{r: 3, fill: 'var(--bg-surface)', stroke: 'var(--sgs-accent)', strokeWidth: 2}} name={t('dash.chart_trend')} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyState message={t('dash.chart_empty')} />}
                                </div>
                            </div>
                            <div className="dashboard-side">
                                <div className="dashboard-subhead mb-2">{t('dash.activity_title')}</div>
                                <div className="max-h-[315px] overflow-y-auto no-scrollbar">
                                    {(analytics.recentActivities || []).map((act: any, idx: number) => (
                                        <ActivityItem key={act.id != null ? `${act.id}-${idx}` : idx} activity={act} />
                                    ))}
                                    {(!analytics.recentActivities || analytics.recentActivities.length === 0) && <div className="py-10"><EmptyState message={t('dash.activity_empty')} /></div>}
                                </div>
                            </div>
                        </div>
                        <div className="dashboard-secondary">
                         <section>
                                <div className="mb-2 flex items-center justify-between gap-2"><div className="dashboard-subhead">{t('dash.market_pulse_title')}</div><SegmentToggle value="pulse" onChange={() => undefined} options={[{ value: 'pulse', label: ui.overview }]} /></div>
                                <div className="h-[270px] w-full min-w-0">
                                    {analytics.marketPulse && analytics.marketPulse.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                                            <ScatterChart margin={{ top: 15, right: 15, bottom: 15, left: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} opacity={0.5} />
                                                <XAxis type="number" dataKey="area" name={t('dash.scatter_area')} unit="m²" stroke={chartTheme.colors.text} fontSize={11} tickLine={false} axisLine={false} />
                                                <YAxis type="number" dataKey="price" name={t('dash.scatter_price')} unit={` ${t('dash.scatter_price_unit')}`} stroke={chartTheme.colors.text} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} />
                                                <ZAxis type="number" dataKey="interest" range={[100, 850]} name={t('dash.scatter_interest')} />
                                                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTooltip t={t} />} />
                                                <Scatter name={t('dash.scatter_interest')} data={analytics.marketPulse} opacity={0.78}>
                                                    {analytics.marketPulse.map((entry: any, index: number) => {
                                                        const colors = ['var(--sgs-primary)', 'var(--sgs-verified)', 'var(--sgs-accent)', 'var(--sgs-accent-text)', 'var(--sgs-primary-deep)', 'var(--sgs-text-muted)'];
                                                        const hash = entry.location.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                                                        return <Cell key={`cell-${index}`} fill={colors[hash % colors.length]} />;
                                                    })}
                                                </Scatter>
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyState message={t('dash.market_pulse_empty')} />}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {Array.from(new Set(analytics.marketPulse?.map((item: any) => item.location) || [])).map((loc: any, idx: number) => (
                                        <span key={idx} className="text-xs text-[var(--text-secondary)]">{loc}</span>
                                    ))}
                                </div>
                                <div className="mt-4 border-t border-[var(--glass-border)] pt-3">
                                    <div className="mb-2 flex items-center justify-between"><div className="dashboard-subhead">{ui.project}</div><span className="text-xs text-[var(--text-tertiary)]">{overview.projectBreakdown?.length ?? 0}</span></div>
                                    <div className="space-y-2">
                                        {(overview.projectBreakdown || []).slice(0, 4).map((project: any, index: number) => <div key={project.id ?? index} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-[var(--text-secondary)]">{project.name}</span><span className="font-mono text-[var(--text-tertiary)]">{project.leads ?? project.count ?? 0}</span></div>)}
                                        {!overview.projectBreakdown?.length && <div className="text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Chưa có dữ liệu dự án' : 'No project data yet'}</div>}
                                    </div>
                                </div>
                            </section>
                            <section>
                                <div className="mb-2 flex items-center justify-between gap-2"><div className="dashboard-subhead">{t('dash.leaderboard_title')}</div><SegmentToggle value={leaderboardMode} onChange={(value) => setLeaderboardMode(value as 'individual' | 'team')} options={[{ value: 'individual', label: ui.individual }, { value: 'team', label: ui.team }]} /></div>
                                <div className="max-h-[305px] overflow-y-auto no-scrollbar">
                                    {(leaderboardMode === 'team' ? (overview.teamLeaderboard || []) : (analytics.agentLeaderboard || [])).map((agent: any, idx: number) => (
                                        <div key={agent.id ?? agent.name ?? idx} className="dashboard-ranking">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <AgentAvatar name={agent.name} avatar={agent.avatar} />
                                                <div className="min-w-0">
                                                     <div className="flex items-center gap-1.5"><div className="rank-name truncate">{agent.name}</div>{agent.overloaded && <span className="rounded-full bg-[var(--ui-danger)]/10 px-1.5 py-0.5 text-xs font-bold text-[var(--ui-danger)]">{ui.overloaded}</span>}</div>
                                                    <div className="rank-detail">{agent.deals} {t('dash.deals_closed')}</div>
                                                </div>
                                            </div>
                                            <div className="rank-metric"><span>{t('dash.close_rate')}</span>{agent.closeRate}%</div>
                                            <div className="rank-metric"><span>{t('dash.sla_score')}</span>{agent.slaScore}/100</div>
                                        </div>
                                    ))}
                                    {(!(leaderboardMode === 'team' ? overview.teamLeaderboard : analytics.agentLeaderboard)?.length) && <div className="py-10"><EmptyState message={t('dash.leaderboard_empty')} /></div>}
                                </div>
                            </section>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3" aria-label={language === 'vn' ? 'Tóm tắt vận hành' : 'Operations summary'}>
                        <section className="dashboard-panel" aria-label={language === 'vn' ? 'Cố Vấn AI' : 'AI Advisor'}>
                            <div className="dashboard-panel-head">
                                <h2>{language === 'vn' ? 'Cố Vấn AI' : 'AI Advisor'}</h2>
                                <a href="/ai-governance" className="text-xs font-semibold text-[var(--sgs-primary)]">AI</a>
                            </div>
                            <div className="flex items-center gap-3 px-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]" aria-hidden="true">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                                </div>
                                <div><div className="text-2xl font-extrabold text-[var(--text-primary)]">{overview.aiAdvisor?.count ?? 0}</div><div className="text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Gợi ý trong ngày' : 'Suggestions today'}</div></div>
                                <div className="ml-auto text-right"><div className={`text-lg font-bold ${(overview.aiAdvisor?.anomalies ?? 0) > 0 ? 'text-[var(--ui-danger)]' : 'text-[var(--text-tertiary)]'}`}>{overview.aiAdvisor?.anomalies ?? 0}</div><div className="text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Cảnh báo bất thường' : 'Anomaly alerts'}</div></div>
                            </div>
                            <div className="mt-4 space-y-2 px-4 pb-4">
                                {(Array.isArray(overview.aiAdvisor?.suggestions) ? overview.aiAdvisor.suggestions : []).slice(0, 3).map((item: any, index: number) => <div key={index} className="rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">{typeof item === 'string' ? item : item?.title || item?.message || item?.content || (language === 'vn' ? 'Gợi ý AI chưa có nội dung hiển thị' : 'AI suggestion has no display text')}</div>)}
                                {!overview.aiAdvisor?.suggestions?.length && <div className="text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Chưa có gợi ý mới' : 'No new suggestions'}</div>}
                            </div>
                        </section>
                        <InventoryOverviewWidget analytics={overview} language={language} />
                        <InboxOverviewWidget analytics={overview} language={language} />
                    </section>

                    <SearchAnalyticsWidget analytics={overview} language={language} />

                    {(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(analytics.user?.role ?? '')) && (
                        <>
                            <VisitorFunnelWidget days={selectedDays} language={language} />
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <GeoLocationTable t={t} days={selectedDays} />
                                <RealtimeTrafficWidget t={t} theme={chartTheme} />
                            </div>
                        </>
                    )}
                    <section className="dashboard-panel" aria-label={ui.demand}>
                        <div className="dashboard-panel-head"><h2>{ui.demand}</h2><span className="text-xs text-[var(--text-tertiary)]">{overview.demandAreas?.length ?? 0}</span></div>
                        <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
                            {(overview.demandAreas || []).slice(0, 8).map((area: any, index: number) => (
                                <div key={area.name ?? index} className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-3">
                                    <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-[var(--text-secondary)]">{area.name}</span><strong className="font-mono text-[var(--sgs-primary)]">{area.score ?? area.count ?? 0}</strong></div>
                                    <div className="mt-2 h-1.5 rounded-full bg-[var(--glass-surface-hover)]"><div className="h-full rounded-full bg-[var(--sgs-accent)]" style={{ width: `${Math.min(100, Number(area.score ?? area.count ?? 0))}%` }} /></div>
                                </div>
                            ))}
                        </div>
                        {!overview.demandAreas?.length && <div className="mx-4 mb-4 py-3 text-xs text-[var(--text-tertiary)]">{language === 'vn' ? 'Chưa có dữ liệu nhu cầu theo khu vực' : 'No area demand data yet'}</div>}
                    </section>
                </div>
            </div>
        </div>
        {createPortal(
            toast ? (
                <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            ) : null,
            document.body
        )}
    </>
    );
};
export default Dashboard;