
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { NO_IMAGE_URL } from '../utils/constants';
import { db } from '../services/dbApi';
import { Listing, ListingStatus, PropertyType, TransactionType, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { ListingCard } from '../components/ListingCard';
import { ListingForm } from '../components/ListingForm';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';
import { smartMatch, formatSmartPrice, formatUnitPrice } from '../utils/textUtils';
import { ROUTES } from '../config/routes';
import MapView from '../components/MapView';

// -----------------------------------------------------------------------------
//  CONSTANTS & CONFIG
// -----------------------------------------------------------------------------

type ViewMode = 'LIST' | 'BOARD' | 'GRID' | 'MAP';

const ICONS = {
    ADD: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    SEARCH: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    VIEW_LIST: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    VIEW_BOARD: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>,
    VIEW_GRID: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    EDIT: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    TRASH: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    DUPLICATE: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>,
    X: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    VIEW_MAP: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
};

const STATUS_CONFIG: Record<ListingStatus, { color: string, bg: string, border: string }> = {
    [ListingStatus.BOOKING]: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    [ListingStatus.OPENING]: { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    [ListingStatus.AVAILABLE]: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    [ListingStatus.HOLD]: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    [ListingStatus.SOLD]: { color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--glass-surface-hover)]', border: 'border-slate-300' },
    [ListingStatus.RENTED]: { color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    [ListingStatus.INACTIVE]: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
};

// --- HOOK: DRAGGABLE SCROLL (Unified) ---
const useDraggableScroll = (ref: React.RefObject<HTMLDivElement>, trigger?: any) => {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let isDown = false;
        let startX = 0;
        let startY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;

        const onMouseDown = (e: MouseEvent) => {
            // Prevent dragging if clicking interactive elements inside
            if ((e.target as HTMLElement).closest('button, input, select, a, [role="button"]')) return;
            
            isDown = true;
            node.classList.add('cursor-grabbing');
            node.classList.remove('cursor-grab');
            node.classList.remove('snap-x');
            
            startX = e.pageX - node.offsetLeft;
            startY = e.pageY - node.offsetTop;
            scrollLeft = node.scrollLeft;
            scrollTop = node.scrollTop;
        };

        const onMouseLeave = () => {
            isDown = false;
            node.classList.remove('cursor-grabbing');
            node.classList.add('cursor-grab');
            node.classList.add('snap-x');
        };

        const onMouseUp = () => {
            isDown = false;
            node.classList.remove('cursor-grabbing');
            node.classList.add('cursor-grab');
            node.classList.add('snap-x');
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - node.offsetLeft;
            const y = e.pageY - node.offsetTop;
            const walkX = (x - startX) * 2; // Speed multiplier X
            const walkY = (y - startY) * 2; // Speed multiplier Y
            
            node.scrollLeft = scrollLeft - walkX;
            // Only scroll vertically if it's not a predominantly horizontal container (like filters)
            // For simple detection, we can check if scrollHeight > clientHeight significantly
            if (node.scrollHeight > node.clientHeight) {
                node.scrollTop = scrollTop - walkY;
            }
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
            node.classList.remove('cursor-grab', 'cursor-grabbing');
        };
    }, [ref, trigger]);
};


// --- PAGINATION COMPONENT (MINIMALIST) ---
const PaginationControl = memo(({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange, t }: any) => {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    const pageSizeOptions = [
        { value: 12, label: '12' },
        { value: 24, label: '24' },
        { value: 48, label: '48' },
        { value: 100, label: '100' }
    ];

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center px-3 sm:px-5 py-2 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)] shadow-sm gap-2">
            <div className="hidden sm:flex text-xs text-[var(--text-tertiary)] font-medium items-center gap-1">
                <span>{t('pagination.showing')}</span>
                <span className="font-bold text-[var(--text-primary)]">{totalItems > 0 ? start : 0}-{end}</span>
                <span>{t('pagination.of')}</span>
                <span className="font-bold text-[var(--text-primary)]">{totalItems}</span>
                <span className="hidden sm:inline">{t('pagination.results')}</span>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                <div className="min-w-[64px] mr-1">
                    <Dropdown
                        value={pageSize}
                        onChange={(v) => onPageSizeChange(Number(v))}
                        options={pageSizeOptions}
                        className="text-xs"
                        placement="top"
                    />
                </div>
                <button 
                    onClick={() => onPageChange(page - 1)} 
                    disabled={page === 1}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.prev')}
                </button>
                <div className="flex items-center gap-1 px-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{page} / {totalPages || 1}</span>
                </div>
                <button 
                    onClick={() => onPageChange(page + 1)} 
                    disabled={page === totalPages || totalPages === 0}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.next')}
                </button>
            </div>
        </div>
    );
});

