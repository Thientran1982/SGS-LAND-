import { uiPrompt } from '../utils/uiDialog';
import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { api } from '../services/api';
import { Proposal, Listing, Lead, User, LeadScore } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { SeoHead } from '../components/SeoHead';
// -----------------------------------------------------------------------------
// 1. CONSTANTS & CONFIGURATION
// -----------------------------------------------------------------------------
const RISK_CONSTANTS = {
    THRESHOLD_HIGH: 5.0,   // > 5% discount
    THRESHOLD_MEDIUM: 2.0, // > 2% discount
    TOAST_DURATION: 3000
};
type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
interface OutreachApproval {
    id: string;
    actionType?: string;
    status: string;
    leadName?: string;
    payload?: { draftVariants?: Array<{ id: string; channel: string; subject?: string; message: string }> };
    deliveries?: Array<{
        deliveryId?: string;
        executionId?: string | null;
        variantId?: string;
        channel?: string;
        deliveryKey?: string;
        status: string;
        providerMessageId?: string;
        error?: string;
        auditHistory?: Array<{
            id: string;
            eventType: 'PROVIDER_LOOKUP' | 'OPERATOR_DECISION';
            provider: 'BREVO' | 'ZALO' | 'NONE';
            lookupStatus?: string;
            providerEvent?: string;
            providerMessageId?: string;
            decisionStatus?: 'SENT' | 'FAILED';
            decisionNote?: string;
            operatorId?: string;
            operatorName?: string;
            createdAt: string;
        }>;
    }>;
}
interface OutreachDeliveryLookup {
    deliveryId: string;
    variantId: string;
    channel: string;
    deliveryKey: string;
    provider: 'BREVO' | 'ZALO' | 'NONE';
    status: 'DELIVERED' | 'NOT_RECEIVED' | 'UNKNOWN' | 'UNSUPPORTED';
    recommendedStatus?: 'SENT' | 'FAILED';
    providerMessageId?: string;
    event?: string;
    error?: string;
    instruction: string;
}
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
    // Keep portal always mounted to avoid removeChild errors during HMR/unmount cycles.
    // Only render visible content when isOpen === true.
    return createPortal(
        isOpen ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-enter">
                <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{t('approvals.reject_modal_title')}</h3>
                    <textarea 
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full border border-[var(--glass-border)] rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none h-24 resize-none mb-4 bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] transition-colors"
                        placeholder={t('approvals.reject_reason_placeholder')}
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">{t('common.cancel')}</button>
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
        ) : null,
        document.body
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

    const isSelf = currentUser
        ? (currentUser.id && (proposal as any).createdById
            ? currentUser.id === (proposal as any).createdById
            : currentUser.name === proposal.createdBy)
        : false;
    const styles = RISK_STYLES[riskAssessment.level];

    return (
                <div 
            className={`bg-[var(--bg-surface)] rounded-[20px] border shadow-sm relative overflow-hidden transition-all duration-300 group flex flex-col h-full
                ${isSelected ? 'border-[var(--sgs-primary)] ring-2 ring-[var(--sgs-primary)]/20 bg-[var(--sgs-primary)]/10' : `border-[var(--glass-border)] hover:border-[var(--glass-border)] hover:shadow-md`}`}
            onClick={() => onToggleSelect(proposal.id)}
        >
            {/* Header / Selection */}
            <div className="p-4 flex justify-between items-start pb-2">
                <div className="flex items-center gap-3">
                    <div 
                        className={`w-5 h-5 rounded border transition-colors flex items-center justify-center
                            ${isSelected ? 'bg-[var(--sgs-primary)] border-sgs-primary text-white' : 'bg-[var(--bg-surface)] border-slate-300 text-transparent group-hover:border-[var(--sgs-primary)]'}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                        <div className="font-bold text-[var(--text-primary)] text-sm">{proposal.createdBy}</div>
                        <div className="text-xs2 text-[var(--text-secondary)] font-mono">{formatDateTime(proposal.createdAt)}</div>
                    </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs2 font-bold border uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border}`}>
                    {t(`approvals.risk_${riskAssessment.level.toLowerCase()}`)}
                </div>
            </div>
            {/* Content Body */}
            <div className="px-4 pb-4 flex-1">
                {/* Discount Highlight */}
                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-black text-[var(--text-primary)]">{discountPercent.toFixed(1)}%</span>
                    <span className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wide">{t('approvals.discount')}</span>
                </div>
                {/* Listing & Price Context */}
                <div className="bg-[var(--glass-surface)] rounded-xl p-3 mb-3 border border-[var(--glass-border)]">
                    <div className="text-xs font-bold text-[var(--text-secondary)] truncate mb-1" title={listing?.title}>
                        {listing?.title || t('approvals.unknown_listing')}
                    </div>
                    <div className="flex justify-between items-end">
                         <div className="text-xs2 text-[var(--text-tertiary)]">
                            {t('approvals.price_original')}: <span className="line-through">{formatCurrency(proposal.basePrice)}</span>
                         </div>
                         <div className="text-sm font-bold text-sgs-primary">
                            {formatCurrency(proposal.finalPrice)}
                         </div>
                    </div>
                </div>
                {/* Lead Context */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--glass-surface-hover)] flex items-center justify-center text-[var(--text-tertiary)]">
                        {ICONS.USER}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate flex-1 font-medium">{lead?.name || t('data.unknown')}</div>
                    {lead?.score && (
                        <div className={`text-xs2 font-bold px-1.5 rounded border ${lead.score.grade === 'A' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-[var(--glass-surface)] text-[var(--text-tertiary)] border-[var(--glass-border)]'}`}>
                            {t('approvals.lead_rank')} {lead.score.grade}
                        </div>
                    )}
                </div>                
                {/* Risk Reasons */}
                {riskAssessment.reasonKeys.length > 0 && (
                    <div className="text-xs2 text-[var(--text-tertiary)] mt-2 space-y-1">
                        {riskAssessment.reasonKeys.map(k => (
                            <div key={k} className="flex items-center gap-1.5">
                                <span className={styles.icon}>{ICONS.WARNING}</span> {t(`approvals.${k}`)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Footer Actions */}
            <div className="p-3 border-t border-[var(--glass-border)] flex gap-2 bg-[var(--glass-surface)]/50">
                <button 
                    onClick={(e) => { e.stopPropagation(); onReject(proposal.id); }}
                    className="flex-1 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                    {t('approvals.btn_reject')}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onApprove(proposal.id); }}
                    disabled={isSelf}
                    title={isSelf ? t('approvals.tooltip_self') : undefined}
                    className="flex-1 py-2 rounded-lg bg-sgs-primary-deep text-white text-xs font-bold hover:bg-slate-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSelf ? t('approvals.tooltip_self') : t('approvals.btn_approve')}
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
    const [brokerApprovals, setBrokerApprovals] = useState<OutreachApproval[]>([]);
    const [approvedOutreach, setApprovedOutreach] = useState<OutreachApproval[]>([]);
    const [listings, setListings] = useState<Record<string, Listing>>({});
    const [leads, setLeads] = useState<Record<string, Lead>>({});
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);   
    // UI State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<'RISK' | 'DATE'>('RISK');
    const [filterMode, setFilterMode] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [deliveryLookups, setDeliveryLookups] = useState<Record<string, OutreachDeliveryLookup>>({});
    const [deliveryLookupLoading, setDeliveryLookupLoading] = useState<string | null>(null);
    const [auditExportLoading, setAuditExportLoading] = useState<string | null>(null);
    const { t, formatDateTime, formatCurrency } = useTranslation();
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success', duration?: number) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), duration ?? RISK_CONSTANTS.TOAST_DURATION);
    }, []);
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [props, user, approvalData] = await Promise.all([
                db.getPendingProposals(),
                db.getCurrentUser(),
                api.get<{ items?: OutreachApproval[]; approvedOutreach?: OutreachApproval[] }>('/api/approval-requests')
                    .catch(() => ({ items: [], approvedOutreach: [] })),
            ]);
            setPending(props || []);
            setCurrentUser(user);            
            setBrokerApprovals(approvalData.items || []);
            setApprovedOutreach(approvalData.approvedOutreach || []);
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
                listRes.data.forEach((l: any) => listMap[l.id] = l);
                setListings(listMap);
                const leadMap: Record<string, Lead> = {};
                leadRes.forEach(l => { if (l) leadMap[l.id] = l; });
                setLeads(leadMap);
            }
        } catch (e) {
            notify(t('common.error_loading'), 'error');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { loadData(); }, [loadData]);
    // Sorting & Filtering
    const sortedProposals = useMemo(() => {
        let filtered = [...pending];
        if (filterMode !== 'ALL') {
            filtered = filtered.filter(p => {
                const pct = p.basePrice > 0 ? (p.discountAmount / p.basePrice) * 100 : 0;
                return analyzeRisk(pct, leads[p.leadId]?.score).level === filterMode;
            });
        }
        return filtered.sort((a, b) => {
            if (sortMode === 'RISK') {
                const getScore = (p: Proposal) => {
                   const lead = leads[p.leadId];
                   const pct = p.basePrice > 0 ? (p.discountAmount / p.basePrice) * 100 : 0;
                   return analyzeRisk(pct, lead?.score).score;
                };
                return getScore(b) - getScore(a);
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }, [pending, leads, sortMode, filterMode]);
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
        if (selectedIds.size === sortedProposals.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(sortedProposals.map(p => p.id)));
    };
    const processApproval = async (ids: string[]) => {
        const results = await Promise.allSettled(ids.map(id => db.approveProposal(id)));
        const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
        const successes = results.filter(r => r.status === 'fulfilled').length;
        if (successes > 0) {
            notify(t('approvals.approve_success') + ` (${successes})`, 'success');
            setSelectedIds(new Set());
            loadData();
        }
        for (const failure of failures) {
            const err = failure.reason as any;
            const errCode = err?.data?.error;
            if (errCode === 'AML_CLEARANCE_REQUIRED') {
                const price = err?.data?.finalPrice;
                const formattedPrice = price
                    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
                    : '';
                notify(
                    ` Cần xác minh AML trước khi phê duyệt${formattedPrice ? ` — Giá trị: ${formattedPrice}` : ''}. Vui lòng hoàn tất quy trình AML cho giao dịch này.`,
                    'error',
                    8000
                );
            } else {
                notify(err?.message || t('common.error'), 'error');
            }
        }
    };
    const processRejection = async (id: string, reason: string) => {
        try {
            await db.rejectProposal(id, reason);
            notify(t('approvals.reject_success'), 'success');
            setRejectId(null);
            loadData();
        } catch (e) { notify(t('common.error'), 'error'); }
    };
    const approveOutreach = async (id: string) => {
        try {
            await api.post(`/api/approval-requests/${id}/approve`, {});
            notify('Draft outreach đã được duyệt. Broker có thể gửi thủ công theo từng kênh.', 'success', 6000);
            await loadData();
        } catch (e: any) {
            notify(e?.data?.error || e?.message || t('common.error'), 'error', 6000);
        }
    };
    const sendOutreach = async (approvalId: string, variantId: string) => {
        try {
            await api.post(`/api/approval-requests/${approvalId}/send`, { variantId });
            notify('Đã gửi draft outreach qua provider.', 'success', 5000);
            await loadData();
        } catch (e: any) {
            notify(e?.data?.error || e?.message || 'Không thể gửi draft outreach. Hãy kiểm tra consent/provider.', 'error', 7000);
            await loadData();
        }
    };
    const deliveryLookupKey = (approvalId: string, variantId: string) => `${approvalId}:${variantId}`;
    const lookupOutreachDelivery = async (approvalId: string, variantId: string) => {
        const key = deliveryLookupKey(approvalId, variantId);
        setDeliveryLookupLoading(key);
        try {
            const result = await api.post<OutreachDeliveryLookup>(
                `/api/approval-requests/${approvalId}/delivery-lookup`,
                { variantId },
            );
            setDeliveryLookups(previous => ({ ...previous, [key]: result }));
            await loadData();
            notify(
                result.status === 'DELIVERED'
                    ? 'Provider đã ghi nhận message. Hãy đối chiếu người nhận trước khi chốt SENT.'
                    : result.status === 'NOT_RECEIVED'
                        ? 'Provider không ghi nhận message đã giao. Hãy đối chiếu trước khi chốt FAILED.'
                        : 'Provider chưa có bằng chứng đủ chắc chắn. Không gửi lại; kiểm tra thủ công.',
                result.status === 'UNKNOWN' || result.status === 'UNSUPPORTED' ? 'error' : 'success',
                7000,
            );
        } catch (e: any) {
            notify(e?.data?.error || e?.message || 'Không thể tra cứu provider.', 'error', 7000);
        } finally {
            setDeliveryLookupLoading(null);
        }
    };
    const reconcileOutreachDelivery = async (
        approvalId: string,
        variantId: string,
        status: 'SENT' | 'FAILED',
    ) => {
        const note = (await uiPrompt(
            status === 'SENT'
                ? 'Ghi chú đối soát: bằng chứng nào xác nhận provider đã gửi?'
                : 'Ghi chú đối soát: bằng chứng nào xác nhận provider không gửi?',
        ));
        if (!note?.trim()) return;
        const key = deliveryLookupKey(approvalId, variantId);
        setDeliveryLookupLoading(key);
        try {
            await api.post(`/api/approval-requests/${approvalId}/reconcile`, {
                variantId,
                status,
                note: note.trim(),
                providerMessageId: deliveryLookups[key]?.providerMessageId,
            });
            notify(status === 'SENT' ? 'Đã chốt delivery là SENT.' : 'Đã chốt delivery là FAILED.', 'success', 6000);
            await loadData();
        } catch (e: any) {
            notify(e?.data?.error || e?.message || 'Không thể chốt kết quả đối soát.', 'error', 7000);
            await loadData();
        } finally {
            setDeliveryLookupLoading(null);
        }
    };
    const exportOutreachAuditHistory = async (approvalId: string) => {
        setAuditExportLoading(approvalId);
        try {
            const response = await fetch(`/api/approval-requests/${approvalId}/outreach-audit-export`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const exportError = new Error(
                    errorData?.error || `Không thể xuất lịch sử đối soát (${response.status}).`,
                ) as Error & { code?: string; status?: number };
                exportError.code = errorData?.error;
                exportError.status = response.status;
                throw exportError;
            }
            const blob = await response.blob();
            if (blob.size === 0) {
                const exportError = new Error('OUTREACH_AUDIT_EXPORT_TEMPORARILY_UNAVAILABLE') as Error & {
                    code?: string;
                    status?: number;
                };
                exportError.code = 'OUTREACH_AUDIT_EXPORT_TEMPORARILY_UNAVAILABLE';
                exportError.status = 503;
                throw exportError;
            }
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const contentDisposition = response.headers.get('content-disposition') || '';
            const filename = contentDisposition.match(/filename="([^"]+)"/i)?.[1]
                || `outreach-audit-${approvalId}.csv`;
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            notify('Đã xuất lịch sử tra cứu và quyết định outreach.', 'success', 5000);
        } catch (error: any) {
            if (error?.code === 'OUTREACH_APPROVAL_NOT_FOUND' || error?.status === 404) {
                notify(
                    'Approval không còn hợp lệ nên không thể tải lịch sử đối soát. Hãy làm mới danh sách để kiểm tra lại.',
                    'error',
                    7000,
                );
            } else if (
                error?.code === 'OUTREACH_AUDIT_EXPORT_TEMPORARILY_UNAVAILABLE'
                || error?.status === 503
                || !error?.status
            ) {
                notify(
                    'Chưa thể tải lịch sử đối soát lúc này. Không có tệp nào được tạo; hãy thử lại.',
                    'error',
                    7000,
                );
            } else {
                notify(error?.message || 'Không thể xuất lịch sử đối soát.', 'error', 7000);
            }
        } finally {
            setAuditExportLoading(null);
        }
    };
    const pendingOutreach = brokerApprovals.filter(item => item.actionType === 'DRAFT_OUTREACH');
    const deliveryForVariant = (item: OutreachApproval, variantId: string) =>
        (item.deliveries || []).find(delivery =>
            delivery.variantId === variantId
            || Boolean(delivery.executionId?.endsWith(`:${variantId}`)),
        );
    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <>
          <SeoHead title="Hộp Phê Duyệt | SGS LAND" description="Xem xét và phê duyệt các yêu cầu, hợp đồng và giao dịch bất động sản." canonicalPath="/approval-inbox" />
        <div className="p-4 sm:p-6 space-y-6 pb-24 relative animate-enter">

            {(pendingOutreach.length > 0 || approvedOutreach.length > 0) && (
                <section className="space-y-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-sgs-primary">Outreach broker</p>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Draft đã duyệt và gửi thủ công</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Consent được kiểm tra lại ngay trước khi gửi. Không có auto-send và kết quả không rõ sẽ không được gửi lại tự động.
                        </p>
                    </div>
                    {[...pendingOutreach.map(item => ({ ...item, _pending: true })), ...approvedOutreach.map(item => ({ ...item, _pending: false }))].map(item => (
                        <div
                            key={item.id}
                            data-testid={`outreach-approval-card-${item.id}`}
                            className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 md:p-5 shadow-sm"
                        >
                            <div className="flex flex-wrap justify-between gap-3 items-start">
                                <div>
                                    <p className="font-bold text-[var(--text-primary)]">{item.leadName || 'Lead'}</p>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                        {item._pending ? 'Đang chờ broker duyệt' : 'Đã duyệt — chọn variant để gửi'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {!item._pending && (
                                        <button
                                            type="button"
                                            onClick={() => exportOutreachAuditHistory(item.id)}
                                            disabled={auditExportLoading === item.id}
                                            className="px-3 py-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-primary)] text-xs font-bold hover:bg-[var(--glass-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {auditExportLoading === item.id ? 'Đang xuất…' : 'Xuất lịch sử đối soát'}
                                        </button>
                                    )}
                                    {item._pending && (
                                        <button
                                            onClick={() => approveOutreach(item.id)}
                                            className="px-4 py-2 rounded-xl bg-sgs-primary-deep text-white text-xs font-bold hover:bg-slate-800"
                                        >
                                            Duyệt draft
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
                                {(item.payload?.draftVariants || []).map(variant => {
                                    const delivery = deliveryForVariant(item, variant.id);
                                    const sent = delivery?.status === 'SENT';
                                    const unknown = delivery?.status === 'UNKNOWN';
                                    const lookupKey = deliveryLookupKey(item.id, variant.id);
                                    const lookup = deliveryLookups[lookupKey];
                                    const lookupLoading = deliveryLookupLoading === lookupKey;
                                    return (
                                            <div key={variant.id} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
                                            <div className="flex justify-between gap-3 items-center">
                                                <span className="text-xs font-bold uppercase tracking-wider text-sgs-primary">{variant.channel}</span>
                                                {delivery && <span className={`text-[11px] font-bold ${sent ? 'text-emerald-600' : 'text-amber-600'}`}>{delivery.status}</span>}
                                            </div>
                                            {variant.subject && <p className="text-sm font-semibold mt-2 text-[var(--text-primary)]">{variant.subject}</p>}
                                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line mt-2">{variant.message}</p>
                                            {!item._pending && variant.channel === 'CALL_SCRIPT' && (
                                                <p className="text-xs text-amber-700 mt-3">Kịch bản này chỉ để broker gọi thủ công; hệ thống không gọi thay.</p>
                                            )}
                                            {unknown && (
                                                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                                    <p className="font-bold">Delivery chưa rõ — không gửi lại.</p>
                                                    <p className="mt-1">Tra cứu provider bằng delivery key trước khi chốt SENT hoặc FAILED.</p>
                                                    {delivery?.deliveryKey && (
                                                        <code className="mt-2 block break-all rounded bg-white/70 px-2 py-1 text-[10px]">
                                                            {delivery.deliveryKey}
                                                        </code>
                                                    )}
                                                    <button
                                                        onClick={() => lookupOutreachDelivery(item.id, variant.id)}
                                                        disabled={lookupLoading}
                                                        className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                                                    >
                                                        {lookupLoading ? 'Đang tra cứu…' : 'Tra cứu provider'}
                                                    </button>
                                                    {lookup && (
                                                        <div className="mt-3 border-t border-amber-200 pt-2">
                                                            <p className="font-semibold">
                                                                Kết quả: {lookup.status}
                                                                {lookup.event ? ` (${lookup.event})` : ''}
                                                                {lookup.providerMessageId ? ` · ${lookup.providerMessageId}` : ''}
                                                            </p>
                                                            <p className="mt-1">{lookup.instruction}</p>
                                                            {lookup.error && <p className="mt-1 text-rose-700">{lookup.error}</p>}
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <button
                                                                    onClick={() => reconcileOutreachDelivery(item.id, variant.id, 'SENT')}
                                                                    disabled={lookupLoading}
                                                                    className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                                                                >
                                                                    Chốt SENT
                                                                </button>
                                                                <button
                                                                    onClick={() => reconcileOutreachDelivery(item.id, variant.id, 'FAILED')}
                                                                    disabled={lookupLoading}
                                                                    className="rounded-lg border border-rose-300 bg-white px-3 py-2 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                                                >
                                                                    Chốt FAILED
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                             {delivery?.auditHistory && delivery.auditHistory.length > 0 && (
                                                 <details className="mt-3 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)]" open>
                                                     <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-[var(--text-primary)]">
                                                         Lịch sử tra cứu và quyết định ({delivery.auditHistory.length})
                                                     </summary>
                                                     <div className="space-y-2 border-t border-[var(--glass-border)] px-3 py-3">
                                                         {delivery.auditHistory.map(event => (
                                                             <div key={event.id} className="rounded-lg bg-[var(--glass-surface)] p-2.5 text-xs text-[var(--text-secondary)]">
                                                                 <div className="flex flex-wrap items-center justify-between gap-2">
                                                                     <span className="font-bold text-[var(--text-primary)]">
                                                                         {event.eventType === 'PROVIDER_LOOKUP' ? 'Tra cứu provider' : 'Quyết định operator'}
                                                                     </span>
                                                                     <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                                                                 </div>
                                                                 <div className="mt-1 space-y-0.5">
                                                                     {event.eventType === 'PROVIDER_LOOKUP' && (
                                                                         <p>
                                                                             Kết quả: <strong>{event.lookupStatus || '—'}</strong>
                                                                             {event.providerEvent ? ` · Event: ${event.providerEvent}` : ''}
                                                                         </p>
                                                                     )}
                                                                     {event.providerMessageId && (
                                                                         <p>Provider message ID: <code className="break-all">{event.providerMessageId}</code></p>
                                                                     )}
                                                                     {event.eventType === 'OPERATOR_DECISION' && (
                                                                         <p>
                                                                             Quyết định: <strong>{event.decisionStatus || '—'}</strong>
                                                                             {event.decisionNote ? ` · ${event.decisionNote}` : ''}
                                                                         </p>
                                                                     )}
                                                                     <p>Operator: {event.operatorName || event.operatorId || 'Không xác định'}</p>
                                                                 </div>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 </details>
                                             )}
                                            {!item._pending && variant.channel !== 'CALL_SCRIPT' && !unknown && (
                                                <button
                                                    onClick={() => sendOutreach(item.id, variant.id)}
                                                    disabled={sent || delivery?.status === 'FAILED'}
                                                    className="mt-3 w-full py-2 rounded-lg bg-sgs-primary-deep text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {sent ? 'Đã gửi' : delivery?.status === 'FAILED' ? 'Đã thất bại — cần xử lý lại theo quy trình' : 'Gửi thủ công'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* METRICS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-[var(--bg-surface)] p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                    <span className="text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest truncate">{t('approvals.metric_pipeline')}</span>
                    <div className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight mt-1">{formatCurrency(metrics.totalValue)}</div>
                </div>
                <div className="bg-[var(--bg-surface)] p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col justify-between">
                    <span className="text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest truncate">{t('approvals.metric_avg_discount')}</span>
                    <div className="text-xl md:text-2xl font-black text-sgs-primary tracking-tight mt-1">{metrics.avgDiscount.toFixed(1)}%</div>
                </div>
                <div className="bg-[var(--bg-surface)] p-4 md:p-5 rounded-2xl md:rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col justify-between">
                    <span className="text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest truncate">{t('approvals.metric_high_risk')}</span>
                    <div className="text-xl md:text-2xl font-black text-rose-500 tracking-tight mt-1">{metrics.highRiskCount}</div>
                </div>
            </div>
            {/* TOOLBAR */}
            <div className="flex flex-wrap justify-between items-center bg-[var(--bg-surface)] p-4 rounded-[24px] border border-[var(--glass-border)] shadow-sm gap-4 sticky top-0 z-20 backdrop-blur-md bg-[var(--bg-surface)]/90">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('approvals.title')}</h2>
                    <span className="bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full text-xs font-bold">{pending.length}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSelectAll} className="text-xs font-bold text-[var(--text-tertiary)] hover:text-sgs-primary transition-colors">
                        {selectedIds.size === sortedProposals.length && sortedProposals.length > 0 ? t('approvals.deselect_all') : t('approvals.select_all')}
                    </button>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <Dropdown 
                        value={filterMode}
                        onChange={(v) => setFilterMode(v as any)}
                        options={[
                            { value: 'ALL', label: t('approvals.filter_all') },
                            { value: 'HIGH', label: t('approvals.filter_high') },
                            { value: 'MEDIUM', label: t('approvals.filter_medium') },
                            { value: 'LOW', label: t('approvals.filter_low') }
                        ]}
                         className="min-w-[150px]"
                         variant="compact"
                        icon={ICONS.FILTER}
                    />
                    <Dropdown 
                        value={sortMode}
                        onChange={(v) => setSortMode(v as any)}
                        options={[
                            { value: 'RISK', label: t('approvals.sort_risk') },
                            { value: 'DATE', label: t('approvals.sort_date') }
                        ]}
                         className="min-w-[160px]"
                         variant="compact"
                        icon={ICONS.SORT}
                    />
                </div>
            </div>
            {/* GRID */}
            {sortedProposals.length === 0 ? (
                <div className="p-20 text-center text-[var(--text-secondary)] flex flex-col items-center border-2 border-dashed border-[var(--glass-border)] rounded-[32px]">
                    <div className="w-16 h-16 bg-[var(--glass-surface)] rounded-full flex items-center justify-center mb-4 text-[var(--text-secondary)]">{ICONS.CHECK_CIRCLE}</div>
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
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sgs-primary-deep text-white p-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-scale-up border border-slate-700 min-w-[300px] justify-between">
                    <div className="pl-2 text-sm font-bold flex items-center gap-2">
                        <span className="bg-sgs-primary px-2 py-0.5 rounded-full text-xs">{selectedIds.size}</span>
                        {t('approvals.selected_count')}
                    </div>
                    <button 
                        onClick={() => processApproval(Array.from(selectedIds))}
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)] px-6 py-2 rounded-xl text-xs font-bold hover:bg-sgs-champagne transition-colors shadow-lg active:scale-95"
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