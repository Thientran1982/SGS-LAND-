
import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { db } from '../services/dbApi';
import { Proposal, Listing, Lead, User, LeadScore } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

// -----------------------------------------------------------------------------
// 1. CONSTANTS & CONFIGURATION
// -----------------------------------------------------------------------------
const RISK_CONSTANTS = {
    THRESHOLD_HIGH: 5.0,   // > 5% discount
    THRESHOLD_MEDIUM: 2.0, // > 2% discount
    TOAST_DURATION: 3000
};

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface RiskAssessment {
    level: RiskLevel;
    reasonKeys: string[];
    score: number; // Internal score for sorting
}

const RISK_STYLES = {
    HIGH: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', badge: 'bg-rose-500', icon: 'text-rose-500' },
    MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-500', icon: 'text-amber-500' },
    LOW: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-500', icon: 'text-emerald-500' }
};

const ICONS = {
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    WARNING: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    FILTER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    SORT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>,
    CHECK_CIRCLE: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
};

// -----------------------------------------------------------------------------
// 2. BUSINESS LOGIC (Advanced Risk Engine)
// -----------------------------------------------------------------------------
const analyzeRisk = (discountPercent: number, leadScore?: LeadScore): RiskAssessment => {
    const reasonKeys: string[] = [];
    let level: RiskLevel = 'LOW';
    let score = 0; // Higher score = Higher Priority/Risk

    // Base Risk on Discount
    if (discountPercent > RISK_CONSTANTS.THRESHOLD_HIGH) {
        level = 'HIGH';
        reasonKeys.push('reason_deep_discount');
        score += 50;
    } else if (discountPercent > RISK_CONSTANTS.THRESHOLD_MEDIUM) {
        level = 'MEDIUM';
        score += 20;
    }

    // Contextual Adjustment based on Customer Score
    if (leadScore) {
        if (leadScore.grade === 'A' && level === 'HIGH') {
            level = 'MEDIUM'; // Downgrade risk for VIPs
            reasonKeys.push('reason_vip_allowance');
            score -= 10;
        } else if (leadScore.grade === 'A' && level === 'MEDIUM') {
            level = 'LOW';
            reasonKeys.push('reason_vip_allowance');
            score -= 10;
        } else if ((leadScore.grade === 'C' || leadScore.grade === 'D') && discountPercent > 1) {
            // Upgrade risk for low-quality leads asking for discount
            if (level === 'LOW') level = 'MEDIUM';
            reasonKeys.push('reason_low_score');
            score += 15;
        }
    }

    return { level, reasonKeys, score };
};

// -----------------------------------------------------------------------------
// 3. SUB-COMPONENTS
// -----------------------------------------------------------------------------

interface RejectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    t: (key: string) => string;
}

const RejectModal = memo(({ isOpen, onClose, onConfirm, t }: RejectModalProps) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-enter">
            <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">{t('approvals.reject_modal_title')}</h3>
                <textarea 
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none h-24 resize-none mb-4 bg-slate-50 focus:bg-white transition-colors"
                    placeholder={t('approvals.reject_reason_placeholder')}
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">{t('common.cancel')}</button>
                    <button 
                        onClick={() => { if(reason.trim()) { onConfirm(reason); setReason(''); } }} 
                        disabled={!reason.trim()} 
                        className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-rose-700 transition-all disabled:opacity-50"
                    >
                        {t('approvals.btn_reject')}
                    </button>
                </div>
            </div>
        </div>
    );
});

interface ProposalCardProps {
    proposal: Proposal;
    listing?: Listing;
    lead?: Lead;
    currentUser: User | null;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    t: (key: string, params?: any) => string;
    formatDateTime: (d: string) => string;
    formatCurrency: (amount: number) => string;
}

