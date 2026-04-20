
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lead, LeadStage, Interaction, Channel, Direction, LEAD_SOURCES, VN_PHONE_REGEX, ContractStatus, ContractType, Contract, PaymentMilestone } from '../types';
import { db } from '../services/dbApi';
import { contractApi } from '../services/api/contractApi';
import { aiService } from '../services/aiService';
import { useTranslation } from '../services/i18n';
import { Dropdown } from './Dropdown';
import { ContractModal } from './ContractModal';
import { useSocket } from '../services/websocket';
import { AiCreditBadge, AiQuotaGate, type QuotaInfo } from './AiCreditBadge';

const fmtDots = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const stripMarkdown = (text: string): string =>
    text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/#{1,6}\s*/g, '')
        .replace(/^[-•]\s+/gm, '• ')
        .replace(/__(.+?)__/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .trim();

const AIAnalysisCard = ({ summary, loading, t, onRefresh, quota, onUpgrade }: any) => (
    <div className="bg-white p-5 rounded-2xl mb-8 border border-indigo-100 shadow-sm animate-enter relative group overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 text-xs uppercase tracking-widest">{t('detail.ai_analysis')}</h4>
                    <p className="text-2xs text-indigo-500 font-semibold uppercase tracking-tighter">{t('detail.ai_badge')}</p>
                </div>
            </div>
            <AiQuotaGate quota={quota} featureLabel="ARIA" onUpgradeClick={onUpgrade}>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="p-2 text-indigo-500 hover:text-indigo-700 bg-indigo-50 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm disabled:opacity-50"
                    title={t('common.refresh')}
                >
                    <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </AiQuotaGate>
        </div>

        {/* Credit badge — only shown when quota is limited and not unlimited */}
        {quota && !quota.isUnlimited && (
            <div className="mb-3 relative z-10">
                <AiCreditBadge quota={quota} featureLabel="Phân tích ARIA" onUpgradeClick={onUpgrade} />
            </div>
        )}

        {loading ? (
            <div className="space-y-2.5 py-1 relative z-10">
                <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-full"></div>
                <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-5/6"></div>
                <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-2/3"></div>
            </div>
        ) : quota && !quota.isUnlimited && quota.remaining <= 0 && !summary ? (
            <AiQuotaGate quota={quota} featureLabel="phân tích ARIA" onUpgradeClick={onUpgrade}>
                <span />
            </AiQuotaGate>
        ) : (
            <div className="relative z-10">
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {summary || t('detail.ai_no_data')}
                </p>
                <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-2xs font-bold rounded-full uppercase tracking-tighter border border-indigo-100">{t('detail.ai_insights')}</span>
                    <div className="h-px flex-1 bg-indigo-100"></div>
                </div>
            </div>
        )}
    </div>
);

const DetailField = ({ label, children, className, error }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase ml-1 block tracking-wide">{label}</label>
        {children}
        {error && <p className="text-xs2 text-rose-500 font-bold ml-1">{error}</p>}
    </div>
);

const TimelineItem = ({ item, t, formatDateTime }: any) => {
    const isSystem = item.type === 'SYSTEM' || item.metadata?.systemType;

    if (isSystem) {
        return (
            <div className="flex gap-4 pb-6 ml-2 pl-6 relative animate-enter items-center">
                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white"></div>
                <div className="w-full bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-lg p-2 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                    <span>{item.content}</span>
                    <span className="text-xs2 font-mono opacity-60">{formatDateTime(item.timestamp)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-4 pb-6 border-l border-[var(--glass-border)] ml-2 pl-6 relative animate-enter">
            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${item.direction === Direction.OUTBOUND ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
            <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                        {item.direction === Direction.OUTBOUND ? t('detail.timeline_you') : t('detail.timeline_lead')}
                    </span>
                    <span className="text-xs2 text-[var(--text-secondary)]">• {formatDateTime(item.timestamp)}</span>
                    <span className={`text-2xs px-1.5 py-0.5 rounded uppercase font-bold ${
                        item.channel === Channel.ZALO ? 'bg-blue-50 text-blue-600' : 
                        item.channel === Channel.EMAIL ? 'bg-amber-50 text-amber-600' : 
                        item.channel === Channel.SMS ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)]'
                    }`}>{item.channel}</span>
                </div>
                <div className={`text-sm p-3 rounded-lg border w-fit max-w-[90%] ${item.direction === Direction.OUTBOUND ? 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)]' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>
                    {item.content}
                </div>
            </div>
        </div>
    );
};

const ICONS = {
    SEND: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    ZALO: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S16.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v4h-4v2h4v4h2v-4h4v-2h-4V6h-2z" fillRule="evenodd" /></svg>,
    EMAIL: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    SMS: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    EDIT_PEN: <svg className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
};

const STYLES = {
    INPUT: "w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
    INPUT_ERROR: "w-full border border-rose-300 bg-rose-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
};

interface LeadDetailProps {
    lead: Lead;
    onClose: () => void;
    onUpdate: (lead: Lead) => Promise<void>;
    isModal?: boolean;
}

export const LeadDetail: React.FC<LeadDetailProps> = ({ lead, onClose, onUpdate, isModal }) => {
    const { socket } = useSocket();
    const [formData, setFormData] = useState<Lead>({ ...lead });
    const [isSaving, setIsSaving] = useState(false);
    const [isScoring, setIsScoring] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [aiSummary, setAiSummary] = useState("");
    const [ariaQuota, setAriaQuota] = useState<QuotaInfo | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [activeChannel, setActiveChannel] = useState<Channel>(Channel.ZALO);
    const [messageContent, setMessageContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);
    const [editingContractInitialTab, setEditingContractInitialTab] = useState<'parties' | 'property' | 'terms' | 'schedule'>('schedule');
    const [localContractSchedule, setLocalContractSchedule] = useState<PaymentMilestone[] | null>(null);
    const [localContractInfo, setLocalContractInfo] = useState<{
        contractId: string;
        contractStatus?: string;
        contractType?: string;
        contractValue?: number;
        contractNumber?: string;
        contractPaymentSchedule?: PaymentMilestone[];
    } | null>(null);
    const [loadingEditContract, setLoadingEditContract] = useState(false);
    const [activeViewers, setActiveViewers] = useState<any[]>([]);
    const { t, formatDateTime, language } = useTranslation();

    const [users, setUsers] = useState<{value: string, label: string}[]>([]);

    const refreshAiSummary = async () => {
        setIsThinking(true);
        try {
            const history = await db.getInteractions(lead.id);
            const { summary, quota } = await aiService.summarizeLead(lead, history, language);
            setAiSummary(stripMarkdown(summary));
            if (quota) setAriaQuota(quota as QuotaInfo);
        } catch (e) {
            setAiSummary(t('detail.ai_unavailable'));
        } finally {
            setIsThinking(false);
        }
    };

    useEffect(() => {
        setFormData({ ...lead });
        setErrors({});
        setAiSummary("");
        setLocalContractSchedule(null);
        setLocalContractInfo(null);
        
        const load = async () => {
            const history = await db.getInteractions(lead.id);
            setInteractions(history.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            
            try {
                const res = await db.getMembers();
                setUsers([
                    { value: '', label: t('inbox.unassigned') },
                    ...res.data.map((u: any) => ({ value: u.id, label: u.name }))
                ]);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, [lead, language]);

    // Collaboration Presence Tracking
    useEffect(() => {
        if (!lead.id) return;

        const setupPresence = async () => {
            try {
                const currentUser = await db.getCurrentUser();
                if (currentUser) {
                    socket?.emit("view_lead", { leadId: lead.id, user: currentUser });
                }
            } catch (e) {
                console.error("Failed to get current user for presence", e);
            }
        };

        setupPresence();

        const handleActiveViewers = (viewers: any[]) => {
            setActiveViewers(viewers);
        };

        socket?.on("active_viewers", handleActiveViewers);

        return () => {
            socket?.emit("leave_lead", { leadId: lead.id });
            socket?.off("active_viewers", handleActiveViewers);
        };
    }, [lead.id, socket]);

    const handleSendMessage = async () => {
        if (!messageContent.trim()) return;
        setIsSending(true);
        try {
            await db.sendInteraction(lead.id, messageContent, activeChannel);
            setMessageContent('');
            // Refresh
            const history = await db.getInteractions(lead.id);
            setInteractions(history.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (error) {
            console.error("Failed to send", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleCreateContract = () => {
        setIsContractModalOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate(formData);
            if(isModal) onClose();
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleInputChange = (field: keyof Lead, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleScoreLead = async () => {
        if (!formData.id || isScoring) return;
        setIsScoring(true);
        try {
            const history = await db.getInteractions(formData.id);
            const lastMsg = history[0]?.content;
            const result = await aiService.scoreLead(formData, lastMsg, undefined, language);
            const newScore = { score: result.score, grade: result.grade, reasoning: result.reasoning };
            setFormData(prev => ({ ...prev, score: newScore }));
            await onUpdate({ ...formData, score: newScore });
        } catch (e) {
            console.error('Score lead failed', e);
        } finally {
            setIsScoring(false);
        }
    };

    const stageOptions = Object.values(LeadStage).map(s => ({ value: s, label: t(`stage.${s}`) }));
    // Fix: Translate raw source values if they are simple English words, or keep as is if proper nouns (Facebook/Zalo)
    const sourceOptions = LEAD_SOURCES.map(s => ({ 
        value: s, 
        label: t(`source.${s}`) !== `source.${s}` ? t(`source.${s}`) : s 
    }));
    
    const scoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-100';
        return 'text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] border-[var(--glass-border)]';
    };

    // --- RENDER CONTENT ---
    const content = (
        <div className={`bg-[var(--bg-surface)] ${isModal ? 'fixed inset-0 z-[70] md:inset-y-4 md:inset-x-auto md:right-4 md:w-[80vw] lg:w-[900px] md:rounded-3xl md:shadow-2xl animate-slide-in-right border border-[var(--glass-border)] overflow-y-auto no-scrollbar' : 'h-full flex flex-col'}`}>
            
            {/* Header - sticky at top when modal */}
            <div className={`flex justify-between items-center p-4 md:p-6 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm ${isModal ? 'sticky top-0 z-20' : 'flex-none relative z-20'}`}>
                <div className="flex-1 mr-4 flex items-center gap-4">
                    {/* Visual Anchor: Avatar */}
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl border-2 border-white shadow-sm shrink-0">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="group relative">
                            <input 
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className={`font-bold text-xl md:text-2xl text-[var(--text-primary)] w-full bg-transparent border border-transparent rounded-lg px-2 py-1 focus:bg-[var(--glass-surface)] focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 truncate`}
                                placeholder={t('auth.placeholder_name')}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                {ICONS.EDIT_PEN}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 mt-0.5">
                            <span
                                className="text-xs2 font-mono text-[var(--text-secondary)] bg-[var(--glass-surface)] px-1.5 py-0.5 rounded border border-[var(--glass-border)] cursor-pointer hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                                title={formData.id || ''}
                                onClick={() => formData.id && navigator.clipboard.writeText(formData.id)}
                            >
                                {formData.id ? `#${formData.id.slice(0, 8).toUpperCase()}` : 'NEW'}
                            </span>
                            {formData.score && (
                                <div className="group relative">
                                    <span className={`text-xs2 font-bold px-1.5 py-0.5 rounded border ${scoreColor(formData.score.score)} bg-transparent cursor-help`}>
                                        {formData.score.grade} · {formData.score.score} pts
                                    </span>
                                    {formData.score.reasoning && (
                                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-[var(--bg-surface)] dark:bg-slate-800 rounded-xl shadow-xl border border-[var(--glass-border)] dark:border-slate-700 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs3 text-[var(--text-secondary)] dark:text-slate-300 leading-relaxed">
                                            <div className="font-bold text-indigo-600 mb-1 uppercase tracking-tighter">AI Reasoning</div>
                                            {formData.score.reasoning}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={handleScoreLead}
                                disabled={isScoring || !formData.id}
                                title={t('detail.score_btn')}
                                className="flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isScoring ? (
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                ) : (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                                )}
                                {isScoring ? t('detail.scoring') : t('detail.score_btn')}
                            </button>
                            
                            {/* Active Viewers Collaboration */}
                            {activeViewers.length > 1 && (
                                <div className="flex items-center ml-2">
                                    <div className="flex -space-x-2">
                                        {activeViewers.map((viewer, idx) => (
                                            <div key={idx} className="w-6 h-6 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-3xs font-bold text-indigo-700 shadow-sm" title={viewer.name}>
                                                {viewer.name?.charAt(0).toUpperCase()}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="ml-2 text-xs2 text-[var(--text-tertiary)] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {t('detail.viewing')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button type="button" onClick={onClose} aria-label={t('common.close')} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-2.5 rounded-full hover:bg-[var(--glass-surface-hover)] transition-colors shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Scrollable Body */}
            <div className={`p-4 md:p-6 bg-[var(--glass-surface)]/30 ${!isModal ? 'flex-1 min-h-0 overflow-y-auto no-scrollbar' : ''}`}>
                    <AIAnalysisCard summary={aiSummary} loading={isThinking} t={t} onRefresh={refreshAiSummary} quota={ariaQuota} onUpgrade={() => window.open('/pricing', '_blank')} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 mb-8">
                        <DetailField label={t('leads.phone')}>
                            <input value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} className={STYLES.INPUT} />
                        </DetailField>
                        <DetailField label={t('leads.email')}>
                            <input value={formData.email || ''} onChange={e => handleInputChange('email', e.target.value)} className={STYLES.INPUT} />
                        </DetailField>
                        <DetailField label={t('leads.address')} className="sm:col-span-2">
                            <input value={formData.address || ''} onChange={e => handleInputChange('address', e.target.value)} className={STYLES.INPUT} />
                        </DetailField>
                        <DetailField label={t('leads.stage')}>
                            <Dropdown value={formData.stage} onChange={(val) => handleInputChange('stage', val)} options={stageOptions} className="w-full" />
                        </DetailField>
                        <DetailField label={t('leads.source')}>
                            <Dropdown value={formData.source} onChange={(val) => handleInputChange('source', val)} options={sourceOptions} className="w-full" />
                        </DetailField>
                        {/* Social Profiles — auto-populated from Zalo/Facebook webhooks */}
                        {(lead.socialIds?.zalo || lead.socialIds?.facebook || lead.socialIds?.telegram) && (
                            <div className="sm:col-span-2">
                                <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-2 tracking-wider">Tài khoản mạng xã hội</div>
                                <div className="flex flex-wrap gap-2">
                                    {lead.socialIds?.zalo && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-xs font-mono">
                                            <span className="w-5 h-5 bg-blue-600 text-white rounded font-bold text-xs flex items-center justify-center shrink-0">Z</span>
                                            <span className="font-medium">Zalo:</span>
                                            <span className="select-all">{lead.socialIds.zalo}</span>
                                        </div>
                                    )}
                                    {lead.socialIds?.facebook && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2]/5 border border-[#1877F2]/20 text-[#1877F2] rounded-xl text-xs font-mono">
                                            <span className="w-5 h-5 bg-[#1877F2] text-white rounded-full font-bold text-xs flex items-center justify-center shrink-0">f</span>
                                            <span className="font-medium">Facebook:</span>
                                            <span className="select-all">{lead.socialIds.facebook}</span>
                                        </div>
                                    )}
                                    {lead.socialIds?.telegram && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-xl text-xs font-mono">
                                            <span className="w-5 h-5 bg-sky-500 text-white rounded-full font-bold text-xs flex items-center justify-center shrink-0">✈</span>
                                            <span className="font-medium">Telegram:</span>
                                            <span className="select-all">{lead.socialIds.telegram}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <DetailField label={t('leads.assigned_to')}>
                            <Dropdown value={formData.assignedTo || ''} onChange={(val) => handleInputChange('assignedTo', val)} options={users} className="w-full" />
                        </DetailField>
                        <DetailField label={t('leads.notes')} className="sm:col-span-2">
                            <textarea
                                value={formData.notes || ''}
                                onChange={e => handleInputChange('notes', e.target.value)}
                                rows={formData.notes ? 6 : 3}
                                className={`w-full border border-[var(--glass-border)] rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none no-scrollbar ${formData.notes ? 'bg-amber-50/60 font-mono text-xs text-[var(--text-secondary)] leading-relaxed' : ''}`}
                                placeholder={t('leads.notes_placeholder')}
                            />
                        </DetailField>
                    </div>

                    {(() => {
                        const effectiveContractId = localContractInfo?.contractId ?? lead.contractId;
                        const effectiveStatus = localContractInfo?.contractStatus ?? lead.contractStatus;
                        const effectiveType = localContractInfo?.contractType ?? lead.contractType;
                        const effectiveValue = localContractInfo?.contractValue ?? lead.contractValue;
                        const effectiveNumber = localContractInfo?.contractNumber ?? lead.contractNumber;

                        if (!effectiveContractId) {
                            return (
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        <h4 className="font-bold text-xs text-[var(--text-secondary)] uppercase tracking-widest">{t('detail.linked_contracts') || 'Hợp đồng liên kết'}</h4>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="bg-[var(--bg-surface)] border-2 border-dashed border-[var(--glass-border)] rounded-2xl p-6 text-center">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <p className="text-sm font-bold text-[var(--text-secondary)] mb-1">{t('detail.no_contract_title') || 'Chưa có hợp đồng'}</p>
                                        <p className="text-xs text-[var(--text-tertiary)] mb-4">{t('detail.no_contract_desc') || 'Tạo hợp đồng để quản lý tiến độ thanh toán'}</p>
                                        <button
                                            type="button"
                                            onClick={handleCreateContract}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors shadow-sm active:scale-95"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            {t('detail.create_contract') || 'Tạo hợp đồng'}
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        const schedule: PaymentMilestone[] = localContractSchedule ?? localContractInfo?.contractPaymentSchedule ?? lead.contractPaymentSchedule ?? [];
                        const paidCount = schedule.filter(m => m.status === 'PAID').length;
                        const total = schedule.length;
                        const totalPaidAmt = schedule.filter(m => m.status === 'PAID').reduce((s, m) => s + (m.paidAmount ?? m.amount ?? 0), 0);
                        const totalScheduledAmt = schedule.reduce((s, m) => s + (m.amount || 0), 0);
                        const denominator = Number(effectiveValue) || totalScheduledAmt;
                        const paidPct = denominator > 0 ? Math.min(100, Math.round((totalPaidAmt / denominator) * 100)) : (total > 0 ? Math.round((paidCount / total) * 100) : 0);
                        const overdueInDetail = schedule.filter(m => m.status === 'OVERDUE' || (m.status === 'PENDING' && m.dueDate && new Date(m.dueDate) < new Date())).length;
                        const statusColor = effectiveStatus === ContractStatus.SIGNED ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : effectiveStatus === ContractStatus.CANCELLED ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-amber-600 bg-amber-50 border-amber-200';
                        return (
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-3">
                                    <h4 className="font-bold text-xs text-[var(--text-secondary)] uppercase tracking-widest">{t('detail.linked_contracts') || 'Hợp đồng liên kết'}</h4>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>
                                <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-[var(--text-primary)] truncate">{effectiveNumber || `HĐ-${effectiveContractId?.slice(-6)}`}</span>
                                                {effectiveStatus && <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${statusColor}`}>{t(`contract_status.${effectiveStatus}`) || effectiveStatus}</span>}
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                {effectiveType ? (t(`contract_type.${effectiveType}`) || effectiveType) : ''}
                                                {effectiveValue ? ` · ${fmtDots(effectiveValue)} đ` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-none">
                                            <button
                                                type="button"
                                                onClick={() => window.open(`/p/contract_${effectiveContractId}`, '_blank')}
                                                title={t('contracts.btn_preview_print') || 'Xem trước & In'}
                                                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                                {t('contracts.btn_print_short') || 'In / PDF'}
                                            </button>
                                            <button
                                                disabled={loadingEditContract}
                                                onClick={async () => {
                                                    setLoadingEditContract(true);
                                                    try {
                                                        const full = await contractApi.getContractById(effectiveContractId!);
                                                        setEditingContractInitialTab('schedule');
                                                        setEditingContract(full);
                                                    } catch (e) {
                                                        console.error('Failed to load contract', e);
                                                    } finally {
                                                        setLoadingEditContract(false);
                                                    }
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-60"
                                            >
                                                {loadingEditContract
                                                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                }
                                                {t('common.edit') || 'Sửa'}
                                            </button>
                                        </div>
                                    </div>
                                    {schedule.length > 0 ? (
                                        <div>
                                            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                                                <span>{t('leads.col_payment_progress') || 'Tiến độ TT'}</span>
                                                <span className={`font-bold ${overdueInDetail > 0 ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}>
                                                    {paidCount}/{total} đợt · {paidPct}%
                                                    {overdueInDetail > 0 && ` · ${overdueInDetail} quá hạn`}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${overdueInDetail > 0 ? 'bg-rose-500' : paidPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${paidPct}%` }} />
                                            </div>
                                            <div className="mt-3 space-y-1.5">
                                                {schedule.map((m, idx) => {
                                                    const isActuallyOverdue = m.status === 'OVERDUE' || (m.status === 'PENDING' && m.dueDate && new Date(m.dueDate) < new Date());
                                                    const dotCls = m.status === 'PAID'
                                                        ? 'bg-emerald-500 text-white'
                                                        : m.status === 'WAIVED'
                                                        ? 'bg-slate-300 text-slate-500'
                                                        : isActuallyOverdue
                                                        ? 'bg-rose-500 text-white animate-pulse'
                                                        : 'bg-slate-200 text-slate-500';
                                                    const amtCls = m.status === 'PAID'
                                                        ? 'text-emerald-600'
                                                        : isActuallyOverdue
                                                        ? 'text-rose-600'
                                                        : m.status === 'WAIVED'
                                                        ? 'text-slate-400 line-through'
                                                        : 'text-[var(--text-primary)]';
                                                    return (
                                                        <div key={m.id || idx} className={`flex items-center gap-2 text-xs py-1 px-1.5 rounded-lg ${isActuallyOverdue ? 'bg-rose-50' : m.status === 'PAID' ? 'bg-emerald-50/50' : ''}`}>
                                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-none text-[10px] font-bold ${dotCls}`}>
                                                                {m.status === 'PAID' ? '✓' : m.status === 'WAIVED' ? '—' : idx + 1}
                                                            </span>
                                                            <span className="flex-1 text-[var(--text-secondary)] truncate">{m.name || `Đợt ${idx + 1}`}</span>
                                                            <span className="text-[var(--text-tertiary)] tabular-nums">{m.dueDate ? new Date(m.dueDate).toLocaleDateString('vi-VN') : ''}</span>
                                                            {m.percentage > 0 && <span className="text-[var(--text-tertiary)] text-[10px]">{m.percentage}%</span>}
                                                            <span className={`font-bold tabular-nums ${amtCls}`}>{m.amount ? fmtDots(m.amount) + ' đ' : ''}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {totalScheduledAmt > 0 && (
                                                <div className="mt-2 pt-2 border-t border-[var(--glass-border)] flex justify-between text-xs">
                                                    <span className="text-[var(--text-tertiary)]">{t('payment.total_paid') || 'Đã thanh toán'}</span>
                                                    <span className="font-bold text-emerald-600">{fmtDots(totalPaidAmt)} đ / {fmtDots(totalScheduledAmt)} đ</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-[var(--text-secondary)] italic">{t('contracts.no_payment_schedule') || 'Chưa có tiến độ thanh toán'}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="mb-8 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                            {[Channel.ZALO, Channel.EMAIL, Channel.SMS].map(ch => (
                                <button key={ch} onClick={() => setActiveChannel(ch)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeChannel === ch ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'bg-[var(--glass-surface)] text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)]'}`}>
                                    {ch === Channel.ZALO ? ICONS.ZALO : ch === Channel.EMAIL ? ICONS.EMAIL : ICONS.SMS} {ch}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <textarea 
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                                className="w-full border border-[var(--glass-border)] rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-24 no-scrollbar"
                                placeholder={t('detail.placeholder_msg')}
                            />
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs2 text-[var(--text-secondary)] uppercase font-bold tracking-wider">{activeChannel}</span>
                                <button onClick={handleSendMessage} disabled={isSending || !messageContent.trim()} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm active:scale-95">
                                    {isSending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : ICONS.SEND}
                                    {isSending ? t('detail.sending') : t('detail.send')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                            <h4 className="font-bold text-xs text-[var(--text-secondary)] uppercase tracking-widest">{t('detail.history')}</h4>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>
                        <div className="space-y-0">
                            {interactions.map((i) => <TimelineItem key={i.id} item={i} t={t} formatDateTime={formatDateTime} />)}
                            {interactions.length === 0 && <div className="text-center py-10 text-[var(--text-secondary)] border-2 border-dashed border-[var(--glass-border)] rounded-2xl text-xs">{t('detail.empty_history')}</div>}
                        </div>
                    </div>
            </div>

            <div className={`p-4 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] flex gap-3 ${isModal ? 'sticky bottom-0 z-20' : 'flex-none relative z-20'}`}>
                {(() => {
                    const existingContractId = localContractInfo?.contractId ?? lead.contractId;
                    if (existingContractId) {
                        return (
                            <button
                                type="button"
                                onClick={() => window.open(`/p/contract_${existingContractId}`, '_blank')}
                                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                {t('contracts.btn_preview_print') || 'Xem trước & In hợp đồng'}
                            </button>
                        );
                    }
                    return (
                        <button
                            type="button"
                            onClick={handleCreateContract}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {t('detail.create_contract')}
                        </button>
                    );
                })()}
                <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]">
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    {t('common.save')}
                </button>
            </div>
        {isContractModalOpen && (
            <ContractModal
                initialData={{
                    leadId: lead.id,
                    type: ContractType.DEPOSIT,
                    status: ContractStatus.DRAFT,
                    partyBName: lead.name,
                    partyBPhone: lead.phone,
                    partyBAddress: lead.address || '',
                }}
                onClose={() => setIsContractModalOpen(false)}
                onSuccess={async () => {
                    setIsContractModalOpen(false);
                    try {
                        const refreshedLead = await db.getLeadById(lead.id);
                        if (refreshedLead?.contractId) {
                            setLocalContractInfo({
                                contractId: refreshedLead.contractId,
                                contractStatus: refreshedLead.contractStatus ?? undefined,
                                contractType: refreshedLead.contractType ?? undefined,
                                contractValue: refreshedLead.contractValue ?? undefined,
                                contractNumber: refreshedLead.contractNumber ?? undefined,
                                contractPaymentSchedule: refreshedLead.contractPaymentSchedule ?? undefined,
                            });
                        }
                        const stageUpdate = { stage: LeadStage.WON };
                        setFormData(prev => ({ ...prev, ...stageUpdate }));
                        await db.updateLead(lead.id, stageUpdate as any);
                        socket?.emit("lead_updated", { ...refreshedLead, ...stageUpdate });
                    } catch (e) {
                        console.error('Failed to refresh lead after contract creation', e);
                    }
                }}
            />
        )}
        {editingContract && (
            <ContractModal
                contract={editingContract}
                initialTab={editingContractInitialTab}
                onClose={() => setEditingContract(null)}
                onSuccess={async () => {
                    try {
                        const updated = await contractApi.getContractById(editingContract.id);
                        if (updated) {
                            if (updated.paymentSchedule) {
                                setLocalContractSchedule(updated.paymentSchedule);
                            }
                            setLocalContractInfo(prev => ({
                                contractId: editingContract.id,
                                contractStatus: updated.status ?? prev?.contractStatus,
                                contractType: updated.type ?? prev?.contractType,
                                contractValue: Number(updated.propertyPrice) || Number(updated.value) || prev?.contractValue,
                                contractNumber: updated.contractNumber ?? prev?.contractNumber,
                                contractPaymentSchedule: updated.paymentSchedule ?? prev?.contractPaymentSchedule,
                            }));
                        }
                    } catch (e) {
                        console.error('Failed to refresh contract after save', e);
                    }
                    setEditingContract(null);
                }}
            />
        )}
        </div>
    );

    // Use Portal for Modal Mode to break out of stacking contexts and ensure it's on top
    if (isModal) {
        return createPortal(
            <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-fade-in" onClick={onClose} aria-hidden="true" />
                {content}
            </>,
            document.body
        );
    }

    return content;
};
