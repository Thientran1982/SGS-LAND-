
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { db } from '../services/dbApi';
import { User, NavGroup } from '../types';
import { ROUTES, FULL_HEIGHT_PAGES } from '../config/routes';
import { CommandCenter } from './Navigation';
import { GlobalSearch } from './GlobalSearch';
import { Logo } from './Logo';
import { OnboardingWizard } from './OnboardingWizard';
import { prefetchRoute } from '../utils/reactUtils';

// -----------------------------------------------------------------------------
// 1. CONFIGURATION & ASSETS
// -----------------------------------------------------------------------------

import { 
    LayoutDashboard, Users, FileText, Package, Inbox, Star, CheckSquare, 
    GitMerge, Target, Share2, BookOpen, BarChart2, Store, Shield, 
    Database, Activity, Settings, CreditCard, Lock, Smartphone, 
    User as UserIcon, Moon, Sun, LogOut, ChevronLeft, ChevronDown, Languages, Home
} from 'lucide-react';

// Icons mapping - SYNCHRONIZED with mockDb.ts iconKeys
const NAV_ICONS: Record<string, React.ReactNode> = {
    // Core
    [ROUTES.LANDING]: <Home size={20} strokeWidth={2} />,
    [ROUTES.DASHBOARD]: <LayoutDashboard size={20} strokeWidth={2} />,
    [ROUTES.LEADS]: <Users size={20} strokeWidth={2} />,
    [ROUTES.CONTRACTS]: <FileText size={20} strokeWidth={2} />,
    [ROUTES.INVENTORY]: <Package size={20} strokeWidth={2} />,
    [ROUTES.INBOX]: <Inbox size={20} strokeWidth={2} />,
    
    // Ops
    [ROUTES.FAVORITES]: <Star size={20} strokeWidth={2} />,
    [ROUTES.APPROVALS]: <CheckSquare size={20} strokeWidth={2} />,
    [ROUTES.SEQUENCES]: <GitMerge size={20} strokeWidth={2} />,
    [ROUTES.SCORING_RULES]: <Target size={20} strokeWidth={2} />,
    [ROUTES.ROUTING_RULES]: <Share2 size={20} strokeWidth={2} />,
    [ROUTES.KNOWLEDGE]: <BookOpen size={20} strokeWidth={2} />,
    [ROUTES.REPORTS]: <BarChart2 size={20} strokeWidth={2} />,

    // Ecosystem
    [ROUTES.MARKETPLACE]: <Store size={20} strokeWidth={2} />,
    [ROUTES.AI_GOVERNANCE]: <Shield size={20} strokeWidth={2} />,
    [ROUTES.DATA_PLATFORM]: <Database size={20} strokeWidth={2} />,
    [ROUTES.SYSTEM]: <Activity size={20} strokeWidth={2} />,
    [ROUTES.ADMIN_USERS]: <Users size={20} strokeWidth={2} />,
    [ROUTES.ENTERPRISE_SETTINGS]: <Settings size={20} strokeWidth={2} />,
    [ROUTES.BILLING]: <CreditCard size={20} strokeWidth={2} />,
    [ROUTES.SECURITY]: <Lock size={20} strokeWidth={2} />,
    
    // Other
    'mobile_app': <Smartphone size={20} strokeWidth={2} />,
    'profile': <UserIcon size={20} strokeWidth={2} />,
    'theme-dark': <Moon size={20} strokeWidth={2} />,
    'theme-light': <Sun size={20} strokeWidth={2} />,
    'logout': <LogOut size={20} strokeWidth={2} />,
    'toggle': <ChevronLeft size={20} strokeWidth={2} />,
    'chevron': <ChevronDown size={20} strokeWidth={2} />
};

// -----------------------------------------------------------------------------
// 2. ISOLATED SUB-COMPONENTS
// -----------------------------------------------------------------------------

