
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { db } from './services/dbApi';
import { I18nProvider, useTranslation } from './services/i18n';
import { ThemeProvider } from './services/theme';
import { TenantProvider } from './services/tenantContext';
import { ROUTES, FULL_HEIGHT_PAGES } from './config/routes';
import type { User } from './types';
import { lazyLoad, registerPrefetch, prefetchRoutes } from './utils/reactUtils';
import { updatePageSEO } from './utils/seo';
import { motion, AnimatePresence } from 'motion/react';

// -----------------------------------------------------------------------------
// 1. LAZY LOADED PAGES
// -----------------------------------------------------------------------------

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 2 * 60_000,   // 2 min — data stays fresh, no flicker on return
            gcTime: 15 * 60_000,     // 15 min — keep data in memory much longer
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

// Public Pages - using lazyLoad wrapper which handles named exports automatically
const Login = lazyLoad(() => import('./pages/Login'), 'Login');
const PublicProposal = lazyLoad(() => import('./pages/PublicProposal'), 'PublicProposal');
const PublicContract = lazyLoad(() => import('./pages/PublicContract'), 'PublicContract');
const Landing = lazyLoad(() => import('./pages/Landing'), 'Landing');
const ProductSearch = lazyLoad(() => import('./pages/ProductSearch'), 'ProductSearch');
// Ensure these match file names exactly
const AiValuation = lazyLoad(() => import('./pages/AiValuation'), 'AiValuation'); 
const CrmLanding = lazyLoad(() => import('./pages/CrmLanding'), 'CrmLanding'); 
const ListingDetail = lazyLoad(() => import('./pages/ListingDetail'), 'ListingDetail'); 
const AboutUs = lazyLoad(() => import('./pages/AboutUs'), 'AboutUs');
const News = lazyLoad(() => import('./pages/News'), 'News');
const Contact = lazyLoad(() => import('./pages/Contact'), 'Contact'); 
const Careers = lazyLoad(() => import('./pages/Careers'), 'Careers'); 
const HelpCenter = lazyLoad(() => import('./pages/HelpCenter'), 'HelpCenter'); 
const ApiDocs = lazyLoad(() => import('./pages/ApiDocs'), 'ApiDocs'); 
const PublicStatus = lazyLoad(() => import('./pages/PublicStatus'), 'PublicStatus');
const LiveChat = lazyLoad(() => import('./pages/LiveChat'), 'LiveChat');
const PrivacyPolicy = lazyLoad(() => import('./pages/Legal'), 'PrivacyPolicy');
const TermsOfService = lazyLoad(() => import('./pages/Legal'), 'TermsOfService');
const CookieSettings = lazyLoad(() => import('./pages/Legal'), 'CookieSettings');

// Private Pages - Core
const Dashboard = lazyLoad(() => import('./pages/Dashboard'), 'Dashboard');
const Leads = lazyLoad(() => import('./pages/Leads'), 'Leads');
const Contracts = lazyLoad(() => import('./pages/Contracts'), 'Contracts');
const Inventory = lazyLoad(() => import('./pages/Inventory'), 'Inventory');
const Favorites = lazyLoad(() => import('./pages/Favorites'), 'Favorites');
const Inbox = lazyLoad(() => import('./pages/Inbox'), 'Inbox');
const Reports = lazyLoad(() => import('./pages/Reports'), 'Reports');

// Private Pages - Operations
const ApprovalInbox = lazyLoad(() => import('./pages/ApprovalInbox'), 'ApprovalInbox');
const RoutingRules = lazyLoad(() => import('./pages/RoutingRules'), 'RoutingRules');
const Sequences = lazyLoad(() => import('./pages/Sequences'), 'Sequences');
const ScoringRules = lazyLoad(() => import('./pages/ScoringRules'), 'ScoringRules');
const KnowledgeBase = lazyLoad(() => import('./pages/KnowledgeBase'), 'KnowledgeBase');

