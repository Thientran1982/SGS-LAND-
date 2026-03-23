
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { NO_IMAGE_URL } from '../utils/constants';
import { db } from '../services/dbApi';
import { Listing, PropertyType, TransactionType, ListingStatus, User } from '../types';
import { useTranslation } from '../services/i18n';
import { ListingCard } from '../components/ListingCard';
import { Dropdown } from '../components/Dropdown';
import { Logo } from '../components/Logo';
import { ROUTES } from '../config/routes';
import { smartMatch, formatSmartPrice, formatUnitPrice } from '../utils/textUtils';
import MapView from '../components/MapView';
import { motion } from 'motion/react';

// --- ICONS ---
const ICONS = {
    SEARCH: <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    VIEW_GRID: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    VIEW_LIST: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    VIEW_BOARD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>,
    VIEW_MAP: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    LOCATION: <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    BED: <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    HEART_FILLED: <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.25 7.688 3.25c1.544 0 3.04.99 3.812 2.55.242.49.878.49 1.12 0C13.272 4.24 14.768 3.25 16.312 3.25c2.974 0 5.438 2.072 5.438 5.002 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>,
    HEART_OUTLINE: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
    VERIFIED: <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>,
    FILTER: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

// --- HOOK: DRAGGABLE SCROLL ---
const useDraggableScroll = (ref: React.RefObject<HTMLDivElement>, trigger?: any) => {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button, input, select')) return;
            isDown = true;
            node.classList.add('cursor-grabbing');
            node.classList.remove('cursor-grab');
            node.classList.remove('snap-x');
            startX = e.pageX - node.offsetLeft;
            scrollLeft = node.scrollLeft;
        };

        const onMouseLeave = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing');
            node.classList.add('cursor-grab');
            node.classList.add('snap-x');
        };

        const onMouseUp = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing');
            node.classList.add('cursor-grab');
            node.classList.add('snap-x');
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - node.offsetLeft;
            const walk = (x - startX) * 2;
            node.scrollLeft = scrollLeft - walk;
        };

        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('mouseleave', onMouseLeave);
        node.addEventListener('mouseup', onMouseUp);
        node.addEventListener('mousemove', onMouseMove);
        
        node.classList.add('cursor-grab');

        return () => {
            node.removeEventListener('mousedown', onMouseDown);
            node.removeEventListener('mouseleave', onMouseLeave);
            node.removeEventListener('mouseup', onMouseUp);
            node.removeEventListener('mousemove', onMouseMove);
        };
    }, [ref, trigger]);
};

