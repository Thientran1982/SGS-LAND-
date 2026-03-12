
import React, { useState, useEffect, useCallback, Suspense, memo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { db } from './services/dbApi';
import { I18nProvider, useTranslation } from './services/i18n';
import { ThemeProvider } from './services/theme';
import { TenantProvider } from './services/tenantContext';
import { ROUTES } from './config/routes';
import { lazyLoad } from './utils/reactUtils';
import { motion, AnimatePresence } from 'motion/react';

// -----------------------------------------------------------------------------
// 1. LAZY LOADED PAGES
// -----------------------------------------------------------------------------

const queryClient = new QueryClient();

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
const Profile = lazyLoad(() => import('./pages/Profile'), 'Profile');

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
            <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
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
            return <ErrorState message="Đã xảy ra lỗi không mong muốn." onRetry={() => window.location.reload()} />;
        }
        return this.props.children;
    }
}

const LoadingScreen: React.FC = () => (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-app)] transition-colors duration-300 text-[var(--text-primary)]">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-[var(--glass-border)] border-t-[var(--primary-600)] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-[var(--primary-600)] rounded-full animate-pulse"></div>
            </div>
        </div>
        <div className="mt-4 text-xs font-bold uppercase tracking-widest animate-pulse opacity-60">
            Đang khởi tạo hệ thống...
        </div>
    </div>
);

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

    const navigate = useCallback((path: string) => {
        const target = path.startsWith('/') ? path : `/${path}`;
        window.location.hash = target;
    }, []);

    return { route, navigate };
};

// -----------------------------------------------------------------------------
// 5. APPLICATION SHELL
// -----------------------------------------------------------------------------

const AppShell: React.FC = () => {
    const { route, navigate } = useRouter();
    const { t } = useTranslation();
    const [authState, setAuthState] = useState<'LOADING' | 'AUTH' | 'GUEST'>('LOADING');

    // Auth Initialization — runs once on mount to check session
    useEffect(() => {
        const initAuth = async () => {
            try {
                const user = await db.getCurrentUser();
                setAuthState(user ? 'AUTH' : 'GUEST');
            } catch {
                setAuthState('GUEST');
            }
        };
        initAuth();

        // Re-check on explicit auth events (login/logout)
        const onLogin = () => db.getCurrentUser().then(u => setAuthState(u ? 'AUTH' : 'GUEST')).catch(() => setAuthState('GUEST'));
        const onLogout = () => setAuthState('GUEST');
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
        }
    }, [route.base, authState, navigate]);

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
        setAuthState('AUTH');
        navigate(ROUTES.DEFAULT_PRIVATE);
    }, [navigate]);

    const handleLogout = useCallback(() => {
        db.logout();
        setAuthState('GUEST');
        navigate(ROUTES.LOGIN);
    }, [navigate]);

    // --- RENDERER ---

    if (authState === 'LOADING') return <LoadingScreen />;

    // 2. Public Pages Routing (Guest or Auth user on public page)
    if (authState === 'GUEST' || (PUBLIC_ROUTES.has(route.base) && authState === 'AUTH' && route.base !== ROUTES.LANDING)) {
        
        // Safety Catch: If authState is GUEST but route is NOT public (e.g. manually typed #/dashboard)
        // Wait for checkAuth to complete and either authenticate or redirect to login
        if (authState === 'GUEST' && !PUBLIC_ROUTES.has(route.base) && route.base !== '') {
             return <LoadingScreen />; 
        }

        // Special Case: Login Page
        if (route.base === ROUTES.LOGIN) {
            return (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ErrorBoundary>
                            <Suspense fallback={<LoadingScreen />}>
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
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={route.fullPath}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                        >
                            <ErrorBoundary>
                                <Suspense fallback={<LoadingScreen />}>
                                    <PublicContract token={token} />
                                </Suspense>
                            </ErrorBoundary>
                        </motion.div>
                    </AnimatePresence>
                );
            }

            return (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                    >
                        <ErrorBoundary>
                            <Suspense fallback={<LoadingScreen />}>
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
                <AnimatePresence mode="wait">
                    <motion.div
                        key={route.fullPath}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="h-[100dvh] w-full overflow-y-auto no-scrollbar bg-[var(--bg-app)]"
                    >
                        <ErrorBoundary>
                            <Suspense fallback={<LoadingScreen />}>
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
        const TargetComponent = PAGE_REGISTRY[route.base];
        return (
            <Layout activePage={route.base} onNavigate={navigate} onLogout={handleLogout}>
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={route.fullPath}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="h-full w-full flex flex-col relative overflow-hidden isolate"
                    >
                        <ErrorBoundary>
                            <Suspense fallback={
                                <div className="h-full w-full flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-[var(--glass-border)] border-t-[var(--primary-600)] rounded-full animate-spin"></div>
                                </div>
                            }>
                                {TargetComponent ? <TargetComponent /> : <NotFound />}
                            </Suspense>
                        </ErrorBoundary>
                    </motion.div>
                </AnimatePresence>
            </Layout>
        );
    }

    return <LoadingScreen />;
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