// --- TABLE ROW (LIST VIEW) ---
const InventoryRow = memo(({ item, onEdit, onDelete, onDuplicate, onClick, t, formatCurrency, canViewInternal }: any) => {
    const statusStyle = STATUS_CONFIG[item.status as ListingStatus] || STATUS_CONFIG[ListingStatus.AVAILABLE];
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef  = useRef<HTMLButtonElement>(null);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setMenuOpen(v => !v);
    };

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <tr 
            onClick={() => onClick && onClick(item)}
            className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-[var(--glass-surface)] dark:hover:bg-slate-800/50 transition-colors cursor-pointer hidden md:table-row"
        >
            {/* Sticky Code & Image */}
            <td className="px-4 py-3 sticky left-0 z-10 bg-[var(--bg-surface)] dark:bg-slate-900 group-hover:bg-[var(--glass-surface)] dark:group-hover:bg-slate-800/50 border-r border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors min-w-[200px] max-w-[250px]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--glass-surface-hover)] dark:bg-slate-800 overflow-hidden shrink-0 border border-[var(--glass-border)] relative">
                        <img 
                            src={item.images?.[0] || NO_IMAGE_URL}
                            className="w-full h-full object-cover"
                            alt=""
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }}
                        />
                        {item.isVerified && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-bl-md z-10" />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-xs2 font-bold text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] px-1 py-0.5 rounded">{item.code}</span>
                            <span className={`text-3xs font-bold uppercase px-1 py-0.5 rounded ${item.transaction === 'RENT' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                                {t(`transaction.${item.transaction}`)}
                            </span>
                        </div>
                        <div className="font-bold text-[var(--text-primary)] dark:text-slate-200 text-xs truncate max-w-[180px]" title={item.title}>{item.title}</div>
                    </div>
                </div>
            </td>

            <td className="px-4 py-3 text-xs text-[var(--text-secondary)] dark:text-slate-400 max-w-[150px] truncate" title={item.location}>
                {item.location}
            </td>

            {canViewInternal && (
                <>
                    <td className="px-4 py-3 text-xs">
                        <div className="flex flex-col">
                            <span className="font-bold text-[var(--text-secondary)] dark:text-slate-200 truncate max-w-[120px]" title={item.ownerName || '--'}>
                                {item.ownerName || '--'}
                            </span>
                            <span className="text-xs2 text-[var(--text-tertiary)] font-mono">
                                {item.ownerPhone || '--'}
                            </span>
                        </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-right">
                        <div className="flex flex-col items-end">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {item.commission ? `${item.commission}${item.commissionUnit === 'PERCENT' ? '%' : ' VND'}` : '--'}
                            </span>
                        </div>
                    </td>
                </>
            )}
            
            <td className="px-4 py-3 text-xs">
                <span className="font-bold text-[var(--text-secondary)] dark:text-slate-300 bg-[var(--glass-surface)] dark:bg-slate-800 px-2 py-1 rounded border border-[var(--glass-border)] dark:border-slate-700 whitespace-nowrap">
                    {t(`property.${item.type.toUpperCase()}`)}
                </span>
            </td>

            {/* Smart Pricing Column */}
            <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end">
                    {item.type === PropertyType.PROJECT && (
                        <span className="text-2xs font-bold text-[var(--text-secondary)] uppercase leading-none mb-0.5">
                            {t('inventory.min_price')}
                        </span>
                    )}
                    <span className="text-sm font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">
                        {formatSmartPrice(item.price, t)}
                    </span>
                </div>
            </td>

            <td className="px-4 py-3 text-right text-xs3 font-bold text-indigo-600 dark:text-indigo-400">
                {item.area > 0 && item.type !== PropertyType.PROJECT ? formatUnitPrice(item.price, item.area, t) : '--'}
            </td>

            <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)] dark:text-slate-400 font-mono">
                {item.area} <span className="text-xs2 text-[var(--text-secondary)]">m²</span>
            </td>

            <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold border uppercase tracking-wider whitespace-nowrap ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                    {item.status === 'AVAILABLE' && item.transaction === 'RENT' ? t('status.READY') || 'Sẵn sàng' : t(`status.${item.status}`)}
                </span>
            </td>

            {/* Sticky Actions */}
            <td className="px-3 py-3 text-right sticky right-0 z-10 bg-[var(--bg-surface)] dark:bg-slate-900 group-hover:bg-[var(--glass-surface)] dark:group-hover:bg-slate-800/50 border-l border-slate-50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                {canViewInternal && (
                    <button
                        ref={btnRef}
                        onClick={openMenu}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-all"
                        title={t('common.actions') || 'Thao tác'}
                    >
                        <svg className="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                    </button>
                )}
                {menuOpen && createPortal(
                    <div
                        ref={menuRef}
                        onClick={e => e.stopPropagation()}
                        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                        className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[160px]"
                    >
                        <button onClick={() => { setMenuOpen(false); onEdit(item); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            {t('common.edit') || 'Chỉnh sửa'}
                        </button>
                        {onDuplicate && (
                            <button onClick={() => { setMenuOpen(false); onDuplicate(item.id); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                                {t('common.duplicate') || 'Nhân bản'}
                            </button>
                        )}
                        <div className="border-t border-[var(--glass-border)] my-1" />
                        <button onClick={() => { setMenuOpen(false); onDelete(item.id); }} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            {t('common.delete') || 'Xóa'}
                        </button>
                    </div>,
                    document.body
                )}
            </td>
        </tr>
    );
});

// --- COMPACT ROW (MOBILE LIST VIEW) ---
const CompactInventoryRow = memo(({ item, onEdit, onDelete, onDuplicate, onClick, t, canViewInternal }: any) => {
    const statusStyle = STATUS_CONFIG[item.status as ListingStatus] || STATUS_CONFIG[ListingStatus.AVAILABLE];
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef  = useRef<HTMLButtonElement>(null);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setMenuOpen(v => !v);
    };

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div 
            onClick={() => onClick && onClick(item)}
            className="flex md:hidden items-center gap-3 p-3 border-b border-[var(--glass-border)] dark:border-slate-800/50 active:bg-[var(--glass-surface)] dark:active:bg-slate-800 transition-colors cursor-pointer"
        >
            <div className="w-14 h-14 rounded-xl bg-[var(--glass-surface-hover)] dark:bg-slate-800 overflow-hidden shrink-0 border border-[var(--glass-border)] dark:border-slate-700 relative">
                <img
                    src={item.images?.[0] || NO_IMAGE_URL}
                    className="w-full h-full object-cover"
                    alt=""
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }}
                />
                <div className="absolute top-0 left-0 px-1 bg-black/40 text-3xs text-white font-mono">{item.code}</div>
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-3xs font-bold uppercase px-1 py-0.5 rounded ${item.transaction === 'RENT' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                        {t(`transaction.${item.transaction}`)}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold border uppercase tracking-wider ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                        {item.status === 'AVAILABLE' && item.transaction === 'RENT' ? t('status.READY') || 'Sẵn sàng' : t(`status.${item.status}`)}
                    </span>
                </div>
                <h4 className="font-bold text-[var(--text-primary)] dark:text-slate-200 text-xs truncate mb-0.5">{item.title}</h4>
                <div className="text-xs2 text-[var(--text-tertiary)] truncate">{item.location}</div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-right">
                    <div className="flex flex-col items-end">
                        {item.type === PropertyType.PROJECT && (
                            <span className="text-3xs font-bold text-[var(--text-secondary)] uppercase leading-none">
                                {t('inventory.min_price')}
                            </span>
                        )}
                        <div className="text-sm font-black text-[var(--text-primary)] dark:text-white tracking-tight">
                            {formatSmartPrice(item.price, t)}
                        </div>
                    </div>
                    <div className="text-xs2 font-medium text-[var(--text-secondary)]">
                        {item.area} m² {item.area > 0 && item.type !== PropertyType.PROJECT && `• ${formatUnitPrice(item.price, item.area, t)}`}
                    </div>
                </div>
                {canViewInternal && (
                    <button
                        ref={btnRef}
                        onClick={openMenu}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-all"
                    >
                        <svg className="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                    </button>
                )}
            </div>

            {menuOpen && createPortal(
                <div ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[160px]">
                    <button onClick={() => { setMenuOpen(false); onEdit(item); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        {t('common.edit') || 'Chỉnh sửa'}
                    </button>
                    {onDuplicate && (
                        <button onClick={() => { setMenuOpen(false); onDuplicate(item.id); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                            {t('common.duplicate') || 'Nhân bản'}
                        </button>
                    )}
                    <div className="border-t border-[var(--glass-border)] my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(item.id); }} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        {t('common.delete') || 'Xóa'}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
});

// --- KANBAN CARD (BOARD VIEW) ---
const InventoryKanbanCard = memo(({ item, onClick, onEdit, onDelete, onDuplicate, canViewInternal, t, formatCurrency }: any) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef  = useRef<HTMLButtonElement>(null);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setMenuOpen(v => !v);
    };

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div 
            onClick={() => onClick(item)}
            className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 mb-3 group flex flex-col gap-2 relative"
        >
            <div className="flex gap-3 items-start">
                <div className="w-12 h-12 rounded-lg bg-[var(--glass-surface-hover)] overflow-hidden shrink-0">
                    <img src={item.images?.[0] || NO_IMAGE_URL} className="w-full h-full object-cover" alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-3xs font-bold uppercase px-1.5 py-0.5 rounded ${item.transaction === 'RENT' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                            {t(`transaction.${item.transaction}`)}
                        </span>
                        <span className="font-mono text-xs2 font-bold text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] px-1 py-0.5 rounded">{item.code}</span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)] text-xs line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">{item.title}</div>
                </div>
                {canViewInternal && (
                    <button
                        ref={btnRef}
                        onClick={openMenu}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-all shrink-0"
                    >
                        <svg className="w-3.5 h-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                    </button>
                )}
            </div>
            <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                <div className="flex flex-col">
                    {item.type === PropertyType.PROJECT && (
                        <span className="text-3xs font-bold text-[var(--text-secondary)] uppercase leading-none mb-0.5">
                            {t('inventory.min_price')}
                        </span>
                    )}
                    <div className="font-extrabold text-[var(--text-primary)] text-sm">{formatSmartPrice(item.price, t)}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs2 text-[var(--text-secondary)]">{item.area}m²</div>
                    {item.area > 0 && item.type !== PropertyType.PROJECT && (
                        <div className="text-2xs font-bold text-indigo-600">
                            {formatUnitPrice(item.price, item.area, t)}
                        </div>
                    )}
                </div>
            </div>

            {menuOpen && createPortal(
                <div ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[160px]">
                    <button onClick={() => { setMenuOpen(false); onEdit(item); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        {t('common.edit') || 'Chỉnh sửa'}
                    </button>
                    {onDuplicate && (
                        <button onClick={() => { setMenuOpen(false); onDuplicate(item.id); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                            {t('common.duplicate') || 'Nhân bản'}
                        </button>
                    )}
                    <div className="border-t border-[var(--glass-border)] my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(item.id); }} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        {t('common.delete') || 'Xóa'}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Inventory: React.FC = () => {
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const [listings, setListings] = useState<Listing[]>([]); // Store current page data
    const [totalItems, setTotalItems] = useState(0);
    const [stats, setStats] = useState({ availableCount: 0, holdCount: 0, soldCount: 0, rentedCount: 0, bookingCount: 0, openingCount: 0, inactiveCount: 0, totalCount: 0 });
    const [allFilteredListings, setAllFilteredListings] = useState<Listing[]>([]); // For Kanban board
    const [loading, setLoading] = useState(true);
    const [boardLoading, setBoardLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Filters & Pagination State
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [transactionFilter, setTransactionFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    
    // View State
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try { return (localStorage.getItem('sgs_inv_view') as ViewMode) || 'GRID'; } catch { return 'GRID'; }
    });

    const boardRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    const filtersRef = useRef<HTMLDivElement>(null);
    const metricsRef = useRef<HTMLDivElement>(null);

    // Apply Draggable Scroll Physics to containers
    useDraggableScroll(boardRef, viewMode);
    useDraggableScroll(tableRef, viewMode);
    useDraggableScroll(filtersRef, null);
    useDraggableScroll(metricsRef, null);

    useEffect(() => { localStorage.setItem('sgs_inv_view', viewMode); }, [viewMode]);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchListings = useCallback(async () => {
        setLoading(true);
        try {
            const filters = { search: debouncedSearch, type: typeFilter, status: statusFilter, transaction: transactionFilter };
            const [res, favs] = await Promise.all([
                db.getListings(page, pageSize, filters),
                db.getFavorites(1, 1000),
            ]);
            setListings(res.data || []);
            setTotalItems(res.total || 0);
            if (res.stats) setStats(res.stats);
            setFavorites(new Set(favs.data?.map((f: any) => f.id) || []));
        } catch (e) {
            console.error(e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, typeFilter, statusFilter, transactionFilter, page, pageSize, notify, t]);

    const fetchBoardData = useCallback(async () => {
        if (viewMode !== 'BOARD' && viewMode !== 'MAP') { setAllFilteredListings([]); return; }
        setBoardLoading(true);
        try {
            const filters = { search: debouncedSearch, type: typeFilter, status: statusFilter, transaction: transactionFilter };
            const allRes = await db.getListings(1, 500, filters);
            setAllFilteredListings(allRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setBoardLoading(false);
        }
    }, [viewMode, debouncedSearch, typeFilter, statusFilter, transactionFilter]);

    useEffect(() => { fetchListings(); }, [fetchListings]);
    useEffect(() => { fetchBoardData(); }, [fetchBoardData]);

    const totalPages = Math.ceil(totalItems / pageSize);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, typeFilter, statusFilter, transactionFilter, pageSize]);

    // Grouping for Kanban (apply to all filtered items to show full board)
    const groupedListings = useMemo(() => {
        const groups: Record<string, Listing[]> = {};
        Object.values(ListingStatus).forEach(status => groups[status] = []);
        allFilteredListings.forEach(l => {
            if (groups[l.status]) groups[l.status].push(l);
        });
        return groups;
    }, [allFilteredListings]);

    // Handlers
    const canViewInternalInfo = useMemo(() => {
        if (!currentUser) return false;
        // Allow ADMIN, TEAM_LEAD, and SALES to see the columns. 
        // Data masking is handled at the DB level (mockDb.ts) for SALES.
        return [UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.SALES].includes(currentUser.role);
    }, [currentUser]);

    const handleToggleFavorite = async (id: string) => {
        const isFav = favorites.has(id);
        const newFavs = new Set(favorites);
        if (isFav) newFavs.delete(id); else newFavs.add(id);
        setFavorites(newFavs);
        try { await db.toggleFavorite(id); } catch { setFavorites(favorites); }
    };

    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await db.deleteListing(itemToDelete);
            fetchListings();
            notify(t('inventory.action_delete'), 'success');
        } catch (e) { 
            notify(t('common.error'), 'error'); 
        } finally {
            setItemToDelete(null);
        }
    };

    const handleSaveListing = async (data: Partial<Listing>) => {
        try {
            if (editingListing) await db.updateListing(editingListing.id, data);
            else await db.createListing(data);
            notify(t('common.success'), 'success');
            setIsCreateModalOpen(false);
            setEditingListing(undefined);
            fetchListings();
        } catch (e: any) { notify(e.message, 'error'); }
    };

    const handleNavigate = (id: string) => { window.location.hash = `#/${ROUTES.LISTING}/${id}`; };

    const typeOptions = useMemo(() => [{ value: 'ALL', label: t('inventory.all_types') }, ...Object.values(PropertyType).map(tKey => ({ value: tKey, label: t(`property.${tKey.toUpperCase()}`) }))], [t]);
    const statusOptions = useMemo(() => [{ value: 'ALL', label: t('inventory.all_statuses') }, ...Object.values(ListingStatus).map(s => ({ value: s, label: t(`status.${s}`) }))], [t]);
    const transactionOptions = useMemo(() => [{ value: 'ALL', label: t('inventory.all_transactions') || 'Tất cả giao dịch' }, ...Object.values(TransactionType).map(tr => ({ value: tr, label: t(`transaction.${tr}`) }))], [t]);

    return (
        <div className="h-full flex flex-col relative">
            {toast && <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            {/* Header & Controls */}
            <div className="sticky top-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-b border-[var(--glass-border)] shadow-sm p-4 md:p-6 transition-all flex-none">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                                {ICONS.SEARCH}
                            </div>
                            <input 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                className="w-full pl-10 pr-10 py-2.5 min-h-[44px] bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)] transition-all outline-none placeholder:text-[var(--text-muted)]" 
                                placeholder={t('inventory.search_hint')} 
                            />
                            {search && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                    <button 
                                        onClick={() => setSearch('')}
                                        className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                        title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                    >
                                        {ICONS.X}
                                    </button>
                                </div>
                            )}
                        </div>
                        {canViewInternalInfo && (
                            <button onClick={() => { setEditingListing(undefined); setIsCreateModalOpen(true); }} className="md:hidden shrink-0 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95">{ICONS.ADD}</button>
                        )}
                    </div>

                    <div ref={filtersRef} className="flex gap-2 overflow-x-auto pb-2 px-1 -mx-1 no-scrollbar mask-linear-fade items-center scroll-smooth cursor-grab active:cursor-grabbing">
                        <div className="min-w-[140px] shrink-0"><Dropdown value={transactionFilter} onChange={(v) => setTransactionFilter(v as string)} options={transactionOptions} className="text-xs" /></div>
                        <div className="min-w-[140px] shrink-0"><Dropdown value={typeFilter} onChange={(v) => setTypeFilter(v as string)} options={typeOptions} className="text-xs" /></div>
                        <div className="min-w-[140px] shrink-0"><Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as string)} options={statusOptions} className="text-xs" /></div>
                        
                        {/* View Switcher */}
                        <div className="flex bg-[var(--glass-surface-hover)] p-1 rounded-xl shrink-0">
                            <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'}`} title={t('inventory.view_grid')}>{ICONS.VIEW_GRID}</button>
                            <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'}`} title={t('inventory.view_list')}>{ICONS.VIEW_LIST}</button>
                            <button onClick={() => setViewMode('BOARD')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'BOARD' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'}`} title={t('inventory.view_board')}>{ICONS.VIEW_BOARD}</button>
                            <button onClick={() => setViewMode('MAP')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'MAP' ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'}`} title={t('inventory.view_map') || 'Bản đồ'}>{ICONS.VIEW_MAP}</button>
                        </div>

                        {/* Active filter chip */}
                        {(typeFilter !== 'ALL' || statusFilter !== 'ALL' || transactionFilter !== 'ALL') && (
                            <button
                                onClick={() => { setTypeFilter('ALL'); setStatusFilter('ALL'); setTransactionFilter('ALL'); }}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 font-bold rounded-xl text-xs transition-all whitespace-nowrap hover:bg-orange-100 active:scale-95"
                                title={t('inventory.reset_filters') || 'Xóa bộ lọc'}
                            >
                                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
                                {t('inventory.reset_filters') || 'Xóa bộ lọc'}
                                <span className="ml-0.5 opacity-70">×</span>
                            </button>
                        )}

                        <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>

                        {canViewInternalInfo && (
                            <button onClick={() => { setEditingListing(undefined); setIsCreateModalOpen(true); }} className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all whitespace-nowrap active:scale-95 shrink-0">
                                {ICONS.ADD} {t('inventory.create_title')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Metrics Section */}
            <div ref={metricsRef} className="px-4 md:px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-surface)]/50 flex overflow-x-auto no-scrollbar gap-3 md:gap-4 flex-none scroll-smooth cursor-grab active:cursor-grabbing">
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-[var(--glass-border)] shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 truncate">{t('inventory.total_listings') || 'Tổng kho'}</div>
                    <div className="text-lg md:text-2xl font-black text-[var(--text-primary)]">{stats.totalCount || totalItems}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-emerald-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-emerald-500 uppercase tracking-wider mb-1 truncate">{t('status.AVAILABLE') || 'Đang bán'}</div>
                    <div className="text-lg md:text-2xl font-black text-emerald-600">{stats.availableCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-amber-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-amber-500 uppercase tracking-wider mb-1 truncate">{t('status.HOLD') || 'Giữ chỗ'}</div>
                    <div className="text-lg md:text-2xl font-black text-amber-600">{stats.holdCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-orange-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-orange-500 uppercase tracking-wider mb-1 truncate">{t('status.BOOKING') || 'Đặt cọc'}</div>
                    <div className="text-lg md:text-2xl font-black text-orange-600">{stats.bookingCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-indigo-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-indigo-500 uppercase tracking-wider mb-1 truncate">{t('status.OPENING') || 'Mở bán'}</div>
                    <div className="text-lg md:text-2xl font-black text-indigo-600">{stats.openingCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-teal-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-teal-500 uppercase tracking-wider mb-1 truncate">{t('status.RENTED') || 'Đã thuê'}</div>
                    <div className="text-lg md:text-2xl font-black text-teal-600">{stats.rentedCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-[var(--glass-border)] shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1 truncate">{t('status.SOLD') || 'Đã bán'}</div>
                    <div className="text-lg md:text-2xl font-black text-[var(--text-secondary)]">{stats.soldCount}</div>
                </div>
                <div className="bg-[var(--bg-surface)] px-3 md:px-4 py-3 rounded-xl border border-rose-100 shadow-sm min-w-[110px] md:flex-1 shrink-0">
                    <div className="text-2xs md:text-xs2 font-bold text-rose-500 uppercase tracking-wider mb-1 truncate">{t('status.INACTIVE') || 'Ngưng GD'}</div>
                    <div className="text-lg md:text-2xl font-black text-rose-600">{stats.inactiveCount}</div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-[var(--bg-surface)] min-h-0 relative flex flex-col">

                {/* GRID & LIST — inside overflow-auto so content can scroll */}
                {(viewMode === 'GRID' || viewMode === 'LIST') && (
                    <div className="flex-1 overflow-auto p-4 md:p-6 no-scrollbar">
                        
                        {/* GRID VIEW (DEFAULT) */}
                        {viewMode === 'GRID' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {loading ? (
                                    [1,2,3,4,5,6,7,8].map(i => (
                                        <div key={i} className="bg-[var(--glass-surface-hover)] rounded-[24px] animate-pulse flex flex-col overflow-hidden">
                                            <div className="h-[200px] bg-slate-100/80" />
                                            <div className="p-4 space-y-3">
                                                <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                                                <div className="h-4 bg-slate-100 rounded-full w-full" />
                                                <div className="h-3 bg-slate-100 rounded-full w-2/3" />
                                                <div className="flex justify-between items-center pt-2">
                                                    <div className="h-5 bg-slate-100 rounded-full w-1/2" />
                                                    <div className="h-5 bg-slate-100 rounded-full w-1/4" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : listings.length > 0 ? (
                                    listings.map(item => (
                                        <div key={item.id} className="min-h-full">
                                            <ListingCard
                                                item={{...item, isFavorite: favorites.has(item.id)}} t={t} formatCurrency={formatCurrency}
                                                onToggleFavorite={handleToggleFavorite}
                                                onEdit={(l) => { setEditingListing(l); setIsCreateModalOpen(true); }}
                                                onDelete={handleDeleteClick}
                                                onDuplicate={async (id) => {
                                                    try { await db.duplicateListing(id); fetchListings(); notify(t('leads.duplicate_success'), 'success'); } catch(e) { notify(t('common.error'), 'error'); }
                                                }}
                                                onClick={() => handleNavigate(item.id)}
                                                showActions={true}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full flex flex-col items-center gap-4 py-20 text-center">
                                        {debouncedSearch || typeFilter !== 'ALL' || statusFilter !== 'ALL' || transactionFilter !== 'ALL' ? (
                                            <>
                                                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[var(--text-primary)]">{t('common.no_results')}</p>
                                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inventory.empty_filter_hint') || 'Thử xóa bộ lọc hoặc tìm kiếm khác'}</p>
                                                </div>
                                                <button onClick={() => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); setTransactionFilter('ALL'); }} className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                                                    {t('inventory.reset_filters') || 'Xóa bộ lọc'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400">
                                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[var(--text-primary)]">{t('inventory.empty_title') || 'Chưa có sản phẩm nào'}</p>
                                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inventory.empty_hint') || 'Thêm sản phẩm bất động sản đầu tiên vào kho'}</p>
                                                </div>
                                                {canViewInternalInfo && (
                                                    <button onClick={() => { setEditingListing(undefined); setIsCreateModalOpen(true); }} className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2">
                                                        {ICONS.ADD} {t('inventory.create_title')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* LIST VIEW (TABLE) */}
                        {viewMode === 'LIST' && (
                            <div className="bg-[var(--bg-surface)] rounded-[24px] md:border border-[var(--glass-border)] shadow-sm overflow-hidden h-full flex flex-col">
                                <div ref={tableRef} className="overflow-auto no-scrollbar flex-1 min-w-0 w-full cursor-grab active:cursor-grabbing">
                                    {(loading || listings.length > 0) && <table className="w-full text-left border-collapse relative hidden md:table">
                                        <thead className="bg-[var(--glass-surface)] border-b border-[var(--glass-border)] sticky top-0 z-20 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase sticky left-0 z-30 bg-[var(--glass-surface)] min-w-[200px] border-r border-[var(--glass-border)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    {t('inventory.label_title')}
                                                </th>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('inventory.label_location')}</th>
                                                {canViewInternalInfo && (
                                                    <>
                                                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('inventory.label_owner')}</th>
                                                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-right">{t('inventory.label_commission')}</th>
                                                    </>
                                                )}
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('inventory.label_type')}</th>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-right">{t('inventory.label_price')}</th>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-right">{t('inventory.label_unit_price') || 'Đơn giá'}</th>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-right">{t('inventory.label_area')}</th>
                                                <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-center">{t('inventory.label_status')}</th>
                                                {canViewInternalInfo && <th className="px-4 py-3 text-xs font-bold text-[var(--text-tertiary)] uppercase text-right sticky right-0 z-30 bg-[var(--glass-surface)] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)]">{t('common.actions')}</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loading ? (
                                                Array.from({ length: 8 }).map((_, i) => (
                                                    <tr key={i} className="border-b border-slate-50 hidden md:table-row">
                                                        <td className="px-4 py-3 sticky left-0 bg-[var(--bg-surface)] min-w-[200px]">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                                                                <div className="space-y-1.5 flex-1">
                                                                    <div className="h-2.5 bg-slate-100 animate-pulse rounded-full w-16" />
                                                                    <div className="h-3 bg-slate-100 animate-pulse rounded-full w-3/4" />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3"><div className="h-3 bg-slate-100 animate-pulse rounded-full w-28" /></td>
                                                        {canViewInternalInfo && <>
                                                            <td className="px-4 py-3"><div className="h-3 bg-slate-100 animate-pulse rounded-full w-20" /></td>
                                                            <td className="px-4 py-3"><div className="h-3 bg-slate-100 animate-pulse rounded-full w-12 ml-auto" /></td>
                                                        </>}
                                                        <td className="px-4 py-3"><div className="h-5 bg-slate-100 animate-pulse rounded-full w-16" /></td>
                                                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 animate-pulse rounded-full w-24 ml-auto" /></td>
                                                        <td className="px-4 py-3"><div className="h-3 bg-slate-100 animate-pulse rounded-full w-16 ml-auto" /></td>
                                                        <td className="px-4 py-3"><div className="h-3 bg-slate-100 animate-pulse rounded-full w-12 ml-auto" /></td>
                                                        <td className="px-4 py-3"><div className="h-5 bg-slate-100 animate-pulse rounded-full w-16 mx-auto" /></td>
                                                        {canViewInternalInfo && <td className="px-3 py-3 sticky right-0 bg-[var(--bg-surface)]"><div className="w-6 h-6 rounded-lg bg-slate-100 animate-pulse ml-auto" /></td>}
                                                    </tr>
                                                ))
                                            ) : (
                                                listings.map(item => (
                                                    <InventoryRow
                                                        key={item.id} item={item}
                                                        onEdit={(l: Listing) => { setEditingListing(l); setIsCreateModalOpen(true); }}
                                                        onDelete={handleDeleteClick}
                                                        onDuplicate={async (id: string) => {
                                                            try { await db.duplicateListing(id); fetchListings(); notify(t('leads.duplicate_success'), 'success'); } catch(e) { notify(t('common.error'), 'error'); }
                                                        }}
                                                        onClick={() => handleNavigate(item.id)}
                                                        t={t} formatCurrency={formatCurrency}
                                                        canViewInternal={canViewInternalInfo}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>}

                                    {/* Mobile Compact List */}
                                    {(loading || listings.length > 0) && <div className="md:hidden flex flex-col divide-y divide-[var(--glass-border)]">
                                        {loading ? (
                                            Array.from({ length: 8 }).map((_, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 border-b border-[var(--glass-border)]">
                                                    <div className="w-14 h-14 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex gap-1.5">
                                                            <div className="h-4 bg-slate-100 animate-pulse rounded w-12" />
                                                            <div className="h-4 bg-slate-100 animate-pulse rounded w-14" />
                                                        </div>
                                                        <div className="h-3.5 bg-slate-100 animate-pulse rounded-full w-3/4" />
                                                        <div className="h-3 bg-slate-100 animate-pulse rounded-full w-1/2" />
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                        <div className="h-5 bg-slate-100 animate-pulse rounded w-20" />
                                                        <div className="h-3 bg-slate-100 animate-pulse rounded w-14" />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            listings.map(item => (
                                                <CompactInventoryRow
                                                    key={item.id} item={item}
                                                    onEdit={(l: Listing) => { setEditingListing(l); setIsCreateModalOpen(true); }}
                                                    onDelete={handleDeleteClick}
                                                    onDuplicate={async (id: string) => {
                                                        try { await db.duplicateListing(id); fetchListings(); notify(t('leads.duplicate_success'), 'success'); } catch(e) { notify(t('common.error'), 'error'); }
                                                    }}
                                                    onClick={() => handleNavigate(item.id)}
                                                    t={t}
                                                    canViewInternal={canViewInternalInfo}
                                                />
                                            ))
                                        )}
                                    </div>}

                                    {listings.length === 0 && !loading && (
                                        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
                                            {debouncedSearch || typeFilter !== 'ALL' || statusFilter !== 'ALL' || transactionFilter !== 'ALL' ? (
                                                <>
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-[var(--text-primary)]">{t('common.no_results')}</p>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inventory.empty_filter_hint') || 'Thử xóa bộ lọc hoặc tìm kiếm khác'}</p>
                                                    </div>
                                                    <button onClick={() => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); setTransactionFilter('ALL'); }} className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
                                                        {t('inventory.reset_filters') || 'Xóa bộ lọc'}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-[var(--text-primary)]">{t('inventory.empty_title') || 'Chưa có sản phẩm nào'}</p>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inventory.empty_hint') || 'Thêm sản phẩm bất động sản đầu tiên vào kho'}</p>
                                                    </div>
                                                    {canViewInternalInfo && (
                                                        <button onClick={() => { setEditingListing(undefined); setIsCreateModalOpen(true); }} className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2">
                                                            {ICONS.ADD} {t('inventory.create_title')}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MAP VIEW — absolute positioning for guaranteed pixel height independent of scroll/flex chain */}
                {viewMode === 'MAP' && (
                    <div className="absolute inset-0 p-4 md:p-6" style={{ zIndex: 1 }}>
                        <div className="w-full h-full rounded-2xl overflow-hidden border border-[var(--glass-border)] shadow-sm relative">
                            <MapView
                                listings={allFilteredListings.length > 0 ? allFilteredListings : listings}
                                onNavigate={handleNavigate}
                                formatCurrency={formatCurrency}
                                formatUnitPrice={formatUnitPrice}
                                formatCompactNumber={formatCompactNumber}
                                t={t}
                                language={language}
                            />
                            {boardLoading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                                        <p className="text-xs font-bold text-slate-600">{t('common.loading') || 'Đang tải...'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* KANBAN BOARD VIEW — direct flex-1 child for proper height */}
                {viewMode === 'BOARD' && (
                    <div ref={boardRef} className="flex flex-1 min-h-0 overflow-x-auto gap-4 p-4 md:p-6 no-scrollbar snap-x snap-mandatory overscroll-x-contain cursor-grab active:cursor-grabbing scroll-px-4">
                        {Object.values(ListingStatus).map(status => {
                            const style = STATUS_CONFIG[status];
                            const items = groupedListings[status] || [];
                            
                            return (
                                <div key={status} className="min-w-[85vw] md:min-w-[280px] w-[85vw] md:w-[280px] flex-shrink-0 flex flex-col h-full bg-[var(--glass-surface)] rounded-2xl border border-[var(--glass-border)] snap-center">
                                    <div className={`p-3 border-b border-[var(--glass-border)] flex justify-between items-center rounded-t-2xl ${style.bg}`}>
                                        <h3 className={`text-xs font-bold uppercase tracking-wider ${style.color}`}>{t(`status.${status}`)}</h3>
                                        <span className="text-xs2 font-bold bg-[var(--bg-surface)] px-2 py-0.5 rounded-full text-[var(--text-tertiary)] shadow-sm border border-[var(--glass-border)]">{items.length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                                        {boardLoading ? (
                                            [1,2,3].map(i => (
                                                <div key={i} className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--glass-border)] mb-3 animate-pulse">
                                                    <div className="flex gap-3 items-start mb-3">
                                                        <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />
                                                        <div className="flex-1 space-y-2 pt-1">
                                                            <div className="h-2.5 bg-slate-100 rounded-full w-3/4" />
                                                            <div className="h-2 bg-slate-100 rounded-full w-1/2" />
                                                        </div>
                                                    </div>
                                                    <div className="border-t border-slate-50 pt-2 flex justify-between">
                                                        <div className="h-4 bg-slate-100 rounded-full w-1/2" />
                                                        <div className="h-3 bg-slate-100 rounded-full w-1/4" />
                                                    </div>
                                                </div>
                                            ))
                                        ) : items.map(item => (
                                            <InventoryKanbanCard
                                                key={item.id} item={item}
                                                onClick={() => handleNavigate(item.id)}
                                                onEdit={(l: Listing) => { setEditingListing(l); setIsCreateModalOpen(true); }}
                                                onDelete={handleDeleteClick}
                                                onDuplicate={async (id: string) => {
                                                    try { await db.duplicateListing(id); fetchBoardData(); notify(t('leads.duplicate_success'), 'success'); } catch(e) { notify(t('common.error'), 'error'); }
                                                }}
                                                canViewInternal={canViewInternalInfo}
                                                t={t} formatCurrency={formatCurrency}
                                            />
                                        ))}
                                        {items.length === 0 && !boardLoading && (
                                            <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
                                                <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center`}>
                                                    <svg className={`w-5 h-5 ${style.color} opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                </div>
                                                <p className="text-xs text-[var(--text-tertiary)]">{t('inventory.kanban_empty') || 'Chưa có sản phẩm'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Sticky Pagination Footer — only for GRID / LIST */}
                {viewMode !== 'BOARD' && viewMode !== 'MAP' && (
                    <PaginationControl 
                        page={page} 
                        totalPages={totalPages} 
                        totalItems={totalItems} 
                        pageSize={pageSize}
                        onPageChange={(p: number) => setPage(p)}
                        onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }}
                        t={t}
                    />
                )}
            </div>

            <ListingForm 
                isOpen={isCreateModalOpen} 
                onClose={() => { setIsCreateModalOpen(false); setEditingListing(undefined); }} 
                onSubmit={handleSaveListing} 
                initialData={editingListing}
                t={t}
            />

            <ConfirmModal 
                isOpen={!!itemToDelete}
                title={t('common.delete')}
                message={t('common.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmDelete}
                onCancel={() => setItemToDelete(null)}
                variant="danger"
            />
        </div>
    );
};
