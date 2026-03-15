
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { Lead, Listing, ListingStatus, ProposalStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { smartMatch } from '../utils/textUtils';
import { copyToClipboard } from '../utils/clipboard';
import { Dropdown, DropdownOption } from './Dropdown';

interface FlashProposalModalProps {
    lead: Lead;
    listings: Listing[];
    onClose: () => void;
    onSuccess: () => void;
}

// -----------------------------------------------------------------------------
// 1. CONFIGURATION & ASSETS
// -----------------------------------------------------------------------------

const DEAL_CONFIG = {
    DEFAULT_DEPOSIT: 50000000,
    VALIDITY_OPTIONS: [1, 3, 7, 15, 30],
    HIGH_DISCOUNT_THRESHOLD: 10,
    SEARCH_LIMIT: 20,
    DEBOUNCE_MS: 300,
    LATENCY_SIM: 800
} as const;

const ICONS = {
    CLOSE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    SEARCH: <svg className="w-5 h-5 absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    CLEAR: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    WARNING: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    REFRESH: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    ALERT: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    PENDING: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SUCCESS: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    COPY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
};

// -----------------------------------------------------------------------------
// 2. HOOKS
// -----------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// -----------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const FlashProposalModal: React.FC<FlashProposalModalProps> = memo(({ lead, listings, onClose, onSuccess }) => {
    // UI Flow State
    const [step, setStep] = useState<'SELECT' | 'CONFIRM' | 'DONE' | 'PENDING'>('SELECT');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Data State
    const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
    const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
    const [discountValue, setDiscountValue] = useState<number>(0);
    const [validityDays, setValidityDays] = useState<number>(3); 
    const [depositAmount, setDepositAmount] = useState<number>(DEAL_CONFIG.DEFAULT_DEPOSIT);
    const [note, setNote] = useState<string>('');
    const [generatedLink, setGeneratedLink] = useState('');
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, DEAL_CONFIG.DEBOUNCE_MS); 
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const { t, formatCurrency, formatDate } = useTranslation();

    // Reset config on listing selection
    useEffect(() => {
        if (selectedListing) {
            setDiscountValue(0); 
            setDepositAmount(DEAL_CONFIG.DEFAULT_DEPOSIT);
            setNote('');
            setError(null);
        }
    }, [selectedListing]);

    // Auto-focus search
    useEffect(() => {
        if (step === 'SELECT') {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [step]);

    // Filter Listings
    const availableListings = useMemo(() => {
        return listings.filter(l => 
            l.status === ListingStatus.AVAILABLE && 
            smartMatch(l.title + l.code + l.location, debouncedSearch)
        ).slice(0, DEAL_CONFIG.SEARCH_LIMIT); 
    }, [listings, debouncedSearch]);

    // Financial Math
    const finalCalculations = useMemo(() => {
        if (!selectedListing) return { discountAmt: 0, finalPrice: 0 };
        
        let discountAmt = 0;
        if (discountType === 'PERCENT') {
            const pct = Math.min(Math.max(0, discountValue), 100);
            discountAmt = selectedListing.price * (pct / 100);
        } else {
            discountAmt = Math.min(Math.max(0, discountValue), selectedListing.price);
        }

        return {
            discountAmt,
            finalPrice: Math.max(0, selectedListing.price - discountAmt)
        };
    }, [selectedListing, discountType, discountValue]);

    // Expiry Date Calc
    const expiryDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + validityDays);
        return formatDate(d.toISOString());
    }, [validityDays, formatDate]);

    // Action Handlers
    const handleCreate = async () => {
        if (!selectedListing) return;
        setProcessing(true);
        setError(null);
        
        try {
            const proposal = await db.createProposal({
                leadId: lead.id,
                listingId: selectedListing.id,
                basePrice: selectedListing.price,
                discountAmount: finalCalculations.discountAmt,
                finalPrice: finalCalculations.finalPrice,
                validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
                metadata: {
                    depositRequired: depositAmount,
                    validityDays: validityDays,
                    note: note || `Created via Flash Proposal`
                }
            });
            
            await new Promise(r => setTimeout(r, DEAL_CONFIG.LATENCY_SIM));

            if (proposal.status === ProposalStatus.PENDING_APPROVAL) {
                setStep('PENDING');
            } else {
                // Correctly link to HashRouter format
                setGeneratedLink(`${window.location.origin}/#/p/${proposal.token}`);
                setStep('DONE');
            }
        } catch (e: any) { 
            setError(e.message || t('proposal.error_create'));
        } finally { 
            setProcessing(false); 
        }
    };

    const handleCopy = async () => {
        const text = t('proposal.generated_msg', { name: lead.name, link: generatedLink });
        await copyToClipboard(text);
        onSuccess(); // Triggers data refresh in parent
    };

    // Render Steps
    const renderSelectionStep = () => (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-white shrink-0">
                <div className="relative group">
                    <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        {ICONS.SEARCH}
                    </div>
                    <input 
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                        placeholder={t('inventory.search_hint')}
                    />
                    {searchQuery && (
                        <div className="absolute right-2 inset-y-0 flex items-center">
                            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center" title={t('common.clear_search') || 'Xóa tìm kiếm'}>
                                {ICONS.CLEAR}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {availableListings.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 italic">{t('inventory.empty')}</div>
                ) : (
                    availableListings.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => { setSelectedListing(item); setStep('CONFIRM'); }} 
                            className="bg-white p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-indigo-500 hover:shadow-lg hover:scale-[1.01] transition-all group relative overflow-hidden active:scale-95"
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{item.code}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">{t(`status.${item.status}`)}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors line-clamp-1">{item.title}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.location}</p>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <div className="text-base md:text-lg font-extrabold text-slate-900">{formatCurrency(item.price)}</div>
                                    <div className="text-[10px] text-slate-400">{item.area}m² • {item.bedrooms} {t('pub.bedrooms')}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderConfirmStep = () => {
        if (!selectedListing) return null;
        return (
            <div className="flex flex-col h-full animate-slide-in-right overflow-hidden">
                <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto no-scrollbar">
                    
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-bold flex items-center gap-2">
                            {ICONS.WARNING}
                            {error}
                        </div>
                    )}

                    {/* Listing Preview */}
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex gap-4 items-start">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-200 rounded-xl flex-shrink-0 overflow-hidden">
                            <img src={`https://ui-avatars.com/api/?name=${selectedListing.code}&background=random`} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-800 text-sm md:text-base line-clamp-2">{selectedListing.title}</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{selectedListing.area} m²</span>
                                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{selectedListing.bedrooms} {t('pub.bedrooms')}</span>
                                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{selectedListing.attributes.direction ? t(`direction.${selectedListing.attributes.direction}`) : '---'}</span>
                            </div>
                            <button onClick={() => setStep('SELECT')} className="text-[10px] font-bold text-indigo-600 hover:underline mt-2 flex items-center gap-1">
                                {ICONS.REFRESH}
                                {t('proposal.change_property')}
                            </button>
                        </div>
                    </div>

                    {/* Configuration */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('proposal.config_price')}</h4>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                {(['PERCENT', 'AMOUNT'] as const).map(type => (
                                    <button 
                                        key={type}
                                        onClick={() => setDiscountType(type)} 
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${discountType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        {type === 'PERCENT' ? '%' : '$'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input 
                                        type="number"
                                        min="0"
                                        value={discountValue}
                                        onChange={e => setDiscountValue(Number(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                                        {discountType === 'PERCENT' ? '%' : 'VND'}
                                    </div>
                                </div>
                                {discountType === 'PERCENT' && (
                                    <input 
                                        type="range" 
                                        min="0" max="15" step="0.5" 
                                        value={discountValue} 
                                        onChange={e => setDiscountValue(Number(e.target.value))} 
                                        className="w-24 accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer hidden sm:block"
                                    />
                                )}
                            </div>
                            {discountType === 'PERCENT' && discountValue > DEAL_CONFIG.HIGH_DISCOUNT_THRESHOLD && (
                                <div className="text-[10px] text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                                    {ICONS.ALERT}
                                    {t('approvals.reason_deep_discount')}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Dropdown
                                    label={t('proposal.label_validity')}
                                    value={validityDays}
                                    onChange={(val) => setValidityDays(Number(val))}
                                    options={DEAL_CONFIG.VALIDITY_OPTIONS.map(day => ({
                                        value: day,
                                        label: `${day} ${t('billing.days')}`
                                    }))}
                                    className="w-full"
                                />
                                <p className="text-[10px] text-indigo-500 font-bold mt-1 text-right">
                                    → {expiryDate}
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t('proposal.label_deposit')}</label>
                                <input 
                                    type="number"
                                    value={depositAmount}
                                    onChange={e => setDepositAmount(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{t('proposal.label_note')}</label>
                            <textarea 
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder={t('proposal.placeholder_note')}
                                rows={2}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 resize-none"
                            />
                        </div>

                        {/* Breakdown */}
                        <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200/60">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">{t('proposal.price_original')}</span>
                                <span className="font-mono text-slate-600 line-through decoration-slate-400">{formatCurrency(selectedListing.price)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">{t('proposal.amount_discount')}</span>
                                <span className="font-mono text-rose-500 font-bold">-{formatCurrency(finalCalculations.discountAmt)}</span>
                            </div>
                            <div className="border-t border-slate-200 my-2"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-slate-800 text-sm">{t('proposal.price_final')}</span>
                                <span className="text-xl md:text-2xl font-extrabold text-emerald-600 tracking-tight bg-white px-2 rounded shadow-sm border border-emerald-100">
                                    {formatCurrency(finalCalculations.finalPrice)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 shrink-0 safe-area-pb">
                    <button 
                        onClick={handleCreate} 
                        disabled={processing} 
                        className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {processing ? t('proposal.btn_processing') : t('proposal.btn_create')}
                    </button>
                </div>
            </div>
        );
    };

    // Use React Portal to render at document.body to avoid z-index stacking context issues with parent transforms
    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" aria-hidden="true" />
            
            {/* Modal Content */}
            <div className="bg-white w-full max-w-2xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl shadow-slate-900/20 border border-white/20 relative flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-scale-up z-10" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">{t('proposal.flash_title')}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold max-w-[120px] truncate">{lead.name}</span>
                            <span>•</span>
                            <span className="font-mono">{lead.phone}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50 min-h-0">
                    {step === 'SELECT' && renderSelectionStep()}
                    
                    {step === 'CONFIRM' && renderConfirmStep()}

                    {step === 'PENDING' && (
                        <div className="flex flex-col items-center justify-center p-12 text-center animate-enter h-full">
                            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4">
                                {ICONS.PENDING}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">{t('approvals.pending_title')}</h3>
                            <p className="text-slate-500 mt-2 mb-6 text-sm max-w-xs">{t('approvals.subtitle')}</p>
                            <button onClick={() => { onClose(); onSuccess(); }} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">{t('common.close')}</button>
                        </div>
                    )}

                    {step === 'DONE' && (
                        <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center animate-enter h-full overflow-y-auto no-scrollbar">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-sm shrink-0">
                                {ICONS.SUCCESS}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">{t('common.success')}</h3>
                            
                            <div className="w-full bg-slate-50 p-4 rounded-xl mt-6 border border-slate-200 relative group">
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 text-left">{t('proposal.public_link_label')}</div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        readOnly 
                                        value={generatedLink} 
                                        className="font-mono text-xs text-indigo-600 bg-transparent outline-none w-full truncate"
                                        onClick={(e) => e.currentTarget.select()}
                                    />
                                </div>
                            </div>

                            <button onClick={handleCopy} className="mt-6 w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                {ICONS.COPY}
                                {t('proposal.btn_copy_close')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
});
