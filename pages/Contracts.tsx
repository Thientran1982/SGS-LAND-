import React, { useState, useEffect, useRef } from 'react';
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
            if (Math.abs(walk) > 5) {
                dragged = true;
            }
            node.scrollLeft = scrollLeft - walk;
        };

        const onClick = (e: MouseEvent) => {
            if (dragged) {
                e.preventDefault();
                e.stopPropagation();
            }
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

const Contracts: React.FC = () => {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<ContractType | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);
    
    const [contractToDelete, setContractToDelete] = useState<string | null>(null);
    const [shareLink, setShareLink] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);

    const loadContracts = async () => {
        setLoading(true);
        try {
            const res = await db.getContracts(page, 20, { search, type: typeFilter, status: statusFilter });
            setContracts(res.data);
            setTotalPages(res.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContracts();
    }, [page, search, typeFilter, statusFilter]);

    const handleDelete = async () => {
        if (contractToDelete) {
            await db.deleteContract(contractToDelete);
            setContractToDelete(null);
            loadContracts();
        }
    };

    const handleEdit = (contract: Contract) => {
        setEditingContract(contract);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 h-full flex flex-col animate-enter">
            <div className="flex justify-end mb-6">
                <button 
                    onClick={() => { setEditingContract(null); setIsModalOpen(true); }}
                    className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl font-bold text-sm shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    {t('contracts.btn_create')}
                </button>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--glass-border)] flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px] group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <input 
                            type="text" 
                            placeholder={t('contracts.search_placeholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)] transition-all outline-none placeholder:text-[var(--text-muted)]"
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <Dropdown
                        value={typeFilter}
                        onChange={(val) => setTypeFilter(val as any)}
                        options={[
                            { value: 'ALL', label: t('contracts.all_types') },
                            { value: ContractType.DEPOSIT, label: t('contracts.type_DEPOSIT') },
                            { value: ContractType.SALES, label: t('contracts.type_SALES') }
                        ]}
                        className="w-48"
                    />
                    <Dropdown
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val as any)}
                        options={[
                            { value: 'ALL', label: t('contracts.all_statuses') },
                            { value: ContractStatus.DRAFT, label: t('contracts.status_DRAFT') },
                            { value: ContractStatus.PENDING_SIGNATURE, label: t('contracts.status_PENDING_SIGNATURE') },
                            { value: ContractStatus.SIGNED, label: t('contracts.status_SIGNED') },
                            { value: ContractStatus.CANCELLED, label: t('contracts.status_CANCELLED') }
                        ]}
                        className="w-48"
                    />
                </div>

                <div 
                    className="flex-1 overflow-auto min-w-0 min-h-0 w-full no-scrollbar"
                    ref={scrollRef}
                >
                    {loading ? (
                        <div className="p-8 text-center text-[var(--text-secondary)]">{t('common.loading')}</div>
                    ) : contracts.length === 0 ? (
                        <div className="p-12 text-center text-[var(--text-secondary)]">
                            <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            {t('contracts.empty')}
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
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_status')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)]">{t('contracts.col_date')}</th>
                                        <th className="p-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--glass-border)] text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {contracts.map(c => (
                                        <tr 
                                            key={c.id} 
                                            onClick={(e) => {
                                                handleEdit(c);
                                            }} 
                                            className="cursor-pointer hover:bg-[var(--glass-surface-hover)] transition-colors group"
                                        >
                                            <td className="p-4">
                                                <div className="font-medium text-sm text-[var(--text-primary)]">
                                                    {t(`contracts.type_${c.type}`)}
                                                </div>
                                                <div
                                                    className="text-xs font-mono text-[var(--text-secondary)] mt-0.5 cursor-pointer hover:text-indigo-500 transition-colors"
                                                    title={c.id}
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.id); }}
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
                                                {c.type === ContractType.DEPOSIT && (
                                                    <div className="text-xs text-indigo-500 mt-0.5">Cọc: {formatCurrency(c.depositAmount || 0)}</div>
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
                                                {formatDate(c.createdAt)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            window.location.hash = `#/p/contract_${c.id}`;
                                                        }}
                                                        className="p-1.5 text-[var(--text-secondary)] hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Xem & Xuất PDF"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            const link = `${window.location.origin}/#/p/contract_${c.id}`;
                                                            setShareLink(link);
                                                        }}
                                                        className="p-1.5 text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title={t('common.share_link')}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setContractToDelete(c.id); }}
                                                        className="p-1.5 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title={t('common.delete')}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <ContractModal 
                    contract={editingContract}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        loadContracts();
                    }}
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
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShareLink(null)}></div>
                    <div className="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-enter p-6">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Chia sẻ hợp đồng</h3>
                        <p className="text-sm text-[var(--text-tertiary)] mb-4">Sao chép đường dẫn bên dưới để gửi cho khách hàng:</p>
                        <div className="flex items-center gap-2 bg-[var(--glass-surface)] p-3 rounded-xl border border-[var(--glass-border)]">
                            <input 
                                type="text" 
                                readOnly 
                                value={shareLink} 
                                className="bg-transparent outline-none flex-1 text-sm font-mono text-indigo-600"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    alert(t('common.copied'));
                                }}
                                className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                        </div>
                        <button 
                            onClick={() => setShareLink(null)}
                            className="mt-6 w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Contracts;
