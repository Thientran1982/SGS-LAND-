
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { db } from '../services/mockDb';
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
    VIEW_GRID: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2v-2a2 2 0 01-2 2H6a2 2 0 01-2-2v2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    VIEW_LIST: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    VIEW_BOARD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2-2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 00-2 2" /></svg>,
    VIEW_MAP: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    LOCATION: <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    BED: <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    HEART_FILLED: <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.25 7.688 3.25c1.544 0 3.04.99 3.812 2.55.242.49.878.49 1.12 0C13.272 4.24 14.768 3.25 16.312 3.25c2.974 0 5.438 2.072 5.438 5.002 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>,
    HEART_OUTLINE: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
    VERIFIED: <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M11.379 1.665a3 3 0 00-3.14.318 3.001 3.001 0 00-2.117 2.376 3 3 0 00-2.827 1.398 3 3 0 00-.884 3.056A3.001 3.001 0 002 11.25a3 3 0 00.411 2.439 3 3 0 00.884 3.055 3.001 3.001 0 002.827 1.398 3 3 0 002.117 2.376 3 3 0 003.14.318 3 3 0 003.242 0 3 3 0 003.14-.318 3.001 3.001 0 002.117-2.376 3 3 0 002.827-1.398 3 3 0 00.884-3.056A3.001 3.001 0 0022 11.25a3 3 0 00-.411-2.439 3 3 0 00-.884-3.055 3.001 3.001 0 00-2.827-1.398 3 3 0 00-2.117-2.376 3 3 0 00-3.14-.318 3 3 0 00-3.242 0zM9.53 13.03a.75.75 0 001.06 1.06l4.25-4.25a.75.75 0 00-1.06-1.06L10.06 12.5 8.47 10.91a.75.75 0 00-1.06 1.06l2.12 2.12z" clipRule="evenodd" /></svg>,
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
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
            <div className="hidden sm:flex text-xs text-slate-500 font-medium items-center gap-1">
                <span>{t('pagination.showing')}</span>
                <span className="font-bold text-slate-900">{start}-{end}</span>
                <span>{t('pagination.of')}</span>
                <span className="font-bold text-slate-900">{totalItems}</span>
                <span className="hidden sm:inline">{t('pagination.results')}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button 
                    onClick={() => onPageChange(page - 1)} 
                    disabled={page === 1}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.prev')}
                </button>
                <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-bold text-slate-800">{page} / {totalPages}</span>
                </div>
                <button 
                    onClick={() => onPageChange(page + 1)} 
                    disabled={page === totalPages}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.next')}
                </button>
            </div>
        </div>
    );
});

type ViewMode = 'GRID' | 'LIST' | 'BOARD' | 'MAP';