const ProposalCard = memo(({ proposal, listing, lead, currentUser, isSelected, onToggleSelect, onApprove, onReject, t, formatDateTime, formatCurrency }: ProposalCardProps) => {
    
    const { discountPercent, riskAssessment } = useMemo(() => {
        const base = Math.max(0, proposal.basePrice);
        const discount = Math.max(0, proposal.discountAmount);
        const pct = base > 0 ? (discount / base) * 100 : 0;
        return {
            discountPercent: pct,
            riskAssessment: analyzeRisk(pct, lead?.score)
        };
    }, [proposal, lead]);

    const isSelf = currentUser?.name === proposal.createdBy; 
    const styles = RISK_STYLES[riskAssessment.level];

    return (
        <div 
            className={`bg-white rounded-[20px] border shadow-sm relative overflow-hidden transition-all duration-300 group flex flex-col h-full
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10' : `border-slate-200 hover:border-slate-300 hover:shadow-md`}`}
            onClick={() => onToggleSelect(proposal.id)}
        >
            {/* Header / Selection */}
            <div className="p-4 flex justify-between items-start pb-2">
                <div className="flex items-center gap-3">
                    <div 
                        className={`w-5 h-5 rounded border transition-colors flex items-center justify-center
                            ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-transparent group-hover:border-indigo-400'}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 text-sm">{proposal.createdBy}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{formatDateTime(proposal.createdAt)}</div>
                    </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border}`}>
                    {t(`approvals.risk_${riskAssessment.level.toLowerCase()}`)}
                </div>
            </div>

            {/* Content Body */}
            <div className="px-4 pb-4 flex-1">
                {/* Discount Highlight */}
                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-black text-slate-900">{discountPercent.toFixed(1)}%</span>
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('approvals.discount')}</span>
                </div>

                {/* Listing & Price Context */}
                <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                    <div className="text-xs font-bold text-slate-700 truncate mb-1" title={listing?.title}>
                        {listing?.title || t('approvals.unknown_listing')}
                    </div>
                    <div className="flex justify-between items-end">
                         <div className="text-[10px] text-slate-500">
                            {t('approvals.price_original')}: <span className="line-through">{formatCurrency(proposal.basePrice)}</span>
                         </div>
                         <div className="text-sm font-bold text-indigo-600">
                            {formatCurrency(proposal.finalPrice)}
                         </div>
                    </div>
                </div>

                {/* Lead Context */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        {ICONS.USER}
                    </div>
                    <div className="text-xs text-slate-600 truncate flex-1 font-medium">{lead?.name || t('data.unknown')}</div>
                    {lead?.score && (
                        <div className={`text-[10px] font-bold px-1.5 rounded border ${lead.score.grade === 'A' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            {t('approvals.lead_rank')} {lead.score.grade}
                        </div>
                    )}
                </div>
                
                {/* Risk Reasons */}
                {riskAssessment.reasonKeys.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-2 space-y-1">
                        {riskAssessment.reasonKeys.map(k => (
                            <div key={k} className="flex items-center gap-1.5">
                                <span className={styles.icon}>{ICONS.WARNING}</span> {t(`approvals.${k}`)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-slate-100 flex gap-2 bg-slate-50/50">
                <button 
                    onClick={(e) => { e.stopPropagation(); onReject(proposal.id); }}
                    className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                    {t('approvals.btn_reject')}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onApprove(proposal.id); }}
                    disabled={isSelf}
                    className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('approvals.btn_approve')}
                </button>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// 4. MAIN COMPONENT
// -----------------------------------------------------------------------------
export const ApprovalInbox: React.FC = () => {
    // Data State
    const [pending, setPending] = useState<Proposal[]>([]);
    const [listings, setListings] = useState<Record<string, Listing>>({});
    const [leads, setLeads] = useState<Record<string, Lead>>({});
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<'RISK' | 'DATE'>('RISK');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const { t, formatDateTime, formatCurrency } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), RISK_CONSTANTS.TOAST_DURATION);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [props, user] = await Promise.all([
                db.getPendingProposals(),
                db.getCurrentUser()
            ]);
            setPending(props || []);
            setCurrentUser(user);
            
            // Efficient Data Loading (Map Pattern)
            const safeProps = props || [];
            const listingIds = [...new Set(safeProps.map(p => p.listingId))];
            const leadIds = [...new Set(safeProps.map(p => p.leadId))];

            if (listingIds.length || leadIds.length) {
                const [listRes, leadRes] = await Promise.all([
                    listingIds.length ? db.getListings(1, 1000) : { data: [] },
                    leadIds.length ? Promise.all(leadIds.map(id => db.getLeadById(id))) : []
                ]);
                
                const listMap: Record<string, Listing> = {};
                listRes.data.forEach(l => listMap[l.id] = l);
                setListings(listMap);

                const leadMap: Record<string, Lead> = {};
                leadRes.forEach(l => { if (l) leadMap[l.id] = l; });
                setLeads(leadMap);
            }
        } catch (e) {
            console.error("Failed to load approvals", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Sorting & Derived Data
    const sortedProposals = useMemo(() => {
        return [...pending].sort((a, b) => {
            if (sortMode === 'RISK') {
                // Calculate risk score dynamically for sorting
                const getScore = (p: Proposal) => {
                   const lead = leads[p.leadId];
                   const pct = (p.discountAmount / p.basePrice) * 100;
                   return analyzeRisk(pct, lead?.score).score;
                };
                return getScore(b) - getScore(a); // High risk first
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Oldest first
        });
    }, [pending, leads, sortMode]);

    // Metrics
    const metrics = useMemo(() => {
        const totalValue = pending.reduce((acc, p) => acc + p.finalPrice, 0);
        const avgDiscount = pending.length > 0 ? pending.reduce((acc, p) => acc + ((p.discountAmount/p.basePrice)*100), 0) / pending.length : 0;
        const highRiskCount = pending.filter(p => analyzeRisk((p.discountAmount/p.basePrice)*100).level === 'HIGH').length;
        return { totalValue, avgDiscount, highRiskCount };
    }, [pending]);

    // Handlers
    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === pending.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(pending.map(p => p.id)));
    };

    const processApproval = async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => db.approveProposal(id)));
            notify(t('approvals.approve_success') + ` (${ids.length})`, 'success');
            setSelectedIds(new Set());
            loadData();
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    const processRejection = async (id: string, reason: string) => {
        try {
            await db.rejectProposal(id, reason);
            notify(t('approvals.reject_success'), 'success');
            setRejectId(null);
            loadData();
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-24 relative animate-enter">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            {/* METRICS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t('approvals.metric_pipeline')}</span>
                    <div className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mt-1">{formatCurrency(metrics.totalValue)}</div>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t('approvals.metric_avg_discount')}</span>
                    <div className="text-xl md:text-2xl font-black text-indigo-600 tracking-tight mt-1">{metrics.avgDiscount.toFixed(1)}%</div>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t('approvals.metric_high_risk')}</span>
                    <div className="text-xl md:text-2xl font-black text-rose-500 tracking-tight mt-1">{metrics.highRiskCount}</div>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm gap-4 sticky top-0 z-20 backdrop-blur-md bg-white/90">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">{t('approvals.title')}</h2>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{pending.length}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSelectAll} className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                        {selectedIds.size === pending.length ? t('approvals.deselect_all') : t('approvals.select_all')}
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <Dropdown 
                        value={sortMode}
                        onChange={(v) => setSortMode(v as any)}
                        options={[
                            { value: 'RISK', label: t('approvals.sort_risk') },
                            { value: 'DATE', label: t('approvals.sort_date') }
                        ]}
                        className="text-xs min-w-[160px]"
                        icon={ICONS.SORT}
                    />
                </div>
            </div>

            {/* GRID */}
            {sortedProposals.length === 0 ? (
                <div className="p-20 text-center text-slate-400 flex flex-col items-center border-2 border-dashed border-slate-100 rounded-[32px]">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">{ICONS.CHECK_CIRCLE}</div>
                    <p className="font-medium">{t('approvals.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {sortedProposals.map(prop => (
                        <ProposalCard 
                            key={prop.id}
                            proposal={prop}
                            listing={listings[prop.listingId]}
                            lead={leads[prop.leadId]}
                            currentUser={currentUser}
                            isSelected={selectedIds.has(prop.id)}
                            onToggleSelect={handleToggleSelect}
                            onApprove={(id) => processApproval([id])}
                            onReject={(id) => setRejectId(id)}
                            t={t}
                            formatDateTime={formatDateTime}
                            formatCurrency={formatCurrency}
                        />
                    ))}
                </div>
            )}

            {/* BULK ACTION BAR */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-scale-up border border-slate-700 min-w-[300px] justify-between">
                    <div className="pl-2 text-sm font-bold flex items-center gap-2">
                        <span className="bg-indigo-500 px-2 py-0.5 rounded-full text-xs">{selectedIds.size}</span>
                        {t('approvals.selected_count')}
                    </div>
                    <button 
                        onClick={() => processApproval(Array.from(selectedIds))}
                        className="bg-white text-slate-900 px-6 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-lg active:scale-95"
                    >
                        {t('approvals.approve_selection')}
                    </button>
                </div>
            )}

            <RejectModal 
                isOpen={!!rejectId}
                onClose={() => setRejectId(null)}
                onConfirm={(r) => rejectId && processRejection(rejectId, r)}
                t={t}
            />
        </div>
    );
};
