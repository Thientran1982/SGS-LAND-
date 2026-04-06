
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { Lead, Listing, User } from '../types';
import { normalizeForSearch } from '../utils/textUtils';
import { ROUTES } from '../config/routes';

// -----------------------------------------------------------------------------
// TYPES & UTILS
// -----------------------------------------------------------------------------

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (type: string, id: string) => void;
}

type SearchItem = 
    | { type: 'LEAD'; id: string; title: string; subtitle: string; icon: 'LEAD' }
    | { type: 'LISTING'; id: string; title: string; subtitle: string; icon: 'LISTING' }
    | { type: 'USER'; id: string; title: string; subtitle: string; icon: 'USER' }
    | { type: 'ACTION'; id: string; title: string; subtitle: string; icon: 'ACTION'; route?: string; action?: () => void };

const ICONS = {
    SEARCH: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    LOADING: <div className="w-4 h-4 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin"></div>,
    LEAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    LISTING: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ACTION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    HISTORY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CLEAR: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

const SectionLabel = memo(({ label }: { label: string }) => (
    <div className="px-4 py-1.5 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest bg-[var(--bg-app)]/60 sticky top-0 backdrop-blur-md z-10 select-none border-b border-[var(--glass-border)]/50">
        {label}
    </div>
));

const HighlightedText = memo(({ text, query }: { text: string, query: string }) => {
    if (!query || !text) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) => 
                part.toLowerCase() === query.toLowerCase() ? (
                    <span key={i} className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 font-bold px-0.5 rounded">{part}</span>
                ) : ( <span key={i}>{part}</span> )
            )}
        </span>
    );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [rawResults, setRawResults] = useState<{ leads: Lead[], listings: Listing[], users: User[] }>({ leads: [], listings: [], users: [] });
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [history, setHistory] = useState<SearchItem[]>(() => {
        try { return JSON.parse(localStorage.getItem('sgs_search_history') || '[]'); } catch { return []; }
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // 1. QUICK ACTIONS
    const quickActions: SearchItem[] = useMemo(() => [
        { type: 'ACTION', id: 'act_dash', title: t('menu.dashboard'), subtitle: t('search.quick_actions'), icon: 'ACTION', route: ROUTES.DASHBOARD },
        { type: 'ACTION', id: 'act_lead', title: t('leads.create_modal_title'), subtitle: t('search.quick_actions'), icon: 'ACTION', route: ROUTES.LEADS },
        { type: 'ACTION', id: 'act_inv', title: t('inventory.create_title'), subtitle: t('search.quick_actions'), icon: 'ACTION', route: ROUTES.INVENTORY },
        { type: 'ACTION', id: 'act_rep', title: t('menu.reports'), subtitle: t('search.quick_actions'), icon: 'ACTION', route: ROUTES.REPORTS },
    ], [t]);

    // 2. FLATTEN RESULTS
    const flatResults = useMemo<SearchItem[]>(() => {
        if (!query.trim()) {
            return [
                ...history.map(h => ({ ...h, isHistory: true })),
                ...quickActions
            ];
        }
        const items: SearchItem[] = [];
        const matchedActions = quickActions.filter(a => normalizeForSearch(a.title).includes(normalizeForSearch(query)));
        matchedActions.forEach(a => items.push(a));
        (rawResults.leads || []).forEach(l => items.push({ 
            type: 'LEAD', id: l.id, title: l.name, subtitle: `${l.phone} • ${l.source}`, icon: 'LEAD' 
        }));
        (rawResults.listings || []).forEach(l => items.push({ 
            type: 'LISTING', id: l.id, title: l.title, subtitle: `${l.code} • ${l.location}`, icon: 'LISTING' 
        }));
        (rawResults.users || []).forEach(u => items.push({ 
            type: 'USER', id: u.id, title: u.name, subtitle: u.email, icon: 'USER' 
        }));
        return items;
    }, [query, rawResults, history, quickActions]);

    // 3. RESET & FOCUS
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setSelectedIndex(0);
        } else {
            setQuery('');
            setRawResults({ leads: [], listings: [], users: [] });
        }
    }, [isOpen]);

    // 4. SEARCH EXECUTION (debounced 200ms)
    useEffect(() => {
        if (!query.trim()) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const handler = setTimeout(async () => {
            try {
                const res = await db.globalSearch(query);
                setRawResults({
                    leads: res.leads || [],
                    listings: res.listings || [],
                    users: (res as any).users || [],
                });
                setSelectedIndex(0);
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        }, 200);
        return () => clearTimeout(handler);
    }, [query]);

    // 5. SELECT HANDLER
    const handleSelect = useCallback((item: SearchItem) => {
        if (item.type !== 'ACTION') {
            const newHistory = [item, ...history.filter(h => h.id !== item.id)].slice(0, 5);
            setHistory(newHistory);
            localStorage.setItem('sgs_search_history', JSON.stringify(newHistory));
        }
        if (item.type === 'ACTION' && item.route) {
            onNavigate('ROUTE', item.route);
        } else {
            onNavigate(item.type, item.id);
        }
        onClose();
    }, [onNavigate, onClose, history]);

    const clearHistory = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHistory([]);
        localStorage.removeItem('sgs_search_history');
    };

    // 6. KEYBOARD NAVIGATION
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(flatResults.length, 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + Math.max(flatResults.length, 1)) % Math.max(flatResults.length, 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (flatResults[selectedIndex]) handleSelect(flatResults[selectedIndex]);
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    };

    // Auto-scroll selected into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIndex]);

    if (!isOpen) return null;

    // --- RENDER ROW ---
    const renderRow = (item: SearchItem, idx: number) => {
        const isSelected = idx === selectedIndex;
        const Icon = ICONS[item.icon] || ICONS.SEARCH;
        const isHistory = (item as any).isHistory;

        return (
            <div 
                key={`${item.type}-${item.id}-${idx}`} 
                data-index={idx}
                onClick={() => handleSelect(item)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group border-l-[3px] ${
                    isSelected 
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500' 
                        : 'hover:bg-[var(--glass-surface)] border-transparent'
                }`}
            >
                <div className={`p-2 rounded-xl transition-colors shrink-0 ${
                    isSelected 
                        ? 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300' 
                        : 'bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] group-hover:bg-[var(--glass-surface)] group-hover:text-[var(--text-secondary)]'
                }`}>
                    {isHistory ? ICONS.HISTORY : Icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className={`font-semibold text-sm truncate ${
                        isSelected 
                            ? 'text-indigo-700 dark:text-indigo-200' 
                            : 'text-[var(--text-primary)]'
                    }`}>
                        {query ? <HighlightedText text={item.title} query={query} /> : item.title}
                    </div>
                    <div className="text-xs2 text-[var(--text-tertiary)] truncate font-medium mt-0.5">
                        {item.subtitle}
                    </div>
                </div>
                {isSelected && (
                    <div className="shrink-0 text-xs2 text-indigo-400 dark:text-indigo-400 font-mono bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded-md opacity-80">
                        ↵
                    </div>
                )}
            </div>
        );
    };

    const totalResults = (rawResults.leads?.length || 0) + (rawResults.listings?.length || 0) + (rawResults.users?.length || 0);

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[8vh] sm:pt-[10vh] px-4" onKeyDown={handleKeyDown}>
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" 
                onClick={onClose} 
            />
            
            {/* Modal */}
            <div className="w-full max-w-2xl bg-[var(--bg-surface)] rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[70vh] animate-scale-up ring-1 ring-black/10 dark:ring-white/10">
                
                {/* SEARCH INPUT */}
                <div className="flex items-center gap-3 px-4 py-3.5 bg-[var(--bg-surface)] border-b border-[var(--glass-border)] group">
                    <div className={`shrink-0 transition-colors ${loading ? 'text-indigo-500' : 'text-[var(--text-tertiary)] group-focus-within:text-indigo-500'}`}>
                        {loading ? ICONS.LOADING : ICONS.SEARCH}
                    </div>
                    <input 
                        ref={inputRef}
                        className="flex-1 text-base sm:text-lg outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-transparent h-9"
                        placeholder={t('common.search_advanced')}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        {query && (
                            <button 
                                onClick={() => { setQuery(''); inputRef.current?.focus(); }} 
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-full hover:bg-[var(--glass-surface-hover)] flex items-center justify-center" 
                                title={t('common.clear_search')}
                            >
                                {ICONS.CLEAR}
                            </button>
                        )}
                        <kbd className="hidden sm:flex items-center text-xs2 text-[var(--text-muted)] bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded-md font-mono">
                            ESC
                        </kbd>
                    </div>
                </div>

                {/* RESULTS LIST */}
                <div ref={listRef} className="overflow-y-auto flex-1 bg-[var(--bg-surface)] scroll-smooth relative min-h-[100px] no-scrollbar">
                    
                    {/* Empty state - no query, no history */}
                    {!query && history.length === 0 && (
                        <div className="p-10 text-center text-[var(--text-tertiary)] text-sm">
                            <div className="text-2xl mb-3 opacity-30">⌘K</div>
                            <p>{t('search.try_searching')}</p>
                        </div>
                    )}

                    {/* History + Quick Actions (empty query) */}
                    {!query && (
                        <>
                            {history.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center pr-3 sticky top-0 z-10 bg-[var(--bg-app)]/60 backdrop-blur-md border-b border-[var(--glass-border)]/50">
                                        <div className="px-4 py-1.5 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest select-none">
                                            {t('search.recent')}
                                        </div>
                                        <button 
                                            onClick={clearHistory} 
                                            className="text-xs2 text-[var(--text-tertiary)] hover:text-rose-500 font-bold uppercase transition-colors px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                        >
                                            {t('search.history_clear')}
                                        </button>
                                    </div>
                                    {history.map((item, idx) => renderRow({...item, isHistory: true} as any, idx))}
                                </div>
                            )}
                            {quickActions.length > 0 && (
                                <div>
                                    <SectionLabel label={t('search.quick_actions')} />
                                    {quickActions.map((item, idx) => renderRow(item, idx + history.length))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Search Results */}
                    {query && (
                        <>
                            {flatResults.length === 0 && !loading ? (
                                <div className="p-12 text-center text-[var(--text-secondary)]">
                                    <svg className="w-10 h-10 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <p className="font-medium text-sm">{t('search.no_results')}</p>
                                    <p className="text-xs2 text-[var(--text-tertiary)] mt-1">"{query}"</p>
                                </div>
                            ) : (
                                flatResults.map((item, idx) => {
                                    const prev = flatResults[idx - 1];
                                    const showHeader = !prev || prev.type !== item.type;
                                    let headerLabel = '';
                                    if (item.type === 'ACTION') headerLabel = t('search.commands');
                                    else if (item.type === 'LEAD') headerLabel = t('search.leads');
                                    else if (item.type === 'LISTING') headerLabel = t('search.listings');
                                    else if (item.type === 'USER') headerLabel = t('search.users');

                                    return (
                                        <div key={`${item.type}-${item.id}-${idx}`}>
                                            {showHeader && <SectionLabel label={headerLabel} />}
                                            {renderRow(item, idx)}
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER */}
                <div className="px-4 py-2 bg-[var(--glass-surface)] border-t border-[var(--glass-border)] flex justify-between items-center select-none">
                    <div className="flex items-center gap-3 text-xs2 text-[var(--text-muted)]">
                        <span className="hidden sm:flex items-center gap-1">
                            <kbd className="bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] px-1 py-0.5 rounded text-xs2 font-mono">↑↓</kbd>
                            <span>{t('search.navigate')}</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                            <kbd className="bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] px-1 py-0.5 rounded text-xs2 font-mono">↵</kbd>
                            <span>{t('search.select')}</span>
                        </span>
                    </div>
                    {query && totalResults > 0 && (
                        <span className="text-xs2 font-mono text-[var(--text-tertiary)]">
                            {totalResults} {t('search.matches')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