export const ProductSearch: React.FC = () => {
    const { t, formatCurrency, language } = useTranslation();
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try { return (localStorage.getItem('sgs_public_view') as ViewMode) || 'GRID'; } catch { return 'GRID'; }
    });

    const filterContainerRef = useRef<HTMLDivElement>(null);
    const boardContainerRef = useRef<HTMLDivElement>(null);

    useDraggableScroll(filterContainerRef, viewMode);
    useDraggableScroll(boardContainerRef, viewMode);

    const [query, setQuery] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedTransaction, setSelectedTransaction] = useState('ALL');
    const [selectedLocation, setSelectedLocation] = useState('ALL');
    const [priceFilter, setPriceFilter] = useState('ALL');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

    useEffect(() => { localStorage.setItem('sgs_public_view', viewMode); }, [viewMode]);

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
        const load = async () => {
            setLoading(true);
            try {
                const user = await db.getCurrentUser();
                setCurrentUser(user);
                const res = await db.getListings(1, 2000); 
                setListings(res.data.filter(l => l.status === ListingStatus.AVAILABLE || l.status === ListingStatus.OPENING || l.status === ListingStatus.BOOKING));
                const favs = await db.getFavorites(1, 1000);
                setFavorites(new Set(favs.data.map(f => f.id)));
            } catch (e) {
                console.error(e);
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
            const matchesQuery = smartMatch((l.title || '') + ' ' + (l.location || '') + ' ' + (l.code || '') + ' ' + typeStr, query);
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
    }, [listings, query, selectedType, selectedTransaction, selectedLocation, priceFilter, showFavoritesOnly, showVerifiedOnly, favorites, t]);

    const paginatedListings = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredListings.slice(start, start + pageSize);
    }, [filteredListings, page, pageSize]);

    const totalPages = Math.ceil(filteredListings.length / pageSize);

    useEffect(() => { setPage(1); }, [query, selectedType, selectedTransaction, selectedLocation, priceFilter, showFavoritesOnly, showVerifiedOnly]);

    const handleToggleFavorite = async (id: string) => {
        const isFav = favorites.has(id);
        const newSet = new Set(favorites);
        if (isFav) newSet.delete(id); else newSet.add(id);
        setFavorites(newSet);

        setToast({ msg: isFav ? t('favorites.removed') || "Đã xóa khỏi yêu thích" : t('favorites.added') || "Đã thêm vào yêu thích", type: 'success' });
        setTimeout(() => setToast(null), 2000);

        try {
            if (isFav) await db.removeFromFavorites(id);
            else await db.addToFavorites(id);
        } catch (e) {
            console.error(e);
            setFavorites(favorites);
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
        paginatedListings.forEach(l => {
            if (!groups[l.type]) groups[l.type] = [];
            groups[l.type].push(l);
        });
        return groups;
    }, [paginatedListings]);

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
            {toast && (
                <div className="fixed top-20 right-6 z-[100] bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-enter flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    {toast.msg}
                </div>
            )}

            {/* HEADER (Sticky) */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl z-50 border-b border-slate-200 shrink-0">
                <div className="max-w-[1920px] mx-auto">
                    {/* Top Row: Brand & Search & Login */}
                    <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            {/* Logo / Back */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={handleHome} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                                    placeholder={t('search.placeholder')}
                                />
                                {query && (
                                    <div className="absolute right-2 inset-y-0 flex items-center">
                                        <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center" title={t('common.clear_search') || 'Xóa tìm kiếm'}>
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
                    <div className="px-4 md:px-6 h-16 flex items-center border-t border-slate-100 bg-white">
                        
                        {/* Scrollable Container for EVERYTHING */}
                        <div ref={filterContainerRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full cursor-grab active:cursor-grabbing select-none pr-4">
                            
                            {/* 1. View Switcher */}
                            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0 mr-2">
                                <button onClick={() => setViewMode('GRID')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{ICONS.VIEW_GRID}</button>
                                <button onClick={() => setViewMode('LIST')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{ICONS.VIEW_LIST}</button>
                                <button onClick={() => setViewMode('BOARD')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'BOARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{ICONS.VIEW_BOARD}</button>
                                <button onClick={() => setViewMode('MAP')} className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-all ${viewMode === 'MAP' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{ICONS.VIEW_MAP}</button>
                            </div>

                            <div className="w-px h-6 bg-slate-200 mx-2 shrink-0"></div>

                            {/* 2. Filters */}
                            <div className="min-w-[130px] shrink-0"><Dropdown value={selectedTransaction} onChange={(v) => setSelectedTransaction(v as string)} options={transactionOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[130px] shrink-0"><Dropdown value={selectedType} onChange={(v) => setSelectedType(v as string)} options={typeOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[150px] shrink-0"><Dropdown value={selectedLocation} onChange={(v) => setSelectedLocation(v as string)} options={locationOptions} className="text-xs h-11" placement="bottom" /></div>
                            <div className="min-w-[130px] shrink-0"><Dropdown value={priceFilter} onChange={(v) => setPriceFilter(v as string)} options={priceOptions} className="text-xs h-11" placement="bottom" /></div>
                            
                            <button 
                                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                                className={`h-11 px-4 rounded-xl border flex items-center gap-2 transition-all shrink-0 text-xs font-bold ${showFavoritesOnly ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                            >
                                {showFavoritesOnly ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE} 
                                <span className="hidden sm:inline">{t('favorites.title')}</span>
                            </button>

                            <button onClick={() => setShowVerifiedOnly(!showVerifiedOnly)} className={`h-11 px-4 rounded-xl border flex items-center gap-2 transition-all shrink-0 text-xs font-bold ${showVerifiedOnly ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
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

            {/* CONTENT VIEWPORT */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
                    {/* 1. GRID VIEW */}
                    {viewMode === 'GRID' && (
                        loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-[1920px] mx-auto">
                                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-[400px] bg-slate-200 rounded-[24px] animate-pulse"></div>)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-[1920px] mx-auto">
                                {paginatedListings.map((item, index) => (
                                    <motion.div 
                                        key={item.id} 
                                        className="min-h-full"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: index * 0.05 }}
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
                            <div className="hidden md:block max-w-[1920px] mx-auto bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-4 py-4 w-12"></th>
                                                <th className="px-4 py-4">{t('inventory.label_title')}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_price')}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_unit_price') || 'Đơn giá'}</th>
                                                <th className="px-4 py-4 text-right">{t('inventory.label_area')}</th>
                                                <th className="px-4 py-4 hidden lg:table-cell">{t('inventory.label_location')}</th>
                                                <th className="px-4 py-4 hidden xl:table-cell">{t('inventory.label_type')}</th>
                                                <th className="px-4 py-4 text-right">{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedListings.map(item => {
                                                const isFav = favorites.has(item.id);
                                                return (
                                                    <tr key={item.id} onClick={() => handleNavigate(item.id)} className="hover:bg-slate-50 cursor-pointer group transition-colors">
                                                        <td className="px-4 py-4">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                                className={`p-1.5 rounded-full transition-colors ${isFav ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-400 hover:bg-slate-100'}`}
                                                            >
                                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 relative border border-slate-100">
                                                                    <img src={item.images?.[0]} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                                                    {item.isVerified && <div className="absolute bottom-0 right-0 p-0.5 bg-emerald-500 rounded-tl-md text-white"></div>}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800 text-sm mb-0.5 line-clamp-1 max-w-[200px] lg:max-w-[300px]">{item.title}</div>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                        <span className="lg:hidden truncate max-w-[150px]">{item.location}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${item.transaction === 'SALE' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                                                                            {t(`transaction.${item.transaction}`)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{formatSmartPrice(item.price, t)}</td>
                                                        <td className="px-4 py-4 text-right text-[11px] font-bold text-indigo-600">
                                                            {item.area > 0 && item.type !== PropertyType.PROJECT ? formatUnitPrice(item.price, item.area, t) : '--'}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-sm text-slate-600 whitespace-nowrap">{item.area} m²</td>
                                                        <td className="px-4 py-4 hidden lg:table-cell text-sm text-slate-600 max-w-[200px] truncate" title={item.location}>{item.location}</td>
                                                        <td className="px-4 py-4 hidden xl:table-cell">
                                                            <span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
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
                                            {paginatedListings.length === 0 && (
                                                <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">{t('common.no_results')}</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* MOBILE LIST */}
                            <div className="md:hidden space-y-3 pb-6">
                                {paginatedListings.map((item, index) => {
                                    const isFav = favorites.has(item.id);
                                    return (
                                        <motion.div 
                                            key={item.id} 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                            onClick={() => handleNavigate(item.id)}
                                            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex gap-3 active:scale-95 transition-transform cursor-pointer relative"
                                        >
                                            <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 relative">
                                                <img src={item.images?.[0]} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div>
                                                    <div className="pr-8">
                                                        <h4 className="font-bold text-slate-900 text-sm truncate">{item.title}</h4>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 line-clamp-1 flex items-center gap-1 mt-0.5">
                                                        {ICONS.LOCATION} {item.location}
                                                    </div>
                                                </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div>
                                                            <div className="text-sm font-extrabold text-indigo-600 leading-none">
                                                                {formatSmartPrice(item.price, t)}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                                                {item.area} m² • {item.bedrooms} PN {item.area > 0 && item.type !== PropertyType.PROJECT && `• ${formatUnitPrice(item.price, item.area, t)}`}
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-lg border border-slate-200">
                                                            {t(`property.${item.type.toUpperCase()}`)}
                                                        </span>
                                                    </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                className={`absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors z-10 ${isFav ? 'text-rose-500 bg-rose-50' : 'text-slate-300 bg-transparent hover:bg-slate-100'}`}
                                            >
                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                            </button>
                                        </motion.div>
                                    );
                                })}
                                {paginatedListings.length === 0 && <EmptyState t={t} onClear={clearFilters} />}
                            </div>
                        </>
                    )}

                    {/* 3. BOARD VIEW */}
                    {viewMode === 'BOARD' && (
                        <div ref={boardContainerRef} className="h-full overflow-x-auto pb-4 no-scrollbar flex gap-6 snap-x cursor-grab active:cursor-grabbing">
                            {Object.entries(groupedListings).map(([type, items]) => {
                                const listingItems = items as unknown as Listing[];
                                if (listingItems.length === 0) return null;
                                return (
                                    <div key={type} className="min-w-[320px] w-[320px] flex flex-col h-full bg-slate-100/50 rounded-2xl border border-slate-200/60 snap-start">
                                        <div className="p-4 flex justify-between items-center sticky top-0 bg-slate-100/90 backdrop-blur-sm z-10 rounded-t-2xl border-b border-slate-200/50">
                                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{t(`property.${type.toUpperCase()}`)}</h3>
                                            <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm">{listingItems.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                                            {listingItems.map(item => {
                                                const isFav = favorites.has(item.id);
                                                return (
                                                    <div 
                                                        key={item.id} 
                                                        onClick={() => handleNavigate(item.id)}
                                                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-1 group relative"
                                                    >
                                                        <div className="aspect-video w-full bg-slate-100 rounded-lg mb-3 overflow-hidden relative">
                                                            <img src={item.images?.[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" referrerPolicy="no-referrer" />
                                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm z-10 flex flex-col items-end">
                                                                <span>{formatSmartPrice(item.price, t)}</span>
                                                                {item.area > 0 && item.type !== PropertyType.PROJECT && (
                                                                    <span className="text-[8px] opacity-80 font-medium">{formatUnitPrice(item.price, item.area, t)}</span>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                                                                className="absolute top-2 left-2 p-1.5 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm text-white z-20 transition-colors"
                                                            >
                                                                {isFav ? ICONS.HEART_FILLED : ICONS.HEART_OUTLINE}
                                                            </button>
                                                        </div>
                                                        <h4 className="font-bold text-slate-800 text-xs line-clamp-2 mb-2 leading-relaxed">{item.title}</h4>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
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

                    {/* 4. MAP VIEW */}
                    {viewMode === 'MAP' && (
                        <div className="h-full w-full relative z-0 rounded-[24px] overflow-hidden shadow-sm border border-slate-200">
                            <MapView 
                                listings={filteredListings} 
                                onNavigate={handleNavigate} 
                                formatCurrency={formatCurrency} 
                                formatUnitPrice={formatUnitPrice}
                                t={t}
                                language={language}
                            />
                        </div>
                    )}

                    {/* Pagination */}
                    {viewMode !== 'MAP' && totalPages > 1 && (
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
            </div>
        </div>
    );
};

const EmptyState = ({ t, onClear }: any) => (
    <div className="col-span-full py-20 text-center">
        <div className="text-6xl mb-4 opacity-30">🏠</div>
        <p className="text-slate-400 text-lg font-medium">{t('common.no_results')}</p>
        <button onClick={onClear} className="mt-4 text-indigo-600 font-bold hover:underline">
            {t('search.clear_filters')}
        </button>
    </div>
);
