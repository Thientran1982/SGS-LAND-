import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/mockDb';
import { Listing, ListingStatus, PropertyType, User } from '../types'; 
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { ListingCard } from '../components/ListingCard'; 
import { Hero3D } from '../components/Hero3D';
import { ArrowRight, Search, Sparkles, BarChart3, Globe2, Zap, Sun, Moon, ChevronRight, X } from 'lucide-react';
import { motion } from 'motion/react';

// -----------------------------------------------------------------------------
// ASSETS & CONFIGURATION
// -----------------------------------------------------------------------------

const PARTNERS = [
    "VINHOMES", "MASTERISE HOMES", "KEPPEL LAND", "CAPITALAND", "GAMUDA LAND", "SONKIM LAND", "HUNG THINH", "NOVALAND"
];

const ICONS = {
    ARROW_RIGHT: <ArrowRight className="w-4 h-4" />,
    SEARCH: <Search className="w-5 h-5" />,
    AI_SPARK: <Sparkles className="w-6 h-6" />,
    CHART: <BarChart3 className="w-6 h-6" />,
    GLOBE: <Globe2 className="w-6 h-6" />,
    BOLT: <Zap className="w-6 h-6" />,
    SUN: <Sun className="w-4 h-4" />,
    MOON: <Moon className="w-4 h-4" />,
    X: <X className="w-4 h-4" />
};

// --- HOOKS ---

const useCountUp = (end: number, duration: number = 2000, start: boolean = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!start) return;
        
        let startTime: number | null = null;
        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = currentTime - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            // Easing function (easeOutExpo)
            const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
            
            setCount(Math.floor(ease * end));

            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }, [end, duration, start]);

    return count;
};

const NavPill = ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className="px-3 lg:px-5 py-1.5 lg:py-2.5 rounded-full text-[10px] lg:text-xs font-bold transition-all duration-300 border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md cursor-pointer hover:-translate-y-0.5 select-none whitespace-nowrap"
    >
        {children}
    </div>
);

// Enhanced Stat Card with Intersection Observer for Animation
const StatCard = ({ label, value, suffix, trend, prefix = "" }: { label: string, value: number, suffix: string, trend: string, prefix?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const count = useCountUp(value, 2000, isVisible);
    const { language } = useTranslation();

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <motion.div 
            ref={cardRef} 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] transition-all group h-full justify-center items-center text-center transform hover:-translate-y-1"
        >
            <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-3 md:mb-4">{label}</span>
            <div className="flex flex-col items-center gap-2 md:gap-3">
                <span className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:scale-105 transition-transform">
                    {prefix}{count.toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US')}{suffix}
                </span>
                <span className="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 whitespace-nowrap">{trend}</span>
            </div>
        </motion.div>
    );
};

const FeatureBento = ({ title, desc, icon, className = "", iconBg = "bg-slate-100", onClick, ctaLabel, delay = 0 }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, delay }}
        onClick={onClick}
        className={`relative p-6 md:p-8 rounded-[32px] overflow-hidden group border border-slate-100 dark:border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-500 bg-white dark:bg-slate-800 flex flex-col justify-between cursor-pointer ${className}`}
    >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"></div>
        
        <div>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                {icon}
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[95%] font-medium">{desc}</p>
        </div>
        <div className="pt-8 flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white opacity-60 group-hover:opacity-100 transition-opacity group/btn">
            <span>{ctaLabel}</span>
            <span className="group-hover/btn:translate-x-1 transition-transform">{ICONS.ARROW_RIGHT}</span>
        </div>
    </motion.div>
);

