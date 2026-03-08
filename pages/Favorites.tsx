
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/mockDb';
import { Listing } from '../types';
import { useTranslation } from '../services/i18n';
import { ListingCard } from '../components/ListingCard';
import { ROUTES } from '../config/routes';
import { ConfirmModal } from '../components/ConfirmModal';

const CONFIG = {
    PAGE_SIZE: 12
};

export const Favorites: React.FC = () => {
    const { t, formatCurrency } = useTranslation();
    const [favorites, setFavorites] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    
    // UI State for Removal
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const fetchFavorites = useCallback(async () => {
        setLoading(true);
        try {
            const res = await db.getFavorites(page, CONFIG.PAGE_SIZE);
            setFavorites(res.data || []);
            setTotalPages(res.totalPages);
            setTotalCount(res.total || 0); 
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    // Handle unfavorite with animation (Used for both Toggle Heart AND Delete Action)
    const performRemoval = useCallback(async (id: string) => {
        // 1. Mark as removed to trigger animation
        setRemovedIds(prev => new Set(prev).add(id));
        
        // 2. Wait for animation then update state and DB
        setTimeout(async () => {
            try {
                await db.removeFromFavorites(id);
                // Optimistic Update
                setFavorites(prev => {
                    const updated = (prev || []).filter(l => l.id !== id);
                    if (updated.length === 0 && page > 1) {
                        setPage(p => p - 1);
                    }
                    return updated;
                });
                setRemovedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setTotalCount(prev => prev - 1);
            } catch (e) {
                console.error("Failed to remove favorite", e);
                // Revert animation state if failed (optional, depending on UX pref)
                setRemovedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        }, 300); // 300ms matches animation duration
    }, []);

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await performRemoval(itemToDelete);
            setItemToDelete(null);
        }
    };

    const handleNavigate = (id: string) => {
        window.location.hash = `#/${ROUTES.LISTING}/${id}`;
    };

    return (
        <div className="h-full flex flex-col pb-20 animate-enter relative">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm p-6 mb-6">
                <h1 className="text-2xl font-bold text-slate-800">{t('favorites.title')}</h1>
                <p className="text-sm text-slate-500">{t('favorites.subtitle')} ({totalCount})</p>
            </div>

            <div className="flex-1 overflow-auto px-6 no-scrollbar">
                {loading && favorites.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1,2,3,4].map(i => <div key={i} className="h-[400px] bg-slate-100 rounded-[24px] animate-pulse"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {favorites.map(item => (
                            <div 
                                key={item.id} 
                                className={`min-h-full transition-all duration-300 ${removedIds.has(item.id) ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
                            >
                                <ListingCard 
                                    item={item} 
                                    t={t} 
                                    formatCurrency={formatCurrency}
                                    onToggleFavorite={performRemoval} // Heart click is instant
                                    onEdit={() => {}}
                                    onDelete={() => setItemToDelete(item.id)} // Trash click asks for confirmation
                                    onClick={() => handleNavigate(item.id)}
                                    showActions={false}
                                />
                            </div>
                        ))}
                        {favorites.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                                <div className="text-6xl mb-4 opacity-20">❤️</div>
                                <p className="text-slate-400 italic mb-6">{t('favorites.empty')}</p>
                                <button 
                                    onClick={() => window.location.hash = `#/${ROUTES.INVENTORY}`}
                                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors"
                                >
                                    {t('favorites.btn_browse')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                {totalPages > 1 && favorites.length > 0 && (
                    <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('common.prev') || 'Trước'}
                        </button>
                        <span className="text-sm font-bold text-slate-500">
                            {page} / {totalPages}
                        </span>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('common.next') || 'Sau'}
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