const LogoutModal = ({ isOpen, onClose, onConfirm, t }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; t: any }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-enter">
            <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] scale-100 animate-scale-up">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <LogOut className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t('menu.logout')}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">{t('common.confirm_logout')}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-[var(--glass-border)] transition-colors">
                            {t('common.cancel')}
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-rose-600 hover:shadow-rose-500/30 transition-all">
                            {t('common.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SidebarContentProps {
    activePage: string;
    onNavigate: (path: string) => void;
    collapsed: boolean;
    isMobile: boolean;
    onToggleCollapse: () => void;
    onLogoutClick: () => void;
    onToggleTheme: () => void;
    onToggleLang: () => void;
    themeMode: 'light' | 'dark';
    lang: string;
    menuGroups: NavGroup[];
    t: (k: string) => string;
}

const Sidebar = memo(({ 
    activePage, 
    onNavigate, 
    collapsed, 
    isMobile, 
    onToggleCollapse, 
    onLogoutClick, 
    onToggleTheme, 
    onToggleLang,
    themeMode,
    lang,
    menuGroups,
    t 
}: SidebarContentProps) => {
    const isCollapsed = !isMobile && collapsed;
    
    // Persist open groups
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('sgs_nav_groups');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    useEffect(() => {
        localStorage.setItem('sgs_nav_groups', JSON.stringify(openGroups));
    }, [openGroups]);

    // Initialize all groups to open by default
    useEffect(() => {
        if (menuGroups && menuGroups.length > 0 && Object.keys(openGroups).length === 0) {
            const initial: Record<string, boolean> = {};
            menuGroups.forEach(g => initial[g.id] = true);
            setOpenGroups(initial);
        }
    }, [menuGroups]);

    // Auto-expand group containing active page
    useEffect(() => {
        if (!menuGroups || menuGroups.length === 0) return;
        const activeGroup = menuGroups.find(g => g.items?.some(i => i.route === activePage));
        if (activeGroup && !openGroups[activeGroup.id]) {
            setOpenGroups(prev => ({ ...prev, [activeGroup.id]: true }));
        }
    }, [activePage, menuGroups]);

    const toggleGroup = (groupId: string) => {
        setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* 1. Brand Header */}
            <div className="h-20 flex items-center justify-center relative shrink-0">
                <button 
                    onClick={() => onNavigate(ROUTES.DASHBOARD)}
                    className={`flex items-center gap-3 transition-all duration-300 outline-none ${isCollapsed ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100'}`}
                    aria-label={t('nav.go_to_dashboard') || "Đi đến Tổng quan"}
                >
                    <div className="w-8 h-8 text-indigo-600">
                        <Logo className="w-full h-full" />
                    </div>
                    <div className="overflow-hidden whitespace-nowrap text-left">
                        <h1 className="font-bold text-lg leading-none tracking-tight text-[var(--text-primary)]">
                            {t('nav.logo_label')}
                        </h1>
                        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em]">
                            {t('nav.brand_subtitle')}
                        </span>
                    </div>
                </button>
                
                {isCollapsed && (
                    <button onClick={() => onNavigate(ROUTES.DASHBOARD)} className="w-8 h-8 text-indigo-600 animate-scale-up absolute">
                        <Logo className="w-full h-full" />
                    </button>
                )}
                
                {!isMobile && (
                    <button 
                        onClick={onToggleCollapse}
                        className={`absolute -right-3 top-8 w-6 h-6 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-indigo-600 shadow-sm z-50 hover:scale-110 transition-all ${isCollapsed ? 'rotate-180' : ''}`}
                        aria-label={t('nav.toggle_sidebar') || "Đóng mở thanh bên"}
                    >
                        {NAV_ICONS['toggle']}
                    </button>
                )}
            </div>

            {/* 2. Navigation Items (Scrollable) */}
            <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 overscroll-contain min-h-0 space-y-4">
                {menuGroups?.map((group) => {
                    const isOpen = openGroups[group.id] || isCollapsed; 
                    const hasActiveChild = group.items?.some(i => i.route === activePage);

                    return (
                        <div key={group.id} className="relative">
                            {/* Group Header */}
                            {isCollapsed ? (
                                <div className="h-px bg-[var(--glass-border)] mx-4 my-4 opacity-50" title={t(group.labelKey)}></div>
                            ) : (
                                <button 
                                    onClick={() => toggleGroup(group.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 mb-1 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--text-primary)] ${hasActiveChild ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}
                                >
                                    <span>{t(group.labelKey)}</span>
                                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                                        {NAV_ICONS['chevron']}
                                    </div>
                                </button>
                            )}
                            
                            {/* Group Items (Accordion Body) */}
                            <div className={`space-y-1 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                {group.items?.map((item) => {
                                    const isActive = activePage === item.route;
                                    const Icon = NAV_ICONS[item.iconKey] || NAV_ICONS[ROUTES.DASHBOARD]; // Fallback

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onNavigate(item.route)}
                                            onMouseEnter={() => prefetchRoute(item.route)}
                                            title={isCollapsed ? t(item.labelKey) : ''}
                                            className={`
                                                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative
                                                ${isActive 
                                                    ? 'bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-sm border-l-4 border-indigo-500' 
                                                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] border-l-4 border-transparent'}
                                            `}
                                        >
                                            <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}`}>
                                                {Icon}
                                            </div>
                                            
                                            {!isCollapsed && (
                                                <span className={`text-xs font-medium truncate ${isActive ? 'font-bold' : ''}`}>
                                                    {t(item.labelKey)}
                                                </span>
                                            )}
                                            
                                            {isCollapsed && (
                                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity delay-75">
                                                    {t(item.labelKey)}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                <div className="h-16 w-full shrink-0"></div>
            </nav>

            {/* 3. Footer Controls */}
            <div className="p-3 border-t border-[var(--glass-border)] space-y-2 shrink-0 bg-[var(--bg-surface)] z-20 rounded-b-[24px]">
                <div className={`grid ${isCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                    <button 
                        onClick={onToggleTheme} 
                        className="flex items-center justify-center p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-indigo-500 transition-colors border border-transparent hover:border-[var(--glass-border)] group relative"
                        title={t(themeMode === 'dark' ? 'nav.mode_light' : 'nav.mode_dark')}
                        aria-label={t(themeMode === 'dark' ? 'nav.mode_light' : 'nav.mode_dark')}
                    >
                        <div className="transition-transform group-hover:rotate-12">
                            {NAV_ICONS[themeMode === 'dark' ? 'theme-light' : 'theme-dark']}
                        </div>
                        {!isCollapsed && <span className="sr-only">{t('nav.mode_switch')}</span>}
                    </button>

                    <button 
                        onClick={onToggleLang} 
                        className="flex items-center justify-center p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-indigo-500 transition-colors border border-transparent hover:border-[var(--glass-border)] group"
                        title={t('nav.lang_switch')}
                        aria-label={t('nav.lang_switch')}
                    >
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] font-extrabold tracking-tighter transition-transform group-hover:scale-110">
                            {lang.toUpperCase()}
                        </span>
                    </button>
                </div>

                <button 
                    onClick={onLogoutClick}
                    className={`w-full flex items-center justify-center p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors border border-transparent hover:border-rose-100 cursor-pointer ${!isCollapsed ? 'gap-2' : ''}`}
                    title={t('menu.logout')}
                    aria-label={t('menu.logout')}
                >
                    {NAV_ICONS['logout']}
                    {!isCollapsed && <span className="text-xs font-bold">{t('menu.logout')}</span>}
                </button>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// 3. MAIN LAYOUT COMPONENT
// -----------------------------------------------------------------------------

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (path: string) => void;
    onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = memo(({ children, activePage, onNavigate, onLogout }) => {
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    
    const [user, setUser] = useState<User | null>(null);
    const [menuGroups, setMenuGroups] = useState<NavGroup[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { t, language, setLanguage } = useTranslation();
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const loadUser = async () => {
            const u = await db.getCurrentUser();
            setUser(u);
            if (u) {
                // Fetch menu based on user role
                db.getUserMenu(u.role).then(setMenuGroups);
            }
        };
        loadUser();

        window.addEventListener('user-updated', loadUser);
        return () => window.removeEventListener('user-updated', loadUser);
    }, []);

    const handleNavigate = useCallback((path: string) => {
        onNavigate(path);
        setMobileMenuOpen(false);
    }, [onNavigate]);

    // Replaced native window.confirm with Modal state trigger
    const handleLogoutClick = useCallback(() => {
        setShowLogoutConfirm(true);
        setMobileMenuOpen(false); // Close drawer to prevent visual glitch
    }, []);

    const handleLogoutConfirm = useCallback(() => {
        setShowLogoutConfirm(false);
        onLogout();
    }, [onLogout]);

    const pageTitle = t(`menu.${activePage}`) || activePage;
    const isAppPage = FULL_HEIGHT_PAGES.has(activePage as any);

    const sidebarProps = useMemo(() => ({
        activePage,
        onNavigate: handleNavigate,
        onLogoutClick: handleLogoutClick,
        onToggleTheme: toggleTheme,
        onToggleLang: () => setLanguage(language === 'en' ? 'vn' : 'en'),
        themeMode: theme,
        lang: language,
        menuGroups,
        t
    }), [activePage, handleNavigate, handleLogoutClick, toggleTheme, language, theme, menuGroups, t, setLanguage]);

    return (
        <div className="fixed inset-0 h-[100dvh] supports-[height:100cqh]:h-[100cqh] w-full bg-[var(--bg-app)] p-0 sm:p-2 md:p-3 flex gap-0 sm:gap-2 md:gap-3 overflow-hidden font-sans text-[var(--text-primary)] transition-colors duration-300 relative selection:bg-indigo-500/30">
            
            {/* SIDEBAR ISLAND (Desktop/Tablet) */}
            <aside 
                className={`
                    relative h-full z-40 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]
                    bg-[var(--bg-surface)]
                    rounded-none sm:rounded-[24px] shadow-sm border-r sm:border border-[var(--glass-border)]
                    flex flex-col shrink-0 no-scrollbar
                    ${desktopCollapsed ? 'w-0 md:w-[76px]' : 'w-0 md:w-64'} 
                    hidden md:flex overflow-visible
                `}
            >
                <Sidebar 
                    {...sidebarProps} 
                    isMobile={false} 
                    collapsed={desktopCollapsed} 
                    onToggleCollapse={() => setDesktopCollapsed(!desktopCollapsed)} 
                />
            </aside>

            {/* MOBILE DRAWER (Overlay) */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
            />
            
            <div className={`fixed inset-y-0 left-0 w-72 bg-[var(--bg-surface)] shadow-2xl z-[101] md:hidden transition-transform duration-300 ease-out transform flex flex-col no-scrollbar ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar 
                    {...sidebarProps} 
                    isMobile={true} 
                    collapsed={false} 
                    onToggleCollapse={() => {}} 
                />
            </div>

            {/* MAIN CONTENT ISLAND */}
            <main 
                className={`
                    flex-1 flex flex-col min-w-0 min-h-0 relative 
                    bg-[var(--bg-surface)]
                    rounded-none sm:rounded-[24px] shadow-none sm:shadow-sm 
                    border-x-0 border-y-0 sm:border border-[var(--glass-border)]
                    isolate overflow-hidden
                `}
            >
                {/* Header: Structurally Fixed at top of flex column */}
                <div className="flex-none z-30 w-full relative">
                    {user && (
                        <CommandCenter 
                            title={pageTitle}
                            user={user}
                            onSearch={() => setIsSearchOpen(true)}
                            onMenuClick={() => setMobileMenuOpen(true)}
                            onNavigate={onNavigate}
                            isProfileActive={activePage === ROUTES.PROFILE}
                        />
                    )}
                </div>
                
                {/* Content Area - SCROLL VIEWPORT */}
                <div className="flex-1 relative w-full min-h-0">
                    {/* Absolute positioning strategy to enforce viewport constraints */}
                    <div 
                        className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth isolate touch-auto no-scrollbar"
                        style={{ overscrollBehaviorY: 'auto', WebkitOverflowScrolling: 'touch' }}
                        id="main-scroll-container"
                    >
                        {/* App pages (fixed-height like Inventory/Leads/Board) need h-full for percentage resolution.
                            Content pages (scrollable like Dashboard/Reports) need min-h-full + flex-1.
                            CSS spec: min-height creates an "indefinite" height so children's height:100% resolves to auto=0.
                            h-full creates a "definite" height so children's height:100% resolves correctly. */}
                        {isAppPage ? (
                            <div className="w-full h-full">
                                {children}
                            </div>
                        ) : (
                            <div className="w-full min-h-full flex flex-col">
                                <div className="flex-1 w-full relative">
                                    {children}
                                </div>
                                <div className="h-40 w-full shrink-0 opacity-0 pointer-events-none" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <GlobalSearch 
                isOpen={isSearchOpen} 
                onClose={() => setIsSearchOpen(false)} 
                onNavigate={(type, id) => {
                    if (type === 'LEAD') onNavigate(ROUTES.LEADS);
                    else if (type === 'LISTING') onNavigate(ROUTES.INVENTORY);
                    else if (type === 'USER') onNavigate(ROUTES.ADMIN_USERS);
                    else if (type === 'ROUTE') onNavigate(id); // For direct routes
                }}
            />

            <LogoutModal 
                isOpen={showLogoutConfirm} 
                onClose={() => setShowLogoutConfirm(false)} 
                onConfirm={handleLogoutConfirm} 
                t={t} 
            />
            <OnboardingWizard />
        </div>
    );
});

Layout.displayName = 'Layout';