// Private Pages - Enterprise
const SystemStatus = lazyLoad(() => import('./pages/SystemStatus'), 'SystemStatus');
const AdminUsers = lazyLoad(() => import('./pages/AdminUsers'), 'AdminUsers');
const EnterpriseSettings = lazyLoad(() => import('./pages/EnterpriseSettings'), 'EnterpriseSettings');
const Billing = lazyLoad(() => import('./pages/Billing'), 'Billing');
const Marketplace = lazyLoad(() => import('./pages/Marketplace'), 'Marketplace');
const DataPlatform = lazyLoad(() => import('./pages/DataPlatform'), 'DataPlatform');
const SecurityCompliance = lazyLoad(() => import('./pages/SecurityCompliance'), 'SecurityCompliance');
const AiGovernance = lazyLoad(() => import('./pages/AiGovernance'), 'AiGovernance');
const SeoManager = lazyLoad(() => import('./pages/SeoManager'), 'SeoManager');
const Profile = lazyLoad(() => import('./pages/Profile'), 'Profile');

// ---------------------------------------------------------------------------
// PREFETCH REGISTRATION — maps each route to its raw import so nav hover
// can call registerPrefetch(route) before the user clicks.
// ---------------------------------------------------------------------------
registerPrefetch(ROUTES.DASHBOARD,            () => import('./pages/Dashboard'));
registerPrefetch(ROUTES.LEADS,               () => import('./pages/Leads'));
registerPrefetch(ROUTES.CONTRACTS,           () => import('./pages/Contracts'));
registerPrefetch(ROUTES.INVENTORY,           () => import('./pages/Inventory'));
registerPrefetch(ROUTES.INBOX,              () => import('./pages/Inbox'));
registerPrefetch(ROUTES.FAVORITES,           () => import('./pages/Favorites'));
registerPrefetch(ROUTES.REPORTS,            () => import('./pages/Reports'));
registerPrefetch(ROUTES.APPROVALS,           () => import('./pages/ApprovalInbox'));
registerPrefetch(ROUTES.ROUTING_RULES,       () => import('./pages/RoutingRules'));
registerPrefetch(ROUTES.SEQUENCES,           () => import('./pages/Sequences'));
registerPrefetch(ROUTES.SCORING_RULES,       () => import('./pages/ScoringRules'));
registerPrefetch(ROUTES.KNOWLEDGE,           () => import('./pages/KnowledgeBase'));
registerPrefetch(ROUTES.SYSTEM,             () => import('./pages/SystemStatus'));
registerPrefetch(ROUTES.ADMIN_USERS,         () => import('./pages/AdminUsers'));
registerPrefetch(ROUTES.ENTERPRISE_SETTINGS, () => import('./pages/EnterpriseSettings'));
registerPrefetch(ROUTES.BILLING,            () => import('./pages/Billing'));
registerPrefetch(ROUTES.MARKETPLACE,         () => import('./pages/Marketplace'));
registerPrefetch(ROUTES.DATA_PLATFORM,       () => import('./pages/DataPlatform'));
registerPrefetch(ROUTES.SECURITY,           () => import('./pages/SecurityCompliance'));
registerPrefetch(ROUTES.AI_GOVERNANCE,       () => import('./pages/AiGovernance'));
registerPrefetch(ROUTES.PROFILE,            () => import('./pages/Profile'));
registerPrefetch(ROUTES.SEARCH,             () => import('./pages/ProductSearch'));
registerPrefetch(ROUTES.LANDING,            () => import('./pages/Landing'));

// Placeholder for Mobile App
const MobileApp = () => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-full mb-6">
                <svg className="w-12 h-12 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('mobile.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-4">{t('mobile.scan_desc')}</p>
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl shadow-lg border border-[var(--glass-border)]">
                <div className="w-32 h-32 bg-slate-900 mx-auto flex items-center justify-center text-white/50 text-xs">
                    [QR CODE]
                </div>
            </div>
            <p className="mt-6 text-xs text-indigo-600 font-bold uppercase tracking-widest">{t('mobile.features')}</p>
        </div>
    );
};

// -----------------------------------------------------------------------------
// 2. REGISTRIES & CONFIG
// -----------------------------------------------------------------------------

