
import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Listing, PropertyType, TransactionType, ListingStatus } from '../types';
import { db } from '../services/dbApi';
import { NO_IMAGE_URL } from '../utils/constants';
import { copyToClipboard } from '../utils/clipboard';
import { ROUTES } from '../config/routes';
import { formatSmartPrice, formatUnitPrice } from '../utils/textUtils';

// Encapsulated Icons
export const LISTING_ICONS = {
    HEART_FILLED: <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3.25 7.688 3.25c1.544 0 3.04.99 3.812 2.55.242.49.878.49 1.12 0C13.272 4.24 14.768 3.25 16.312 3.25c2.974 0 5.438 2.072 5.438 5.002 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>,
    HEART_OUTLINE: <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
    VERIFIED: <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>,
    VIEW: <svg className="w-3.5 h-3.5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    BUILDING: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 01 1v5m-4 0h4" /></svg>,
    KEY: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    USER: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    ACTION: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>,
    CHEVRON_LEFT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    CHEVRON_RIGHT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    IMAGE_PLACEHOLDER: <svg className="w-10 h-10 text-[var(--text-secondary)] dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    COPY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    DUPLICATE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 00-2-2v-2" /></svg>,
    LOCATION: <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    FIRE: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
    EYE: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
};


const ImageCarousel = memo(({ images, title, isVerified, isFavorite, onToggleFavorite, t, bookingCount, viewCount, onClick, type, transaction }: { images?: string[], title: string, isVerified: boolean, isFavorite: boolean, onToggleFavorite: (e: React.MouseEvent) => void, t: any, bookingCount?: number, viewCount?: number, onClick?: () => void, type: PropertyType, transaction?: TransactionType }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imgError, setImgError] = useState(false);
    const hasImages = images && images.length > 0 && !imgError;

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!images?.length) return;
        setImgError(false);
        setCurrentIndex((prev) => (prev + 1) % images!.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!images?.length) return;
        setImgError(false);
        setCurrentIndex((prev) => (prev - 1 + images!.length) % images!.length);
    };

    const isHot = (bookingCount || 0) > 100;
    const isRent = transaction === 'RENT';

    return (
        <div className="relative aspect-[4/3] w-full bg-[var(--glass-surface-hover)] dark:bg-slate-800 group overflow-hidden cursor-pointer isolate z-0" onClick={onClick}>
            {/* Status Badges - Z-index elevated */}
            <div className="absolute top-3 left-3 z-30 flex flex-col gap-1.5 items-start pointer-events-none">
                <div className="flex gap-1.5">
                    {/* Transaction Type Badge - FIX for Ambiguous Status */}
                    <div className={`flex items-center gap-1.5 text-xs2 font-bold px-2 py-1 rounded-lg shadow-sm backdrop-blur-sm border border-white/20 uppercase tracking-wide text-white ${isRent ? 'bg-purple-600/90' : 'bg-blue-600/90'}`}>
                        {isRent ? t('transaction.RENT') : t('transaction.SALE')}
                    </div>

                    {isVerified && (
                        <div className="flex items-center gap-1.5 bg-emerald-600/95 text-white text-xs2 font-bold px-2 py-1 rounded-lg shadow-sm backdrop-blur-sm border border-white/20">
                            {LISTING_ICONS.VERIFIED}
                            <span className="uppercase tracking-wide">{t('inventory.verified')}</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-1.5">
                    {bookingCount !== undefined && bookingCount > 0 && (
                        <div className={`flex items-center gap-1.5 text-white text-xs2 font-bold px-2 py-1 rounded-lg shadow-sm backdrop-blur-sm border border-white/20 ${isHot ? 'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse' : 'bg-slate-900/80'}`}>
                            {isHot ? LISTING_ICONS.FIRE : LISTING_ICONS.USER}
                            <span>{bookingCount}</span>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 bg-black/60 text-white text-xs2 font-bold px-2 py-1 rounded-lg shadow-sm backdrop-blur-sm border border-white/10">
                        {LISTING_ICONS.EYE}
                        <span>{viewCount || 0}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onToggleFavorite}
                className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-all active:scale-95 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={isFavorite ? t('favorites.remove') : t('favorites.add')}
                aria-pressed={isFavorite}
            >
                {isFavorite ? LISTING_ICONS.HEART_FILLED : LISTING_ICONS.HEART_OUTLINE}
            </button>

            {hasImages ? (
                <>
                    <img
                        src={images![currentIndex]}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        onError={() => setImgError(true)}
                    />
                    {images!.length > 1 && (
                        <>
                            <div className="absolute inset-0 flex items-center justify-between p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                <button onClick={prevImage} aria-label={t('common.prev')} className="p-2.5 rounded-full bg-[var(--bg-surface)]/90 shadow-md text-[var(--text-primary)] hover:bg-[var(--bg-surface)] pointer-events-auto transition-transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{LISTING_ICONS.CHEVRON_LEFT}</button>
                                <button onClick={nextImage} aria-label={t('common.next')} className="p-2.5 rounded-full bg-[var(--bg-surface)]/90 shadow-md text-[var(--text-primary)] hover:bg-[var(--bg-surface)] pointer-events-auto transition-transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{LISTING_ICONS.CHEVRON_RIGHT}</button>
                            </div>
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                                {images!.map((_, idx) => (
                                    <div key={idx} className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-[var(--bg-surface)]' : 'w-1.5 bg-[var(--bg-surface)]/50'}`} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <img
                    src={NO_IMAGE_URL}
                    alt={title}
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                />
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none z-10"></div>
        </div>
    );
});

export const ListingActionMenu = memo(({ listing, onEdit, onDelete, onCopy, onDuplicate, t }: { listing: Listing, onEdit: () => void, onDelete: () => void, onCopy?: (code: string) => void, onDuplicate: () => void, t: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) {
            setIsOpen(false);
        } else if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 5 + window.scrollY,
                left: Math.min(rect.right - 150 + window.scrollX, window.innerWidth - 160)
            });
            setIsOpen(true);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const close = () => setIsOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('click', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('click', close);
        };
    }, [isOpen]);

    const handleCopyCode = async () => {
        if (onCopy) {
            const success = await copyToClipboard(listing.code);
            if (success) onCopy(listing.code);
        }
        setIsOpen(false);
    };

    return (
        <>
            <button ref={buttonRef} onClick={toggleMenu} className={`p-2 rounded-xl transition-colors z-20 relative ${isOpen ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}>{LISTING_ICONS.ACTION}</button>
            {isOpen && createPortal(
                <div 
                    className="fixed z-[9999] w-48 bg-[var(--bg-surface)] dark:bg-slate-900 rounded-xl shadow-2xl border border-[var(--glass-border)] dark:border-white/10 overflow-hidden animate-enter origin-top-right"
                    style={{ top: coords.top, left: coords.left }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 hover:bg-[var(--glass-surface)] dark:hover:bg-slate-800 flex items-center gap-2">{LISTING_ICONS.EDIT} {t('inventory.action_edit')}</button>
                    {onCopy && <button onClick={(e) => { e.stopPropagation(); handleCopyCode(); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 hover:bg-[var(--glass-surface)] dark:hover:bg-slate-800 flex items-center gap-2">{LISTING_ICONS.COPY} {t('inventory.action_copy_code')}</button>}
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDuplicate(); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 hover:bg-[var(--glass-surface)] dark:hover:bg-slate-800 flex items-center gap-2">{LISTING_ICONS.DUPLICATE} {t('common.duplicate')}</button>
                    <div className="h-px bg-[var(--glass-surface)] dark:bg-slate-800 my-1"></div>
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDelete(); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2">{LISTING_ICONS.TRASH} {t('inventory.action_delete')}</button>
                </div>,
                document.body
            )}
        </>
    );
});

interface ListingCardProps {
    item: Listing;
    t: any;
    formatCurrency: (n: number) => string;
    onToggleFavorite: (id: string) => void;
    onEdit: (item: Listing) => void;
    onDelete: (id: string) => void;
    onCopy?: (code: string) => void;
    onDuplicate?: (id: string) => void;
    onClick?: () => void;
    showActions?: boolean;
}

export const ListingCard = memo(({ item, t, formatCurrency, onToggleFavorite, onEdit, onDelete, onCopy, onDuplicate, onClick, showActions }: ListingCardProps) => {
    // 1. Guard Clause: Essential for crash prevention if data is malformed
    if (!item) return null;

    const viewCount = item.viewCount || 0;
    const isProject = item.type === PropertyType.PROJECT;

    const handleCardClick = useCallback(() => {
        if (onClick) {
            onClick();
        }
    }, [item.id, onClick]);

    const attributeGrid = useMemo(() => {
        if (!item) return null;
        
        const GridItem = ({ label, value }: { label: string, value: string | number }) => (
            <div className="text-center overflow-hidden">
                <div className="text-2xs font-bold text-[var(--text-secondary)] uppercase truncate" title={label}>{label}</div>
                <div className="text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 truncate mt-0.5" title={String(value)}>{value}</div>
            </div>
        );

        const wrapperClass = "grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-50 dark:border-white/5 mb-2";
        const attrs = item.attributes || {}; 

        if (item.type === PropertyType.PROJECT) {
            return (
                <div className={wrapperClass}>
                    <GridItem label={t('inventory.label_developer')} value={attrs.developer || '--'} />
                    <GridItem label={t('inventory.label_total_units')} value={item.totalUnits || (attrs.totalUnits as string) || '--'} />
                    <GridItem label={t('inventory.label_handover')} value={attrs.handoverYear || '--'} />
                </div>
            );
        } else if (item.type === PropertyType.LAND || item.type === PropertyType.FACTORY) {
             return (
                <div className={wrapperClass}>
                    <GridItem label={t('pub.area')} value={`${item.area || 0} m²`} />
                    <GridItem label={t('inventory.label_frontage')} value={attrs.frontage ? `${attrs.frontage as number}m` : '--'} />
                    <GridItem label={t('inventory.label_land_type')} value={(attrs.landType as string) || '--'} />
                </div>
            );
        } else {
             return (
                <div className={wrapperClass}>
                    <GridItem label={t('pub.area')} value={`${item.area || 0} m²`} />
                    <GridItem label={t('pub.bedrooms')} value={item.bedrooms || '-'} />
                    <GridItem label={t('pub.direction')} value={attrs.direction ? t(`direction.${attrs.direction}`) : '-'} />
                </div>
            );
        }
    }, [item, t]);

    if (!item) return null;

    const shouldShowActions = showActions !== undefined ? showActions : !onClick;
    const attrs = item.attributes || {};

    return (
        <div 
            onClick={handleCardClick}
            className="bg-[var(--bg-surface)] dark:bg-slate-900 rounded-[24px] shadow-sm group h-full relative overflow-hidden transform-gpu will-change-transform transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(79,70,229,0.15)] dark:hover:shadow-[0_12px_30px_-10px_rgba(79,70,229,0.1)] border border-[var(--glass-border)] dark:border-white/10 hover:border-indigo-500/40 dark:hover:border-indigo-400/40 isolate cursor-pointer flex flex-col"
            style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
        >
            <div className="shrink-0">
                <ImageCarousel 
                    images={item.images} 
                    title={item.title} 
                    isVerified={item.isVerified && !isProject} 
                    isFavorite={item.isFavorite}
                    bookingCount={item.bookingCount}
                    viewCount={viewCount}
                    onToggleFavorite={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                    t={t}
                    type={item.type}
                    transaction={item.transaction}
                    onClick={handleCardClick}
                />
            </div>

            <div className="p-4 flex flex-col flex-1 bg-[var(--bg-surface)] dark:bg-slate-900 relative z-10 min-h-0">
                <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2 mb-1">
                            {!isProject && (
                                <span className="font-mono text-2xs font-bold bg-[var(--glass-surface-hover)] dark:bg-slate-800 text-[var(--text-secondary)] dark:text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{item.code}</span>
                            )}
                            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${item.status === 'AVAILABLE' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-[var(--glass-surface-hover)] dark:bg-slate-800 text-[var(--text-tertiary)] dark:text-slate-400'}`}>
                                {item.status === 'AVAILABLE' && item.transaction === 'RENT' ? t('status.READY') : t(`status.${item.status}`)}
                            </span>
                        </div>
                        <h3 className="font-bold text-[var(--text-primary)] dark:text-slate-200 text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={item.title}>
                            {item.title}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-1 text-xs3 text-[var(--text-tertiary)] dark:text-slate-400 mb-3 truncate">
                    {LISTING_ICONS.LOCATION}
                    <span className="truncate">{item.location}</span>
                </div>

                {attributeGrid}

                <div className="flex justify-between items-center mt-auto pt-1 gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="text-2xs font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                            {isProject ? t('inventory.min_price') : t('inventory.label_price')}
                        </div>
                        <div className="text-lg font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight leading-none">
                            {formatSmartPrice(item.price, t)}
                        </div>
                        {item.area > 0 && item.type !== PropertyType.PROJECT && (
                            <div className="text-xs2 font-medium text-[var(--text-tertiary)] dark:text-slate-400 mt-0.5">
                                {formatUnitPrice(item.price, item.area, t)}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        {attrs.legalStatus && (
                            <div className="flex flex-col items-end">
                                <span className="text-2xs font-bold text-[var(--text-secondary)] uppercase">{t('inventory.label_legal')}</span>
                                <span className="text-2xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded uppercase tracking-wide truncate max-w-[80px]">
                                    {t(`legal.${attrs.legalStatus}`) || (attrs.legalStatus as string)}
                                </span>
                            </div>
                        )}
                        {shouldShowActions && (
                            <>
                                {attrs.legalStatus && <div className="w-px h-6 bg-[var(--glass-surface-hover)] dark:bg-white/10 mx-1"></div>}
                                <ListingActionMenu 
                                    listing={item}
                                    onEdit={() => onEdit(item)}
                                    onDelete={() => onDelete(item.id)}
                                    onCopy={onCopy}
                                    onDuplicate={() => onDuplicate && onDuplicate(item.id)}
                                    t={t}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
