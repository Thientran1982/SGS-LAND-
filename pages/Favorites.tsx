
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '../services/dbApi';
import { Listing, PropertyType } from '../types';
import { useTranslation } from '../services/i18n';
import { ListingCard } from '../components/ListingCard';
import { ROUTES } from '../config/routes';
import { ConfirmModal } from '../components/ConfirmModal';

const CONFIG = { PAGE_SIZE: 12 };

const SORT_OPTIONS = [
    { value: 'date_desc', label: 'Mới thêm nhất' },
    { value: 'price_asc',  label: 'Giá tăng dần' },
    { value: 'price_desc', label: 'Giá giảm dần' },
    { value: 'area_asc',   label: 'Diện tích tăng dần' },
    { value: 'area_desc',  label: 'Diện tích giảm dần' },
];

const TYPE_LABELS: Record<string, string> = {
    [PropertyType.PROJECT]:    'Dự án',
    [PropertyType.APARTMENT]:  'Căn hộ',
    [PropertyType.TOWNHOUSE]:  'Nhà phố',
    [PropertyType.VILLA]:      'Biệt thự',
    [PropertyType.LAND]:       'Đất nền',
    [PropertyType.FACTORY]:    'Nhà xưởng',
    [PropertyType.OFFICE]:     'Văn phòng',
    [PropertyType.COMMERCIAL]: 'Thương mại',
};

type Toast = { msg: string; type: 'success' | 'error' };

export const Favorites: React.FC = () => {
    const { t, formatCurrency } = useTranslation();

    const [allFavorites, setAllFavorites] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const [sortBy, setSortBy] = useState('date_desc');
    const [filterType, setFilterType] = useState<string>('ALL');

    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const removingRef = useRef<Set<string>>(new Set());

    const [toast, setToast] = useState<Toast | null>(null);

    const notify = (msg: string, type: Toast['type'] = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchFavorites = useCallback(async () => {
        setLoading(true);
        try {
            const res = await db.getFavorites(1, 1000);
            setAllFavorites(res.data || []);
        } catch {
            notify('Không thể tải danh sách quan tâm', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

    const filtered = useMemo(() => {
        let list = filterType === 'ALL'
            ? allFavorites
            : allFavorites.filter(l => l.type === filterType);

        list = [...list].sort((a, b) => {
            if (sortBy === 'price_asc')  return (a.price ?? 0) - (b.price ?? 0);
            if (sortBy === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
            if (sortBy === 'area_asc')   return (a.area ?? 0) - (b.area ?? 0);
            if (sortBy === 'area_desc')  return (b.area ?? 0) - (a.area ?? 0);
            return 0;
        });

        return list;
    }, [allFavorites, sortBy, filterType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / CONFIG.PAGE_SIZE));
    const pagedItems = filtered.slice((page - 1) * CONFIG.PAGE_SIZE, page * CONFIG.PAGE_SIZE);

    useEffect(() => { setPage(1); }, [sortBy, filterType]);

    const performRemoval = useCallback(async (id: string) => {
        if (removingRef.current.has(id)) return;
        removingRef.current.add(id);
        setRemovedIds(prev => new Set(prev).add(id));

        setTimeout(async () => {
            try {
                await db.removeFromFavorites(id);
                setAllFavorites(prev => {
                    const updated = prev.filter(l => l.id !== id);
                    if (pagedItems.length === 1 && page > 1) setPage(p => p - 1);
                    return updated;
                });
                setRemovedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                notify(t('favorites.removed'), 'success');
            } catch {
                setRemovedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                notify('Xóa thất bại, vui lòng thử lại', 'error');
            } finally {
                removingRef.current.delete(id);
            }
        }, 300);
    }, [page, pagedItems.length, t]);

    const handleConfirmDelete = async () => {
        if (itemToDelete) { await performRemoval(itemToDelete); setItemToDelete(null); }
    };

    const handleNavigate = (id: string) => {
        window.location.hash = `#/${ROUTES.LISTING}/${id}`;
    };

    const availableTypes = useMemo(() => {
        const types = new Set(allFavorites.map(l => l.type).filter(Boolean));
        return Array.from(types) as string[];
    }, [allFavorites]);

    return (
        <div className="h-full flex flex-col pb-20 animate-enter relative">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border transition-all ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="sticky top-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-b border-[var(--glass-border)] shadow-sm px-6 py-3 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-indigo-600">
                        {filtered.length}{filterType !== 'ALL' ? ` / ${allFavorites.length}` : ''} {t('favorites.title')}
                    </span>
                    {allFavorites.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            {availableTypes.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        onClick={() => setFilterType('ALL')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterType === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-indigo-300'}`}
                                    >
                                        Tất cả
                                    </button>
                                    {availableTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setFilterType(type)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-indigo-300'}`}
                                        >
                                            {TYPE_LABELS[type] || type}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] focus:outline-none focus:border-indigo-400 cursor-pointer"
                            >
                                {SORT_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto px-6 no-scrollbar">
                {loading && allFavorites.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="h-[400px] bg-[var(--glass-surface-hover)] rounded-[24px] animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {pagedItems.map(item => (
                            <div
                                key={item.id}
                                className={`min-h-full transition-all duration-300 ${removedIds.has(item.id) ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
                            >
                                <ListingCard
                                    item={item}
                                    t={t}
                                    formatCurrency={formatCurrency}
                                    onToggleFavorite={performRemoval}
                                    onEdit={() => {}}
                                    onDelete={() => setItemToDelete(item.id)}
                                    onClick={() => handleNavigate(item.id)}
                                    showActions={false}
                                />
                            </div>
                        ))}

                        {pagedItems.length === 0 && !loading && (
                            <div className="col-span-full py-20 text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--glass-surface-hover)] flex items-center justify-center">
                                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </div>
                                <p className="text-slate-400 italic mb-2 font-medium">
                                    {filterType !== 'ALL'
                                        ? `Không có BĐS loại "${TYPE_LABELS[filterType] || filterType}" trong danh sách quan tâm`
                                        : t('favorites.empty')
                                    }
                                </p>
                                {filterType !== 'ALL' ? (
                                    <button
                                        onClick={() => setFilterType('ALL')}
                                        className="px-5 py-2 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                                    >
                                        Xem tất cả loại
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => window.location.hash = `#/${ROUTES.INVENTORY}`}
                                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        {t('favorites.btn_browse')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {totalPages > 1 && pagedItems.length > 0 && (
                    <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('common.prev')}
                        </button>
                        <span className="text-sm font-bold text-[var(--text-tertiary)]">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('common.next')}
                        </button>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!itemToDelete}
                title={t('common.delete')}
                message={t('common.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleConfirmDelete}
                onCancel={() => setItemToDelete(null)}
                variant="danger"
            />
        </div>
    );
};