// Comprehensive mapping of ALL routes to their components
const PAGE_REGISTRY: Record<string, React.ComponentType<any>> = {
    // Public
    [ROUTES.LANDING]: Landing,
    [ROUTES.SEARCH]: ProductSearch,
    [ROUTES.AI_VALUATION]: AiValuation, 
    [ROUTES.CRM_SOLUTION]: CrmLanding,
    [ROUTES.ABOUT]: AboutUs,
    [ROUTES.NEWS]: News,
    [ROUTES.CONTACT]: Contact,
    [ROUTES.CAREERS]: Careers,
    [ROUTES.HELP_CENTER]: HelpCenter,
    [ROUTES.API_DOCS]: ApiDocs,
    [ROUTES.STATUS_PUBLIC]: PublicStatus,
    [ROUTES.LIVE_CHAT]: LiveChat,
    [ROUTES.PRIVACY]: PrivacyPolicy,
    [ROUTES.TERMS]: TermsOfService,
    [ROUTES.COOKIES]: CookieSettings,
    [ROUTES.LOGIN]: Login,
    [ROUTES.LISTING]: ListingDetail, 

    // Private
    [ROUTES.DASHBOARD]: Dashboard,
    [ROUTES.LEADS]: Leads,
    [ROUTES.CONTRACTS]: Contracts,
    [ROUTES.INVENTORY]: Inventory,
    [ROUTES.FAVORITES]: Favorites,
    [ROUTES.INBOX]: Inbox,
    [ROUTES.REPORTS]: Reports,
    [ROUTES.APPROVALS]: ApprovalInbox,
    [ROUTES.ROUTING_RULES]: RoutingRules,
    [ROUTES.SEQUENCES]: Sequences,
    [ROUTES.SCORING_RULES]: ScoringRules,
    [ROUTES.KNOWLEDGE]: KnowledgeBase,
    [ROUTES.SYSTEM]: SystemStatus,
    [ROUTES.ADMIN_USERS]: AdminUsers,
    [ROUTES.ENTERPRISE_SETTINGS]: EnterpriseSettings,
    [ROUTES.BILLING]: Billing,
    [ROUTES.MARKETPLACE]: Marketplace,
    [ROUTES.DATA_PLATFORM]: DataPlatform,
    [ROUTES.SECURITY]: SecurityCompliance,
    [ROUTES.AI_GOVERNANCE]: AiGovernance,
    [ROUTES.SEO_MANAGER]: SeoManager,
    [ROUTES.PROFILE]: Profile,
    // Misc
    [ROUTES.MOBILE_APP]: MobileApp
};

// List of routes that do NOT require authentication and should NOT render the App Sidebar
const PUBLIC_ROUTES = new Set([
    '', // Root
    ROUTES.LANDING,
    ROUTES.SEARCH,
    ROUTES.AI_VALUATION,
    ROUTES.CRM_SOLUTION,
    ROUTES.ABOUT,
    ROUTES.NEWS,
    ROUTES.CONTACT,
    ROUTES.CAREERS,
    ROUTES.HELP_CENTER,
    ROUTES.API_DOCS,
    ROUTES.STATUS_PUBLIC,
    ROUTES.LIVE_CHAT,
    ROUTES.PRIVACY,
    ROUTES.TERMS,
    ROUTES.COOKIES,
    ROUTES.LOGIN,
    ROUTES.RESET_PASSWORD,
    ROUTES.PUBLIC_PREFIX,
    ROUTES.LISTING
]);

// -----------------------------------------------------------------------------
// 3. UI COMPONENTS
// -----------------------------------------------------------------------------

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const lang = typeof window !== 'undefined' ? localStorage.getItem('sgs_lang') : 'vn';
            const msg = lang === 'en' ? 'An unexpected error has occurred.' : 'Đã xảy ra lỗi không mong muốn.';
            return <ErrorState message={msg} onRetry={() => window.location.reload()} />;
        }
        return this.props.children;
    }
}

