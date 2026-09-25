import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart2,
    Bot,
    Building2,
    ChevronDown,
    CircleDollarSign,
    ClipboardList,
    Inbox,
    LayoutDashboard,
    LogOut,
    Megaphone,
    MessageCircle,
    Moon,
    MoreHorizontal,
    Package,
    Search,
    Settings,
    Sparkles,
    Sun,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../config/routes';
import { db } from '../services/dbApi';
import { socket } from '../services/websocket';
import { useTranslation } from '../services/i18n';
import { AppNotification } from '../services/api/notificationApi';
import { NavGroup, NavItem, User } from '../types';
import { Logo } from './Logo';
import { NotificationButton, UserAvatar } from './Navigation';

export type WorkspaceHubId =
    | 'overview'
    | 'inbox'
    | 'leads'
    | 'listings'
    | 'deals'
    | 'work'
    | 'marketing'
    | 'reports'
    | 'ai'
    | 'settings';

interface HubDefinition {
    id: WorkspaceHubId;
    labelKey: string;
    icon: LucideIcon;
    routes: string[];
}

export interface WorkspaceHub extends HubDefinition {
    items: NavItem[];
}

const HUB_DEFINITIONS: HubDefinition[] = [
    { id: 'overview', labelKey: 'shell.hub.overview', icon: LayoutDashboard, routes: [ROUTES.DASHBOARD, ROUTES.FAVORITES, ROUTES.APPROVALS] },
    { id: 'inbox', labelKey: 'shell.hub.inbox', icon: Inbox, routes: [ROUTES.INBOX] },
    { id: 'leads', labelKey: 'shell.hub.leads', icon: Users, routes: [ROUTES.LEADS, ROUTES.SCORING_RULES, ROUTES.ROUTING_RULES, ROUTES.SEQUENCES] },
    { id: 'listings', labelKey: 'shell.hub.listings', icon: Building2, routes: [ROUTES.INVENTORY, ROUTES.UNIT_INVENTORY, ROUTES.PROJECTS, ROUTES.SEARCH, ROUTES.AUCTION] },
    { id: 'deals', labelKey: 'shell.hub.deals', icon: CircleDollarSign, routes: [ROUTES.CONTRACTS, ROUTES.CHECKOUT, ROUTES.COMMISSIONS] },
    { id: 'work', labelKey: 'shell.hub.work', icon: ClipboardList, routes: [ROUTES.TASK_DASHBOARD, ROUTES.TASKS, ROUTES.TASK_KANBAN, ROUTES.EMPLOYEES, ROUTES.TASK_REPORTS] },
    { id: 'marketing', labelKey: 'shell.hub.marketing', icon: Megaphone, routes: [ROUTES.CAMPAIGNS, ROUTES.SOCIAL_PUBLISHING, ROUTES.MY_LANDING, ROUTES.LANDING_AI, ROUTES.SEO_MANAGER] },
    { id: 'reports', labelKey: 'shell.hub.reports', icon: BarChart2, routes: [ROUTES.REPORTS, ROUTES.MARKET_REPORT, ROUTES.VALUATION_ACCURACY] },
    {
        id: 'ai',
        labelKey: 'shell.hub.ai',
        icon: Sparkles,
        routes: [ROUTES.AI_ADVISOR, ROUTES.AGENT_COCKPIT, ROUTES.AGENT_TASKS, ROUTES.AGENT_AUDIT, ROUTES.AI_GOVERNANCE, ROUTES.AI_EVALUATION, ROUTES.ADMIN_AI_COST, ROUTES.KNOWLEDGE],
    },
    {
        id: 'settings',
        labelKey: 'shell.hub.settings',
        icon: Settings,
        routes: [
            ROUTES.PROFILE,
            ROUTES.ENTERPRISE_SETTINGS,
            ROUTES.ADMIN_USERS,
            ROUTES.VENDOR_MANAGEMENT,
            ROUTES.BILLING,
            ROUTES.SECURITY,
            ROUTES.SYSTEM,
            ROUTES.DATA_PLATFORM,
            ROUTES.ERROR_MONITOR,
            ROUTES.SCRAPER,
            ROUTES.CUSTOM_FIELDS,
            ROUTES.MARKETPLACE,
            ROUTES.MOBILE_APP,
        ],
    },
];

const routeHub = new Map<string, WorkspaceHubId>(
    HUB_DEFINITIONS.flatMap(hub => hub.routes.map(route => [route, hub.id] as const)),
);