// --- PAGINATION COMPONENT ---
const PaginationControl = memo(({ page, totalPages, totalItems, pageSize, onPageChange, t }: any) => {
    const start = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <>
            {/* Mobile: slim icon-only bar */}
            <div className="flex sm:hidden items-center justify-center gap-3 px-3 py-1.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] shadow-sm">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-bold text-[var(--text-primary)] min-w-[56px] text-center">{page} / {totalPages}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages || totalPages === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Desktop: full bar */}
            <div className="hidden sm:flex flex-row justify-between items-center px-5 py-2 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] shadow-sm gap-2">
                <div className="flex text-xs text-[var(--text-tertiary)] font-medium items-center gap-1">
                    <span>{t('pagination.showing')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{start}-{end}</span>
                    <span>{t('pagination.of')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{totalItems}</span>
                    <span>{t('pagination.results')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                    >
                        {t('pagination.prev')}
                    </button>
                    <div className="flex items-center gap-1 px-1.5">
                        <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{page} / {totalPages}</span>
                    </div>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page === totalPages || totalPages === 0}
                        className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                    >
                        {t('pagination.next')}
                    </button>
                </div>
            </div>
        </>
    );
});

type ViewMode = 'GRID' | 'LIST' | 'BOARD' | 'MAP';

export const ProductSearch: React.FC = () => {
    const { t, formatCurrency, language, formatCompactNumber } = useTranslation();
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [fetchError, setFetchError] = useState(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try { return (localStorage.getItem('sgs_public_view') as ViewMode) || 'GRID'; } catch { return 'GRID'; }
    });

    const filterContainerRef = useRef<HTMLDivElement>(null);
    const boardContainerRef = useRef<HTMLDivElement>(null);

    useDraggableScroll(filterContainerRef, viewMode);
    useDraggableScroll(boardContainerRef, viewMode);

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedTransaction, setSelectedTransaction] = useState('ALL');
    const [selectedLocation, setSelectedLocation] = useState('ALL');
    const [priceFilter, setPriceFilter] = useState('ALL');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

    useEffect(() => { localStorage.setItem('sgs_public_view', viewMode); }, [viewMode]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const hash = window.location.hash;
        if (hash.includes('?')) {
            const queryString = hash.split('?')[1];
            const params = new URLSearchParams(queryString);
            const q = params.get('q');
            if (q) setQuery(decodeURIComponent(q));
        }
    }, []);

    useEffect(() => {
        return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setFetchError(false);
            try {
                const user = await db.getCurrentUser();
                setCurrentUser(user);
                const res = await db.getPublicListings(1, 2000);
                setListings(res.data.filter(l => l.status === ListingStatus.AVAILABLE || l.status === ListingStatus.OPENING || l.status === ListingStatus.BOOKING));
                if (user) {
                    const favs = await db.getFavorites(1, 1000);
                    setFavorites(new Set(favs.data.map((f: any) => f.id)));
                } else {
                    try {
                        const stored = JSON.parse(localStorage.getItem('sgs_favorites') || '[]');
                        setFavorites(new Set(stored));
                    } catch {}
                }
            } catch {
                setFetchError(true);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const handleNavigate = (id: string) => window.location.hash = `#/${ROUTES.LISTING}/${id}`;

    const filteredListings = useMemo(() => {
        return listings.filter(l => {
            const typeStr = t(`property.${l.type.toUpperCase()}`) || '';
            const matchesQuery = smartMatch((l.title || '') + ' ' + (l.location || '') + ' ' + (l.code || '') + ' ' + typeStr, debouncedQuery);
            const matchesType = selectedType === 'ALL' || l.type === selectedType;
            const matchesTrans = selectedTransaction === 'ALL' || l.transaction === selectedTransaction;
            const matchesLoc = selectedLocation === 'ALL' || (l.location || '').includes(selectedLocation);
            
            let matchesPrice = true;
            if (priceFilter === 'UNDER_2') matchesPrice = l.price < 2_000_000_000;
            else if (priceFilter === '2_5') matchesPrice = l.price >= 2_000_000_000 && l.price <= 5_000_000_000;
            else if (priceFilter === '5_10') matchesPrice = l.price >= 5_000_000_000 && l.price <= 10_000_000_000;
            else if (priceFilter === 'OVER_10') matchesPrice = l.price > 10_000_000_000;

            const matchesFav = showFavoritesOnly ? favorites.has(l.id) : true;
            const matchesVerified = showVerifiedOnly ? l.isVerified : true;

            return matchesQuery && matchesType && matchesTrans && matchesLoc && matchesPrice && matchesFav && matchesVerified;
        });
    }, [listings, debouncedQuery, selectedType, selectedTransaction, selectedLocation, priceFilter, showFavoritesOnly, showVerifiedOnly, favorites, t]);

    const paginatedListings = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredListings.slice(start, start + pageSize);
    }, [filteredListings, page, pageSize]);

    const totalPages = Math.ceil(filteredListings.length / pageSize);

    useEffect(() => { setPage(1); }, [debouncedQuery, selectedType, selectedTransaction, selectedLocation, priceFilter, showFavoritesOnly, showVerifiedOnly]);

    const handleToggleFavorite = async (id: string) => {
        const isFav = favorites.has(id);
        const newSet = new Set(favorites);
        if (isFav) newSet.delete(id); else newSet.add(id);
        setFavorites(newSet);

        setToast({ msg: isFav ? t('favorites.removed') : t('favorites.added'), type: 'success' });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 2000);

        if (currentUser) {
            try {
                await db.toggleFavorite(id);
            } catch (e) {
                console.error(e);
                setFavorites(favorites);
            }
        } else {
            try {
                const stored = JSON.parse(localStorage.getItem('sgs_favorites') || '[]') as string[];
                const updated = isFav ? stored.filter((x) => x !== id) : [...stored, id];
                localStorage.setItem('sgs_favorites', JSON.stringify(updated));
            } catch {}
        }
    };

    const uniqueLocations = useMemo(() => {
        const locs = new Set(listings.map(l => l.location?.split(',').pop()?.trim() || '').filter(Boolean));
        return Array.from(locs).sort();
    }, [listings]);

    const typeOptions = useMemo(() => [{ value: 'ALL', label: t('inventory.all_types') }, ...Object.values(PropertyType).map(tKey => ({ value: tKey, label: t(`property.${tKey.toUpperCase()}`) }))], [t]);
    const transactionOptions = useMemo(() => [{ value: 'ALL', label: t('inventory.all_transactions') }, ...Object.values(TransactionType).map(tr => ({ value: tr, label: t(`transaction.${tr}`) }))], [t]);
    const priceOptions = useMemo(() => [
        { value: 'ALL', label: t('search.price_any') },
        { value: 'UNDER_2', label: t('search.price_under_2b') },
        { value: '2_5', label: t('search.price_2_5b') },
        { value: '5_10', label: t('search.price_5_10b') },
        { value: 'OVER_10', label: t('search.price_over_10b') },
    ], [t]);
    const locationOptions = useMemo(() => [{ value: 'ALL', label: t('search.all_locations') }, ...uniqueLocations.map(loc => ({ value: loc, label: loc }))], [uniqueLocations, t]);

    const hasActiveFilters = query || selectedType !== 'ALL' || selectedTransaction !== 'ALL' || selectedLocation !== 'ALL' || priceFilter !== 'ALL' || showFavoritesOnly || showVerifiedOnly;

    const clearFilters = () => {
        setQuery('');
        setDebouncedQuery('');
        setSelectedType('ALL');
        setSelectedTransaction('ALL');
        setSelectedLocation('ALL');
        setPriceFilter('ALL');
        setShowFavoritesOnly(false);
        setShowVerifiedOnly(false);
    };

    const groupedListings = useMemo(() => {
        const groups: Record<string, Listing[]> = {};
        [PropertyType.APARTMENT, PropertyType.VILLA, PropertyType.TOWNHOUSE, PropertyType.LAND, PropertyType.PROJECT].forEach(type => {
            groups[type] = [];
        });
        filteredListings.slice(0, 500).forEach(l => {
            if (!groups[l.type]) groups[l.type] = [];
            groups[l.type].push(l);
        });
        return groups;
    }, [filteredListings]);

    return (
        <div className="h-[100dvh] flex flex-col bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] overflow-hidden relative">
            {toast && (
                <div className="fixed top-20 right-6 z-[100] bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-enter flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    {toast.msg}
                </div>
            )}

            {/* HEADER (Sticky) */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/95 backdrop-blur-xl z-50 border-b border-[var(--glass-border)] shrink-0">
                <div className="max-w-[1920px] mx-auto">
                    {/* Top Row: Brand & Search & Login */}
                    <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            {/* Logo / Back */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={handleHome} className="p-2 text-[var(--text-tertiary)] hover:text-indigo-600 transition-colors rounded-lg hover:bg-[var(--glass-surface-hover)] min-w-[44px] min-h-[44px] flex items-center justify-center">
                                    {ICONS.BACK}
                                </button>
                                <div onClick={handleHome} className="flex items-center gap-2 cursor-pointer">
                                    <Logo className="w-7 h-7 text-indigo-600" />
                                    <span className="font-bold text-lg tracking-tight hidden sm:inline">SGS<span className="text-slate-400">MARKET</span></span>
                                </div>
                            </div>

                            {/* Right: Login (Mobile only) */}
                            <div className="shrink-0 flex items-center justify-end sm:hidden">
                                <button onClick={handleLogin} className="px-5 py-2 min-h-[44px] bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-lg active:scale-95 flex items-center justify-center">
                                    {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                                </button>
                            </div>
                        </div>

                            {/* Centered Search Bar */}
                        <div className="flex-1 w-full max-w-2xl mx-auto relative group flex items-center gap-2">
                            <div className="relative flex-1 group">
                                <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    {ICONS.SEARCH}
                                </div>
                                <input 
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 min-h-[44px] bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)] transition-all outline-none placeholder:text-[var(--text-muted)]"
                                    placeholder={t('search.placeholder')}
                                />
                                {query && (
                                    <div className="absolute right-2 inset-y-0 flex items-center">
                                        <button onClick={() => setQuery('')} className="text-slate-400 hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center" title={t('common.clear_search')}>
                                            {ICONS.X}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Login (Desktop) */}
                        <div className="shrink-0 hidden sm:flex items-center justify-end">
                            <button onClick={handleLogin} className="px-5 py-2 min-h-[44px] bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-lg active:scale-95 flex items-center justify-center">
                                {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Toolbar (Filters & Views) */}
                    <div className="px-4 md:px-6 h-16 flex items-center border-t border-[var(--glass-border)] bg-[var(--bg-surface)]">
                        
                        {/* Scrollable Container for EVERYTHING */}
                        <div ref={filterContainerRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full cursor-grab active:cursor-grabbing select-none pr-4">
                            
                            {/* 1. View Switcher */}
                            <div className="flex bg-[var(--glass-surface-hover)] p-0.5 rounded-lg shrink-0 mr-2">
                                <button onClick={() => setViewMode('GRID')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'GRID' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-[var(--text-secondary)]'}`}>{ICONS.VIEW_GRID}</button>
                                <button onClick={() => setViewMode('LIST')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'LIST' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-[var(--text-secondary)]'}`}>{ICONS.VIEW_LIST}</button>
                                <button onClick={() => setViewMode('BOARD')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'BOARD' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-[var(--text-secondary)]'}`}>{ICONS.VIEW_BOARD}</button>
                                <button onClick={() => setViewMode('MAP')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'MAP' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-[var(--text-secondary)]'}`}>{ICONS.VIEW_MAP}</button>
                            </div>

                            <div className="w-px h-6 bg-slate-200 mx-2 shrink-0"></div>

                            {/* 2. Filters */}
                            <div className="min-w-[130px] shrink-0"><Dropdown value={selectedTransaction} onChange={(v) => setSelectedTransaction(v as string)} options={transactionOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[130px] shrink-0"><Dropdown value={selectedType} onChange={(v) => setSelectedType(v as string)} options={typeOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[150px] shrink-0"><Dropdown value={selectedLocation} onChange={(v) => setSelectedLocation(v as string)} options={locationOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[130px] shrink-0"><Dropdown value={priceFilter} onChange={(v) => setPriceFilter(v as string)} options={priceOptions} className="text-xs h-11" placement="bottom" /></div>
                            
                            <button 
                                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                                className={`h-11 px-4 rounded-xl border flex items-center gap-2 transition-all shrink-0 text-xs font-bold ${showFavoritesOnly ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-tertiary)] hover:border-[var(--glass-border)]'}`}
                            >
                                {showFavoritesOnly ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE} 
                                <span className="hidden sm:inline">{t('favorites.title')}</span>
                            </button>

                            <button onClick={() => setShowVerifiedOnly(!showVerifiedOnly)} className={`h-11 px-4 rounded-xl border flex items-center gap-2 transition-all shrink-0 text-xs font-bold ${showVerifiedOnly ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-tertiary)] hover:border-[var(--glass-border)]'}`}>
                                {ICONS.VERIFIED} <span className="hidden sm:inline">{t('inventory.verified')}</span>
                            </button>

                            {hasActiveFilters && (
                                <button onClick={clearFilters} className="px-4 h-11 text-rose-600 font-bold text-xs bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-1">
                                    {ICONS.X} {t('search.clear_filters')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* FETCH ERROR */}
            {fetchError && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                    <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    <p className="text-slate-500 font-medium text-center">{t('common.error_loading')}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                    >
                        {t('common.retry')}
                    </button>
                </div>
            )}

            {/* CONTENT VIEWPORT */}
            {!fetchError && <div className="flex-1 overflow-hidden relative flex flex-col">

                {/* MAP VIEW — rendered outside overflow-y-auto so Leaflet gets a real height */}
                {viewMode === 'MAP' && (
                    <div className="flex-1 min-h-0 p-4 md:p-6">
                        <div className="h-full w-full relative z-0 rounded-[24px] overflow-hidden shadow-sm border border-[var(--glass-border)]">
                            <MapView
                                listings={filteredListings.slice(0, 1000)}
                                onNavigate={handleNavigate}
                                formatCurrency={formatCurrency}
                                formatUnitPrice={formatUnitPrice}
                                formatCompactNumber={formatCompactNumber}
                                t={t}
                                language={language}
                            />
                            {loading && (
                                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                                    <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                                    <p className="text-xs font-bold text-slate-600">{t('common.loading')}</p>
                                </div>
                            )}
                            {!loading && filteredListings.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-surface)]/80 backdrop-blur-sm z-10 gap-3">
                                    <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                    <p className="text-slate-400 font-medium">{t('common.no_results')}</p>
                                    <button onClick={clearFilters} className="text-indigo-600 font-bold hover:underline text-sm">{t('search.clear_filters')}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar${viewMode === 'MAP' ? ' hidden' : ''}`}>
                    {/* 1. GRID VIEW */}
                    {viewMode === 'GRID' && (
                        loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-[1920px] mx-auto">
                                {[1,2,3,4,5,6,7,8].map(i => (
                                    <div key={i} className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] overflow-hidden animate-pulse">
                                        <div className="aspect-[4/3] bg-slate-200 w-full" />
                                        <div className="p-4 space-y-3">
                                            <div className="h-3 bg-slate-200 rounded-full w-3/4" />
                                            <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                                            <div className="h-5 bg-slate-200 rounded-full w-2/3 mt-2" />
                                            <div className="flex justify-between mt-3">
                                                <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                                                <div className="h-3 bg-slate-100 rounded-full w-1/4" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-[1920px] mx-auto">
                                {paginatedListings.map((item, index) => (
                                    <motion.div 
                                        key={item.id} 
                                        className="min-h-full"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05 }}
                                    >
                                        <ListingCard 
                                            item={{...item, isFavorite: favorites.has(item.id)}} 
                                            t={t} 
                                            formatCurrency={formatCurrency} 
                                            onToggleFavorite={handleToggleFavorite}
                                            onEdit={() => {}} 
                                            onDelete={() => {}} 
                                            onClick={() => handleNavigate(item.id)} 
                                            showActions={false}
                                        />
                                    </motion.div>
                                ))}
                                {paginatedListings.length === 0 && <EmptyState t={t} onClear={clearFilters} />}
                            </div>
                        )
                    )}

                    {/* 2. LIST VIEW */}
                    {viewMode === 'LIST' && (
                        <>
                            <div className="hidden md:block max-w-[1920px] mx-auto bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[var(--glass-surface)]/80 border-b border-[var(--glass-border)] text-xs font-bold text-[var(--text-tertiary)] uppercase">
                                            <tr>
                                                <th className="px-4 py-4 w-12"></th>
                                                <th className="px-4 py-4">{t('inventory.label_title')}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_price')}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_unit_price')}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_area')}</th>
                                                <th className="px-4 py-4 hidden lg:table-cell">{t('inventory.label_location')}</th>
                                                <th className="px-4 py-4 hidden xl:table-cell">{t('inventory.label_type')}</th>
                                                <th className="px-4 py-4 text-right">{t('common.learn_more')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--glass-border)]">
                                            {loading && [1,2,3,4,5,6,7,8].map(i => (
                                                <tr key={i} className="animate-pulse">
                                                    <td className="px-4 py-4"><div className="w-8 h-8 rounded-full bg-slate-200" /></td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0" />
                                                            <div className="space-y-2">
                                                                <div className="h-3 bg-slate-200 rounded-full w-40" />
                                                                <div className="h-2.5 bg-slate-100 rounded-full w-24" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-200 rounded-full w-20 ml-auto" /></td>
                                                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-100 rounded-full w-16 ml-auto" /></td>
                                                    <td className="px-4 py-4 text-right"><div className="h-3 bg-slate-100 rounded-full w-12 ml-auto" /></td>
                                                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-3 bg-slate-100 rounded-full w-32" /></td>
                                                    <td className="px-4 py-4 hidden xl:table-cell"><div className="h-5 bg-slate-100 rounded w-16" /></td>
                                                    <td className="px-4 py-4 text-right"><div className="h-7 bg-slate-100 rounded-lg w-20 ml-auto" /></td>
                                                </tr>
                                            ))}
                                            {!loading && paginatedListings.map(item => {
                                                const isFav = favorites.has(item.id);
                                                return (
                                                    <tr key={item.id} onClick={() => handleNavigate(item.id)} className="hover:bg-[var(--glass-surface)] cursor-pointer group transition-colors">
                                                        <td className="px-4 py-4">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                                className={`p-1.5 rounded-full transition-colors ${isFav ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-400 hover:bg-[var(--glass-surface-hover)]'}`}
                                                            >
                                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 rounded-lg bg-[var(--glass-surface-hover)] overflow-hidden shrink-0 relative border border-[var(--glass-border)]">
                                                                    <img src={item.images?.[0] || NO_IMAGE_URL} className="w-full h-full object-cover" alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                                                                    {item.isVerified && <div className="absolute bottom-0 right-0 p-0.5 bg-emerald-500 rounded-tl-md text-white flex items-center justify-center"><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg></div>}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-[var(--text-primary)] text-sm mb-0.5 line-clamp-1 max-w-[200px] lg:max-w-[300px]">{item.title}</div>
                                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                                                                        <span className="lg:hidden truncate max-w-[150px]">{item.location}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-xs2 font-bold uppercase ${item.transaction === 'SALE' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                                                                            {t(`transaction.${item.transaction}`)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">{formatSmartPrice(item.price, t)}</td>
                                                        <td className="px-4 py-4 text-right text-xs3 font-bold text-indigo-600">
                                                            {item.area > 0 && item.type !== PropertyType.PROJECT ? formatUnitPrice(item.price, item.area, t) : '--'}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-sm text-[var(--text-secondary)] whitespace-nowrap">{item.area > 0 ? `${item.area} m²` : '--'}</td>
                                                        <td className="px-4 py-4 hidden lg:table-cell text-sm text-[var(--text-secondary)] max-w-[200px] truncate" title={item.location}>{item.location}</td>
                                                        <td className="px-4 py-4 hidden xl:table-cell">
                                                            <span className="px-2 py-1 rounded bg-[var(--glass-surface-hover)] text-xs2 font-bold text-[var(--text-tertiary)] uppercase whitespace-nowrap">
                                                                {t(`property.${item.type.toUpperCase()}`)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <button className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap">
                                                                {t('common.learn_more')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {paginatedListings.length === 0 && !loading && (
                                                <tr><td colSpan={8} className="p-12 text-center text-slate-400 italic">{t('common.no_results')}</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* MOBILE LIST */}
                            <div className="md:hidden space-y-3 pb-6">
                                {loading && [1,2,3,4,5,6].map(i => (
                                    <div key={i} className="bg-[var(--bg-surface)] p-3 rounded-2xl border border-[var(--glass-border)] shadow-sm flex gap-3 animate-pulse">
                                        <div className="w-20 h-20 rounded-xl bg-slate-200 shrink-0" />
                                        <div className="flex-1 space-y-2 pt-1">
                                            <div className="h-3 bg-slate-200 rounded-full w-3/4" />
                                            <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                                            <div className="h-4 bg-slate-200 rounded-full w-2/5 mt-2" />
                                        </div>
                                    </div>
                                ))}
                                {!loading && paginatedListings.map((item, index) => {
                                    const isFav = favorites.has(item.id);
                                    return (
                                        <motion.div 
                                            key={item.id} 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
                                            onClick={() => handleNavigate(item.id)}
                                            className="bg-[var(--bg-surface)] p-3 rounded-2xl border border-[var(--glass-border)] shadow-sm flex gap-3 active:scale-95 transition-transform cursor-pointer relative"
                                        >
                                            <div className="w-20 h-20 rounded-xl bg-[var(--glass-surface-hover)] overflow-hidden shrink-0 relative">
                                                <img src={item.images?.[0] || NO_IMAGE_URL} className="w-full h-full object-cover" alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div>
                                                    <div className="pr-8">
                                                        <h4 className="font-bold text-[var(--text-primary)] text-sm truncate">{item.title}</h4>
                                                    </div>
                                                    <div className="text-xs2 text-[var(--text-tertiary)] line-clamp-1 flex items-center gap-1 mt-0.5">
                                                        {ICONS.LOCATION} {item.location}
                                                    </div>
                                                </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div>
                                                            <div className="text-sm font-extrabold text-indigo-600 leading-none">
                                                                {formatSmartPrice(item.price, t)}
                                                            </div>
                                                            <div className="text-xs2 text-slate-400 mt-0.5 font-medium">
                                                                {item.area > 0 ? `${item.area} m²` : ''}{item.bedrooms ? ` • ${item.bedrooms} ${t('listing.bedrooms_short')}` : ''}{item.area > 0 && item.type !== PropertyType.PROJECT ? ` • ${formatUnitPrice(item.price, item.area, t)}` : ''}
                                                            </div>
                                                        </div>
                                                        <span className="text-2xs font-bold uppercase bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] px-2 py-1 rounded-lg border border-[var(--glass-border)]">
                                                            {t(`property.${item.type.toUpperCase()}`)}
                                                        </span>
                                                    </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                className={`absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors z-10 ${isFav ? 'text-rose-500 bg-rose-50' : 'text-slate-300 bg-transparent hover:bg-[var(--glass-surface-hover)]'}`}
                                            >
                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                            </button>
                                        </motion.div>
                                    );
                                })}
                                {!loading && paginatedListings.length === 0 && <EmptyState t={t} onClear={clearFilters} />}
                            </div>
                        </>
                    )}

                    {/* 3. BOARD VIEW */}
                    {viewMode === 'BOARD' && (
                        <div ref={boardContainerRef} className="h-full overflow-x-auto pb-4 no-scrollbar flex gap-6 snap-x cursor-grab active:cursor-grabbing">
                            {loading ? (
                                [1,2,3,4].map(i => (
                                    <div key={i} className="min-w-[320px] w-[320px] flex flex-col h-full bg-[var(--glass-surface-hover)]/50 rounded-2xl border border-[var(--glass-border)]/60 snap-start animate-pulse">
                                        <div className="p-4 border-b border-[var(--glass-border)]/50 flex justify-between items-center">
                                            <div className="h-3 bg-slate-200 rounded-full w-24" />
                                            <div className="h-5 w-8 bg-slate-200 rounded-full" />
                                        </div>
                                        <div className="flex-1 p-3 space-y-3">
                                            {[1,2,3].map(j => (
                                                <div key={j} className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--glass-border)]">
                                                    <div className="aspect-video w-full bg-slate-200 rounded-lg mb-3" />
                                                    <div className="h-3 bg-slate-200 rounded-full w-3/4 mb-2" />
                                                    <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : filteredListings.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <EmptyState t={t} onClear={clearFilters} />
                                </div>
                            ) : Object.entries(groupedListings).map(([type, items]) => {
                                const listingItems = items as unknown as Listing[];
                                if (listingItems.length === 0) return null;
                                return (
                                    <div key={type} className="min-w-[320px] w-[320px] flex flex-col h-full bg-[var(--glass-surface-hover)]/50 rounded-2xl border border-[var(--glass-border)]/60 snap-start">
                                        <div className="p-4 flex justify-between items-center sticky top-0 bg-[var(--glass-surface-hover)]/90 backdrop-blur-sm z-10 rounded-t-2xl border-b border-[var(--glass-border)]/50">
                                            <h3 className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-wide">{t(`property.${type.toUpperCase()}`)}</h3>
                                            <span className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-full text-xs font-bold text-[var(--text-tertiary)] shadow-sm">{listingItems.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                                            {listingItems.map(item => {
                                                const isFav = favorites.has(item.id);
                                                return (
                                                    <div 
                                                        key={item.id} 
                                                        onClick={() => handleNavigate(item.id)}
                                                        className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-1 group relative"
                                                    >
                                                        <div className="aspect-video w-full bg-[var(--glass-surface-hover)] rounded-lg mb-3 overflow-hidden relative">
                                                            <img src={item.images?.[0] || NO_IMAGE_URL} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs2 font-bold px-1.5 py-0.5 rounded backdrop-blur-sm z-10 flex flex-col items-end">
                                                                <span>{formatSmartPrice(item.price, t)}</span>
                                                                {item.area > 0 && item.type !== PropertyType.PROJECT && (
                                                                    <span className="text-3xs opacity-80 font-medium">{formatUnitPrice(item.price, item.area, t)}</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                                className="absolute top-2 left-2 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm text-white z-20 transition-colors"
                                                            >
                                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mb-1.5">
                                                            <span className={`text-3xs font-bold uppercase px-1.5 py-0.5 rounded ${item.transaction === 'RENT' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                                                                {t(`transaction.${item.transaction}`)}
                                                            </span>
                                                            <span className="font-mono text-xs2 font-bold text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] px-1 py-0.5 rounded">{item.code}</span>
                                                        </div>
                                                        <h4 className="font-bold text-[var(--text-primary)] text-xs line-clamp-2 mb-2 leading-relaxed">{item.title}</h4>
                                                        <div className="flex items-center gap-1 text-xs2 text-slate-400 truncate">
                                                            {ICONS.LOCATION} {item.location}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination — BOARD renders all filtered items so pagination doesn't apply */}
                    {(viewMode === 'GRID' || viewMode === 'LIST') && !loading && filteredListings.length > 0 && (
                        <div className="mt-6">
                            <PaginationControl
                                page={page}
                                totalPages={totalPages}
                                totalItems={filteredListings.length}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                t={t}
                            />
                        </div>
                    )}
                </div>
            </div>}
        </div>
    );
};

const EmptyState = ({ t, onClear }: any) => (
    <div className="col-span-full py-20 text-center flex flex-col items-center">
        <svg className="w-20 h-20 text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <p className="text-slate-400 text-lg font-medium">{t('common.no_results')}</p>
        <button onClick={onClear} className="mt-4 text-indigo-600 font-bold hover:underline">
            {t('search.clear_filters')}
        </button>
    </div>
);