const ErrorState: React.FC<{ message: string, onRetry?: () => void }> = ({ message, onRetry }) => {
    const { t } = useTranslation();
    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[var(--bg-app)] text-[var(--text-secondary)] p-6 text-center animate-enter">
            <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-rose-500 shadow-sm border border-slate-200 dark:border-white/10">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <h3 className="font-bold text-lg text-[var(--text-primary)]">{message}</h3>
            <button 
                onClick={() => onRetry ? onRetry() : window.location.reload()} 
                className="mt-4 px-6 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-bold hover:bg-[var(--glass-surface-hover)] transition-all shadow-sm"
            >
                {t('common.system_reload')}
            </button>
        </div>
    );
};

const NotFound: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 animate-enter text-[var(--text-primary)] bg-[var(--bg-app)] min-h-[100dvh]">
            <div className="text-6xl mb-4 opacity-20 font-mono font-bold">404</div>
            <h2 className="text-xl font-bold mb-2">{t('404.title') || "Page Not Found"}</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">{t('404.desc') || "The page you are looking for does not exist."}</p>
            <button 
                onClick={() => window.location.hash = `#/${ROUTES.LANDING}`}
                className="px-6 py-2.5 bg-[var(--primary-600)] text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-all"
            >
                {t('common.go_back')}
            </button>
        </div>
    );
};

// -----------------------------------------------------------------------------
// 4. ROUTING LOGIC
// -----------------------------------------------------------------------------

