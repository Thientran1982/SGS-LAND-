
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { db } from '../services/dbApi';
import { Lead, LeadStage } from '../types';
import { useTranslation } from '../services/i18n';
import { CreateLeadModal } from '../components/CreateLeadModal';
import { FlashProposalModal } from '../components/FlashProposalModal';
import { LeadDetail } from '../components/LeadDetail';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';
import { useSocket } from '../services/websocket';
import * as XLSX from 'xlsx';

// -----------------------------------------------------------------------------
//  CONSTANTS & STYLES
// -----------------------------------------------------------------------------

type RowDensity = 'compact' | 'normal' | 'relaxed';
type ViewMode = 'LIST' | 'BOARD';

const DENSITY_STYLES = {
    compact: 'py-2 text-xs',
    normal: 'py-4 text-sm',
    relaxed: 'py-6 text-sm'
};

const STAGE_CONFIG: Record<LeadStage, { color: string, bg: string, border: string }> = {
    [LeadStage.NEW]: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    [LeadStage.CONTACTED]: { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    [LeadStage.QUALIFIED]: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    [LeadStage.PROPOSAL]: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    [LeadStage.NEGOTIATION]: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    [LeadStage.WON]: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    [LeadStage.LOST]: { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
};

// Added pointer-events-none to icons to prevent them from becoming the event target
const ICONS = {
    SEARCH: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    ADD: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    EDIT: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    TRASH: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    PROPOSAL: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    DUPLICATE: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 00-2-2v-2" /></svg>,
    FB: <svg className="w-3 h-3 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
    ZALO: <svg className="w-3 h-3 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S16.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v4h-4v2h4v4h2v-4h4v-2h-4V6h-2z" fillRule="evenodd" /></svg>,
    GLOBE: <svg className="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    VIEW_LIST: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    VIEW_BOARD: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>,
    X: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    USER: <svg className="w-3 h-3 pointer-events-none shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
};

const getSourceIcon = (source: string) => {
    switch(source) {
        case 'Facebook': return ICONS.FB;
        case 'Zalo': return ICONS.ZALO;
        default: return ICONS.GLOBE;
    }
};

// --- HOOK: DRAGGABLE SCROLL (Desktop) ---
// Enhanced to accept a dependency trigger (like viewMode) to re-bind listeners
const useDraggableScroll = (ref: React.RefObject<HTMLDivElement>, trigger?: any) => {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        const onMouseDown = (e: MouseEvent) => {
            // Only allow dragging if not clicking an interactive element
            if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return;
            
            isDown = true;
            node.classList.add('cursor-grabbing');
            node.classList.remove('cursor-grab');
            node.classList.remove('snap-x'); // Temporarily disable snap for smooth drag
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
            const walk = (x - startX) * 2; // Increased scroll speed multiplier for better feel
            node.scrollLeft = scrollLeft - walk;
        };

        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('mouseleave', onMouseLeave);
        node.addEventListener('mouseup', onMouseUp);
        node.addEventListener('mousemove', onMouseMove);

        // Initial State
        node.classList.add('cursor-grab');

        return () => {
            node.removeEventListener('mousedown', onMouseDown);
            node.removeEventListener('mouseleave', onMouseLeave);
            node.removeEventListener('mouseup', onMouseUp);
            node.removeEventListener('mousemove', onMouseMove);
            node.classList.remove('cursor-grab', 'cursor-grabbing');
        };
    }, [ref, trigger]); // Re-run when trigger (viewMode) changes
};

