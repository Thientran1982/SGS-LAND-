
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lead, LeadStage, Interaction, Channel, Direction, LEAD_SOURCES, VN_PHONE_REGEX, ContractStatus, ContractType } from '../types';
import { db } from '../services/dbApi';
import { aiService } from '../services/aiService';
import { useTranslation } from '../services/i18n';
import { Dropdown } from './Dropdown';
import { ContractModal } from './ContractModal';
import { useSocket } from '../services/websocket';

const AIAnalysisCard = ({ summary, loading, t, onRefresh }: any) => (
    <div className="bg-gradient-to-br from-indigo-50/50 to-white p-5 rounded-2xl mb-8 border border-indigo-100/50 shadow-sm animate-enter relative group overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100/20 rounded-full blur-3xl group-hover:bg-indigo-200/30 transition-all duration-700"></div>
        
        <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 text-xs uppercase tracking-widest">{t('detail.ai_analysis')}</h4>
                    <p className="text-[9px] text-indigo-400 font-medium uppercase tracking-tighter">Gemini 3.1 Intelligence</p>
                </div>
            </div>
            <button 
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-indigo-400 hover:text-indigo-600 bg-white rounded-xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm disabled:opacity-50"
                title={t('common.refresh')}
            >
                <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
        </div>
        
        {loading ? (
             <div className="space-y-2.5 py-1 relative z-10">
                 <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-full"></div>
                 <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-5/6"></div>
                 <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-2/3"></div>
             </div>
        ) : (
            <div className="relative z-10">
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {summary || t('detail.ai_no_data')}
                </p>
                <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[9px] font-bold rounded-full uppercase tracking-tighter border border-indigo-100/50">Strategic Insights</span>
                    <div className="h-px flex-1 bg-indigo-50"></div>
                </div>
            </div>
        )}
    </div>
);

const DetailField = ({ label, children, className, error }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block tracking-wide">{label}</label>
        {children}
        {error && <p className="text-[10px] text-rose-500 font-bold ml-1">{error}</p>}
    </div>
);