export const Landing: React.FC = () => {
    const { formatCurrency, language, setLanguage, t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    
    const [scrolled, setScrolled] = useState(false);
    const [allListings, setAllListings] = useState<Listing[]>([]);
    const [activeCategory, setActiveCategory] = useState<'ALL' | 'PROJECT' | 'UNIT'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Typewriter effect
    const [text, setText] = useState('');
    
    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    useEffect(() => {
        document.title = `SGS LAND | ${t('landing.hero_title') || 'Enterprise OS'}`;
    }, [t]);

    useEffect(() => {
        const fullText = t('landing.typewriter');
        let idx = 0;
        setText('');
        
        const interval = setInterval(() => {
            setText(fullText.slice(0, idx));
            idx++;
            if (idx > fullText.length) clearInterval(interval);
        }, 40);
        return () => clearInterval(interval);
    }, [language, t]); 

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        
        db.getListings(1, 200).then(res => {
            if (res.data) {
                // Enterprise Logic: Show Premium/Available Listings First
                // Filter for "available" OR "opening" to show active inventory
                const validListings = res.data.filter(l => 
                    l.status === ListingStatus.AVAILABLE || 
                    l.status === ListingStatus.OPENING || 
                    l.status === ListingStatus.BOOKING
                );
                // Sort by Price Descending (Show luxury first)
                const sorted = validListings.sort((a, b) => b.price - a.price);
                setAllListings(sorted);
            }
        });
        
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navigateTo = (route: string) => {
        window.location.hash = `#/${route}`;
        window.scrollTo(0, 0); 
    };

    const handleSearch = () => {
        // Navigate to search page with query parameter if present
        const route = searchQuery.trim() 
            ? `${ROUTES.SEARCH}?q=${encodeURIComponent(searchQuery.trim())}` 
            : ROUTES.SEARCH;
        navigateTo(route);
    };

    const displayedListings = useMemo(() => {
        let filtered = allListings;
        if (activeCategory === 'PROJECT') {
            filtered = allListings.filter(l => l.type === PropertyType.PROJECT);
        } else if (activeCategory === 'UNIT') {
            filtered = allListings.filter(l => l.type !== PropertyType.PROJECT);
        }
        // Show top 6
        return filtered.slice(0, 6);
    }, [allListings, activeCategory]);

    const FooterLink = ({ label, route }: { label: string, route: string }) => (
        <li>
            <button 
                onClick={() => navigateTo(route)} 
                className="hover:text-indigo-600 transition-colors text-left text-slate-500 hover:translate-x-1 duration-200 inline-block"
            >
                {label}
            </button>
        </li>
    );

    return (
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden min-h-screen transition-colors duration-300">
            
            {/* NAVBAR */}
            <nav className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 w-full px-4 flex justify-center pointer-events-none">
                <div className={`pointer-events-auto relative transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex items-center justify-between p-2 rounded-full border ${scrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-slate-200/50 dark:border-white/10 shadow-2xl w-full max-w-5xl' : 'bg-transparent border-transparent w-full max-w-7xl'}`}>
                    
                    <div className="flex items-center gap-2 md:gap-3 pl-2 cursor-pointer group z-10 flex-none md:flex-1" onClick={() => navigateTo('')}>
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-105 transition-transform">
                            <Logo className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className={`font-bold text-base md:text-lg tracking-tight transition-opacity text-slate-900 dark:text-white`}>SGS<span className="text-slate-400">LAND</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/50 dark:border-slate-700 backdrop-blur-md shadow-sm pointer-events-auto flex-none 
                        md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-20">
                        <NavPill onClick={() => navigateTo(ROUTES.SEARCH)}>{t('nav.public_market')}</NavPill>
                        <NavPill onClick={() => navigateTo(ROUTES.AI_VALUATION)}>{t('footer.link_valuation')}</NavPill>
                        <NavPill onClick={() => navigateTo(ROUTES.CRM_SOLUTION)}>{t('footer.link_crm')}</NavPill>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 pr-1 z-10 flex-none ml-auto md:flex-1 md:justify-end">
                        {currentUser ? (
                            <button onClick={() => navigateTo(ROUTES.DASHBOARD)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 lg:px-6 py-2.5 lg:py-2.5 rounded-full text-[10px] lg:text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 active:scale-95 flex items-center gap-2 whitespace-nowrap min-h-[44px]">
                                {t('menu.dashboard')} <span className="hidden sm:inline">{ICONS.ARROW_RIGHT}</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={() => navigateTo(ROUTES.LOGIN)} className="px-3 lg:px-5 py-2 lg:py-2.5 text-[10px] lg:text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hidden lg:flex min-h-[44px] items-center">
                                    {t('auth.btn_login')}
                                </button>
                                
                                <button onClick={() => navigateTo(ROUTES.LOGIN)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 lg:px-6 py-2.5 lg:py-2.5 rounded-full text-[10px] lg:text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 active:scale-95 flex items-center gap-2 whitespace-nowrap min-h-[44px]">
                                    {t('landing.cta_btn_register')} <span className="hidden sm:inline">{ICONS.ARROW_RIGHT}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="relative pt-32 md:pt-40 pb-20 md:pb-32 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center items-center">
                {/* Background Decor */}
                <motion.div 
                    animate={{ 
                        scale: [1, 1.05, 1],
                        opacity: [0.4, 0.6, 0.4]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[1200px] h-[600px] md:h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent dark:from-indigo-900/20 rounded-full blur-3xl -z-10 pointer-events-none"
                ></motion.div>
                
                <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    {/* Left Column: Text & Search */}
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-indigo-50/80 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-500/30 shadow-sm mb-6 md:mb-8 backdrop-blur-sm"
                        >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 dark:bg-indigo-400"></span>
                            </span>
                            <span className="text-[9px] md:text-[10px] font-bold text-indigo-700 dark:text-indigo-300 tracking-widest uppercase">{t('landing.badge_tech')}</span>
                        </motion.div>

                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight mb-6 md:mb-8 leading-[1.1] drop-shadow-sm"
                        >
                            {text}<span className="animate-blink text-indigo-500">|</span>
                        </motion.h1>

                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-base md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mb-10 md:mb-12 font-medium leading-relaxed"
                        >
                            {t('landing.hero_desc')}
                        </motion.p>

                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="w-full max-w-xl relative group z-20"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800 rounded-full opacity-40 blur-lg group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-full p-1.5 md:p-2 flex items-center shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700">
                                <div className="pl-3 md:pl-6 pr-2 md:pr-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center justify-center">{ICONS.SEARCH}</div>
                                <input 
                                    className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white text-sm md:text-lg placeholder:text-slate-400 h-12 md:h-12 font-medium truncate w-full"
                                    placeholder={t('landing.search_placeholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 mr-2 flex items-center justify-center"
                                        title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                    >
                                        {ICONS.X}
                                    </button>
                                )}
                                <button onClick={handleSearch} className="bg-slate-900 dark:bg-indigo-600 text-white px-4 md:px-8 py-2.5 md:py-3 rounded-full font-bold text-xs md:text-sm hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors active:scale-95 shadow-lg shrink-0 ml-1 min-h-[44px]">
                                    {t('common.search')}
                                </button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: 3D SVG */}
                    <div className="w-full flex justify-center items-center lg:justify-end">
                        <Hero3D />
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-16 md:mt-24 pt-8 w-full max-w-5xl mx-auto text-center"
                >
                    <p className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mb-6 md:mb-8">{t('landing.trust_badge')}</p>
                    
                    {/* TICKER ANIMATION CONTAINER */}
                    <div className="relative overflow-hidden w-full max-w-4xl mx-auto mask-linear-fade">
                        <div className="flex gap-12 md:gap-20 opacity-60 grayscale hover:grayscale-0 transition-all duration-700 animate-scroll-x">
                            {[...PARTNERS, ...PARTNERS].map((p, i) => (
                                <span key={i} className="text-sm md:text-lg font-bold font-display text-slate-800 dark:text-slate-300 tracking-tight cursor-default whitespace-nowrap">{p}</span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* METRICS (ENTERPRISE GRADE) */}
            <section className="py-16 md:py-20 px-6 bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <StatCard label={t('landing.stat_value_label')} value={2.5} prefix="$" suffix="B+" trend={t('landing.trend_ytd')} />
                        <StatCard label={t('landing.stat_data_label')} value={50} suffix="M+" trend={t('landing.trend_daily')} />
                        <StatCard label={t('landing.stat_latency_label')} value={48} suffix="ms" trend={t('landing.trend_multi_region')} />
                        <StatCard label={t('landing.stat_uptime_label')} value={99.99} suffix="%" trend={t('landing.trend_enterprise')} />
                    </div>
                </div>
            </section>

            {/* CORE INTELLIGENCE */}
            <section className="py-20 md:py-32 px-6 relative bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-12 md:mb-20 text-center md:text-left"
                    >
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight">{t('landing.core_title_prefix')} <br className="hidden md:block"/> <span className="text-indigo-600 dark:text-indigo-400">{t('landing.core_title_suffix')}</span></h2>
                        <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">{t('landing.core_section_desc')}</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
                        
                        <FeatureBento 
                            title={t('landing.feature_ai_title')}
                            desc={t('landing.feature_ai_desc')}
                            icon={ICONS.AI_SPARK}
                            className="md:col-span-3 lg:col-span-8 bg-slate-50 dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                            onClick={() => navigateTo(ROUTES.AI_VALUATION)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.1}
                        />

                        <FeatureBento 
                            title={t('landing.feature_data_title')}
                            desc={t('landing.feature_data_desc')}
                            icon={ICONS.CHART}
                            className="md:col-span-3 lg:col-span-4 bg-slate-50 dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                            onClick={() => navigateTo(ROUTES.SEARCH)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.2}
                        />

                        <FeatureBento 
                            title={t('landing.feature_crm_title')}
                            desc={t('landing.feature_crm_desc')}
                            icon={ICONS.BOLT}
                            className="md:col-span-3 lg:col-span-4 bg-slate-50 dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            onClick={() => navigateTo(ROUTES.CRM_SOLUTION)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.3}
                        />

                        <FeatureBento 
                            title={t('landing.feature_comm_title')}
                            desc={t('landing.feature_comm_desc')}
                            icon={ICONS.GLOBE}
                            className="md:col-span-3 lg:col-span-8 bg-slate-50 dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                            onClick={() => navigateTo(ROUTES.SEARCH)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.4}
                        />
                    </div>
                </div>
            </section>

            {/* LIVE MARKET (PREMIUM FIRST) */}
            <section className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                <div className="max-w-[1600px] mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-12 gap-6">
                        <div>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest text-xs uppercase mb-2 block">{t('landing.market_subtitle')}</span>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{t('landing.market_title')}</h2>
                        </div>
                        
                        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            {[
                                { id: 'ALL', label: t('dash.filter_all') },
                                { id: 'PROJECT', label: t('property.PROJECT') },
                                { id: 'UNIT', label: t('property.APARTMENT') }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id as any)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        activeCategory === cat.id 
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {displayedListings.length > 0 ? displayedListings.map((item, index) => (
                            <motion.div 
                                key={item.id} 
                                className="min-h-full"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                {/* Use Shared ListingCard Component for Consistency */}
                                <ListingCard 
                                    item={item} 
                                    t={t} 
                                    formatCurrency={formatCurrency} 
                                    onToggleFavorite={() => navigateTo(ROUTES.LOGIN)} 
                                    onEdit={() => {}} 
                                    onDelete={() => {}} 
                                    onClick={() => navigateTo(`${ROUTES.LISTING}/${item.id}`)} 
                                    showActions={false}
                                />
                            </motion.div>
                        )) : (
                            <div className="col-span-3 text-center py-20">
                                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse mx-auto mb-4"></div>
                                <p className="text-slate-400 font-medium">{t('common.loading') || 'Updating market data...'}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-12 text-center">
                        <button onClick={() => navigateTo(ROUTES.SEARCH)} className="group inline-flex items-center gap-2 text-slate-900 dark:text-white font-bold border-b-2 border-slate-200 dark:border-slate-700 pb-1 hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-sm md:text-base">
                            {t('landing.market_view_all')} <span className="group-hover:translate-x-1 transition-transform">{ICONS.ARROW_RIGHT}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 md:py-32 px-6 text-center relative overflow-hidden bg-slate-900">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
                ></motion.div>
                <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-0 left-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
                ></motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-white mb-6 md:mb-8 tracking-tighter">{t('landing.cta_title')}</h2>
                    <p className="text-lg md:text-xl text-slate-300 mb-10 md:mb-12 max-w-2xl mx-auto">
                        {t('landing.cta_desc')}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {currentUser ? (
                            <button onClick={() => navigateTo(ROUTES.DASHBOARD)} className="px-8 md:px-10 py-3 md:py-4 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg hover:scale-105 transition-transform shadow-2xl">
                                {t('menu.dashboard')}
                            </button>
                        ) : (
                            <button onClick={() => navigateTo(ROUTES.LOGIN)} className="px-8 md:px-10 py-3 md:py-4 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg hover:scale-105 transition-transform shadow-2xl">
                                {t('landing.cta_btn_register')}
                            </button>
                        )}
                        <button onClick={() => navigateTo(ROUTES.CONTACT)} className="px-8 md:px-10 py-3 md:py-4 bg-transparent border border-white/20 text-white rounded-full font-bold text-base md:text-lg hover:bg-white/10 transition-colors backdrop-blur-sm">
                            {t('landing.cta_btn_sales')}
                        </button>
                    </div>
                </motion.div>
            </section>

            {/* FOOTER */}
            <footer className="bg-white dark:bg-slate-900 text-sm py-16 md:py-20 px-6 border-t border-slate-100 dark:border-slate-800">
                <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 md:gap-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                            <Logo className="w-5 h-5 md:w-6 md:h-6 text-slate-900 dark:text-white" />
                            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">SGS LAND</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs leading-relaxed text-xs md:text-sm">
                            {t('footer.brand_desc')}
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-[10px] md:text-xs">{t('footer.col_product')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_marketplace')} route={ROUTES.SEARCH} />
                            <FooterLink label={t('footer.link_valuation')} route={ROUTES.AI_VALUATION} />
                            <FooterLink label={t('footer.link_crm')} route={ROUTES.CRM_SOLUTION} />
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-[10px] md:text-xs">{t('footer.col_company')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_about')} route={ROUTES.ABOUT} />
                            <FooterLink label={t('footer.link_careers')} route={ROUTES.CAREERS} />
                            <FooterLink label={t('footer.link_news')} route={ROUTES.NEWS} />
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-[10px] md:text-xs">{t('footer.col_legal')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_help')} route={ROUTES.HELP_CENTER} />
                            <FooterLink label={t('footer.link_api')} route={ROUTES.API_DOCS} />
                            <FooterLink label={t('footer.system_status')} route={ROUTES.STATUS_PUBLIC} />
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-[10px] md:text-xs">{t('footer.link_terms')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_privacy')} route={ROUTES.PRIVACY} />
                            <FooterLink label={t('footer.link_terms')} route={ROUTES.TERMS} />
                        </ul>
                    </div>
                </div>
                <div className="max-w-[1400px] mx-auto mt-16 md:mt-20 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <span className="text-slate-400 text-[10px] md:text-xs">
                        {t('footer.copyright', { year: 2026 })}
                    </span>
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-4 md:pr-6">
                            <button 
                                onClick={toggleTheme}
                                className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center min-w-[36px] min-h-[36px]"
                                aria-label="Toggle Theme"
                            >
                                {theme === 'dark' ? ICONS.MOON : ICONS.SUN}
                            </button>

                            <button 
                                onClick={() => setLanguage(language === 'vn' ? 'en' : 'vn')}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 min-w-[36px] min-h-[36px]"
                                title={t('nav.lang_switch')}
                                aria-label={t('nav.lang_switch')}
                            >
                                {language.toUpperCase()}
                            </button>
                        </div>
                        <div className="flex gap-4 md:gap-6">
                            <a href="https://www.facebook.com/sgslandvn" target="_blank" rel="noreferrer" className="w-10 h-10 md:w-8 md:h-8 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <span className="sr-only">Facebook</span>
                                <svg className="w-4 h-4 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="w-10 h-10 md:w-8 md:h-8 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <span className="sr-only">LinkedIn</span>
                                <svg className="w-4 h-4 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;