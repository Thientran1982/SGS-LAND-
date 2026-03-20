
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/dbApi';
import { Proposal, Listing, Lead } from '../types';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';
import { useTenant } from '../services/tenantContext';
import { formatSmartPrice } from '../utils/textUtils';
import { NO_IMAGE_URL } from '../utils/constants';

interface PublicProposalProps {
    token: string;
}

const ICONS = {
    BED: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    AREA: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    LOCATION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    CHECK: <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SECURITY: <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
};

export const PublicProposal: React.FC<PublicProposalProps> = ({ token }) => {
    const { isLoading: isTenantLoading } = useTenant();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [listing, setListing] = useState<Listing | null>(null);
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepted, setAccepted] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    
    const { t, formatCurrency, formatDate } = useTranslation();

    useEffect(() => {
        if (isTenantLoading) return;
        
        const load = async () => {
            setLoading(true);
            try {
                const found = await db.getProposalByToken(token);
                
                if (found) {
                    setProposal(found);
                    if (found.status === 'ACCEPTED') setAccepted(true);

                    const l = await db.getListingById(found.listingId);
                    if (l) setListing(l);

                    const client = await db.getLeadById(found.leadId);
                    if (client) setLead(client);
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

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;
    
    if (!proposal || !listing) return (
        <div className="h-screen flex flex-col items-center justify-center text-[var(--text-tertiary)]">
            <div className="w-16 h-16 bg-[var(--glass-surface-hover)] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('pub.error_title')}</h1>
            <p>{t('pub.not_found')}</p>
        </div>
    );

    return (
        // FIX: Added no-scrollbar to ensure consistent clean UI
        <div className="fixed inset-0 h-[100dvh] w-full bg-[#f8fafc] font-sans selection:bg-indigo-500/30 overflow-y-auto no-scrollbar">
            {/* Header / Brand */}
            <div className="bg-[var(--bg-surface)] border-b border-[var(--glass-border)] sticky top-0 z-30 bg-[var(--bg-surface)]/80 backdrop-blur-md">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                const authToken = localStorage.getItem('sgs_token');
                                if (authToken) {
                                    window.location.hash = '#/leads';
                                } else {
                                    window.location.hash = '#/';
                                }
                            }}
                            className="p-2 -ml-2 text-slate-400 hover:text-[var(--text-primary)] transition-colors rounded-full hover:bg-[var(--glass-surface-hover)]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <Logo className="w-6 h-6 text-indigo-600" />
                            <span className="font-bold text-lg text-[var(--text-primary)]">SGS LAND</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                        {ICONS.SECURITY} {t('pub.verified')}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-enter pb-20">
                
                {/* Expired Banner */}
                {isExpired && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t('pub.offer_expired')}
                    </div>
                )}

                {/* Hero Card */}
                <div className="bg-[var(--bg-surface)] rounded-[24px] shadow-xl shadow-slate-200/50 border border-[var(--glass-border)] overflow-hidden mb-8 relative">
                    <div className="aspect-video w-full bg-slate-200 relative overflow-hidden">
                        <img src={listing.images?.[0] || NO_IMAGE_URL} className="w-full h-full object-cover" alt={listing.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-6 left-6 text-white">
                            <div className="text-xs font-bold bg-indigo-600 px-2 py-1 rounded mb-2 w-fit">{t(`property.${listing.type.toUpperCase()}`)}</div>
                            <h1 className="text-2xl md:text-3xl font-black leading-tight mb-1">{listing.title}</h1>
                            <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                                {ICONS.LOCATION} {listing.location}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8">
                        <div className="flex flex-wrap gap-4 mb-8 text-sm text-[var(--text-secondary)]">
                            <span className="flex items-center gap-2 bg-[var(--glass-surface)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)]">
                                {ICONS.AREA} <strong>{listing.area} m²</strong>
                            </span>
                            {listing.bedrooms != null && listing.bedrooms > 0 && (
                                <span className="flex items-center gap-2 bg-[var(--glass-surface)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)]">
                                    {ICONS.BED} <strong>{listing.bedrooms} {t('pub.bedrooms')}</strong>
                                </span>
                            )}
                            {listing.attributes?.direction && (
                                <span className="flex items-center gap-2 bg-[var(--glass-surface)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)]">
                                    <strong>{t(`direction.${listing.attributes.direction}`) || listing.attributes.direction}</strong>
                                </span>
                            )}
                        </div>

                        <div className="border-t border-[var(--glass-border)] pt-8">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                {t('pub.exclusive_offer_for')} <span className="text-indigo-600">{lead?.name}</span>
                            </p>
                            
                            {proposal.metadata?.note && (
                                <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                    <div className="text-xs2 font-bold text-indigo-400 uppercase tracking-wider mb-2">{t('proposal.label_note')}</div>
                                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{proposal.metadata.note}</p>
                                </div>
                            )}
                            
                            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                                <div>
                                    {proposal.discountAmount > 0 && (
                                        <div className="flex items-baseline gap-3 mb-1">
                                            <span className="text-sm text-slate-400 line-through decoration-slate-300">{formatCurrency(proposal.basePrice)}</span>
                                            <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">-{formatCurrency(proposal.discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
                                        {formatSmartPrice(proposal.finalPrice, t)}
                                    </div>
                                    {!isExpired && (
                                        <div className="flex flex-col gap-1 mt-3">
                                            <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                                {ICONS.CLOCK} {t('pub.valid_until')}: {formatDate(proposal.validUntil)}
                                            </div>
                                            {proposal.metadata?.depositRequired && (
                                                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-tertiary)]">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {t('proposal.label_deposit')}: {formatCurrency(proposal.metadata.depositRequired)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-4 w-full md:w-auto">
                                    <button
                                        onClick={async () => {
                                            if (!proposal || isExpired || accepted || isAccepting) return;
                                            setIsAccepting(true);
                                            try {
                                                await db.updateProposal(proposal.id, { status: 'ACCEPTED' });
                                                setAccepted(true);
                                            } catch (e) {
                                                console.error('Accept proposal failed:', e);
                                                // Still mark accepted locally so UI feels responsive
                                                setAccepted(true);
                                            } finally {
                                                setIsAccepting(false);
                                            }
                                        }}
                                        disabled={isExpired || accepted || isAccepting}
                                        className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2
                                            ${isExpired ? 'bg-[var(--glass-surface-hover)] text-slate-400 cursor-not-allowed' : accepted ? 'bg-emerald-500 text-white cursor-default' : isAccepting ? 'bg-slate-700 text-white cursor-wait' : 'bg-slate-900 text-white hover:bg-slate-800'}
                                        `}
                                    >
                                        {isAccepting ? (
                                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('common.loading') || 'Đang xử lý...'}</>
                                        ) : accepted ? (
                                            <>{ICONS.CHECK} {t('pub.thank_you')}</>
                                        ) : (
                                            t('pub.interested')
                                        )}
                                    </button>
                                    
                                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                                        {t('proposal.prepared_by')}: <span className="font-bold text-[var(--text-secondary)]">{proposal.createdBy}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {accepted && (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center animate-enter">
                        <h3 className="font-bold text-emerald-800 text-lg mb-1">{t('pub.thank_you')}</h3>
                        <p className="text-emerald-600 text-sm">{t('pub.agent_contact_soon')}</p>
                    </div>
                )}

                <p className="text-center text-xs text-slate-400 mt-8 leading-relaxed max-w-md mx-auto">
                    {t('pub.disclaimer')}
                    <br/>
                    Powered by SGS Land Enterprise.
                </p>
            </div>
        </div>
    );
};
export default PublicProposal;
