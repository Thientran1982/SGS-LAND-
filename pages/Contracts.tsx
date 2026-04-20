import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../services/i18n';
import { db } from '../services/dbApi';
import { Contract, ContractType, ContractStatus } from '../types';
import { ContractModal } from '../components/ContractModal';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';

const useDraggableScroll = (ref: React.RefObject<HTMLDivElement>, trigger?: any) => {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;
        let dragged = false;

        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return;
            isDown = true;
            dragged = false;
            node.classList.add('cursor-grabbing', 'select-none');
            node.classList.remove('cursor-grab', 'snap-x');
            startX = e.pageX - node.offsetLeft;
            scrollLeft = node.scrollLeft;
        };

        const onMouseLeave = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing', 'select-none');
            node.classList.add('cursor-grab', 'snap-x');
        };

        const onMouseUp = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing', 'select-none');
            node.classList.add('cursor-grab', 'snap-x');
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - node.offsetLeft;
            const walk = (x - startX) * 2;
            if (Math.abs(walk) > 5) dragged = true;
            node.scrollLeft = scrollLeft - walk;
        };

        const onClick = (e: MouseEvent) => {
            if (dragged) { e.preventDefault(); e.stopPropagation(); }
        };

        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('mouseleave', onMouseLeave);
        node.addEventListener('mouseup', onMouseUp);
        node.addEventListener('mousemove', onMouseMove);
        node.addEventListener('click', onClick, true);
        node.classList.add('cursor-grab');

        return () => {
            node.removeEventListener('mousedown', onMouseDown);
            node.removeEventListener('mouseleave', onMouseLeave);
            node.removeEventListener('mouseup', onMouseUp);
            node.removeEventListener('mousemove', onMouseMove);
            node.removeEventListener('click', onClick, true);
            node.classList.remove('cursor-grab', 'cursor-grabbing', 'select-none');
        };
    }, [ref, trigger]);
};

/* ── Row action dropdown (3 dots) ── */
interface RowMenuProps {
    contract: Contract;
    onEdit: () => void;
    onViewPDF: () => void;
    onShare: () => void;
    onDelete: () => void;
}

