
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';
import { useTenant } from '../services/tenantContext';
import { formatSmartPrice } from '../utils/textUtils';
import { NO_IMAGE_URL } from '../utils/constants';

interface PublicProposalProps {
    token: string;
}

const ICONS = {
    AREA: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    BED: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    LOCATION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SECURITY: <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    COIN: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CALENDAR: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    TAG: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    ALERT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

export const PublicProposal: React.FC<PublicProposalProps> = ({ token }) => {
    const { isLoading: isTenantLoading } = useTenant();
    const [proposal, setProposal] = useState<any>(null);
    const [leadName, setLeadName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [accepted, setAccepted] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [imgError, setImgError] = useState(false);

    const { t, formatCurrency, formatDate } = useTranslation();

    useEffect(() => {
        if (isTenantLoading) return;
        const load = async () => {
            setLoading(true);
            try {
                const found = await db.getProposalByToken(token);
                if (found && found.found !== false) {
                    setProposal(found);
                    setLeadName(found.leadName || '');
                    if (found.status === 'ACCEPTED') setAccepted(true);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, isTenantLoading]);

    const isExpired = useMemo(() => {
        if (!proposal) return false;
        return new Date(proposal.validUntil) < new Date();
    }, [proposal]);

    // Derive listing data from proposal response (embedded via JOIN)
    const listingImages: string[] = useMemo(() => {
        if (!proposal) return [];
        const imgs = proposal.listingImages;
        if (Array.isArray(imgs)) return imgs.filter(Boolean);
        if (typeof imgs === 'string') {
            try { return JSON.parse(imgs).filter(Boolean); } catch { return []; }
        }
        return [];
    }, [proposal]);

    const heroImage = imgError ? NO_IMAGE_URL : (listingImages[0] || NO_IMAGE_URL);

    if (loading) return (
        <div className="h-screen flex items-center justify-center text-slate-400 font-mono animate-pulse">
            {t('common.loading')}
        </div>
    );

    if (!proposal) return (
        <div className="h-screen flex flex-col items-center justify-center text-slate-500 gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h1 className="text-xl font-bold text-slate-700">{t('pub.error_title')}</h1>
            <p className="text-sm text-slate-400">{t('pub.not_found')}</p>
        </div>
    );

    const paymentSchedule: any[] = proposal.metadata?.paymentSchedule || [];
    const createdBy: string = proposal.createdBy || '';
    const note: string = proposal.metadata?.note || '';
    const depositRequired: number = proposal.metadata?.depositRequired || 0;
    const listingTitle: string = proposal.listingTitle || '';
    const listingLocation: string = proposal.listingLocation || '';
    const listingArea: number = proposal.listingArea || 0;
    const listingBedrooms: number = proposal.listingBedrooms || 0;
    const listingType: string = proposal.listingType || '';
    const listingDirection: string = proposal.listingAttributes?.direction || '';

    return (
        <div className="fixed inset-0 h-[100dvh] w-full bg-slate-50 font-sans overflow-y-auto no-scrollbar">

            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const authToken = localStorage.getItem('sgs_token');
                                window.location.hash = authToken ? '#/leads' : '#/';
                            }}
                            className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100"
                        >
                            {ICONS.BACK}
                        </button>
                        <div className="flex items-center gap-2">
                            <Logo className="w-5 h-5 text-indigo-600" />
                            <span className="font-bold text-slate-800 text-sm">SGS LAND</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100">
                        {ICONS.SECURITY}
                        <span>{t('pub.verified')}</span>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-4">

                {/* Expired Banner */}
                {isExpired && (
                    <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold">
                        {ICONS.ALERT}
                        {t('pub.offer_expired')}
                    </div>
                )}

                {/* ── HERO CARD ── */}
                <div className="bg-white rounded-3xl shadow-sm shadow-slate-200 border border-slate-100 overflow-hidden">

                    {/* Hero Image */}
                    <div className="relative w-full aspect-[16/9] bg-slate-100 overflow-hidden">
                        <img
                            src={heroImage}
                            alt={listingTitle}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                        {listingType && (
                            <div className="absolute top-4 left-4">
                                <span className="text-[11px] font-bold bg-indigo-600 text-white px-2 py-1 rounded-lg uppercase tracking-wide">
                                    {t(`property.${listingType.toUpperCase()}`) || listingType}
                                </span>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h1 className="text-xl md:text-2xl font-black text-white leading-tight mb-1.5 drop-shadow-sm">
                                {listingTitle}
                            </h1>
                            {listingLocation && (
                                <div className="flex items-center gap-1.5 text-white/85 text-sm">
                                    {ICONS.LOCATION}
                                    <span>{listingLocation}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Property Specs */}
                    <div className="px-5 py-4 flex flex-wrap gap-2 border-b border-slate-100">
                        {listingArea > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-semibold">
                                {ICONS.AREA} {listingArea} m²
                            </span>
                        )}
                        {listingBedrooms > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-semibold">
                                {ICONS.BED} {listingBedrooms} {t('pub.bedrooms')}
                            </span>
                        )}
                        {listingDirection && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-semibold">
                                {t(`direction.${listingDirection}`) || listingDirection}
                            </span>
                        )}
                    </div>

                    <div className="px-5 py-5 space-y-5">

                        {/* Exclusive For */}
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                {t('pub.exclusive_offer_for')}
                            </p>
                            <p className="text-base font-bold text-indigo-700">
                                {leadName || '—'}
                            </p>
                        </div>

                        {/* Agent Note */}
                        {note && (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">
                                    {t('proposal.label_note')}
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note}</p>
                            </div>
                        )}

                        {/* ── PRICE SECTION ── */}
                        <div className="border-t border-slate-100 pt-5">
                            {proposal.discountAmount > 0 && (
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-sm text-slate-400 line-through">{formatCurrency(proposal.basePrice)}</span>
                                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">
                                        {ICONS.TAG} -{formatCurrency(proposal.discountAmount)}
                                    </span>
                                </div>
                            )}
                            <div className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                                {formatSmartPrice(proposal.finalPrice, t)}
                            </div>

                            {/* Meta info row */}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                                {!isExpired && (
                                    <div className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold">
                                        {ICONS.CLOCK}
                                        {t('pub.valid_until')}: <span className="font-bold">{formatDate(proposal.validUntil)}</span>
                                    </div>
                                )}
                                {depositRequired > 0 && (
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500 font-semibold">
                                        {ICONS.COIN}
                                        {t('proposal.label_deposit')}: <span className="font-bold">{formatCurrency(depositRequired)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── PAYMENT SCHEDULE ── */}
                        {paymentSchedule.length > 0 && (
                            <div className="border-t border-slate-100 pt-5">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-indigo-100 rounded-full inline-flex items-center justify-center">
                                        <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </span>
                                    Tiến độ thanh toán đề xuất
                                </p>
                                <div className="space-y-3">
                                    {paymentSchedule.map((m: any, i: number) => (
                                        <div key={m.id || i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline gap-2">
                                                    <span className="text-sm font-bold text-slate-800 truncate">{m.label}</span>
                                                    <span className="text-sm font-extrabold text-slate-900 shrink-0">{formatCurrency(m.amount)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                                                    <span className="flex items-center gap-1">
                                                        {ICONS.CALENDAR}
                                                        {new Date(m.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                    <span className="font-mono font-bold text-indigo-500">{m.percentage}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CTA CARD ── */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 space-y-4">

                        {accepted ? (
                            <div className="text-center py-4">
                                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-emerald-800 mb-1">{t('pub.thank_you')}</h3>
                                <p className="text-sm text-emerald-600">{t('pub.agent_contact_soon')}</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">Quan tâm đến sản phẩm này?</h3>
                                    <p className="text-sm text-slate-500">Nhấn nút bên dưới để chuyên viên liên hệ hỗ trợ bạn.</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (isExpired || accepted || isAccepting) return;
                                        setIsAccepting(true);
                                        try {
                                            await fetch(`/api/proposals/token/${token}/interest`, { method: 'POST' });
                                            setAccepted(true);
                                        } catch {
                                            setAccepted(true);
                                        } finally {
                                            setIsAccepting(false);
                                        }
                                    }}
                                    disabled={isExpired || isAccepting}
                                    className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.98]
                                        ${isExpired
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : isAccepting
                                                ? 'bg-slate-700 text-white cursor-wait'
                                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                                        }`}
                                >
                                    {isAccepting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('common.loading')}
                                        </>
                                    ) : (
                                        t('pub.interested')
                                    )}
                                </button>
                            </>
                        )}

                        {/* Agent info */}
                        {createdBy && (
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-slate-400">
                                    {ICONS.USER}
                                    <span>{t('proposal.prepared_by')}</span>
                                </div>
                                <span className="font-bold text-slate-700">{createdBy}</span>
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 leading-relaxed max-w-sm mx-auto pt-2">
                    {t('pub.disclaimer')}
                    <br />
                    Powered by SGS Land Enterprise.
                </p>
            </div>
        </div>
    );
};

export default PublicProposal;