const profileItem: NavItem = {
    id: 'profile',
    labelKey: 'menu.profile',
    route: ROUTES.PROFILE,
    iconKey: ROUTES.PROFILE,
};

export function buildWorkspaceHubs(menuGroups: NavGroup[]): WorkspaceHub[] {
    const definitions = HUB_DEFINITIONS.map(hub => ({ ...hub, routes: [...hub.routes] }));
    const byRoute = new Map<string, NavItem>();
    for (const group of menuGroups) {
        for (const item of group.items ?? []) {
            if (!byRoute.has(item.route)) byRoute.set(item.route, item);
        }
    }
    if (!byRoute.has(ROUTES.PROFILE)) byRoute.set(ROUTES.PROFILE, profileItem);

    const knownRoutes = new Set(definitions.flatMap(hub => hub.routes));
    const unassigned = [...byRoute.values()].filter(item => !knownRoutes.has(item.route) && item.route !== ROUTES.LANDING);
    const fallbackHub = definitions.find(hub => hub.id === 'settings');
    if (fallbackHub) {
        for (const item of unassigned) {
            if (!fallbackHub.routes.includes(item.route)) fallbackHub.routes.push(item.route);
        }
    }

    return definitions.map(hub => ({
        ...hub,
        items: hub.routes
            .map(route => byRoute.get(route))
            .filter((item): item is NavItem => Boolean(item)),
    })).filter(hub => hub.items.length > 0);
}

interface WorkspaceNavigationProps {
    children: React.ReactNode;
    activePage: string;
    menuGroups: NavGroup[];
    user: User;
    assistantOpen: boolean;
    onNavigate: (path: string) => void;
    onLogout: () => void;
    onOpenAssistant: () => void;
    unreadCount: number;
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onDeleteNotification: (id: string) => void;
    onDeleteAllRead: () => void;
    onSearch: () => void;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    themeMode: 'light' | 'dark';
    language: string;
}

interface WorkspaceRailProps {
    activePage: string;
    hubs: WorkspaceHub[];
    user: User;
    onNavigate: (path: string) => void;
    onLogout: () => void;
    onOpenAssistant: () => void;
    unreadCount: number;
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onDeleteNotification: (id: string) => void;
    onDeleteAllRead: () => void;
    onSearch: () => void;
    inboxUnread?: number;
}

