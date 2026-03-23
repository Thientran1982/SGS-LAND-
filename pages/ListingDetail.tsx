
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NO_IMAGE_URL } from '../utils/constants';
import { db } from '../services/dbApi';
import { Listing, PropertyType, ListingStatus, TransactionType, LeadStage, User, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { normalizeForSearch, formatUnitPrice } from '../utils/textUtils';
import { ListingCard } from '../components/ListingCard';
import { BookingModal } from '../components/BookingModal';
import { Lightbox } from '../components/Lightbox';
import { ROUTES } from '../config/routes';
import { aiService } from '../services/aiService';
import MapView from '../components/MapView';
import { copyToClipboard } from '../utils/clipboard';
import { ListingForm } from '../components/ListingForm';
import { ConfirmModal } from '../components/ConfirmModal';
import { Lock, Plus, Edit2, Trash2, Download, Upload, Sparkles, MoreVertical } from 'lucide-react';
import * as XLSX from 'xlsx';

// Icons with pointer-events-none to prevent click hijacking
const ICONS = {
    BACK: <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    LOCATION: <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    PHONE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    CALENDAR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    SHARE: <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    COPY: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    CHECK: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    CLOSE: <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CALC: <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.659c0 3.074-1.8 5.529-4.29 6.226 1.01.83 1.87 1.96 2.42 3.26M9 15.409C10.45 14.83 11.4 13.513 11.4 12c0-1.572-1.201-2.849-2.73-2.951" /></svg>,
    CHART: <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    GRID: <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2v-2a2 2 0 01-2 2H6a2 2 0 01-2-2v2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
};

const PLACEHOLDER_IMG = "https://placehold.co/800x600?text=No+Image";

// Helper
const normalizeAddress = (addr: string) => {
    return addr.replace(/,\s*Việt Nam$/, '');
};

const ShareModal = ({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t: any }) => {
    const [copied, setCopied] = useState(false);
    const [url, setUrl] = useState('');

    // Capture URL exactly when modal opens to ensure accuracy
    useEffect(() => {
        if (isOpen) setUrl(window.location.href);
    }, [isOpen]);

    const handleCopy = async () => {
        await copyToClipboard(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('common.share_link')}</h3>
                    <button onClick={onClose} className="p-2 bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors">
                        {ICONS.CLOSE}
                    </button>
                </div>
                
                <p className="text-sm text-[var(--text-tertiary)] mb-4 leading-relaxed">
                    {t('common.share_desc')}
                </p>

                <div className="bg-[var(--glass-surface)] p-3 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 mb-4 group focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <input 
                        readOnly 
                        value={url} 
                        className="bg-transparent text-sm text-[var(--text-secondary)] flex-1 outline-none font-mono truncate select-all"
                        onClick={(e) => e.currentTarget.select()} // Auto-select on click
                    />
                </div>

                <button 
                    onClick={handleCopy} 
                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                    {copied ? ICONS.CHECK : ICONS.COPY}
                    {copied ? t('common.copied') : t('common.copy_link')}
                </button>
            </div>
        </div>,
        document.body
    );
};

// --- Financial Calculator Component ---
const FinancialSuite = memo(({ price, formatCurrency, t }: { price: number, formatCurrency: (val: number) => string, t: any }) => {
    const [mode, setMode] = useState<'LOAN' | 'RENT'>('LOAN');
    
    // Loan State
    const [ratio, setRatio] = useState(70);
    const [term, setTerm] = useState(20);
    const [rate, setRate] = useState(8.5);

    // Rent State
    // Default rental yield approx 0.4% per month of property value
    const [monthlyRent, setMonthlyRent] = useState(Math.round((price * 0.004) / 100000) * 100000);
    const [occupancy, setOccupancy] = useState(90);

    // Loan Calculations
    const loanAmount = price * (ratio / 100);
    const downPayment = price - loanAmount;
    const monthlyRate = rate / 100 / 12;
    const totalMonths = term * 12;
    // Standard amortization formula (guard: 0% rate → divide evenly; term=0 → 0)
    const monthlyPayment = loanAmount > 0 && term > 0
        ? (monthlyRate === 0
            ? loanAmount / totalMonths
            : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalMonths)))
        : 0;
    const totalPayment = monthlyPayment * totalMonths;
    const totalInterest = totalPayment - loanAmount;

    // Rent Calculations
    const annualRevenue = monthlyRent * 12 * (occupancy / 100);
    const grossYield = price > 0 ? (annualRevenue / price) * 100 : 0;

    return (
        <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden h-full">
            <div className="flex border-b border-[var(--glass-border)]">
                <button 
                    onClick={() => setMode('LOAN')} 
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'LOAN' ? 'text-indigo-600 bg-indigo-50/50' : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-surface)]'}`}
                >
                    {ICONS.CALC} {t('calc.loan')}
                </button>
                <div className="w-px bg-[var(--glass-surface-hover)]"></div>
                <button 
                    onClick={() => setMode('RENT')} 
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'RENT' ? 'text-emerald-600 bg-emerald-50/50' : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-surface)]'}`}
                >
                    {ICONS.CHART} {t('calc.rent')}
                </button>
            </div>

            <div className="p-6">
                {mode === 'LOAN' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-enter">
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('calc.loan_ratio')}</label>
                                    <span className="text-sm font-bold text-indigo-600">{ratio}%</span>
                                </div>
                                <input type="range" min="0" max="90" step="5" value={ratio} onChange={e => setRatio(Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-[var(--glass-surface-hover)] rounded-lg appearance-none cursor-pointer" />
                                <div className="flex justify-between text-xs2 text-[var(--text-secondary)] mt-1">
                                    <span>0%</span>
                                    <span>{t('calc.own_capital')}: {formatCurrency(downPayment)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('calc.term_years')}</label>
                                    <input type="number" min="1" max="50" value={term} onChange={e => setTerm(Math.max(1, Number(e.target.value)))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-secondary)] outline-none focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('calc.interest_rate')}</label>
                                    <input type="number" min="0" max="50" step="0.1" value={rate} onChange={e => setRate(Math.max(0, Number(e.target.value)))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-secondary)] outline-none focus:border-indigo-500" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex flex-col justify-center min-w-0">
                            <div className="text-xs text-indigo-500 font-bold uppercase tracking-wider mb-1 truncate">{t('calc.monthly_payment')}</div>
                            <div className="text-2xl md:text-3xl font-black text-indigo-900 mb-4 break-words">{formatCurrency(monthlyPayment)}</div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center gap-2 flex-wrap">
                                    <span className="text-indigo-400 truncate">{t('calc.total_principal')}</span>
                                    <span className="font-bold text-indigo-800 break-all">{formatCurrency(loanAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 flex-wrap">
                                    <span className="text-indigo-400 truncate">{t('calc.total_interest')}</span>
                                    <span className="font-bold text-indigo-800 break-all">{formatCurrency(totalInterest)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-enter">
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('calc.expected_rent')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={monthlyRent}
                                    onChange={e => setMonthlyRent(Math.max(0, Number(e.target.value)))}
                                    className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-secondary)] outline-none focus:border-emerald-500"
                                />
                                <div className="text-xs2 text-[var(--text-secondary)] mt-1 text-right">{formatCurrency(monthlyRent)}</div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('calc.occupancy_rate')}</label>
                                    <span className="text-sm font-bold text-emerald-600">{occupancy}%</span>
                                </div>
                                <input type="range" min="50" max="100" step="5" value={occupancy} onChange={e => setOccupancy(Number(e.target.value))} className="w-full accent-emerald-600 h-2 bg-[var(--glass-surface-hover)] rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col justify-center min-w-0">
                            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1 truncate">{t('calc.gross_yield')}</div>
                            <div className="text-2xl md:text-3xl font-black text-emerald-900 mb-4 break-words">{grossYield.toFixed(2)}%<span className="text-base font-medium text-emerald-600 ml-1">{t('calc.per_year')}</span></div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center gap-2 flex-wrap">
                                    <span className="text-emerald-500 truncate">{t('calc.annual_cashflow')}</span>
                                    <span className="font-bold text-emerald-800 break-all">{formatCurrency(annualRevenue)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 flex-wrap">
                                    <span className="text-emerald-500 truncate">{t('calc.payback_period')}</span>
                                    <span className="font-bold text-emerald-800 whitespace-nowrap">{annualRevenue > 0 ? (price / annualRevenue).toFixed(1) : '---'} {t('calc.years')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const STATUS_CONFIG: Record<string, { color: string, bg: string, border: string }> = {
    BOOKING: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    OPENING: { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    AVAILABLE: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    HOLD: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    SOLD: { color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--glass-surface-hover)]', border: 'border-slate-300' },
    RENTED: { color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    INACTIVE: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
};

// ─── AssigneeDropdown ─────────────────────────────────────────────────────────
// Custom dropdown replacing native <select> for unit assignment.
// Shows avatar + name in trigger; portal panel with full user list.
// ─────────────────────────────────────────────────────────────────────────────
const AssigneeDropdown = memo(({
    value, name, avatar, users, onChange, disabled, t,
}: {
    value: string | null | undefined;
    name?: string;
    avatar?: string;
    users: User[];
    onChange: (userId: string | null) => void;
    disabled: boolean;
    t: (key: string) => string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const avatarUrl = (n: string, a?: string) =>
        a || `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&size=28&background=6366f1&color=fff`;

    const openMenu = () => {
        if (disabled) return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const GAP = 4;
        const MENU_H = 300;
        const MENU_W = 210;
        const spaceBelow = window.innerHeight - rect.bottom - GAP;
        const safeLeft = Math.min(rect.left, window.innerWidth - MENU_W - 8);
        if (spaceBelow < MENU_H && rect.top > MENU_H) {
            setCoords({ bottom: window.innerHeight - rect.top + GAP, left: safeLeft, width: Math.max(rect.width, MENU_W) });
        } else {
            setCoords({ top: rect.bottom + GAP, left: safeLeft, width: Math.max(rect.width, MENU_W) });
        }
        setIsOpen(true);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleOut = (e: MouseEvent) => {
            if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => setIsOpen(false);
        document.addEventListener('mousedown', handleOut);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleOut);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const select = (userId: string | null) => {
        onChange(userId);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-flex">
            {/* Trigger button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => isOpen ? setIsOpen(false) : openMenu()}
                disabled={disabled}
                className={[
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all select-none',
                    disabled
                        ? 'opacity-60 cursor-not-allowed border-[var(--glass-border)] bg-[var(--glass-surface)]'
                        : 'border-[var(--glass-border)] bg-[var(--bg-surface)] hover:border-indigo-300 hover:shadow-sm cursor-pointer',
                    isOpen && !disabled ? 'border-indigo-400 ring-1 ring-indigo-300/50' : '',
                ].join(' ')}
            >
                {/* Avatar / spinner / placeholder */}
                {disabled ? (
                    <svg className="w-3.5 h-3.5 text-[var(--text-secondary)] animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : name ? (
                    <img src={avatarUrl(name, avatar)} alt={name} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                )}
                <span className={`max-w-[96px] truncate ${name ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] italic'}`}>
                    {name || t('inventory.unassigned')}
                </span>
                <svg className={`w-3 h-3 text-[var(--text-tertiary)] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Portal dropdown */}
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[10002] bg-[var(--bg-surface)]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--glass-border)]/50 overflow-y-auto no-scrollbar max-h-[300px] animate-scale-up"
                    style={{
                        ...(coords.bottom !== undefined ? { bottom: coords.bottom } : { top: coords.top }),
                        left: coords.left,
                        width: coords.width,
                        minWidth: '190px',
                        transformOrigin: coords.bottom !== undefined ? 'bottom left' : 'top left',
                    }}
                >
                    {/* Unassign option */}
                    <button
                        type="button"
                        onClick={() => select(null)}
                        className={[
                            'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors border-b border-[var(--glass-border)]/40',
                            !value
                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] hover:text-[var(--text-primary)]',
                        ].join(' ')}
                    >
                        <span className="w-6 h-6 rounded-full bg-[var(--glass-surface-hover)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </span>
                        <span className="flex-1 text-left italic">{t('inventory.unassigned')}</span>
                        {!value && (
                            <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    {/* User list */}
                    {users.map(u => {
                        const isSelected = u.id === value;
                        return (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => select(u.id)}
                                className={[
                                    'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors border-b border-[var(--glass-border)]/20 last:border-0',
                                    isSelected
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] hover:text-[var(--text-primary)]',
                                ].join(' ')}
                            >
                                <img src={avatarUrl(u.name, u.avatar)} alt={u.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                    <div className={`truncate font-medium leading-tight ${isSelected ? 'text-indigo-700' : ''}`}>{u.name}</div>
                                    <div className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5">
                                        {u.role ? t(`role.${u.role}`) : ''}
                                    </div>
                                </div>
                                {isSelected && (
                                    <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
});
AssigneeDropdown.displayName = 'AssigneeDropdown';

// ─────────────────────────────────────────────────────────────────────────────
// UnitActionsMenu — 3-dot kebab menu replacing standalone Edit + Delete buttons
// ─────────────────────────────────────────────────────────────────────────────
const UnitActionsMenu = memo(({
    unit, onEdit, onDelete, t,
}: {
    unit: Listing;
    onEdit: (e: React.MouseEvent, u: Listing) => void;
    onDelete: (e: React.MouseEvent, u: Listing) => void;
    t: (key: string) => string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const MENU_H = 90;
        const MENU_W = 160;
        const GAP = 4;
        const spaceBelow = window.innerHeight - rect.bottom - GAP;
        const left = Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8);
        if (spaceBelow < MENU_H && rect.top > MENU_H) {
            setCoords({ bottom: window.innerHeight - rect.top + GAP, left });
        } else {
            setCoords({ top: rect.bottom + GAP, left });
        }
        setIsOpen(v => !v);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleOut = (e: MouseEvent) => {
            if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => setIsOpen(false);
        document.addEventListener('mousedown', handleOut);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleOut);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-flex">
            <button
                ref={triggerRef}
                type="button"
                onClick={openMenu}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] transition-colors"
                title={t('common.actions') || 'Actions'}
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[10003] bg-[var(--bg-surface)]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--glass-border)]/50 overflow-hidden animate-scale-up"
                    style={{
                        ...(coords.bottom !== undefined ? { bottom: coords.bottom } : { top: coords.top }),
                        left: coords.left,
                        width: '160px',
                        transformOrigin: coords.bottom !== undefined ? 'bottom right' : 'top right',
                    }}
                >
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onEdit(e, unit); setIsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] hover:text-indigo-600 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
                        {t('common.edit')}
                    </button>
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onDelete(e, unit); setIsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                        {t('common.delete')}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
});
UnitActionsMenu.displayName = 'UnitActionsMenu';

const ProjectUnits = memo(({ projectCode, parentLocation, parentContactPhone, t, formatCurrency, formatCompactNumber }: { projectCode: string, parentLocation?: string, parentContactPhone?: string, t: any, formatCurrency: any, formatCompactNumber: any }) => {
    const [units, setUnits] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuth, setIsAuth] = useState(false);
    const [canManageUnits, setCanManageUnits] = useState(false); // ADMIN or TEAM_LEAD
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>('');
    const [tenantUsers, setTenantUsers] = useState<User[]>([]); // For assignee dropdown
    const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null); // Currently saving assignment
    
    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Listing | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState<Listing | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    /** Returns true if the current user can edit or delete this specific unit */
    const canEditUnit = useCallback((unit: Listing): boolean => {
        if (canManageUnits) return true; // ADMIN / TEAM_LEAD always
        if (!currentUserId) return false;
        if (userRole !== 'SALES' && userRole !== 'MARKETING') return false;
        return unit.assignedTo === currentUserId || unit.createdBy === currentUserId;
    }, [canManageUnits, currentUserId, userRole]);

    useEffect(() => {
        const checkAuth = async () => {
            const user = await db.getCurrentUser();
            setIsAuth(!!user);
            const isManager = !!user && (user.role === 'ADMIN' || user.role === 'TEAM_LEAD');
            setCanManageUnits(isManager);
            if (user) {
                setCurrentUserId(user.id);
                setUserRole(user.role || '');
                // Fetch tenant users for the assignee dropdown (only managers need this)
                if (isManager) {
                    try {
                        const users = await db.getUsers();
                        const NON_ASSIGNABLE = ['VIEWER'];
                        setTenantUsers(Array.isArray(users) ? users.filter((u: User) => !NON_ASSIGNABLE.includes(u.role)) : []);
                    } catch (e) {
                        console.error('Failed to load users for assignment', e);
                    }
                }
            }
        };
        checkAuth();
    }, []);

    const fetchUnits = useCallback(async () => {
        setLoading(true);
        try {
            const user = await db.getCurrentUser();
            let data: any[] = [];
            if (user) {
                const res = await db.getListings(1, 500, { projectCode });
                data = res.data || [];
            } else {
                const res = await db.getPublicListings(1, 500, { projectCode });
                data = res.data || [];
            }
            setUnits(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [projectCode]);

    useEffect(() => {
        if (projectCode) fetchUnits();
    }, [projectCode, fetchUnits]);

    const handleAddUnit = () => {
        setEditingUnit(null);
        setIsFormOpen(true);
    };

    const handleEditUnit = (e: React.MouseEvent, unit: Listing) => {
        e.stopPropagation();
        setEditingUnit(unit);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, unit: Listing) => {
        e.stopPropagation();
        setUnitToDelete(unit);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!unitToDelete) return;
        try {
            await db.deleteListing(unitToDelete.id);
            fetchUnits();
            notify(t('common.success'), 'success');
        } catch (e: any) {
            console.error(e);
            notify(e.message || t('common.error'), 'error');
        } finally {
            setDeleteConfirmOpen(false);
            setUnitToDelete(null);
        }
    };

    const handleFormSubmit = async (data: Partial<Listing>) => {
        try {
            // Force projectCode to be the current project
            const submitData = { ...data, projectCode };
            if (editingUnit) {
                await db.updateListing(editingUnit.id, submitData);
            } else {
                await db.createListing(submitData as Omit<Listing, 'id'>);
            }
            fetchUnits();
            setIsFormOpen(false);
            notify(t('common.success'), 'success');
        } catch (e: any) {
            console.error(e);
            notify(e.message || t('common.error'), 'error');
        }
    };

    /** ADMIN/TEAM_LEAD only: assign (or unassign with null) a unit to an internal user */
    const handleAssign = useCallback(async (unitId: string, userId: string | null) => {
        setAssigningUnitId(unitId);
        try {
            await db.assignListing(unitId, userId);
            // Optimistic update: update the local units list
            setUnits(prev => prev.map(u => {
                if (u.id !== unitId) return u;
                const assignedUser: User | undefined = userId ? tenantUsers.find(tu => tu.id === userId) : undefined;
                return {
                    ...u,
                    assignedTo: userId as typeof u.assignedTo,
                    assignedToName: assignedUser?.name,
                    assignedToAvatar: assignedUser?.avatar,
                    assignedToRole: assignedUser?.role,
                };
            }));
            notify(t('inventory.assign_success'), 'success');
        } catch (e: any) {
            console.error(e);
            notify(e.message || t('inventory.assign_error'), 'error');
        } finally {
            setAssigningUnitId(null);
        }
    }, [tenantUsers, t, notify]);

    const handleExportExcel = () => {
        const dataToExport = units.map(unit => ({
            'Mã SP': unit.code,
            'Tiêu đề': unit.title,
            'Loại': t(`property.${unit.type.toUpperCase()}`),
            'Tầng': unit.attributes?.floor || '',
            'Hướng': unit.attributes?.direction ? (t(`direction.${unit.attributes.direction}`) || unit.attributes.direction) : '',
            'Diện tích (m2)': unit.area,
            'Giá': unit.price,
            'Trạng thái': t(`status.${unit.status}`),
            'Vị trí': unit.location
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-size columns
        const colWidths = [
            { wch: 15 }, // Mã SP
            { wch: 30 }, // Tiêu đề
            { wch: 15 }, // Loại
            { wch: 10 }, // Tầng
            { wch: 15 }, // Hướng
            { wch: 15 }, // Diện tích
            { wch: 20 }, // Giá
            { wch: 15 }, // Trạng thái
            { wch: 30 }  // Vị trí
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh_sach_san_pham');
        XLSX.writeFile(wb, `Du_an_${projectCode}_${new Date().getTime()}.xlsx`);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hasDragged, setHasDragged] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!tableContainerRef.current) return;
        setIsDragging(true);
        setHasDragged(false);
        setStartX(e.pageX - tableContainerRef.current.offsetLeft);
        setScrollLeft(tableContainerRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !tableContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - tableContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        if (Math.abs(walk) > 10) {
            setHasDragged(true);
        }
        tableContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const arrayBuffer = evt.target?.result;
                const wb = XLSX.read(arrayBuffer, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Process and create listings
                for (const row of data as any[]) {
                    // Basic mapping, assuming standard columns from export
                    const newListing: Partial<Listing> = {
                        code: row['Mã SP'] || `LST${Date.now().toString().slice(-4)}`,
                        title: row['Tiêu đề'] || 'Sản phẩm mới',
                        type: PropertyType.APARTMENT, // Default fallback
                        area: Number(row['Diện tích (m2)']) || 0,
                        price: Number(row['Giá']) || 0,
                        status: ListingStatus.AVAILABLE,
                        location: row['Vị trí'] || '',
                        projectCode: projectCode,
                        attributes: {
                            floor: row['Tầng'] ? Number(row['Tầng']) : undefined,
                            direction: row['Hướng'] || undefined
                        },
                        currency: 'VND',
                        transaction: TransactionType.SALE
                    };
                    
                    // Try to map type back
                    const typeStr = row['Loại'];
                    if (typeStr) {
                        const matchedType = Object.values(PropertyType).find(tKey => t(`property.${tKey.toUpperCase()}`) === typeStr);
                        if (matchedType) newListing.type = matchedType as PropertyType;
                    }

                    // Try to map status back
                    const statusStr = row['Trạng thái'];
                    if (statusStr) {
                        const matchedStatus = Object.values(ListingStatus).find(sKey => t(`status.${sKey}`) === statusStr);
                        if (matchedStatus) newListing.status = matchedStatus as ListingStatus;
                    }

                    // Try to map direction back
                    const directionStr = row['Hướng'];
                    if (directionStr) {
                        const directionKeys = ['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'];
                        const matchedDirection = directionKeys.find(dKey => t(`direction.${dKey}`) === directionStr);
                        if (matchedDirection && newListing.attributes) {
                            newListing.attributes.direction = matchedDirection;
                        }
                    }

                    await db.createListing(newListing as Omit<Listing, 'id'>);
                }
                
                fetchUnits();
                if (fileInputRef.current) fileInputRef.current.value = '';
                notify(t('inventory.import_success'), 'success');
            } catch (error) {
                console.error("Error importing excel:", error);
                notify(t('inventory.import_error'), 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (loading) return <div className="animate-pulse h-40 bg-[var(--glass-surface-hover)] rounded-[24px] mt-8"></div>;

    if (!isAuth) return null;

    return (
        <>
        <div className="mt-8 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{t('inventory.project_units')}</h3>
                {canManageUnits && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm font-bold rounded-xl hover:bg-[var(--glass-surface)] transition-colors shadow-sm"
                            title={t('inventory.import_excel')}
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('inventory.import_excel')}</span>
                        </button>
                        <button 
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm font-bold rounded-xl hover:bg-[var(--glass-surface)] transition-colors shadow-sm"
                            title={t('inventory.export_excel')}
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('inventory.export_excel')}</span>
                        </button>
                        <button 
                            onClick={handleAddUnit}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('inventory.add_unit')}</span>
                        </button>
                    </div>
                )}
            </div>
            
            <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
                {units.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        </div>
                        <div>
                            <p className="font-bold text-sm text-[var(--text-primary)]">{t('inventory.empty')}</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('inventory.empty_units_hint')}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div 
                            ref={tableContainerRef}
                            className={`hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto no-scrollbar ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead className="bg-[var(--glass-surface)] border-b border-[var(--glass-border)] sticky top-0 z-30">
                                    <tr>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--glass-surface)]">{t('inventory.label_code')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--glass-surface)]">{t('inventory.label_type')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)]">{t('inventory.label_floor')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)]">{t('inventory.label_direction')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)]">{t('inventory.label_area')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)]">{t('inventory.label_unit_price')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)]">{t('inventory.label_price')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--glass-surface)]">{t('inventory.label_assignee')}</th>
                                        <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-center bg-[var(--glass-surface)] sticky z-20 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]" style={{ right: (canManageUnits || userRole === 'SALES' || userRole === 'MARKETING') ? '48px' : '0' }}>{t('inventory.label_status')}</th>
                                        {(canManageUnits || userRole === 'SALES' || userRole === 'MARKETING') && <th className="px-4 py-4 text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right bg-[var(--glass-surface)] sticky right-0 z-20" style={{ width: '48px', minWidth: '48px' }}></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {units.map(unit => {
                                        const statusStyle = STATUS_CONFIG[unit.status] || STATUS_CONFIG.AVAILABLE;
                                        const showActionsCol = canManageUnits || userRole === 'SALES' || userRole === 'MARKETING';
                                        return (
                                            <tr 
                                                key={unit.id} 
                                                className="hover:bg-[var(--glass-surface)] cursor-pointer transition-colors group" 
                                                onClick={(e) => {
                                                    if (hasDragged) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    window.location.hash = `#/${ROUTES.LISTING}/${unit.id}`;
                                                }}
                                            >
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-xs font-bold text-indigo-600 group-hover:text-indigo-700">{unit.code}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] font-medium">{t(`property.${unit.type.toUpperCase()}`)}</td>
                                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] text-right font-mono">{unit.attributes?.floor || '--'}</td>
                                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] text-right font-mono">{unit.attributes?.direction ? (t(`direction.${unit.attributes.direction}`) || unit.attributes.direction) : '--'}</td>
                                                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] text-right font-mono">{unit.area} <span className="text-xs2 text-[var(--text-secondary)]">m²</span></td>
                                                <td className="px-4 py-3 text-xs3 text-[var(--text-tertiary)] text-right font-medium italic">{formatUnitPrice(unit.price, unit.area, t)}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-[var(--text-primary)] text-right">{formatCurrency(unit.price)}</td>
                                                {/* Assignee column */}
                                                <td className="px-4 py-3 min-w-[160px]" onClick={e => e.stopPropagation()}>
                                                    {canManageUnits ? (
                                                        <AssigneeDropdown
                                                            value={unit.assignedTo}
                                                            name={unit.assignedToName}
                                                            avatar={unit.assignedToAvatar}
                                                            users={tenantUsers}
                                                            onChange={userId => handleAssign(unit.id, userId)}
                                                            disabled={assigningUnitId === unit.id}
                                                            t={t}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            {unit.assignedToName ? (
                                                                <>
                                                                    <img
                                                                        src={unit.assignedToAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(unit.assignedToName)}&size=20&background=6366f1&color=fff`}
                                                                        alt={unit.assignedToName}
                                                                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                                                    />
                                                                    <span className="text-xs text-[var(--text-secondary)]">{unit.assignedToName}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-[var(--text-tertiary)] italic">{t('inventory.unassigned')}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center sticky z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--glass-surface)] transition-colors shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]" style={{ right: showActionsCol ? '48px' : '0' }}>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold border uppercase tracking-wider whitespace-nowrap ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                                                        {t(`status.${unit.status}`)}
                                                    </span>
                                                </td>
                                                {showActionsCol && (
                                                    <td className="px-2 py-3 text-center sticky right-0 bg-[var(--bg-surface)] group-hover:bg-[var(--glass-surface)] z-10 transition-colors" style={{ width: '48px', minWidth: '48px' }}>
                                                        {canEditUnit(unit) && (
                                                            <UnitActionsMenu
                                                                unit={unit}
                                                                onEdit={handleEditUnit}
                                                                onDelete={handleDeleteClick}
                                                                t={t}
                                                            />
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Compact View */}
                        <div className="md:hidden divide-y divide-[var(--glass-border)]">
                            {units.map(unit => {
                                const statusStyle = STATUS_CONFIG[unit.status] || STATUS_CONFIG.AVAILABLE;
                                return (
                                    <div 
                                        key={unit.id} 
                                        className="p-4 active:bg-[var(--glass-surface)] transition-colors cursor-pointer"
                                        onClick={() => window.location.hash = `#/${ROUTES.LISTING}/${unit.id}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs2 font-bold text-indigo-600 mb-1">{unit.code}</span>
                                                <h4 className="text-sm font-bold text-[var(--text-primary)]">{unit.title || t(`property.${unit.type.toUpperCase()}`)}</h4>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold border uppercase tracking-wider ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                                                    {t(`status.${unit.status}`)}
                                                </span>
                                                {canEditUnit(unit) && (
                                                    <UnitActionsMenu
                                                        unit={unit}
                                                        onEdit={handleEditUnit}
                                                        onDelete={handleDeleteClick}
                                                        t={t}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs3 text-[var(--text-tertiary)] space-y-1">
                                                <div>{unit.area} m² • {unit.attributes?.floor ? `Tầng ${unit.attributes.floor}` : 'N/A'} • {unit.attributes?.direction ? t(`direction.${unit.attributes.direction}`) : 'N/A'}</div>
                                                <div className="italic">{formatUnitPrice(unit.price, unit.area, t)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-base font-black text-[var(--text-primary)]">{formatCurrency(unit.price)}</div>
                                            </div>
                                        </div>
                                        {/* Assignee display (mobile) */}
                                        <div className="mt-2 flex items-center gap-1.5 text-xs2 text-[var(--text-tertiary)]" onClick={e => e.stopPropagation()}>
                                            <span className="font-medium flex-shrink-0">{t('inventory.label_assignee')}:</span>
                                            {canManageUnits ? (
                                                <AssigneeDropdown
                                                    value={unit.assignedTo}
                                                    name={unit.assignedToName}
                                                    avatar={unit.assignedToAvatar}
                                                    users={tenantUsers}
                                                    onChange={userId => handleAssign(unit.id, userId)}
                                                    disabled={assigningUnitId === unit.id}
                                                    t={t}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    {unit.assignedToName ? (
                                                        <>
                                                            <img
                                                                src={unit.assignedToAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(unit.assignedToName)}&size=20&background=6366f1&color=fff`}
                                                                alt={unit.assignedToName}
                                                                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                                                            />
                                                            <span>{unit.assignedToName}</span>
                                                        </>
                                                    ) : (
                                                        <span className="italic">{t('inventory.unassigned')}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {isFormOpen && (
                <ListingForm 
                    isOpen={isFormOpen} 
                    onClose={() => setIsFormOpen(false)} 
                    onSubmit={handleFormSubmit}
                    initialData={editingUnit || { projectCode, location: parentLocation || '', contactPhone: parentContactPhone || '' } as any}
                    t={t}
                    isProjectUnit={true}
                />
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                onCancel={() => setDeleteConfirmOpen(false)}
                onConfirm={confirmDelete}
                title={t('common.delete')}
                message={t('common.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                variant="danger"
            />
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
});

export const ListingDetail: React.FC = () => {
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const [listing, setListing] = useState<Listing | null>(null);
    const [similarListings, setSimilarListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [valuation, setValuation] = useState<any>(null);
    const [isValuating, setIsValuating] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [showPhone, setShowPhone] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const canViewInternalInfo = useMemo(() => {
        if (!currentUser || !listing) return false;
        
        // Admins and Team Leads
        if ([UserRole.ADMIN, UserRole.TEAM_LEAD].includes(currentUser.role)) return true;
        
        // Creator of the listing
        if (listing.createdBy === currentUser.id) return true;
        
        // Specific permission
        if (currentUser.permissions?.includes('VIEW_SENSITIVE_INFO')) return true;
        
        // Explicitly authorized
        if (listing.authorizedAgents?.includes(currentUser.id)) return true;

        return false;
    }, [currentUser, listing]);

    // Get ID from Hash URL
    const id = window.location.hash.split('/').pop();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchListingData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [user, item, sim] = await Promise.all([
                db.getCurrentUser(),
                db.getListingById(id),
                db.getSimilarListings(id),
            ]);
            setCurrentUser(user);
            if (item) {
                const normalizedLocation = normalizeAddress(item.location);
                const simFiltered = (sim || []).filter((s: any) => s.id !== item.id);

                // Show listing immediately — don't block on favorites
                setListing({ ...item, location: normalizedLocation, isFavorite: false });
                setSimilarListings(simFiltered);
                setLoading(false);

                // Fetch favorites in background and patch state
                if (user) {
                    try {
                        const favs = await db.getFavorites(1, 1000);
                        const favData = (favs as any).data as any[];
                        const favIds = new Set(favData.map((f: any) => f.id));
                        setListing(prev => prev ? { ...prev, isFavorite: favIds.has(prev.id) } : prev);
                        setSimilarListings(prev => prev.map((s: any) => ({ ...s, isFavorite: favIds.has(s.id) })));
                    } catch {}
                } else {
                    try {
                        const stored: string[] = JSON.parse(localStorage.getItem('sgs_favorites') || '[]');
                        const favIds = new Set(stored);
                        setListing(prev => prev ? { ...prev, isFavorite: favIds.has(prev.id) } : prev);
                    } catch {}
                }
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (listing) {
            document.title = `${listing.title} | SGS LAND`;
        }
    }, [listing]);

    useEffect(() => {
        fetchListingData();
    }, [fetchListingData]);

    const handleBack = useCallback(() => {
        // SMART CONTEXT AWARE BACK BUTTON
        // If user has a session, they are an Agent/Admin -> Go to Inventory
        // If no session, they are a Public Guest -> Go to Marketplace Search
        if (currentUser) {
            window.location.hash = `#/${ROUTES.INVENTORY}`;
        } else {
            window.location.hash = `#/${ROUTES.SEARCH}`;
        }
    }, [currentUser]);

    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const handleShare = () => {
        setShareOpen(true);
    };

    const handleBooking = async (date: string, time: string, note: string, name: string, phone: string) => {
        try {
            const currentUrl = window.location.href;
            const leadNotes = `📅 ĐẶT LỊCH XEM NHÀ\n------------------\n📍 Sản phẩm: [${listing?.code}] ${listing?.title}\n⏰ Thời gian: ${time} ngày ${date}\n👤 Khách hàng: ${name}\n📞 SĐT: ${phone}\n📝 Ghi chú: ${note || 'Không có'}\n🔗 Link: ${currentUrl}`;

            if (currentUser) {
                await db.createLead({
                    name,
                    phone,
                    source: 'BOOKING',
                    stage: LeadStage.NEW,
                    notes: leadNotes,
                });
                if (listing?.id) {
                    await db.updateListing(listing.id, {
                        bookingCount: (listing.bookingCount || 0) + 1,
                    });
                }
            } else {
                await db.createPublicLead({
                    name,
                    phone,
                    notes: leadNotes,
                    source: 'BOOKING',
                    stage: 'NEW',
                });
            }

            notify(t('common.success'), 'success');
        } catch (error) {
            console.error(error);
            notify(t('common.error'), 'error');
        }
        setBookingOpen(false);
    };

    const handleContact = useCallback(() => {
        setShowPhone(true);
        if (!currentUser && listing) {
            db.createPublicLead({
                name: 'Khách quan tâm',
                phone: listing.contactPhone || '0000000000',
                notes: `📞 XEM SĐT\n📍 Sản phẩm: [${listing.code}] ${listing.title}\n🔗 Link: ${window.location.href}`,
                source: 'WEBSITE',
                stage: 'NEW',
            }).catch(() => {});
        }
    }, [listing, currentUser]);

    const handleToggleFavorite = async () => {
        if (!listing) return;
        const newStatus = !listing.isFavorite;

        // Optimistic Update
        setListing(prev => prev ? ({ ...prev, isFavorite: newStatus }) : null);
        notify(newStatus ? (t('favorites.added') || "Đã thêm vào yêu thích") : (t('favorites.removed') || "Đã xóa khỏi yêu thích"), 'success');

        if (currentUser) {
            try {
                await db.toggleFavorite(listing.id);
            } catch (e) {
                console.error("Favorite toggle failed", e);
                setListing(prev => prev ? ({ ...prev, isFavorite: !newStatus }) : null);
            }
        } else {
            try {
                const stored: string[] = JSON.parse(localStorage.getItem('sgs_favorites') || '[]');
                const updated = newStatus
                    ? [...stored.filter(x => x !== listing.id), listing.id]
                    : stored.filter(x => x !== listing.id);
                localStorage.setItem('sgs_favorites', JSON.stringify(updated));
            } catch {}
        }
    };

    const handleAiValuation = async () => {
        if (!currentUser) {
            notify("Vui lòng đăng nhập để sử dụng tính năng thẩm định AI", 'error');
            setTimeout(() => window.location.hash = `#/${ROUTES.LOGIN}`, 1500);
            return;
        }
        if (!listing) return;
        setIsValuating(true);
        try {
            const result = await aiService.getRealtimeValuation(
                listing.location,
                listing.area,
                listing.attributes?.roadWidth || 0,
                listing.attributes?.legalStatus || 'Sổ hồng'
            );
            
            // Map service result to UI state
            setValuation({
                estimatedPrice: result.estimatedPrice,
                confidenceScore: result.confidence / 100,
                pricePerM2: result.basePrice,
                reasoning: result.reasoning,
                comparables: result.comparables
            });
            
            notify("Thẩm định AI hoàn tất", 'success');
        } catch (error) {
            console.error(error);
            notify("Lỗi thẩm định AI", 'error');
        } finally {
            setIsValuating(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;
    if (!listing) return <div className="p-10 text-center text-[var(--text-secondary)]">{t('common.product_not_found')}</div>;

    // --- CONTEXT-AWARE ATTRIBUTE RENDERER ---
    const getAttributes = () => {
        const type = listing.type;
        const attrs = listing.attributes;

        if (type === PropertyType.PROJECT) {
            return [
                { label: t('inventory.label_developer'), value: attrs.developer },
                { label: t('inventory.label_total_units'), value: listing.totalUnits || attrs.totalUnits },
                { label: t('inventory.label_handover'), value: attrs.handoverYear },
                { label: t('inventory.label_legal'), value: attrs.legalStatus ? t(`legal.${attrs.legalStatus}`) : '--' },
                { label: t('inventory.label_status'), value: t(`status.${listing.status}`) },
            ];
        } 
        
        if (type === PropertyType.LAND || type === PropertyType.FACTORY) {
            return [
                { label: t('pub.area'), value: `${listing.area} m²` },
                { label: t('inventory.label_land_type'), value: attrs.landType || '--' },
                { label: t('inventory.label_frontage'), value: attrs.frontage ? `${attrs.frontage}m` : '--' },
                { label: t('inventory.label_road_width'), value: attrs.roadWidth ? `${attrs.roadWidth}m` : '--' },
                { label: t('inventory.label_legal'), value: attrs.legalStatus ? t(`legal.${attrs.legalStatus}`) : '--' },
            ];
        }

        // Default: Apartment / House
        return [
            { label: t('pub.area'), value: `${listing.area} m²` },
            { label: t('pub.bedrooms'), value: listing.bedrooms },
            { label: t('pub.direction'), value: attrs.direction ? t(`direction.${attrs.direction}`) : '--' },
            { label: t('inventory.label_legal'), value: attrs.legalStatus ? t(`legal.${attrs.legalStatus}`) : '--' },
            { label: t('pub.type'), value: t(`property.${listing.type.toUpperCase()}`) },
        ];
    };

    const attributes = getAttributes();

    // Safe images array (ensure at least one item or empty for logic)
    const images = listing.images && listing.images.length > 0 ? listing.images : [PLACEHOLDER_IMG];
    const hasMoreImages = images.length > 5;
    const displayImages = images.slice(0, 5); // Take max 5 for grid

    // Format contact phone for display (add spaces for readability)
    const displayPhone = listing.contactPhone
        ? listing.contactPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')
        : t('common.contact_on_site');

    return (
        <>
        <article className="h-[100dvh] overflow-y-auto no-scrollbar bg-[var(--bg-surface)] pb-28 lg:pb-20 animate-enter relative">

            {/* Header */}
            <div className="sticky top-0 z-40 bg-[var(--bg-surface)]/80 backdrop-blur-md border-b border-[var(--glass-border)] px-4 py-3 md:px-6 md:py-4 flex justify-between items-center gap-2">
                <button 
                    type="button" 
                    onClick={handleBack} 
                    className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-[var(--glass-surface)] active:bg-[var(--glass-surface-hover)] shrink-0"
                >
                    {ICONS.BACK} <span className="hidden sm:inline">{t('common.go_back')}</span>
                </button>
                <div className="flex gap-2 items-center">
                    <button
                        type="button"
                        onClick={handleToggleFavorite}
                        className={`p-2 rounded-full transition-colors ${listing?.isFavorite ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50'}`}
                        title={listing?.isFavorite ? t('favorites.remove') : t('favorites.add')}
                    >
                        <svg className="w-5 h-5 pointer-events-none" fill={listing?.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                    <button 
                        type="button"
                        onClick={handleShare} 
                        className="p-2 text-[var(--text-secondary)] hover:text-indigo-600 rounded-full hover:bg-[var(--glass-surface)] transition-colors" 
                        title={t('common.share_link')}
                    >
                        {ICONS.SHARE}
                    </button>
                    <button onClick={handleLogin} className="px-5 py-2 min-h-[44px] bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors shadow-lg active:scale-95 flex items-center justify-center">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* Gallery (Bento Grid) */}
            <div className="max-w-7xl mx-auto px-4 py-5 md:px-6 md:py-8">
                {/* Dynamic Grid Layout based on image count */}
                <div className={`grid gap-4 rounded-[32px] overflow-hidden h-[400px] md:h-[500px] relative group
                    ${displayImages.length === 1 ? 'grid-cols-1' : ''}
                    ${displayImages.length === 2 ? 'grid-cols-1 md:grid-cols-2' : ''}
                    ${displayImages.length >= 3 ? 'grid-cols-1 md:grid-cols-4' : ''}
                `}>
                    {/* Main Image (Always First) */}
                    <div 
                        className={`h-full relative cursor-pointer overflow-hidden
                            ${displayImages.length >= 3 ? 'md:col-span-2' : ''}
                        `}
                        onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
                    >
                        <img src={displayImages[0] || NO_IMAGE_URL} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt="Main" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors"></div>
                    </div>

                    {/* Secondary Images (Right Side) */}
                    {displayImages.length > 1 && (
                        <div className={`hidden md:grid gap-4 h-full
                            ${displayImages.length === 2 ? 'grid-cols-1' : ''} 
                            ${displayImages.length === 3 ? 'grid-cols-1 grid-rows-2' : ''}
                            ${displayImages.length >= 4 ? 'grid-cols-2 grid-rows-2 md:col-span-2' : ''}
                        `}>
                            {displayImages.slice(1).map((img, idx) => (
                                <div key={idx} className="relative cursor-pointer overflow-hidden h-full w-full" onClick={() => { setLightboxIndex(idx + 1); setLightboxOpen(true); }}>
                                    <img src={img || NO_IMAGE_URL} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt={`Gallery ${idx}`} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE_URL; }} />
                                    {/* Overlay for +More on the last item if needed */}
                                    {idx === displayImages.length - 2 && hasMoreImages && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm">
                                            +{images.length - 5}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* "View All" Button (Floating, visible on Mobile & Desktop) - Updated without ICON */}
                    <button 
                        onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
                        className="absolute bottom-4 right-4 z-20 bg-[var(--bg-surface)]/90 backdrop-blur-md hover:bg-[var(--bg-surface)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all hover:scale-105 active:scale-95 border border-white/20"
                    >
                        {t('common.view_all')} ({images.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border border-indigo-100">{t(`property.${listing.type.toUpperCase()}`)}</span>
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border border-emerald-100">{t(`status.${listing.status}`)}</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-2 leading-tight">{listing.title}</h1>
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)] font-medium flex-wrap">
                            <span className="flex items-center gap-1">{ICONS.LOCATION} {listing.location}</span>
                            <span className="mx-2 text-[var(--text-secondary)] hidden sm:inline">|</span>
                            <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                {listing.viewCount || 0} {t('common.views')}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {attributes.map((attr, i) => (
                            <div key={i} className="bg-[var(--glass-surface)] p-4 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--bg-surface)] hover:shadow-md transition-all duration-300 group">
                                <div className="text-xs2 text-[var(--text-secondary)] font-bold uppercase tracking-wider mb-1 group-hover:text-indigo-500 transition-colors">{attr.label}</div>
                                <div className="font-bold text-[var(--text-primary)] truncate" title={String(attr.value)}>{String(attr.value ?? '--')}</div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t('detail.info_title')}</h3>
                        <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                            {(listing.attributes.description as string) || t('inventory.label_desc')}
                        </p>
                    </div>

                    {/* Map */}
                    {listing.coordinates && (
                        <div className="h-80 rounded-[24px] overflow-hidden border border-[var(--glass-border)] shadow-sm relative z-0">
                            <MapView listings={[listing]} onNavigate={() => {}} formatCurrency={formatCurrency} formatUnitPrice={formatUnitPrice} t={t} language={language} />
                        </div>
                    )}

                    {/* Project Units - New Section */}
                    {listing.type === PropertyType.PROJECT && (
                        <ProjectUnits projectCode={listing.code} parentLocation={listing.location} parentContactPhone={listing.contactPhone} t={t} formatCurrency={formatCurrency} formatCompactNumber={formatCompactNumber} />
                    )}

                    {/* Financial Tools & AI Valuation */}
                    {listing.type !== PropertyType.PROJECT && (
                        <div className="flex flex-col gap-8 mt-8">
                            <div className="min-w-0">
                                <FinancialSuite price={listing.price} formatCurrency={formatCurrency} t={t} />
                            </div>
                            
                            <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col min-w-0">
                                <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-indigo-50/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-[var(--text-primary)]">Thẩm định AI (Real-time)</h3>
                                    </div>
                                    <button 
                                        onClick={handleAiValuation}
                                        disabled={isValuating}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isValuating ? 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
                                    >
                                        {!currentUser && <Lock className="w-3 h-3" />}
                                        {isValuating ? 'Đang thẩm định...' : (!currentUser ? 'Đăng nhập để thẩm định' : 'Bắt đầu thẩm định')}
                                    </button>
                                </div>
                                <div className="p-6 flex-1">
                                    {!valuation && !isValuating && (
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-10">
                                            <div className="w-12 h-12 bg-[var(--glass-surface)] rounded-full flex items-center justify-center text-[var(--text-secondary)]">
                                                {ICONS.CALC}
                                            </div>
                                            <p className="text-sm text-[var(--text-tertiary)] max-w-[240px]">
                                                Sử dụng AI & Thuật toán nâng cao để phân tích giá thị trường thực tế tại khu vực này.
                                            </p>
                                        </div>
                                    )}

                                    {isValuating && (
                                        <div className="space-y-4 animate-pulse">
                                            <div className="h-8 bg-[var(--glass-surface-hover)] rounded-lg w-3/4"></div>
                                            <div className="h-20 bg-[var(--glass-surface-hover)] rounded-lg"></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="h-16 bg-[var(--glass-surface-hover)] rounded-lg"></div>
                                                <div className="h-16 bg-[var(--glass-surface-hover)] rounded-lg"></div>
                                            </div>
                                        </div>
                                    )}

                                    {valuation && (
                                        <div className="animate-enter space-y-6">
                                            <div className="flex flex-wrap items-end gap-2">
                                                <span className="text-2xl md:text-3xl font-black text-[var(--text-primary)] break-words">{formatCurrency(valuation.estimatedPrice)}</span>
                                                <span className="text-sm font-bold text-[var(--text-secondary)] mb-1">/ tổng diện tích</span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 min-w-0">
                                                    <div className="text-xs2 font-bold text-emerald-600 uppercase mb-1 truncate">Độ tin cậy</div>
                                                    <div className="text-xl font-black text-emerald-900">{(valuation.confidenceScore * 100).toFixed(0)}%</div>
                                                </div>
                                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 min-w-0">
                                                    <div className="text-xs2 font-bold text-indigo-600 uppercase mb-1 truncate">Đơn giá m²</div>
                                                    <div className="text-xl font-black text-indigo-900 break-all">{formatCurrency(valuation.pricePerM2)}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Phân tích thị trường</h4>
                                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic">
                                                    "{valuation.reasoning}"
                                                </p>
                                            </div>

                                            {valuation.comparables && valuation.comparables.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Tài sản so sánh</h4>
                                                    <div className="space-y-2">
                                                        {valuation.comparables.map((comp: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between items-center gap-2 p-3 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] flex-wrap">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)] truncate flex-1 min-w-[120px]">{comp.address}</span>
                                                                <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{formatCurrency(comp.price)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Internal Info - Only for Authenticated Agents */}
                    {canViewInternalInfo && (
                        <div className="bg-slate-900 rounded-[32px] p-8 border border-slate-800 mt-12 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                        <Lock className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{t('inventory.section_internal')}</h3>
                                        <p className="text-xs text-[var(--text-secondary)] font-medium">{t('inventory.internal_note')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-[var(--bg-surface)]/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                                        <span className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('inventory.label_owner_name')}</span>
                                        <span className="text-sm font-bold text-slate-200">{listing.ownerName || '--'}</span>
                                    </div>
                                    <div className="bg-[var(--bg-surface)]/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                                        <span className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('inventory.label_owner_phone')}</span>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-mono font-bold text-indigo-400 truncate min-w-0">{listing.ownerPhone || '--'}</span>
                                            {listing.ownerPhone && (
                                                <button 
                                                    onClick={() => window.location.href = `tel:${listing.ownerPhone}`}
                                                    className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all flex-shrink-0"
                                                >
                                                    {ICONS.PHONE}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--bg-surface)]/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                                        <span className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('inventory.label_commission')}</span>
                                        <span className="text-sm font-bold text-emerald-400">
                                            {listing.commission ? `${listing.commission}${listing.commissionUnit === 'PERCENT' ? '%' : ' VND'}` : '--'}
                                        </span>
                                    </div>
                                    <div className="bg-[var(--bg-surface)]/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                                        <span className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">{t('inventory.label_verified')}</span>
                                        <span className={`text-xs2 font-bold px-2 py-1 rounded-lg uppercase tracking-wider inline-block ${listing.isVerified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-[var(--text-secondary)] border border-slate-600'}`}>
                                            {listing.isVerified ? t('inventory.verified') : t('inventory.unverified')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[32px] border border-[var(--glass-border)] shadow-xl sticky top-24">
                        <div className="mb-6">
                            <div className="text-sm text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-1">
                                {listing.type === PropertyType.PROJECT ? t('inventory.min_price') : t('inventory.label_price')}
                            </div>
                            <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight leading-tight">
                                {formatCompactNumber(listing.price)}
                                <span className="text-lg font-bold text-[var(--text-tertiary)] ml-1">₫</span>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">{formatCurrency(listing.price)}</div>
                            {listing.area > 0 && listing.type !== PropertyType.PROJECT && (
                                <div className="text-sm font-medium text-[var(--text-tertiary)] mt-1 italic">
                                    ~ {formatUnitPrice(listing.price, listing.area, t)}
                                </div>
                            )}
                        </div>

                        <button onClick={() => setBookingOpen(true)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 mb-3">
                            {ICONS.CALENDAR} {t('detail.book_viewing')}
                        </button>
                        {showPhone ? (
                            listing.contactPhone ? (
                                <a
                                    href={`tel:${listing.contactPhone}`}
                                    className="w-full py-4 border rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {displayPhone}
                                </a>
                            ) : (
                                <div className="w-full py-4 border rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-emerald-50 border-emerald-200 text-emerald-700">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {displayPhone}
                                </div>
                            )
                        ) : (
                            <button
                                onClick={handleContact}
                                className="w-full py-4 border rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-surface)]"
                            >
                                {ICONS.PHONE} {t('detail.contact_now')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Similar Listings */}
            {similarListings.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 py-12 border-t border-[var(--glass-border)] mt-12">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-8">{t('detail.similar_listings')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {similarListings.map(item => (
                            <div key={item.id} className="min-h-full cursor-pointer" onClick={() => window.location.hash = `#/${ROUTES.LISTING}/${item.id}`}>
                                <ListingCard 
                                    item={item} 
                                    t={t} 
                                    formatCurrency={formatCurrency} 
                                    onToggleFavorite={async (id) => {
                                        const sim = similarListings.find(s => s.id === id);
                                        if (!sim) return;
                                        const newStatus = !sim.isFavorite;
                                        setSimilarListings(prev => prev.map(s => s.id === id ? { ...s, isFavorite: newStatus } : s));
                                        notify(newStatus ? (t('favorites.added') || "Đã thêm vào yêu thích") : (t('favorites.removed') || "Đã xóa khỏi yêu thích"), 'success');
                                        if (currentUser) {
                                            try {
                                                await db.toggleFavorite(id);
                                            } catch (e) {
                                                setSimilarListings(prev => prev.map(s => s.id === id ? { ...s, isFavorite: !newStatus } : s));
                                            }
                                        } else {
                                            try {
                                                const stored: string[] = JSON.parse(localStorage.getItem('sgs_favorites') || '[]');
                                                const updated = newStatus
                                                    ? [...stored.filter(x => x !== id), id]
                                                    : stored.filter(x => x !== id);
                                                localStorage.setItem('sgs_favorites', JSON.stringify(updated));
                                            } catch {}
                                        }
                                    }}
                                    onEdit={() => {}} 
                                    onDelete={() => {}} 
                                    showActions={false}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {lightboxOpen && (
                <Lightbox 
                    images={images} 
                    initialIndex={lightboxIndex} 
                    onClose={() => setLightboxOpen(false)} 
                />
            )}
            
            <BookingModal 
                isOpen={bookingOpen} 
                onClose={() => setBookingOpen(false)} 
                onConfirm={handleBooking} 
                t={t} 
            />

            <ShareModal 
                isOpen={shareOpen} 
                onClose={() => setShareOpen(false)} 
                t={t} 
            />
        </article>
        {createPortal(
            toast ? (
                <div className={`fixed top-6 right-4 md:right-6 z-[100] px-4 md:px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border max-w-[calc(100vw-2rem)] ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm break-words">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