// --- PAGINATION COMPONENT ---
const PaginationControl = memo(({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange, t }: any) => {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    const pageSizeOptions = [
        { value: 15, label: '15' },
        { value: 25, label: '25' },
        { value: 50, label: '50' },
        { value: 100, label: '100' }
    ];

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
            <div className="hidden sm:flex text-xs text-slate-500 font-medium items-center gap-1">
                <span>{t('pagination.showing')}</span>
                <span className="font-bold text-slate-900">{totalItems > 0 ? start : 0}-{end}</span>
                <span>{t('pagination.of')}</span>
                <span className="font-bold text-slate-900">{totalItems}</span>
                <span className="hidden sm:inline">{t('pagination.results')}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="min-w-[70px] mr-2">
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
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.prev')}
                </button>
                <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-bold text-slate-800">{page} / {totalPages || 1}</span>
                </div>
                <button 
                    onClick={() => onPageChange(page + 1)} 
                    disabled={page === totalPages || totalPages === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center"
                >
                    {t('pagination.next')}
                </button>
            </div>
        </div>
    );
});

// --- TABLE ROW ---
const LeadRow = memo(({ lead, isSelected, onSelect, onClick, onProposal, onDuplicate, onDelete, t, visibleColumns, density, formatDate, users }: any) => {
    const stickyClass = isSelected 
        ? 'bg-indigo-50 dark:bg-slate-800' 
        : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50';

    const paddingY = DENSITY_STYLES[density as RowDensity] || DENSITY_STYLES.normal;
    const scoreValue = lead.score?.score || 0;
    const scoreGrade = lead.score?.grade || 'C';
    const stageStyle = STAGE_CONFIG[lead.stage as LeadStage] || STAGE_CONFIG[LeadStage.NEW];

    return (
        <tr 
            onClick={() => onClick(lead)}
            className={`group border-b border-slate-50 dark:border-slate-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            tabIndex={0}
        >
            {/* Sticky Checkbox (Left 0) */}
            <td 
                className={`px-4 ${paddingY} w-[50px] min-w-[50px] max-w-[50px] sticky left-0 z-10 transition-colors border-r border-slate-50/50 box-border ${stickyClass}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-center h-full w-full">
                    <button 
                        onClick={() => onSelect(lead.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 hover:border-indigo-400'}`}
                    >
                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                </div>
            </td>
            
            {/* Sticky Name (Left 50px) */}
            <td className={`px-4 ${paddingY} sticky left-[50px] z-10 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${stickyClass} min-w-[220px]`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                        {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">{lead.name}</div>
                </div>
            </td>

            {/* Dynamic Columns */}
            {visibleColumns.has('phone') && (
                <td className={`px-4 ${paddingY} text-xs text-slate-600 dark:text-slate-400 font-mono`}>
                    {lead.phone}
                </td>
            )}

            {visibleColumns.has('email') && (
                <td className={`px-4 ${paddingY} text-xs text-slate-600 dark:text-slate-400`}>
                    {lead.email || '--'}
                </td>
            )}

            {visibleColumns.has('address') && (
                <td className={`px-4 ${paddingY} text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate`} title={lead.address}>
                    {lead.address || '--'}
                </td>
            )}

            {visibleColumns.has('stage') && (
                <td className={`px-4 ${paddingY}`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${stageStyle.bg} ${stageStyle.color} ${stageStyle.border}`}>
                        {t(`stage.${lead.stage}`)}
                    </span>
                </td>
            )}
            
            {visibleColumns.has('source') && (
                <td className={`px-4 ${paddingY}`}>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">
                            {getSourceIcon(lead.source)}
                        </span>
                        {t(`source.${lead.source}`) !== `source.${lead.source}` ? t(`source.${lead.source}`) : lead.source}
                    </div>
                </td>
            )}

            {visibleColumns.has('score') && (
                <td className={`px-4 ${paddingY}`}>
                    <div className="flex items-center gap-2" title={`Grade: ${scoreGrade}`}>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${scoreValue >= 70 ? 'bg-emerald-500' : scoreValue >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                style={{ width: `${scoreValue}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 min-w-[20px]">{scoreValue}</span>
                    </div>
                </td>
            )}

            {visibleColumns.has('owner') && (
                <td className={`px-4 ${paddingY} text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
                    <div className="flex items-center gap-1.5">
                        {ICONS.USER}
                        {users.find(u => u.value === lead.assignedTo)?.label || lead.assignedTo || t('inbox.unassigned')}
                    </div>
                </td>
            )}

            {visibleColumns.has('createdAt') && (
                <td className={`px-4 ${paddingY} text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono`}>
                    {formatDate(lead.createdAt)}
                </td>
            )}
            
            {/* Sticky Actions (Right) */}
            <td className={`px-4 pr-6 ${paddingY} text-right sticky right-0 z-10 transition-colors shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] ${stickyClass}`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-end gap-1 w-max ml-auto items-center h-full">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClick(lead); }} 
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title={t('common.edit')}
                    >
                        {ICONS.EDIT}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onProposal(lead); }} 
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('leads.create_proposal')}
                    >
                        {ICONS.PROPOSAL}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDuplicate(lead.id); }} 
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.duplicate')}
                    >
                        {ICONS.DUPLICATE}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(lead); }} 
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        title={t('common.delete')}
                    >
                        {ICONS.TRASH}
                    </button>
                </div>
            </td>
        </tr>
    );
});

// --- KANBAN BOARD CARD ---
const KanbanCard = memo(({ lead, onClick, t, formatDate, users }: { lead: Lead, onClick: (l: Lead) => void, t: any, formatDate: any, users: any[] }) => {
    return (
        <div 
            onClick={() => onClick(lead)}
            className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-1 mb-3 group"
            role="button"
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors truncate pr-2">{lead.name}</h4>
                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{lead.score?.score || 0}</div>
            </div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-mono truncate flex-1 mr-2">{lead.phone}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    {getSourceIcon(lead.source)}
                    {t(`source.${lead.source}`) !== `source.${lead.source}` ? t(`source.${lead.source}`) : lead.source}
                </span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-50">
                <span>{formatDate(lead.createdAt)}</span>
                <span className="font-medium text-slate-500 flex items-center gap-1">
                    {ICONS.USER}
                    {users.find(u => u.value === lead.assignedTo)?.label || lead.assignedTo || t('inbox.unassigned')}
                </span>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Leads: React.FC = () => {
    const { t, formatDate } = useTranslation();
    const { socket } = useSocket();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [serverStats, setServerStats] = useState({ total: 0, newCount: 0, wonCount: 0, avgScore: 0, winRate: 0 });
    
    // Refs for drag-to-scroll
    const boardRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    const filtersRef = useRef<HTMLDivElement>(null);
    const metricsRef = useRef<HTMLDivElement>(null);
    
    // View State
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try { return (localStorage.getItem('sgs_leads_view') as ViewMode) || 'LIST'; } catch { return 'LIST'; }
    });

    // Hook: Draggable Scroll for Desktop - Added viewMode dependency to ensure listeners attach on view switch
    useDraggableScroll(boardRef, viewMode);
    // Apply draggable scroll to filters container as well to match user request for swiping
    useDraggableScroll(filtersRef, null);
    useDraggableScroll(tableRef, viewMode);
    useDraggableScroll(metricsRef, null);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [sourceFilter, setSourceFilter] = useState('ALL');

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, stageFilter, sourceFilter]);
    
    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [proposalLead, setProposalLead] = useState<Lead | null>(null);
    const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [listings, setListings] = useState<any[]>([]);
    const [users, setUsers] = useState<{value: string, label: string}[]>([]);

    // --- VIEW SETTINGS STATE (PERSISTED) ---
    const [density, setDensity] = useState<RowDensity>(() => {
        try { return (localStorage.getItem('sgs_leads_density') as RowDensity) || 'normal'; } catch { return 'normal'; }
    });

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('sgs_leads_columns');
            if (saved) return new Set(JSON.parse(saved));
        } catch {}
        return new Set(['phone', 'stage', 'source', 'score', 'owner']);
    });

    // Persistence Effects
    useEffect(() => { localStorage.setItem('sgs_leads_density', density); }, [density]);
    useEffect(() => { localStorage.setItem('sgs_leads_columns', JSON.stringify(Array.from(visibleColumns))); }, [visibleColumns]);
    useEffect(() => { localStorage.setItem('sgs_leads_view', viewMode); }, [viewMode]);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            // For Board view, we might want to fetch more items to fill columns, 
            // but for consistent pagination, we stick to pageSize.
            // If viewMode is BOARD, backend logic might need to be different (grouped query),
            // but here we just fetch flat list and group client-side for simplicity.
            const filters = { search: debouncedSearch, stage: stageFilter, source: sourceFilter, sort: 'score', order: 'desc' };
            const res = await db.getLeads(page, pageSize, filters);
            setLeads(res.data || []);
            setTotalPages(res.totalPages);
            setTotalItems(res.total);
            if (res.stats) setServerStats(res.stats);
        } catch (e) {
            console.error(e);
            notify(t('common.error'), 'error');
            setLeads([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, debouncedSearch, stageFilter, sourceFilter, notify, t]);

    useEffect(() => {
        fetchLeads();
        db.getListings(1, 100).then(res => setListings(res.data));
        db.getTenantUsers(1, 100).then(res => {
            setUsers([
                { value: '', label: t('inbox.unassigned') || 'Unassigned' },
                ...res.data.map(u => ({ value: u.id, label: u.name }))
            ]);
        });
    }, [fetchLeads, t]);

    // WebSocket Integration for Real-time Collaboration
    useEffect(() => {
        const handleLeadChange = (data?: any) => {
            fetchLeads();
            if (data && data.name) {
                notify(t('common.success') + `: ${data.name}`, 'success');
            }
        };

        socket.on("lead_created", handleLeadChange);
        socket.on("lead_updated", handleLeadChange);
        socket.on("lead_scored", handleLeadChange);

        return () => {
            socket.off("lead_created", handleLeadChange);
            socket.off("lead_updated", handleLeadChange);
            socket.off("lead_scored", handleLeadChange);
        };
    }, [socket, fetchLeads, notify, t]);

    // Handle Page Change
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= Math.max(1, totalPages)) {
            setPage(newPage);
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1); // Reset to first page
    };

    const handleSelectAll = () => {
        if (selectedLeads.size === leads.length) setSelectedLeads(new Set());
        else setSelectedLeads(new Set(leads.map(l => l.id)));
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedLeads);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedLeads(newSet);
    };

    const handleDeleteClick = useCallback((lead: Lead) => {
        setLeadToDelete(lead);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!leadToDelete) return;
        try {
            await db.deleteLead(leadToDelete.id);
            notify(t('leads.delete_success') || 'Deleted successfully', 'success');
            
            // Remove from selected leads if it was selected
            setSelectedLeads(prev => {
                const newSet = new Set(prev);
                newSet.delete(leadToDelete.id);
                return newSet;
            });
            
            // Refresh explicitly to update UI
            fetchLeads();
        } catch (e) {
            notify(t('common.error'), 'error');
        } finally {
            setLeadToDelete(null);
        }
    }, [leadToDelete, notify, t, fetchLeads]);

    const handleDuplicate = async (id: string) => {
        try {
            await db.duplicateLead(id);
            notify(t('leads.duplicate_success'), 'success');
            fetchLeads();
        } catch (e) {
            notify(t('common.error'), 'error');
        }
    };

    const handleEdit = (lead: Lead) => {
        setEditingLead(lead);
        setIsDetailOpen(true);
    };

    const handleUpdateLead = async (updatedLead: Lead) => {
        try {
            await db.updateLead(updatedLead.id, updatedLead);
            notify(t('common.success'), 'success');
            setIsDetailOpen(false);
            setEditingLead(null);
            socket.emit("lead_updated", updatedLead);
            fetchLeads();
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    const stageOptions = useMemo(() => [{ value: 'ALL', label: t('leads.all_stages') }, ...Object.values(LeadStage).map(s => ({ value: s, label: t(`stage.${s}`) }))], [t]);
    const sourceOptions = useMemo(() => [{ value: 'ALL', label: t('leads.all_sources') }, ...['Facebook', 'Zalo', 'Website'].map(s => ({ value: s, label: s }))], [t]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportExcel = async () => {
        try {
            setLoading(true);
            // Fetch all leads matching current filters by requesting a large page size
            const filters = { search: debouncedSearch, stage: stageFilter, source: sourceFilter, sort: 'score', order: 'desc' };
            const res = await db.getLeads(1, 10000, filters);
            const allLeads = res.data || [];

            const dataToExport = allLeads.map(lead => ({
                [t('leads.customer_name') || 'Tên khách hàng']: lead.name,
                [t('leads.phone') || 'Số điện thoại']: lead.phone,
                [t('leads.source') || 'Nguồn']: lead.source,
                [t('leads.status') || 'Trạng thái']: t(`stage.${lead.stage}`),
                [t('leads.score') || 'Điểm số']: lead.score?.score || 0,
                [t('leads.assigned_to') || 'Người phụ trách']: lead.assignedTo || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
            XLSX.writeFile(workbook, "DanhSachKhachHang.xlsx");
        } catch (error) {
            console.error("Export failed", error);
            notify(t('common.error') || 'Lỗi khi xuất dữ liệu', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                for (const row of data as any[]) {
                    const newLead: Partial<Lead> = {
                        name: row[t('leads.customer_name') || 'Tên khách hàng'] || (t('leads.new_customer') || 'Khách hàng mới'),
                        phone: row[t('leads.phone') || 'Số điện thoại'] ? String(row[t('leads.phone') || 'Số điện thoại']) : '',
                        source: row[t('leads.source') || 'Nguồn'] || 'Other',
                        stage: LeadStage.NEW,
                        assignedTo: row[t('leads.assigned_to') || 'Người phụ trách'] || 'user_1'
                    };
                    await db.createLead(newLead);
                }
                notify(t('leads.import_success') || 'Nhập dữ liệu thành công', 'success');
                fetchLeads();
            } catch (error) {
                notify(t('leads.import_error') || 'Lỗi khi nhập dữ liệu', 'error');
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSimulateInbound = async () => {
        setLoading(true);
        try {
            const sources = ['Facebook', 'Zalo', 'Website'];
            const randomSource = sources[Math.floor(Math.random() * sources.length)];
            const randomBudget = Math.floor(Math.random() * 5000) * 1000000 + 1000000000; // 1B - 6B
            
            const newLead = {
                name: `${t('leads.customer_from') || 'Khách hàng từ'} ${randomSource} ${Math.floor(Math.random() * 1000)}`,
                phone: `090${Math.floor(1000000 + Math.random() * 9000000)}`,
                email: `khachhang${Math.floor(Math.random() * 1000)}@gmail.com`,
                source: randomSource,
                stage: LeadStage.NEW,
                notes: `${t('leads.interested_budget') || 'Quan tâm dự án, ngân sách khoảng'} ${randomBudget.toLocaleString('vi-VN')} VND`
            };
            
            const createdLead = await db.createLead(newLead);
            notify(t('leads.new_lead_received', { source: randomSource }) || `Đã nhận 1 Lead mới từ ${randomSource}! Hệ thống đang chấm điểm và phân bổ...`, 'success');
            socket.emit("lead_created", createdLead);
            fetchLeads();
        } catch (e) {
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Group leads for Board View
    const groupedLeads = useMemo(() => {
        const groups: Record<string, Lead[]> = {};
        Object.values(LeadStage).forEach(stage => groups[stage] = []);
        leads.forEach(lead => {
            if (groups[lead.stage]) groups[lead.stage].push(lead);
        });
        return groups;
    }, [leads]);

    // Calculate Metrics
    const metrics = serverStats;

    return (
        <div className="h-full flex flex-col relative">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            {/* Header & Controls */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm p-4 md:p-6 transition-all flex-none">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                {ICONS.SEARCH}
                            </div>
                            <input 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-slate-400" 
                                placeholder={t('leads.search_placeholder')} 
                            />
                            {search && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                    <button 
                                        onClick={() => setSearch('')}
                                        className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                        title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                    >
                                        {ICONS.X}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={() => setIsCreateModalOpen(true)} className="md:hidden shrink-0 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95">{ICONS.ADD}</button>
                    </div>

                    <div 
                        ref={filtersRef}
                        className="flex gap-2 overflow-x-auto pb-2 px-1 -mx-1 no-scrollbar mask-linear-fade items-center scroll-smooth cursor-grab active:cursor-grabbing"
                    >
                        <div className="min-w-[140px] shrink-0"><Dropdown value={stageFilter} onChange={(val) => setStageFilter(val as string)} options={stageOptions} className="text-xs" /></div>
                        <div className="min-w-[140px] shrink-0"><Dropdown value={sourceFilter} onChange={(val) => setSourceFilter(val as string)} options={sourceOptions} className="text-xs" /></div>
                        
                        {/* View Switcher */}
                        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                            <button 
                                onClick={() => setViewMode('LIST')} 
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t('leads.view_list')}
                            >
                                {ICONS.VIEW_LIST}
                            </button>
                            <button 
                                onClick={() => setViewMode('BOARD')} 
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'BOARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t('leads.view_board')}
                            >
                                {ICONS.VIEW_BOARD}
                            </button>
                        </div>

                        <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>
                        
                        {selectedLeads.size > 0 && (
                            <button 
                                onClick={() => {
                                    if (window.confirm(t('common.confirm_delete') || 'Are you sure you want to delete selected items?')) {
                                        Promise.all(Array.from(selectedLeads).map(id => db.deleteLead(id)))
                                            .then(() => {
                                                notify(t('common.success'), 'success');
                                                setSelectedLeads(new Set());
                                                fetchLeads();
                                            })
                                            .catch(() => notify(t('common.error'), 'error'));
                                    }
                                }}
                                className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs shadow-sm hover:bg-rose-100 transition-all whitespace-nowrap active:scale-95 shrink-0"
                            >
                                {ICONS.TRASH} {t('common.delete')} ({selectedLeads.size})
                            </button>
                        )}
                        
                        <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            ref={fileInputRef} 
                            onChange={handleImportExcel} 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-sm hover:bg-slate-50 transition-all whitespace-nowrap active:scale-95 shrink-0"
                            title={t('leads.import_excel') || "Nhập Excel"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {t('leads.import_excel') || 'Nhập Excel'}
                        </button>
                        <button 
                            onClick={handleExportExcel} 
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-sm hover:bg-slate-50 transition-all whitespace-nowrap active:scale-95 shrink-0"
                            title={t('leads.export_excel') || "Xuất Excel"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {t('leads.export_excel') || 'Xuất Excel'}
                        </button>

                        <button onClick={() => setIsCreateModalOpen(true)} className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all whitespace-nowrap active:scale-95 shrink-0">
                            {ICONS.ADD} {t('common.add_new')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics Board */}
            <div ref={metricsRef} className="px-4 md:px-6 pt-4 md:pt-6 flex overflow-x-auto no-scrollbar gap-3 md:gap-4 flex-none scroll-smooth cursor-grab active:cursor-grabbing">
                {/* Metric 1: Total Leads */}
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow min-w-[140px] md:flex-1 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{t('leads.total_leads') || 'Tổng số Lead'}</span>
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                    </div>
                    <div>
                        <div className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">{metrics.total}</div>
                        <div className="text-[9px] md:text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1 truncate">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            +12%
                        </div>
                    </div>
                </div>

                {/* Metric 2: New Leads */}
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow min-w-[140px] md:flex-1 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{t('leads.new_leads') || 'Lead Mới'}</span>
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                    </div>
                    <div>
                        <div className="text-xl md:text-3xl font-black text-indigo-600 tracking-tight">{metrics.newCount}</div>
                        <div className="text-[9px] md:text-xs font-medium text-slate-500 mt-1 truncate">
                            {t('leads.pending') || 'Đang chờ'}
                        </div>
                    </div>
                </div>

                {/* Metric 3: Win Rate */}
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow min-w-[140px] md:flex-1 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{t('leads.win_rate') || 'Tỉ lệ chốt'}</span>
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div>
                        <div className="text-xl md:text-3xl font-black text-emerald-600 tracking-tight">{metrics.winRate}%</div>
                        <div className="text-[9px] md:text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1 truncate">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            +2.4%
                        </div>
                    </div>
                </div>

                {/* Metric 4: Avg Score */}
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow min-w-[140px] md:flex-1 shrink-0">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{t('leads.avg_score') || 'Điểm TB'}</span>
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </div>
                    </div>
                    <div>
                        <div className="text-xl md:text-3xl font-black text-amber-600 tracking-tight">{metrics.avgScore}</div>
                        <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${metrics.avgScore}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-white min-h-0 relative flex flex-col">
                
                {/* Scrollable Container */}
                <div className="flex-1 overflow-auto p-4 md:p-6 no-scrollbar">
                    {/* VIEW MODE: LIST (TABLE) - Desktop Only */}
                    {viewMode === 'LIST' && (
                        <div className="hidden md:block bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
                            <div ref={tableRef} className="overflow-auto no-scrollbar custom-scrollbar flex-1 min-w-0 w-full cursor-grab active:cursor-grabbing">
                                <table className="w-full text-left border-collapse relative">
                                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
                                        <tr>
                                            <th className={`px-4 py-3 w-[50px] border-r border-slate-100 sticky left-0 bg-slate-50 z-30`}>
                                                <div className="flex items-center justify-center">
                                                    <input type="checkbox" checked={selectedLeads.size === leads.length && leads.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                </div>
                                            </th>
                                            <th className={`px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky left-[50px] z-30`}>{t('leads.name')}</th>
                                            {visibleColumns.has('phone') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.col_phone')}</th>}
                                            {visibleColumns.has('email') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.col_email')}</th>}
                                            {visibleColumns.has('address') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.col_address')}</th>}
                                            {visibleColumns.has('stage') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.stage')}</th>}
                                            {visibleColumns.has('source') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.source')}</th>}
                                            {visibleColumns.has('score') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.score')}</th>}
                                            {visibleColumns.has('owner') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('common.owner')}</th>}
                                            {visibleColumns.has('createdAt') && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{t('leads.col_created')}</th>}
                                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right sticky right-0 bg-slate-50 z-30">{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {leads?.map(lead => (
                                            <LeadRow 
                                                key={lead.id} 
                                                lead={lead} 
                                                isSelected={selectedLeads.has(lead.id)}
                                                onSelect={handleSelectOne}
                                                onClick={handleEdit}
                                                onProposal={() => setProposalLead(lead)}
                                                onDuplicate={handleDuplicate}
                                                onDelete={handleDeleteClick}
                                                t={t}
                                                visibleColumns={visibleColumns}
                                                density={density}
                                                formatDate={formatDate}
                                                users={users}
                                            />
                                        ))}
                                        {leads?.length === 0 && !loading && (
                                            <tr><td colSpan={12} className="p-12 text-center text-slate-400 italic">{t('common.no_results')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* VIEW MODE: BOARD (KANBAN) - Show on Mobile and Desktop */}
                    {viewMode === 'BOARD' && (
                        <div ref={boardRef} className="flex h-full overflow-x-auto gap-4 px-4 pb-4 no-scrollbar snap-x snap-mandatory overscroll-x-contain cursor-grab active:cursor-grabbing scroll-px-4">
                            {Object.values(LeadStage).map(stage => {
                                const style = STAGE_CONFIG[stage];
                                return (
                                    <div key={stage} className="min-w-[85vw] md:min-w-[320px] w-[85vw] md:w-[320px] flex-shrink-0 flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 snap-center">
                                        <div className={`p-3 border-b border-slate-200 flex justify-between items-center rounded-t-2xl ${style.bg}`}>
                                            <h3 className={`text-xs font-bold uppercase tracking-wider ${style.color}`}>{t(`stage.${stage}`)}</h3>
                                            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full text-slate-500 shadow-sm border border-slate-100">{groupedLeads[stage]?.length || 0}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                                            {groupedLeads[stage]?.map(lead => (
                                                <KanbanCard key={lead.id} lead={lead} onClick={handleEdit} t={t} formatDate={formatDate} users={users} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Mobile Cards (Only for LIST view on Mobile) */}
                    {viewMode === 'LIST' && (
                        <div className="md:hidden space-y-3 pb-20">
                            {leads?.map(lead => (
                                <div 
                                    key={lead.id} 
                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all hover:border-indigo-100" 
                                    onClick={() => handleEdit(lead)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-100">
                                                {lead.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{lead.name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    {getSourceIcon(lead.source)}
                                                    {lead.source} • {formatDate(lead.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${STAGE_CONFIG[lead.stage].bg} ${STAGE_CONFIG[lead.stage].color} ${STAGE_CONFIG[lead.stage].border}`}>
                                            {t(`stage.${lead.stage}`)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4 py-3 border-t border-b border-slate-50">
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t('leads.col_phone')}</div>
                                            <div className="text-xs font-bold text-slate-700 font-mono">{lead.phone}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t('leads.score')}</div>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${lead.score?.score >= 70 ? 'bg-emerald-500' : lead.score?.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${lead.score?.score || 0}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{lead.score?.score || 0}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setProposalLead(lead); }} 
                                            className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 active:bg-indigo-100 transition-colors"
                                        >
                                            {ICONS.PROPOSAL} {t('leads.create_proposal')}
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }} 
                                            className="w-10 h-10 flex items-center justify-center text-rose-400 bg-rose-50 rounded-xl active:bg-rose-100 transition-colors"
                                        >
                                            {ICONS.TRASH}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {leads?.length === 0 && !loading && (
                                <div className="p-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    {t('common.no_results')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Pagination Footer - Fixed at bottom */}
                <PaginationControl 
                    page={page} 
                    totalPages={totalPages} 
                    totalItems={totalItems} 
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    t={t}
                />
            </div>

            {/* Modals */}
            {isCreateModalOpen && <CreateLeadModal onClose={() => setIsCreateModalOpen(false)} onSuccess={() => { setIsCreateModalOpen(false); fetchLeads(); notify(t('common.success'), 'success'); }} />}
            
            {proposalLead && (
                <FlashProposalModal 
                    lead={proposalLead} 
                    listings={listings} 
                    onClose={() => setProposalLead(null)} 
                    onSuccess={() => { setProposalLead(null); notify(t('proposal.btn_create') + ' ' + t('common.success'), 'success'); }} 
                />
            )}

            {isDetailOpen && editingLead && (
                <LeadDetail 
                    lead={editingLead} 
                    onClose={() => { setIsDetailOpen(false); setEditingLead(null); }} 
                    onUpdate={handleUpdateLead} 
                    isModal={true} 
                />
            )}

            <ConfirmModal 
                isOpen={!!leadToDelete}
                title={t('common.delete')}
                message={t('leads.delete_confirm_msg', { name: leadToDelete?.name || '' })}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={confirmDelete}
                onCancel={() => setLeadToDelete(null)}
                variant="danger"
            />
        </div>
    );
};

export default Leads;
