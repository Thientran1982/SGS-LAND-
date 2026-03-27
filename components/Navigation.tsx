
import React, { useState, memo, useMemo, useRef, useEffect } from 'react';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
import { ROUTES } from '../config/routes';
import { AppNotification } from '../services/api/notificationApi';

interface CommandCenterProps {
    title: string;
    user: User;
    onSearch: () => void;
    onMenuClick?: () => void;
    onNavigate: (path: string) => void;
    isProfileActive?: boolean;
    unreadCount?: number;
    notifications?: AppNotification[];
    onMarkRead?: (id: string) => void;
    onMarkAllRead?: () => void;
}

// -----------------------------------------------------------------------------
// 1. ASSETS
// -----------------------------------------------------------------------------

const ICONS = {
    MENU: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    SEARCH: <svg className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    SEARCH_MOBILE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    BELL: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    HEART: <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    CHECK_ALL: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M3 17l4 4L19 5" /></svg>,
};

// -----------------------------------------------------------------------------
// 2. HELPERS
// -----------------------------------------------------------------------------

function relativeTime(iso: string, t: (k: string) => string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notif.just_now');
    if (mins < 60) return `${mins} ${t('notif.minutes_ago')}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ${t('notif.hours_ago')}`;
    const days = Math.floor(hrs / 24);
    return `${days} ${t('notif.days_ago')}`;
}

// -----------------------------------------------------------------------------
// 3. NOTIFICATION ICON MAP
// -----------------------------------------------------------------------------
const NOTIF_ICON: Record<string, React.ReactNode> = {
    PROPOSAL_INTEREST: ICONS.HEART,
};

// -----------------------------------------------------------------------------
// 4. SUB-COMPONENTS
// -----------------------------------------------------------------------------