const useRouter = () => {
    const getHashData = useCallback(() => {
        let hash = window.location.hash.slice(1); // remove '#'
        if (hash.startsWith('/')) hash = hash.slice(1);
        if (hash.endsWith('/')) hash = hash.slice(0, -1);
        
        const path = hash.split('?')[0]; 
        const parts = path.split('/').filter(Boolean);
        const base = parts[0] || ''; 

        return {
            base,
            params: parts.slice(1),
            fullPath: window.location.hash
        };
    }, []);

    const [route, setRoute] = useState(getHashData());

    useEffect(() => {
        const handler = () => setRoute(getHashData());
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, [getHashData]);

    useEffect(() => {
        updatePageSEO(route.base);
    }, [route.base]);

    const navigate = useCallback((path: string) => {
        const target = path.startsWith('/') ? path : `/${path}`;
        window.location.hash = target;
    }, []);

    return { route, navigate };
};

// -----------------------------------------------------------------------------
// 5. APPLICATION SHELL
// -----------------------------------------------------------------------------

const AUTH_CACHE_KEY = 'sgs_auth_cached';

const getInitialAuthState = (): 'LOADING' | 'AUTH' | 'GUEST' => {
    // Always start with LOADING so the server session check runs before rendering
    // any private content. Using localStorage as AUTH directly caused a flash of
    // private pages when the session had expired but the cache flag was still set.
    return 'LOADING';
};

const ADMIN_ONLY_ROUTES = new Set([
    ROUTES.SYSTEM,
    ROUTES.ADMIN_USERS,
    ROUTES.ENTERPRISE_SETTINGS,
    ROUTES.BILLING,
    ROUTES.DATA_PLATFORM,
    ROUTES.SECURITY,
    ROUTES.AI_GOVERNANCE,
    ROUTES.SEO_MANAGER,
]);

const ADMIN_ROLES = new Set(['ADMIN', 'TEAM_LEAD']);

const AppShell: React.FC = () => {
    const { route, navigate } = useRouter();
    const { t } = useTranslation();
    const [authState, setAuthState] = useState<'LOADING' | 'AUTH' | 'GUEST'>(getInitialAuthState);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    // Tracks which private pages have been mounted — CSS show/hide instead of unmount/remount.
    // Uses a ref updated synchronously during render to avoid the extra useEffect render cycle
    // that previously caused a visible blank flash before the new page div appeared.
    const mountedPrivateRoutesRef = useRef<Set<string>>(new Set());

    // Prefetch JS chunks as soon as auth is confirmed — covers all frequently-visited pages
    useEffect(() => {
        if (authState === 'AUTH') {
            prefetchRoutes([
                ROUTES.DASHBOARD, ROUTES.LEADS, ROUTES.INBOX,
                ROUTES.INVENTORY, ROUTES.CONTRACTS, ROUTES.REPORTS,
                ROUTES.APPROVALS, ROUTES.FAVORITES, ROUTES.PROFILE,
                ROUTES.ROUTING_RULES, ROUTES.SEQUENCES, ROUTES.KNOWLEDGE,
            ]);
        }
    }, [authState]);

    // Synchronously register private route into the ref during render (no useEffect needed).
    // This eliminates the extra render cycle that useEffect caused, removing the 1-frame
    // flash before the new page div appeared in the DOM.
    if (authState === 'AUTH' && route.base && PAGE_REGISTRY[route.base] &&
        (!PUBLIC_ROUTES.has(route.base) || route.base === ROUTES.LANDING)) {
        mountedPrivateRoutesRef.current.add(route.base);
    }
    const mountedPrivateRoutes = mountedPrivateRoutesRef.current;

    // Auth Initialization — runs once on mount to check session
    useEffect(() => {
        const initAuth = async () => {
            try {
                const user = await db.getCurrentUser();
                if (user) {
                    localStorage.setItem(AUTH_CACHE_KEY, '1');
                    setCurrentUser(user);
                    setAuthState('AUTH');
                } else {
                    localStorage.removeItem(AUTH_CACHE_KEY);
                    setCurrentUser(null);
                    setAuthState('GUEST');
                }
            } catch {
                localStorage.removeItem(AUTH_CACHE_KEY);
                setCurrentUser(null);
                setAuthState('GUEST');
            }
        };
        initAuth();

        // Re-check on explicit auth events (login/logout)
        const onLogin = () => db.getCurrentUser().then(u => {
            if (u) { localStorage.setItem(AUTH_CACHE_KEY, '1'); setCurrentUser(u); setAuthState('AUTH'); }
            else { localStorage.removeItem(AUTH_CACHE_KEY); setCurrentUser(null); setAuthState('GUEST'); }
        }).catch(() => { localStorage.removeItem(AUTH_CACHE_KEY); setCurrentUser(null); setAuthState('GUEST'); });
        const onLogout = () => { localStorage.removeItem(AUTH_CACHE_KEY); db.clearUserCache(); setCurrentUser(null); setAuthState('GUEST'); };
        window.addEventListener('auth:login', onLogin);
        window.addEventListener('auth:logout', onLogout);
        return () => {
            window.removeEventListener('auth:login', onLogin);
            window.removeEventListener('auth:logout', onLogout);
        };
    }, []);

    // Route Guard — reacts to route changes using cached authState
    useEffect(() => {
        if (authState === 'LOADING') return;

        // Redirect root to Landing
        if (route.base === '') {
            navigate(ROUTES.LANDING);
            return;
        }

        const isPublic = PUBLIC_ROUTES.has(route.base);
        if (!isPublic && authState === 'GUEST') {
            navigate(ROUTES.LOGIN);
            return;
        }

        // RBAC: redirect non-admin roles away from admin-only routes
        if (authState === 'AUTH' && ADMIN_ONLY_ROUTES.has(route.base) && currentUser && !ADMIN_ROLES.has(currentUser.role)) {
            navigate(ROUTES.DASHBOARD);
            setAccessDenied(true);
        }

        // PARTNER roles: redirect away from Dashboard to Inventory
        const isPartnerRole = currentUser?.role === 'PARTNER_ADMIN' || currentUser?.role === 'PARTNER_AGENT';
        if (authState === 'AUTH' && isPartnerRole && route.base === ROUTES.DASHBOARD) {
            navigate(ROUTES.INVENTORY);
        }
    }, [route.base, authState, currentUser, navigate]);

    // Auto-dismiss access denied banner
    useEffect(() => {
        if (!accessDenied) return;
        const timer = setTimeout(() => setAccessDenied(false), 4000);
        return () => clearTimeout(timer);
    }, [accessDenied]);

    // Scroll Restoration
    useEffect(() => {
        const mainContainer = document.getElementById('main-scroll-container');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'instant' });
        } else {
            window.scrollTo(0, 0);
        }
    }, [route.fullPath]);

    const handleLoginSuccess = useCallback(() => {
        localStorage.setItem(AUTH_CACHE_KEY, '1');
        setAuthState('AUTH');
        db.getCurrentUser().then(u => {
            if (u) {
                setCurrentUser(u);
                const isPartner = u.role === 'PARTNER_ADMIN' || u.role === 'PARTNER_AGENT';
                navigate(isPartner ? ROUTES.INVENTORY : ROUTES.DEFAULT_PRIVATE);
            } else {
                navigate(ROUTES.DEFAULT_PRIVATE);
            }
        }).catch(() => { navigate(ROUTES.DEFAULT_PRIVATE); });
    }, [navigate]);

    const handleLogout = useCallback(() => {
        db.logout();
        localStorage.removeItem(AUTH_CACHE_KEY);
        setCurrentUser(null);
        setAuthState('GUEST');
        navigate(ROUTES.LOGIN);
    }, [navigate]);

    // --- RENDERER ---

    // Full-screen spinner for initial auth check / public page load
    const SmallSpinner = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg-app)]">
            <div className="w-8 h-8 border-2 border-[var(--glass-border)] border-t-[var(--primary-600)] rounded-full animate-spin" />
        </div>
    );

    // Skeleton shown inside the main content area while a private page chunk loads.
    // Sidebar + header remain visible — only the content slot shows this.
    const PageSkeleton = (
        <div className="p-4 sm:p-6 space-y-5 animate-pulse w-full">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-6 w-44 bg-slate-100 dark:bg-white/5 rounded-xl" />
                    <div className="h-3 w-28 bg-slate-100 dark:bg-white/5 rounded-lg" />
                </div>
                <div className="h-9 w-28 bg-slate-100 dark:bg-white/5 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ))}
            </div>
            <div className="space-y-2.5">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-11 bg-slate-100 dark:bg-white/5 rounded-xl" style={{ opacity: 1 - i * 0.12 }} />
                ))}
            </div>
        </div>
    );

    // --- LOADING STATE: fully self-contained, never falls through ---
    if (authState === 'LOADING') {
        // Root path — redirect immediately to landing so no blank page or 404
        if (route.base === '') {
            navigate(ROUTES.LANDING);
            return null;
        }

        // Known public route — render the page immediately, no spinner
        if (PUBLIC_ROUTES.has(route.base)) {
            if (route.base === ROUTES.LOGIN) {
                return (
                    <ErrorBoundary>
                        <Suspense fallback={SmallSpinner}>
                            <Login onLoginSuccess={handleLoginSuccess} />
                        </Suspense>
                    </ErrorBoundary>
                );
            }
            if (route.base === ROUTES.PUBLIC_PREFIX) {
                const token = route.params[0];
                return (
                    <div className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]">
                        <ErrorBoundary>
                            <Suspense fallback={SmallSpinner}>
                                {token?.startsWith('contract_') ? <PublicContract token={token} /> :
                                 token ? <PublicProposal token={token} /> :
                                 <ErrorState message={t('pub.not_found')} />}
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                );
            }
            const PublicPage = PAGE_REGISTRY[route.base];
            if (PublicPage) {
                return (
                    <div className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]">
                        <ErrorBoundary>
                            <Suspense fallback={SmallSpinner}>
                                <PublicPage />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                );
            }
        }

        // Private route or unknown — tiny spinner, no text
        return SmallSpinner;
    }

    // 2. Public Pages Routing (Guest or Auth user on public page)
    if (authState === 'GUEST' || (PUBLIC_ROUTES.has(route.base) && authState === 'AUTH' && route.base !== ROUTES.LANDING)) {
        
        // If unauthenticated on a private route, redirect directly to login
        if (authState === 'GUEST' && !PUBLIC_ROUTES.has(route.base) && route.base !== '') {
            navigate(ROUTES.LOGIN);
            return null;
        }

        if (route.base === ROUTES.RESET_PASSWORD) {
            const tokenFromUrl = route.params[0] || window.location.hash.match(/token=([a-f0-9]+)/)?.[1] || '';
            if (tokenFromUrl) {
                window.location.hash = `#/${ROUTES.LOGIN}?reset_token=${tokenFromUrl}`;
            } else {
                navigate(ROUTES.LOGIN);
            }
            return null;
        }

        if (route.base === ROUTES.LOGIN) {
            return (
                <AnimatePresence mode="sync">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                    >
                        <ErrorBoundary>
                            <Suspense fallback={SmallSpinner}>
                                <Login onLoginSuccess={handleLoginSuccess} />
                            </Suspense>
                        </ErrorBoundary>
                    </motion.div>
                </AnimatePresence>
            );
        }

        // Special Case: Public Proposal / Contract
        if (route.base === ROUTES.PUBLIC_PREFIX) {
            const token = route.params[0];
            
            if (token?.startsWith('contract_')) {
                return (
                    <AnimatePresence mode="sync">
                        <motion.div
                            key={route.fullPath}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                        >
                            <ErrorBoundary>
                                <Suspense fallback={SmallSpinner}>
                                    <PublicContract token={token} />
                                </Suspense>
                            </ErrorBoundary>
                        </motion.div>
                    </AnimatePresence>
                );
            }

            return (
                <AnimatePresence mode="sync">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                        className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                    >
                        <ErrorBoundary>
                            <Suspense fallback={SmallSpinner}>
                                {token ? <PublicProposal token={token} /> : <ErrorState message={t('pub.not_found')} />}
                            </Suspense>
                        </ErrorBoundary>
                    </motion.div>
                </AnimatePresence>
            );
        }

        const TargetComponent = PAGE_REGISTRY[route.base];
        
        if (TargetComponent) {
            return (
                <AnimatePresence mode="sync">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                        className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                    >
                        <ErrorBoundary>
                            <Suspense fallback={SmallSpinner}>
                                <TargetComponent />
                            </Suspense>
                        </ErrorBoundary>
                    </motion.div>
                </AnimatePresence>
            );
        }
        
        // Fallback
        return <NotFound />;
    }

    // 3. Authenticated App Layout (Private Pages)
    if (authState === 'AUTH') {
        const hasKnownPage = !!PAGE_REGISTRY[route.base];
        return (
            <Layout activePage={route.base} onNavigate={navigate} onLogout={handleLogout}>
                {/* Access-denied toast for RBAC redirects */}
                <AnimatePresence>
                    {accessDenied && (
                        <motion.div
                            key="access-denied-banner"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-xl shadow-lg pointer-events-none"
                            role="alert"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            {t('rbac.access_denied') || 'Bạn không có quyền truy cập trang này'}
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Page persistence layer — keeps visited pages alive to avoid re-mount/re-fetch.
                    Each page fills the content area via absolute inset-0 and handles its own
                    scrolling via overflow-y-auto, so both fixed-height pages (Leads, Inbox)
                    and scrollable pages (Dashboard, Reports) work correctly. */}
                <div className="relative w-full h-full">
                    {[...mountedPrivateRoutes].map(routeKey => {
                        const Comp = PAGE_REGISTRY[routeKey];
                        if (!Comp) return null;
                        const isActive = routeKey === route.base;
                        return (
                            <div
                                key={routeKey}
                                id={isActive ? 'main-scroll-container' : undefined}
                                className="absolute inset-0 flex flex-col isolate overflow-y-auto overflow-x-hidden no-scrollbar"
                                style={{
                                    display: isActive ? 'flex' : 'none',
                                    overscrollBehaviorY: 'contain',
                                    WebkitOverflowScrolling: 'touch',
                                } as React.CSSProperties}
                            >
                                <ErrorBoundary>
                                    <Suspense fallback={PageSkeleton}>
                                        <Comp />
                                    </Suspense>
                                </ErrorBoundary>
                            </div>
                        );
                    })}
                    {!hasKnownPage && mountedPrivateRoutes.size > 0 && <NotFound />}
                </div>
            </Layout>
        );
    }

    return null;
};

const App: React.FC = () => {
    return (
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <TenantProvider>
                    <ThemeProvider>
                        <I18nProvider>
                            <AppShell />
                        </I18nProvider>
                    </ThemeProvider>
                </TenantProvider>
            </QueryClientProvider>
        </React.StrictMode>
    );
};

export default App;