const WorkspaceRail: React.FC<WorkspaceRailProps> = ({
    activePage,
    hubs,
    user,
    onNavigate,
    onLogout,
    onOpenAssistant,
    unreadCount,
    notifications,
    onMarkRead,
    onMarkAllRead,
    onDeleteNotification,
    onDeleteAllRead,
    onSearch,
    inboxUnread = 0,
}) => {
    const { t } = useTranslation();
    const [profileOpen, setProfileOpen] = useState(false);
    const activeHubId = hubs.find(hub => hub.items.some(item => item.route === activePage))?.id
        ?? routeHub.get(activePage)
        ?? 'overview';

    return (
        <aside className="flex h-full w-full flex-col items-center bg-[var(--sgs-hero-deep)] px-2.5 py-3 text-[var(--sgs-champagne)]">
            <button
                type="button"
                onClick={() => onNavigate(ROUTES.DASHBOARD)}
                className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 text-[var(--sgs-champagne)] dark:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                aria-label={t('nav.go_to_dashboard')}
                title={t('nav.go_to_dashboard')}
            >
                <Logo className="h-8 w-8" />
            </button>

            <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-3" aria-label={t('shell.primary_navigation')}>
                <button
                    type="button"
                    onClick={onSearch}
                    aria-label={t('common.search')}
                    title={t('common.search')}
                    className="group relative mb-2 flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl text-[var(--sgs-champagne)] transition-colors hover:bg-[var(--ui-text-inverse)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                >
                    <Search size={20} aria-hidden="true" />
                    <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-[var(--sgs-primary-deep)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ui-text-inverse)] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {t('common.search')}
                    </span>
                </button>
                {hubs.map(hub => {
                    const Icon = hub.icon;
                    const isActive = activeHubId === hub.id;
                    return (
                        <button
                            type="button"
                            key={hub.id}
                            onClick={() => {
                                const nextRoute = hub.items[0]?.route;
                                if (nextRoute) onNavigate(nextRoute);
                            }}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={hub.id === 'inbox' && inboxUnread > 0 ? `${t(hub.labelKey)}, ${t('shell.inbox_unread').replace('{n}', String(inboxUnread))}` : t(hub.labelKey)}
                            title={t(hub.labelKey)}
                            className={`group relative flex min-h-12 w-full shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)] ${
                                isActive
                                    ? 'bg-[var(--sgs-champagne)] text-[var(--sgs-primary-deep)]'
                                    : 'text-[var(--sgs-champagne)] hover:bg-[var(--ui-text-inverse)]/10'
                            }`}
                        >
                            <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
                            {hub.id === 'inbox' && inboxUnread > 0 && (
                                <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sgs-accent)] px-1 text-[10px] font-bold leading-none text-[var(--sgs-hero-deep)]" aria-hidden="true">{inboxUnread > 99 ? '99+' : inboxUnread}</span>
                            )}
                            <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-[var(--sgs-primary-deep)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ui-text-inverse)] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                {t(hub.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-[var(--ui-text-inverse)]/15 pt-2">
                <button
                    type="button"
                    onClick={onOpenAssistant}
                    className="group relative flex min-h-12 w-full items-center justify-center rounded-2xl text-[var(--sgs-champagne)] transition-colors hover:bg-[var(--ui-text-inverse)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                    aria-label={t('shell.assistant_open')}
                    title={t('shell.assistant_open')}
                >
                    <MessageCircle size={20} aria-hidden="true" />
                    <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-[var(--sgs-primary-deep)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ui-text-inverse)] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {t('shell.assistant_open')}
                    </span>
                </button>
                <NotificationButton
                    placement="rail"
                    className="w-full"
                    unreadCount={unreadCount}
                    notifications={notifications}
                    onMarkRead={onMarkRead}
                    onMarkAllRead={onMarkAllRead}
                    onDeleteNotification={onDeleteNotification}
                    onDeleteAllRead={onDeleteAllRead}
                    onNavigate={onNavigate}
                />

                <div className="relative flex w-full justify-center">
                    {profileOpen && (
                        <div
                            role="menu"
                            aria-label={t('menu.profile')}
                            className="absolute bottom-0 left-full z-[130] ml-3 w-64 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-2 text-[var(--text-primary)] shadow-2xl"
                        >
                            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                                <UserAvatar user={user} isActive={activePage === ROUTES.PROFILE} />
                                <div className="min-w-0 leading-tight">
                                    <div className="truncate text-sm font-bold">{user.name}</div>
                                    <div className="truncate text-xs text-[var(--text-tertiary)]">{t(`role.${user.role?.toUpperCase()}`) || user.role}</div>
                                </div>
                            </div>
                            <div className="my-1 border-t border-[var(--glass-border)]" />
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setProfileOpen(false); onNavigate(ROUTES.PROFILE); }}
                                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                            >
                                <UserAvatar user={user} isActive={activePage === ROUTES.PROFILE} />
                                {t('menu.profile')}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setProfileOpen(false); onLogout(); }}
                                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[var(--ui-danger)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                            >
                                <LogOut size={16} aria-hidden="true" />
                                {t('menu.logout')}
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setProfileOpen(value => !value)}
                        aria-label={t('menu.profile')}
                        aria-expanded={profileOpen}
                        aria-haspopup="menu"
                        title={t('menu.profile')}
                        className="flex min-h-12 w-full items-center justify-center rounded-2xl hover:bg-[var(--ui-text-inverse)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-accent)]"
                    >
                        <UserAvatar user={user} isActive={activePage === ROUTES.PROFILE} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

interface WorkspaceTopBarProps {
    activePage: string;
    activeHub?: WorkspaceHub;
    assistantOpen: boolean;
    unreadCount: number;
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onDeleteNotification: (id: string) => void;
    onDeleteAllRead: () => void;
    onNavigate: (path: string) => void;
    onSearch: () => void;
    onOpenAssistant: () => void;
    onToggleTheme: () => void;
    onToggleLanguage: () => void;
    themeMode: 'light' | 'dark';
    language: string;
}

const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = ({
    activePage,
    activeHub,
    assistantOpen,
    unreadCount,
    notifications,
    onMarkRead,
    onMarkAllRead,
    onDeleteNotification,
    onDeleteAllRead,
    onNavigate,
    onSearch,
    onOpenAssistant,
    onToggleTheme,
    onToggleLanguage,
    themeMode,
    language,
}) => {
    const { t } = useTranslation();
    const pageTitle = t(`menu.${activePage}`);
    const hubLabel = activeHub ? t(activeHub.labelKey) : '';
    const shortcutLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

    return (
        <header className="relative z-30 flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 sm:px-6 lg:px-7">
            <div className="min-w-0 flex-1">
                {hubLabel && hubLabel.toLocaleLowerCase() !== (pageTitle || activePage).toLocaleLowerCase() && (
                    <div className="mb-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{hubLabel}</div>
                )}
                <h1 className="truncate text-base font-bold leading-5 text-[var(--text-primary)] sm:text-lg">
                    {pageTitle || activePage}
                </h1>
            </div>

            <button
                type="button"
                onClick={onSearch}
                aria-label={t('common.search')}
                className="group hidden h-11 w-[min(32vw,390px)] shrink-0 items-center gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 text-left text-sm text-[var(--text-tertiary)] transition-colors hover:border-[var(--ui-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] md:flex"
            >
                <Search size={17} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{t('shell.search_placeholder')}</span>
                <kbd className="shrink-0 rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[var(--text-tertiary)]">{shortcutLabel}</kbd>
            </button>
            <button
                type="button"
                onClick={onSearch}
                aria-label={t('common.search')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] md:hidden"
            >
                <Search size={19} aria-hidden="true" />
            </button>

            <div data-shell-page-actions className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
                <div data-shell-page-slot className="mr-1 hidden items-center lg:flex" />
                <NotificationButton
                    placement="header"
                    className="md:hidden"
                    unreadCount={unreadCount}
                    notifications={notifications}
                    onMarkRead={onMarkRead}
                    onMarkAllRead={onMarkAllRead}
                    onDeleteNotification={onDeleteNotification}
                    onDeleteAllRead={onDeleteAllRead}
                    onNavigate={onNavigate}
                />
                <button
                    type="button"
                    onClick={onToggleTheme}
                    aria-label={t(themeMode === 'dark' ? 'nav.mode_light' : 'nav.mode_dark')}
                    title={t(themeMode === 'dark' ? 'nav.mode_light' : 'nav.mode_dark')}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                >
                    {themeMode === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                </button>
                <button
                    type="button"
                    onClick={onToggleLanguage}
                    aria-label={t('nav.lang_switch')}
                    title={t('nav.lang_switch')}
                    className="flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                >
                    {language === 'vn' ? 'VI' : language.toUpperCase()}
                </button>
                {!assistantOpen && (
                    <button
                        type="button"
                        onClick={onOpenAssistant}
                        aria-label={t('shell.assistant_open')}
                        title={t('shell.assistant_open')}
                        className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[var(--sgs-primary-deep)] text-[var(--sgs-champagne)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] md:flex lg:hidden"
                    >
                        <Bot size={18} aria-hidden="true" />
                    </button>
                )}
            </div>
        </header>
    );
};

interface WorkspaceTabsProps {
    activePage: string;
    hub?: WorkspaceHub;
    onNavigate: (path: string) => void;
}

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ activePage, hub, onNavigate }) => {
    const { t } = useTranslation();
    if (!hub || hub.items.length === 0) return null;

    return (
        <nav className="flex h-12 shrink-0 items-end gap-1 overflow-x-auto border-b border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 sm:px-6 lg:px-7" aria-label={t(hub.labelKey)}>
            {hub.items.map(item => {
                const selected = item.route === activePage;
                return (
                    <button
                        key={item.route}
                        type="button"
                        onClick={() => onNavigate(item.route)}
                        aria-current={selected ? 'page' : undefined}
                        className={`relative flex h-11 shrink-0 items-center rounded-t-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-focus)] sm:px-3.5 sm:text-sm ${
                            selected
                                ? 'text-[var(--sgs-primary-deep)]'
                                : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {item.route === ROUTES.DASHBOARD ? t('shell.tab_dashboard') : t(item.labelKey)}
                        {selected && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--sgs-accent)]" />}
                    </button>
                );
            })}
        </nav>
    );
};

interface MobileNavigationProps {
    activePage: string;
    hubs: WorkspaceHub[];
    isPartner: boolean;
    onNavigate: (path: string) => void;
    onSearch: () => void;
    onOpenAssistant: () => void;
    inboxUnread?: number;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
    activePage,
    hubs,
    isPartner,
    onNavigate,
    onSearch,
    onOpenAssistant: _onOpenAssistant,
    inboxUnread = 0,
}) => {
    const { t } = useTranslation();
    const [moreOpen, setMoreOpen] = useState(false);
    const allItems = useMemo(() => hubs.flatMap(hub => hub.items), [hubs]);
    const getItem = (route: string) => allItems.find(item => item.route === route);
    const partnerProjects = getItem(ROUTES.PROJECTS);
    const inventory = getItem(ROUTES.INVENTORY);
    const primaryItems = isPartner
        ? [partnerProjects, inventory].filter((item): item is NavItem => Boolean(item))
        : [getItem(ROUTES.DASHBOARD), getItem(ROUTES.LEADS), getItem(ROUTES.INVENTORY), getItem(ROUTES.INBOX)].filter((item): item is NavItem => Boolean(item));

    const visibleTabs: Array<{ id: string; label: string; icon: LucideIcon; action: () => void; active: boolean; badge?: number }> = [];
    const SHORT_LABEL: Record<string, string> = {
        [ROUTES.DASHBOARD]: 'shell.mobile.overview',
        [ROUTES.LEADS]: 'shell.mobile.leads',
        [ROUTES.INVENTORY]: 'shell.mobile.inventory',
        [ROUTES.INBOX]: 'shell.mobile.inbox',
        [ROUTES.PROJECTS]: 'shell.mobile.projects',
    };
    primaryItems.forEach(item => {
        const hubId = routeHub.get(item.route);
        const hub = hubs.find(candidate => candidate.id === hubId);
        const Icon = hub?.icon ?? Package;
        visibleTabs.push({
            id: item.route,
            label: t(SHORT_LABEL[item.route] ?? item.labelKey),
            icon: Icon,
            badge: item.route === ROUTES.INBOX ? inboxUnread : 0,
            action: () => { setMoreOpen(false); onNavigate(item.route); },
            active: activePage === item.route,
        });
    });
    while (visibleTabs.length < 4) {
        visibleTabs.push({
            id: `search-${visibleTabs.length}`,
            label: t('common.search'),
            icon: Search,
            action: onSearch,
            active: false,
        });
    }
    visibleTabs.push({
        id: 'more',
        label: t('shell.more'),
        icon: MoreHorizontal,
        action: () => setMoreOpen(value => !value),
        active: moreOpen,
    });

    return (
        <>
            {moreOpen && (
                <>
                    <button
                        type="button"
                        aria-label={t('common.close')}
                        onClick={() => setMoreOpen(false)}
                        className="fixed inset-0 z-[80] bg-[var(--sgs-hero-deep)]/35 md:hidden"
                    />
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="workspace-more-title"
                        className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[85] max-h-[72dvh] overflow-y-auto rounded-t-[24px] border border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 pb-5 pt-4 shadow-2xl sm:inset-x-4 sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:rounded-[24px] md:hidden"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 id="workspace-more-title" className="text-base font-bold text-[var(--text-primary)]">{t('shell.more_title')}</h2>
                                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t('shell.more_description')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMoreOpen(false)}
                                aria-label={t('common.close')}
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                            >
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            {hubs.map(hub => {
                                const Icon = hub.icon;
                                return (
                                    <section key={hub.id} aria-label={t(hub.labelKey)}>
                                        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
                                            <Icon size={15} aria-hidden="true" />
                                            {t(hub.labelKey)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {hub.items.map(item => (
                                                <button
                                                    key={item.route}
                                                    type="button"
                                                    onClick={() => { setMoreOpen(false); onNavigate(item.route); }}
                                                    aria-current={activePage === item.route ? 'page' : undefined}
                                                    className={`flex min-h-12 items-center rounded-xl border px-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] ${
                                                        activePage === item.route
                                                            ? 'border-[var(--ui-border-strong)] bg-[var(--sgs-champagne)] text-[var(--sgs-primary-deep)]'
                                                            : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
                                                    }`}
                                                >
                                                    <span className="line-clamp-2">{t(item.labelKey)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
            <nav
                className="fixed inset-x-0 bottom-0 z-[90] grid grid-cols-5 border-t border-[var(--glass-border)] bg-[var(--bg-surface)]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-sm backdrop-blur md:hidden"
                aria-label={t('shell.mobile_navigation')}
            >
                {visibleTabs.slice(0, 5).map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={tab.action}
                            aria-label={tab.label}
                            aria-current={tab.active ? 'page' : undefined}
                            aria-expanded={tab.id === 'more' ? moreOpen : undefined}
                            className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-focus)] ${
                                tab.active ? 'text-[var(--sgs-primary-deep)]' : 'text-[var(--text-tertiary)]'
                            }`}
                        >
                            <span className="relative">
                                <Icon size={19} strokeWidth={tab.active ? 2.4 : 1.8} aria-hidden="true" />
                                {tab.badge ? <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--sgs-accent)] px-1 text-[9px] font-bold leading-none text-[var(--sgs-hero-deep)]" aria-hidden="true">{tab.badge > 99 ? '99+' : tab.badge}</span> : null}
                            </span>
                            <span className="max-w-full truncate">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </>
    );
};

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({
    children,
    activePage,
    menuGroups,
    user,
    assistantOpen,
    onNavigate,
    onLogout,
    onOpenAssistant,
    unreadCount,
    notifications,
    onMarkRead,
    onMarkAllRead,
    onDeleteNotification,
    onDeleteAllRead,
    onSearch,
    onToggleTheme,
    onToggleLanguage,
    themeMode,
    language,
}) => {
    const { t } = useTranslation();
    const hubs = useMemo(() => buildWorkspaceHubs(menuGroups), [menuGroups]);
    const currentHub = hubs.find(hub => hub.items.some(item => item.route === activePage))
        ?? hubs.find(hub => hub.id === (routeHub.get(activePage) ?? 'overview'));
    const isPartner = user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_AGENT';
    const hasInbox = hubs.some(hub => hub.id === 'inbox');
    const queryClient = useQueryClient();
    const unreadQuery = useQuery({
        queryKey: ['shellInboxUnread', user.id],
        queryFn: async () => {
            const threads: any[] = await db.getInboxThreads();
            return (threads || []).reduce((sum, thread) => sum + (Number(thread?.unreadCount) || 0), 0);
        },
        enabled: hasInbox,
        refetchInterval: 60000,
        staleTime: 20000,
    });
    const inboxUnread = hasInbox ? (unreadQuery.data ?? 0) : 0;
    useEffect(() => {
        if (!hasInbox) return;
        const refresh = () => queryClient.invalidateQueries({ queryKey: ['shellInboxUnread'] });
        socket.on('new_inbound_message', refresh);
        socket.on('inbox_read', refresh);
        return () => { socket.off('new_inbound_message', refresh); socket.off('inbox_read', refresh); };
    }, [hasInbox, queryClient]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                onSearch();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onSearch]);

    return (
        <>
            <div className="hidden h-full shrink-0 overflow-visible rounded-[24px] border border-[var(--glass-border)] shadow-sm md:flex md:w-[76px] lg:w-[84px]">
                <WorkspaceRail
                    inboxUnread={inboxUnread}
                    activePage={activePage}
                    hubs={hubs}
                    user={user}
                    onNavigate={onNavigate}
                    onLogout={onLogout}
                    onOpenAssistant={onOpenAssistant}
                    unreadCount={unreadCount}
                    notifications={notifications}
                    onMarkRead={onMarkRead}
                    onMarkAllRead={onMarkAllRead}
                    onDeleteNotification={onDeleteNotification}
                    onDeleteAllRead={onDeleteAllRead}
                    onSearch={onSearch}
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-none border border-transparent bg-[var(--bg-surface)] shadow-sm sm:rounded-[24px] sm:border-[var(--glass-border)]">
                <WorkspaceTopBar
                    activePage={activePage}
                    activeHub={currentHub}
                    assistantOpen={assistantOpen}
                    unreadCount={unreadCount}
                    notifications={notifications}
                    onMarkRead={onMarkRead}
                    onMarkAllRead={onMarkAllRead}
                    onDeleteNotification={onDeleteNotification}
                    onDeleteAllRead={onDeleteAllRead}
                    onNavigate={onNavigate}
                    onSearch={onSearch}
                    onOpenAssistant={onOpenAssistant}
                    onToggleTheme={onToggleTheme}
                    onToggleLanguage={onToggleLanguage}
                    themeMode={themeMode}
                    language={language}
                />
                <WorkspaceTabs activePage={activePage} hub={currentHub} onNavigate={onNavigate} />
                <div className="relative mb-[calc(4rem+env(safe-area-inset-bottom))] min-h-0 flex-1 overflow-hidden bg-[var(--bg-app)] md:mb-0">
                    {children}
                </div>
            </div>
            <MobileNavigation
                inboxUnread={inboxUnread}
                activePage={activePage}
                hubs={hubs}
                isPartner={isPartner}
                onNavigate={onNavigate}
                onSearch={onSearch}
                onOpenAssistant={onOpenAssistant}
            />
        </>
    );
};