const UserAvatar = memo(({ user, isActive }: { user: User, isActive?: boolean }) => {
    const [imgError, setImgError] = useState(false);

    React.useEffect(() => {
        setImgError(false);
    }, [user.avatar]);

    const hasAvatar = !!user.avatar && !imgError;

    return (
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0.5 border-2 shadow-lg transition-all duration-300 relative overflow-hidden flex items-center justify-center bg-[var(--glass-surface-hover)] dark:bg-slate-800
            ${isActive 
                ? 'border-indigo-500 shadow-indigo-500/20' 
                : 'border-white dark:border-white/10 group-hover:border-indigo-500 group-hover:shadow-indigo-500/20'}`
        }>
            {hasAvatar ? (
                <img 
                    src={user.avatar} 
                    className="w-full h-full rounded-full object-cover" 
                    alt={user.name}
                    onError={() => setImgError(true)} 
                />
            ) : (
                <span className="text-sm font-bold text-[var(--text-tertiary)]">
                    {user.name?.charAt(0).toUpperCase() ?? '?'}
                </span>
            )}
        </div>
    );
});

// Notification panel dropdown
const NotificationPanel = memo(({ 
    notifications, 
    onMarkRead, 
    onMarkAllRead,
    onNavigate,
    onClose,
    t,
}: { 
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onNavigate: (path: string) => void;
    onClose: () => void;
    t: (key: string) => string;
}) => {
    return (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
                <span className="text-sm font-bold text-[var(--text-primary)]">{t('nav.notifications')}</span>
                {notifications.some(n => !n.readAt) && (
                    <button
                        onClick={() => { onMarkAllRead(); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                        title={t('nav.mark_all_read')}
                    >
                        {ICONS.CHECK_ALL}
                        {t('nav.mark_all_read')}
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('nav.no_notifications')}</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div 
                            key={notif.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--glass-border)] last:border-0 transition-colors ${!notif.readAt ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-[var(--glass-surface-hover)]'}`}
                        >
                            {/* Icon */}
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                {NOTIF_ICON[notif.type] ?? ICONS.BELL}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">{notif.title}</span>
                                    {!notif.readAt && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                </div>
                                {notif.body && (
                                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{notif.body}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-[var(--text-tertiary)]">{relativeTime(notif.createdAt, t)}</span>
                                    {notif.metadata?.leadId && (
                                        <button
                                            onClick={() => {
                                                onMarkRead(notif.id);
                                                onNavigate(`${ROUTES.LEADS}?leadId=${notif.metadata?.leadId}`);
                                                onClose();
                                            }}
                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                        >
                                            {t('notif.view_lead')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Mark read dot */}
                            {!notif.readAt && (
                                <button
                                    onClick={() => onMarkRead(notif.id)}
                                    className="w-5 h-5 rounded-full text-slate-300 hover:text-indigo-500 transition-colors shrink-0 mt-0.5 flex items-center justify-center"
                                    title="Đánh dấu đã đọc"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// 5. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const CommandCenter: React.FC<CommandCenterProps> = memo(({ 
    title, 
    user, 
    onSearch, 
    onMenuClick, 
    onNavigate, 
    isProfileActive,
    unreadCount = 0,
    notifications = [],
    onMarkRead,
    onMarkAllRead,
}) => {
    const { t } = useTranslation();
    const [panelOpen, setPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel on outside click
    useEffect(() => {
        if (!panelOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [panelOpen]);
    
    return (
        <div className="h-12 sm:h-14 px-4 sm:px-6 md:px-8 flex items-center justify-between relative z-30 transition-all duration-300 group/header rounded-none sm:rounded-t-[24px] -mx-[1px] -mt-[1px]">
            {/* Background Blur Layer */}
            <div className="absolute inset-0 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] shadow-sm z-0 rounded-none sm:rounded-t-[24px]"></div>

            {/* LEFT: Mobile Menu + Global Search */}
            <div className="flex items-center gap-3 sm:gap-4 relative z-10 flex-1 min-w-0 mr-2">
                <button
                    onClick={onMenuClick}
                    className="md:hidden group flex items-center justify-center -ml-2 min-h-[44px] min-w-[44px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-xl"
                    aria-label={t('common.menu')}
                    aria-expanded={false}
                >
                    <span className="h-9 w-9 flex items-center justify-center rounded-xl text-[var(--text-tertiary)] group-hover:bg-[var(--glass-surface-hover)] group-hover:text-[var(--text-primary)] group-active:scale-95 transition-all">
                        {ICONS.MENU}
                    </span>
                </button>

                {/* Global Search Trigger (Desktop) */}
                <div className="hidden md:flex flex-1 max-w-lg relative z-10">
                    <button 
                        onClick={onSearch}
                        aria-label={t('common.search')}
                        className="w-full group relative flex items-center justify-between bg-[var(--glass-surface-hover)]/50 dark:bg-white/5 border border-[var(--glass-border)] dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-surface)] dark:hover:bg-[var(--bg-surface)]/10 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            {ICONS.SEARCH}
                            <span className="font-medium">{t('common.search')}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* RIGHT: Notification Bell + Actions & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 relative z-10 shrink-0">
                {/* Mobile Search Icon */}
                <button
                    onClick={onSearch}
                    className="md:hidden group flex items-center justify-center min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-xl"
                    aria-label={t('common.search')}
                >
                    <span className="h-9 w-9 flex items-center justify-center rounded-xl text-[var(--text-tertiary)] group-hover:bg-[var(--glass-surface-hover)] group-hover:text-[var(--text-primary)] group-active:scale-95 transition-all">
                        {ICONS.SEARCH_MOBILE}
                    </span>
                </button>

                {/* Notification Bell */}
                <div ref={panelRef} className="relative">
                    <button
                        onClick={() => setPanelOpen(prev => !prev)}
                        className="group relative flex items-center justify-center min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-xl"
                        aria-label={t('nav.notifications')}
                    >
                        <span className="h-9 w-9 flex items-center justify-center rounded-xl text-[var(--text-tertiary)] group-hover:bg-[var(--glass-surface-hover)] group-hover:text-[var(--text-primary)] group-active:scale-95 transition-all relative">
                            {ICONS.BELL}
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center leading-none shadow-sm">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </span>
                    </button>

                    {panelOpen && (
                        <NotificationPanel
                            notifications={notifications}
                            onMarkRead={(id) => { onMarkRead?.(id); }}
                            onMarkAllRead={() => { onMarkAllRead?.(); }}
                            onNavigate={onNavigate}
                            onClose={() => setPanelOpen(false)}
                            t={t}
                        />
                    )}
                </div>

                {/* Profile */}
                <button
                    onClick={() => onNavigate(ROUTES.PROFILE)}
                    className="flex items-center gap-2 sm:gap-3 pl-1 group cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-xl"
                    title={t('menu.profile')}
                    aria-label={t('menu.profile')}
                >
                    <div className="text-right hidden sm:block leading-tight">
                        <div className={`text-sm font-bold transition-colors ${isProfileActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-primary)] group-hover:text-indigo-600'}`}>
                            {user.name}
                        </div>
                        <div className="text-xs2 text-[var(--text-tertiary)] font-medium">
                            {t(`role.${user.role}`) || user.role}
                        </div>
                    </div>
                    
                    <UserAvatar user={user} isActive={isProfileActive} />
                </button>
            </div>
        </div>
    );
});

CommandCenter.displayName = 'CommandCenter';
