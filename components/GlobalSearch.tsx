
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

// Unified Search Item Type
type SearchItem = 
    | { type: 'LEAD'; id: string; title: string; subtitle: string; icon: 'LEAD' }
    | { type: 'LISTING'; id: string; title: string; subtitle: string; icon: 'LISTING' }
    | { type: 'USER'; id: string; title: string; subtitle: string; icon: 'USER' }
    | { type: 'ACTION'; id: string; title: string; subtitle: string; icon: 'ACTION'; route?: string; action?: () => void };

const ICONS = {
    SEARCH: <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    LOADING: <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>,
    LEAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    LISTING: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ACTION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    HISTORY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ENTER: <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
    CLEAR: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

const SectionLabel = memo(({ label }: { label: string }) => (
    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 select-none">
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
                    <span key={i} className="text-indigo-600 bg-indigo-50 font-bold px-0.5 rounded">{part}</span>
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

    // 1. QUICK ACTIONS DEFINITION
    const quickActions: SearchItem[] = useMemo(() => [
        { type: 'ACTION', id: 'act_dash', title: t('menu.dashboard'), subtitle: 'Go to Dashboard', icon: 'ACTION', route: ROUTES.DASHBOARD },
        { type: 'ACTION', id: 'act_lead', title: t('leads.create_modal_title'), subtitle: 'Quick Create', icon: 'ACTION', route: ROUTES.LEADS }, // Ideally this opens modal, but simplified for nav
        { type: 'ACTION', id: 'act_inv', title: t('inventory.create_title'), subtitle: 'Post Property', icon: 'ACTION', route: ROUTES.INVENTORY },
        { type: 'ACTION', id: 'act_rep', title: t('menu.reports'), subtitle: 'View Analytics', icon: 'ACTION', route: ROUTES.REPORTS },
    ], [t]);

    // 2. NORMALIZE & FLATTEN RESULTS
    const flatResults = useMemo<SearchItem[]>(() => {
        // If Query is Empty -> Show History + Actions
        if (!query.trim()) {
            return [
                ...history.map(h => ({ ...h, isHistory: true })), // Tag history items
                ...quickActions
            ];
        }

        // If Query Exists -> Show Search Results
        const items: SearchItem[] = [];
        
        // Priority 1: Actions (matching query)
        const matchedActions = quickActions.filter(a => normalizeForSearch(a.title).includes(normalizeForSearch(query)));
        matchedActions.forEach(a => items.push(a));

        // Priority 2: Data
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

    // 4. SEARCH EXECUTION
    useEffect(() => {
        if (!query.trim()) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const handler = setTimeout(async () => {
            try {
                const res = await db.globalSearch(query);
                setRawResults(res || { leads: [], listings: [], users: [] });
                setSelectedIndex(0); // Reset selection on new results
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        }, 200);
        return () => clearTimeout(handler);
    }, [query]);

    // 5. SELECTION HANDLER
    const handleSelect = useCallback((item: SearchItem) => {
        // Save to History (if not an action)
        if (item.type !== 'ACTION') {
            const newHistory = [item, ...history.filter(h => h.id !== item.id)].slice(0, 5);
            setHistory(newHistory);
            localStorage.setItem('sgs_search_history', JSON.stringify(newHistory));
        }

        // Execute
        if (item.type === 'ACTION' && item.route) {
            onNavigate('ROUTE', item.route); // Special type for direct route
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
                setSelectedIndex(prev => (prev + 1) % flatResults.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
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

    // Auto-scroll
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIndex]);

    if (!isOpen) return null;

    // --- RENDER HELPER ---
    const renderRow = (item: SearchItem, idx: number) => {
        const isSelected = idx === selectedIndex;
        const Icon = ICONS[item.icon] || ICONS.SEARCH;
        const isHistory = (item as any).isHistory;

        return (
            <div 
                key={`${item.type}-${item.id}`} 
                data-index={idx}
                onClick={() => handleSelect(item)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-500 pl-3' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
            >
                <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                    {isHistory ? ICONS.HISTORY : Icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className={`font-bold text-sm truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {query ? <HighlightedText text={item.title} query={query} /> : item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-medium opacity-80">
                        {item.subtitle}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[10vh] px-4" onKeyDown={handleKeyDown}>
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-fade-in" onClick={onClose} />
            
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[65vh] animate-scale-up ring-1 ring-black/10">
                
                {/* INPUT */}
                <div className="p-4 flex items-center gap-3 bg-white z-20 border-b border-slate-100 group">
                    <div className="text-slate-400 pl-1 group-focus-within:text-indigo-500 transition-colors pointer-events-none flex items-center justify-center">{loading ? ICONS.LOADING : ICONS.SEARCH}</div>
                    <input 
                        ref={inputRef}
                        className="flex-1 text-lg outline-none text-slate-800 placeholder:text-slate-400 bg-transparent h-10"
                        placeholder={t('common.search_advanced')}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        {query && <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center" title={t('common.clear_search') || 'Xóa tìm kiếm'}>{ICONS.CLEAR}</button>}
                    </div>
                </div>

                {/* RESULTS */}
                <div ref={listRef} className="overflow-y-auto flex-1 bg-white scroll-smooth relative min-h-[120px] no-scrollbar">
                    
                    {/* 0. Empty & No History */}
                    {!query && history.length === 0 && quickActions.length === 0 && (
                        <div className="p-10 text-center text-slate-400 text-sm italic">{t('search.try_searching')}</div>
                    )}

                    {/* 1. History & Quick Actions (When query is empty) */}
                    {!query && (
                        <>
                            {history.length > 0 && (
                                <div className="pb-2">
                                    <div className="flex justify-between items-center pr-4">
                                        <SectionLabel label="Recent" />
                                        <button onClick={clearHistory} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase transition-colors z-20">Clear</button>
                                    </div>
                                    {history.map((item, idx) => renderRow({...item, isHistory: true} as any, idx))}
                                </div>
                            )}
                            <div className="pb-2">
                                <SectionLabel label="Quick Actions" />
                                {quickActions.map((item, idx) => renderRow(item, idx + history.length))}
                            </div>
                        </>
                    )}

                    {/* 2. Search Results */}
                    {query && (
                        <>
                            {flatResults.length === 0 && !loading ? (
                                <div className="p-12 text-center text-slate-400">
                                    <p className="font-medium text-sm">{t('common.no_results')}</p>
                                </div>
                            ) : (
                                flatResults.map((item, idx) => {
                                    // Visual grouping logic
                                    const prev = flatResults[idx - 1];
                                    const showHeader = !prev || prev.type !== item.type;
                                    let headerLabel = "";
                                    if (item.type === 'ACTION') headerLabel = "Commands";
                                    else if (item.type === 'LEAD') headerLabel = t('menu.leads');
                                    else if (item.type === 'LISTING') headerLabel = t('menu.inventory');
                                    else if (item.type === 'USER') headerLabel = t('menu.admin-users');

                                    return (
                                        <div key={`${item.type}-${item.id}`}>
                                            {showHeader && <SectionLabel label={headerLabel} />}
                                            {renderRow(item, idx)}
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER (CLEANED) */}
                {query && flatResults.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex justify-end items-center select-none">
                        <span className="font-mono">{flatResults.length} matches</span>
                    </div>
                )}
            </div>
        </div>
    );
};