const RowMenu: React.FC<RowMenuProps> = ({ contract, onEdit, onViewPDF, onShare, onDelete }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const menuW = 192;
            const left = rect.right - menuW < 0 ? rect.left : rect.right - menuW;
            setPos({ top: rect.bottom + 4, left });
        }
        setOpen(v => !v);
    };

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [open]);

    const item = (label: string, icon: React.ReactNode, action: () => void, danger = false) => (
        <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); action(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left
                ${danger
                    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    : 'text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)]'
                }`}
        >
            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
            {label}
        </button>
    );

    return (
        <>
            <button
                ref={btnRef}
                onClick={toggle}
                aria-label={t('common.actions')}
                className="p-2 min-h-[36px] min-w-[36px] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
            </button>

            {open && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 192 }}
                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl p-1.5 animate-enter"
                >
                    {item(t('common.edit'), (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    ), onEdit)}
                    {item(t('contracts.view_export_pdf'), (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    ), onViewPDF)}
                    {item(t('common.share_link'), (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    ), onShare)}
                    <div className="my-1 border-t border-[var(--glass-border)]" />
                    {item(t('contracts.delete_label'), (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    ), onDelete, true)}
                </div>,
                document.body
            )}
        </>
    );
};

/* ── Main page ── */
const Contracts: React.FC = () => {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<ContractType | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [stats, setStats] = useState<{ total: number; draftCount: number; pendingCount: number; signedCount: number; cancelledCount: number; signedValue: number; totalValue: number } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);

    const [contractToDelete, setContractToDelete] = useState<string | null>(null);
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);

    const loadContracts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await db.getContracts(page, 20, { search, type: typeFilter, status: statusFilter });
            setContracts(res.data);
            setTotalPages(res.totalPages);
            if (res.stats) setStats(res.stats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, search, typeFilter, statusFilter]);

    useEffect(() => { loadContracts(); }, [loadContracts]);

    useEffect(() => {
        const handler = () => {
            const segment = window.location.pathname.split('/').filter(Boolean)[0] || '';
            if (segment === 'contracts') loadContracts();
        };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [loadContracts]);

    const handleDelete = async () => {
        if (!contractToDelete) return;
        const id = contractToDelete;
        setContractToDelete(null);
        try {
            await db.deleteContract(id);
            loadContracts();
            notify(t('contracts.delete_success'), 'success');
        } catch (error) {
            console.error('Failed to delete contract:', error);
            notify(t('common.error'), 'error');
        }
    };

    const isFiltered = useMemo(() => search !== '' || typeFilter !== 'ALL' || statusFilter !== 'ALL', [search, typeFilter, statusFilter]);

    const handleEdit = (contract: Contract) => {
        setEditingContract(contract);
        setIsModalOpen(true);
    };

    return (
        <>
        <div className="p-4 sm:p-6 h-full flex flex-col animate-enter">
            {/* Header row */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t('contracts.title')}</h1>
                <button
                    onClick={() => { setEditingContract(null); setIsModalOpen(true); }}
                    className="px-4 py-2 min-h-[44px] bg-[var(--primary-600)] text-white rounded-xl font-bold text-sm shadow-sm hover:opacity-90 transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    <span className="hidden sm:inline">{t('contracts.btn_create')}</span>
                    <span className="sm:hidden">Tạo HĐ</span>
                </button>
            </div>

            {/* Stats bar */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl p-3 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-sm">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-[var(--text-tertiary)] font-medium truncate">{t('contracts.stat_total')}</div>
                            <div className="text-lg sm:text-xl font-black text-[var(--text-primary)]">{stats.total}</div>
                            {stats.draftCount > 0 && (
                                <div className="text-2xs text-[var(--text-muted)] mt-0.5">{stats.draftCount} nháp</div>
                            )}
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl p-3 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-sm">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z"/></svg>
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-[var(--text-tertiary)] font-medium truncate">{t('contracts.stat_pending')}</div>
                            <div className="text-lg sm:text-xl font-black text-amber-600">{stats.pendingCount}</div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl p-3 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-sm">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-[var(--text-tertiary)] font-medium truncate">{t('contracts.stat_signed')}</div>
                            <div className="text-lg sm:text-xl font-black text-emerald-600">{stats.signedCount}</div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl p-3 sm:p-3.5 flex items-center gap-2 sm:gap-3 shadow-sm">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-[var(--text-tertiary)] font-medium truncate">{t('contracts.stat_signed_value')}</div>
                            <div className="text-sm sm:text-base font-black text-violet-600 truncate">{formatCurrency(stats.signedValue)}</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden">
                {/* Filter bar */}
                <div className="p-3 sm:p-4 border-b border-[var(--glass-border)] flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {/* Search – full width */}
                    <div className="relative flex-1 group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <input
                            type="text"
                            placeholder={t('contracts.search_placeholder')}
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 sm:pl-10 pr-10 py-2.5 min-h-[44px] bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)] transition-all outline-none placeholder:text-[var(--text-muted)]"
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('common.clear_search')}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Dropdowns – side by side on mobile, natural width on desktop */}
                    <div className="flex gap-2 sm:gap-3">
                        <Dropdown
                            value={typeFilter}
                            onChange={(val) => { setTypeFilter(val as any); setPage(1); }}
                            options={[
                                { value: 'ALL', label: t('contracts.all_types') },
                                { value: ContractType.RESERVATION, label: t('contracts.type_RESERVATION') },
                                { value: ContractType.DEPOSIT, label: t('contracts.type_DEPOSIT') },
                                { value: ContractType.SALES, label: t('contracts.type_SALES') }
                            ]}
                            className="flex-1 sm:flex-none sm:w-44"
                        />
                        <Dropdown
                            value={statusFilter}
                            onChange={(val) => { setStatusFilter(val as any); setPage(1); }}
                            options={[
                                { value: 'ALL', label: t('contracts.all_statuses') },
                                { value: ContractStatus.DRAFT, label: t('contracts.status_DRAFT') },
                                { value: ContractStatus.PENDING_SIGNATURE, label: t('contracts.status_PENDING_SIGNATURE') },
                                { value: ContractStatus.SIGNED, label: t('contracts.status_SIGNED') },
                                { value: ContractStatus.CANCELLED, label: t('contracts.status_CANCELLED') }
                            ]}
                            className="flex-1 sm:flex-none sm:w-44"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto min-w-0 min-h-0 w-full no-scrollbar" ref={scrollRef}>
                    {loading ? (
                        <div className="p-8 text-center text-[var(--text-secondary)]">{t('common.loading')}</div>
                    ) : contracts.length === 0 ? (
                        <div className="p-12 text-center text-[var(--text-secondary)] flex flex-col items-center gap-3">
                            {isFiltered ? (
                                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            ) : (
                                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            )}
                            <p className="text-sm font-medium">{isFiltered ? t('common.no_results') : t('contracts.empty')}</p>
                            {isFiltered && (
                                <button
                                    onClick={() => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); }}
                                    className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
                                >
                                    {t('contracts.reset_filters')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="min-w-[800px] w-full">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[var(--bg-app)] sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_type')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_party_b')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_property')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_value')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_payment_progress')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_status')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_date')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)] text-right w-24">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {contracts.map(c => (
                                        <tr
                                            key={c.id}
                                            tabIndex={0}
                                            onClick={() => handleEdit(c)}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(c); } }}
                                            className="cursor-pointer hover:bg-[var(--glass-surface-hover)] transition-colors group focus-visible:outline-none focus-visible:bg-indigo-50/50"
                                        >
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mb-1 ${
                                                    c.type === ContractType.RESERVATION
                                                        ? 'bg-violet-100 text-violet-700'
                                                        : c.type === ContractType.DEPOSIT
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                    {c.type === ContractType.RESERVATION && (
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
                                                    )}
                                                    {t(`contracts.type_${c.type}`)}
                                                </span>
                                                <div
                                                    className="text-xs font-mono text-[var(--text-secondary)] cursor-pointer hover:text-indigo-500 transition-colors"
                                                    title={c.id}
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.id).catch(() => {}); }}
                                                >
                                                    #{c.id.slice(0, 8).toUpperCase()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-sm text-[var(--text-primary)]">{c.partyBName}</div>
                                                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{c.partyBPhone}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm text-[var(--text-primary)] line-clamp-1">{c.propertyAddress}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-sm text-[var(--text-primary)]">{formatCurrency(c.propertyPrice || 0)}</div>
                                                {c.type === ContractType.DEPOSIT && c.depositAmount ? (
                                                    <div className="text-xs text-indigo-500 mt-0.5">{t('contracts.deposit_label')}: {formatCurrency(c.depositAmount)}</div>
                                                ) : c.type === ContractType.RESERVATION && c.depositAmount ? (
                                                    <div className="text-xs text-violet-500 mt-0.5 font-medium">{t('contracts.reservation_fee').replace(' (VNĐ)', '')}: {formatCurrency(c.depositAmount)}</div>
                                                ) : null}
                                            </td>
                                            <td className="p-4 min-w-[140px]">
                                                {c.paymentSchedule && c.paymentSchedule.length > 0 ? (() => {
                                                    const ms: any[] = c.paymentSchedule;
                                                    const totalAmt = c.propertyPrice || 0;
                                                    const paidAmt = ms.filter((m: any) => m.status === 'PAID').reduce((s: number, m: any) => s + (m.paidAmount ?? m.amount ?? 0), 0);
                                                    const overdue = ms.filter((m: any) => m.status === 'OVERDUE').length;
                                                    const pct = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0;
                                                    return (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-[var(--text-primary)]">{pct}%</span>
                                                                {overdue > 0 && (
                                                                    <span className="text-rose-500 font-bold">{overdue} {t('contracts.payment_overdue')}</span>
                                                                )}
                                                            </div>
                                                            <div className="w-full h-1.5 bg-[var(--glass-border)] rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${overdue > 0 ? 'bg-rose-500' : pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-[var(--text-tertiary)]">{ms.length} {t('contracts.payment_milestones')}</div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                                    c.status === ContractStatus.SIGNED ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                    c.status === ContractStatus.PENDING_SIGNATURE ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                    c.status === ContractStatus.CANCELLED ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                                                    'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] dark:bg-slate-500/20 dark:text-slate-400'
                                                }`}>
                                                    {t(`contracts.status_${c.status}`)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-[var(--text-secondary)]">
                                                {c.type === ContractType.RESERVATION && (c as any).handoverDate ? (
                                                    <div>
                                                        <div className="font-medium text-violet-600">{formatDate((c as any).handoverDate)}</div>
                                                        <div className="text-xs text-[var(--text-tertiary)]">{t('contracts.reservation_expiry')}</div>
                                                    </div>
                                                ) : c.status === ContractStatus.SIGNED && (c as any).signedAt ? (
                                                    <div>
                                                        <div className="font-medium text-emerald-600">{formatDate((c as any).signedAt)}</div>
                                                        <div className="text-xs text-[var(--text-tertiary)]">{t('contracts.signed_date_label')}</div>
                                                    </div>
                                                ) : (
                                                    formatDate(c.createdAt)
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <RowMenu
                                                    contract={c}
                                                    onEdit={() => handleEdit(c)}
                                                    onViewPDF={() => { window.history.pushState(null, '', `/p/contract_${c.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                                                    onShare={() => { setShareLink(`${window.location.origin}/p/contract_${c.id}`); setLinkCopied(false); }}
                                                    onDelete={() => setContractToDelete(c.id)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-[var(--glass-border)] flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">{t('contracts.pagination', { page: String(page), total: String(totalPages) })}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-sm disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-colors"
                            >
                                ← {t('common.prev')}
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-sm disabled:opacity-40 hover:bg-[var(--glass-surface-hover)] transition-colors"
                            >
                                {t('common.next')} →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <ContractModal
                    contract={editingContract}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); loadContracts(); }}
                />
            )}

            <ConfirmModal
                isOpen={!!contractToDelete}
                title={t('common.delete')}
                message={t('contracts.delete_confirm')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setContractToDelete(null)}
            />

            {shareLink && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShareLink(null)} aria-hidden="true" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-modal-title"
                        className="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-enter p-6"
                    >
                        <h3 id="share-modal-title" className="text-lg font-bold text-[var(--text-primary)] mb-4">{t('contracts.share_title')}</h3>
                        <p className="text-sm text-[var(--text-tertiary)] mb-4">{t('contracts.share_desc')}</p>
                        <div className="flex items-center gap-2 bg-[var(--glass-surface)] p-3 rounded-xl border border-[var(--glass-border)]">
                            <input
                                type="text"
                                readOnly
                                value={shareLink}
                                className="bg-transparent outline-none flex-1 text-sm font-mono text-indigo-600"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <button
                                aria-label={t('common.copy_link')}
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink).then(() => {
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }).catch(() => {});
                                }}
                                className="p-2 min-h-[36px] min-w-[36px] rounded-lg transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                                {linkCopied ? (
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                ) : (
                                    <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                )}
                            </button>
                        </div>
                        {linkCopied && <p role="status" aria-live="polite" className="mt-2 text-xs text-emerald-600 font-bold">{t('common.copied')}</p>}
                        <button
                            onClick={() => setShareLink(null)}
                            aria-label={t('common.close')}
                            className="mt-6 w-full py-2.5 min-h-[44px] bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
        {createPortal(
            toast ? (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};

export default Contracts;