const TimelineItem = ({ item, t, formatDateTime }: any) => {
    const isSystem = item.type === 'SYSTEM' || item.metadata?.systemType;

    if (isSystem) {
        return (
            <div className="flex gap-4 pb-6 ml-2 pl-6 relative animate-enter items-center">
                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white"></div>
                <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.content}</span>
                    <span className="text-[10px] font-mono opacity-60">{formatDateTime(item.timestamp)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-4 pb-6 border-l border-slate-200 ml-2 pl-6 relative animate-enter">
            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${item.direction === Direction.OUTBOUND ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
            <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-700">
                        {item.direction === Direction.OUTBOUND ? t('detail.timeline_you') : t('detail.timeline_lead')}
                    </span>
                    <span className="text-[10px] text-slate-400">• {formatDateTime(item.timestamp)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                        item.channel === Channel.ZALO ? 'bg-blue-50 text-blue-600' : 
                        item.channel === Channel.EMAIL ? 'bg-amber-50 text-amber-600' : 
                        item.channel === Channel.SMS ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>{item.channel}</span>
                </div>
                <div className={`text-sm p-3 rounded-lg border w-fit max-w-[90%] ${item.direction === Direction.OUTBOUND ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
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
    EDIT_PEN: <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
};

const STYLES = {
    INPUT: "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
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
    const [isThinking, setIsThinking] = useState(false);
    const [aiSummary, setAiSummary] = useState("");
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [activeChannel, setActiveChannel] = useState<Channel>(Channel.ZALO);
    const [messageContent, setMessageContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [activeViewers, setActiveViewers] = useState<any[]>([]);
    const { t, formatDateTime, language } = useTranslation();

    const [users, setUsers] = useState<{value: string, label: string}[]>([]);

    const refreshAiSummary = async () => {
        setIsThinking(true);
        try {
            const history = await db.getInteractions(lead.id);
            const analysis = await aiService.summarizeLead(lead, history, language);
            setAiSummary(analysis);
        } catch (e) {
            setAiSummary("AI Analysis unavailable.");
        } finally {
            setIsThinking(false);
        }
    };

    useEffect(() => {
        setFormData({ ...lead });
        setErrors({});
        
        const load = async () => {
            const history = await db.getInteractions(lead.id);
            setInteractions(history.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            
            try {
                const res = await db.getTenantUsers(1, 100);
                setUsers([
                    { value: '', label: t('inbox.unassigned') || 'Unassigned' },
                    ...res.data.map(u => ({ value: u.id, label: u.name }))
                ]);
            } catch (e) {
                console.error(e);
            }

            refreshAiSummary();
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
                    socket.emit("view_lead", { leadId: lead.id, user: currentUser });
                }
            } catch (e) {
                console.error("Failed to get current user for presence", e);
            }
        };

        setupPresence();

        const handleActiveViewers = (viewers: any[]) => {
            setActiveViewers(viewers);
        };

        socket.on("active_viewers", handleActiveViewers);

        return () => {
            socket.emit("leave_lead", { leadId: lead.id });
            socket.off("active_viewers", handleActiveViewers);
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

    const stageOptions = Object.values(LeadStage).map(s => ({ value: s, label: t(`stage.${s}`) }));
    // Fix: Translate raw source values if they are simple English words, or keep as is if proper nouns (Facebook/Zalo)
    const sourceOptions = LEAD_SOURCES.map(s => ({ 
        value: s, 
        label: t(`source.${s}`) !== `source.${s}` ? t(`source.${s}`) : s 
    }));
    
    const scoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-100';
        return 'text-slate-500 bg-slate-100 border-slate-200';
    };

    // --- RENDER CONTENT ---
    const content = (
        <div className={`flex flex-col bg-white ${isModal ? 'fixed inset-0 z-[70] md:inset-y-4 md:inset-x-auto md:right-4 md:w-[80vw] lg:w-[900px] md:rounded-3xl md:shadow-2xl overflow-hidden animate-slide-in-right border border-slate-100' : 'h-full'}`}>
            
            {/* Header */}
            <div className="flex-none flex justify-between items-center p-4 md:p-6 border-b border-slate-100 bg-white z-20 shadow-sm relative">
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
                                className={`font-bold text-xl md:text-2xl text-slate-800 w-full bg-transparent border border-transparent rounded-lg px-2 py-1 focus:bg-slate-50 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 truncate`}
                                placeholder={t('auth.placeholder_name')}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                {ICONS.EDIT_PEN}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 mt-0.5">
                            <span
                                className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 cursor-pointer hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                                title={formData.id || ''}
                                onClick={() => formData.id && navigator.clipboard.writeText(formData.id)}
                            >
                                {formData.id ? `#${formData.id.slice(0, 8).toUpperCase()}` : 'NEW'}
                            </span>
                            {formData.score && (
                                <div className="group relative">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${scoreColor(formData.score.score)} bg-transparent cursor-help`}>
                                        {formData.score.score} pts
                                    </span>
                                    {formData.score.reasoning && (
                                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                            <div className="font-bold text-indigo-600 mb-1 uppercase tracking-tighter">AI Reasoning</div>
                                            {formData.score.reasoning}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Active Viewers Collaboration */}
                            {activeViewers.length > 1 && (
                                <div className="flex items-center ml-2">
                                    <div className="flex -space-x-2">
                                        {activeViewers.map((viewer, idx) => (
                                            <div key={idx} className="w-6 h-6 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700 shadow-sm" title={viewer.name}>
                                                {viewer.name?.charAt(0).toUpperCase()}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="ml-2 text-[10px] text-slate-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Đang xem
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2.5 rounded-full hover:bg-slate-100 transition-colors shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-scroll p-4 md:p-6 custom-scrollbar bg-slate-50/30">
                    <AIAnalysisCard summary={aiSummary} loading={isThinking} t={t} onRefresh={refreshAiSummary} />

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
                        <DetailField label={t('leads.assigned_to') || 'Người phụ trách'}>
                            <Dropdown value={formData.assignedTo || ''} onChange={(val) => handleInputChange('assignedTo', val)} options={users} className="w-full" />
                        </DetailField>
                        <DetailField label={formData.notes ? (t('leads.notes') || 'Ghi chú / Lịch hẹn') : (t('leads.notes') || 'Ghi chú')} className="sm:col-span-2">
                            <textarea
                                value={formData.notes || ''}
                                onChange={e => handleInputChange('notes', e.target.value)}
                                rows={formData.notes ? 6 : 3}
                                className={`w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none no-scrollbar ${formData.notes ? 'bg-amber-50/60 font-mono text-xs text-slate-700 leading-relaxed' : ''}`}
                                placeholder={t('leads.notes') || 'Ghi chú về khách hàng...'}
                            />
                        </DetailField>
                    </div>

                    <div className="mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                            {[Channel.ZALO, Channel.EMAIL, Channel.SMS].map(ch => (
                                <button key={ch} onClick={() => setActiveChannel(ch)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeChannel === ch ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                    {ch === Channel.ZALO ? ICONS.ZALO : ch === Channel.EMAIL ? ICONS.EMAIL : ICONS.SMS} {ch}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <textarea 
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-24 no-scrollbar"
                                placeholder={t('detail.placeholder_msg')}
                            />
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{activeChannel}</span>
                                <button onClick={handleSendMessage} disabled={isSending || !messageContent.trim()} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm active:scale-95">
                                    {isSending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : ICONS.SEND}
                                    {isSending ? t('detail.sending') : t('detail.send')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">{t('detail.history')}</h4>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>
                        <div className="space-y-0">
                            {interactions.map((i) => <TimelineItem key={i.id} item={i} t={t} formatDateTime={formatDateTime} />)}
                            {interactions.length === 0 && <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl text-xs">{t('detail.empty_history')}</div>}
                        </div>
                    </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex-none z-20 relative flex gap-3">
                <button 
                    onClick={handleCreateContract} 
                    disabled={formData.stage === LeadStage.WON} 
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('detail.create_contract') || 'Chốt Deal (Tạo Hợp Đồng)'}
                </button>
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
                    setFormData(prev => ({ ...prev, stage: LeadStage.WON }));
                    await onUpdate({ ...formData, stage: LeadStage.WON });
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
