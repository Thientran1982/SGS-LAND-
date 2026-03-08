
import React, { useEffect, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/mockDb';
import { Sequence, SequenceStep, Channel, LeadStage, SequenceStats } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';

// -----------------------------------------------------------------------------
// ASSETS
// -----------------------------------------------------------------------------
const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    EMAIL: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    SMS: <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    WAIT: <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    TASK: <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    STATS: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    ZALO: <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S16.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v4h-4v2h4v4h2v-4h4v-2h-4V6h-2z" fillRule="evenodd" /></svg>,
    CLOSE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------

const getStepIcon = (type: string, channel?: string) => {
    if (type === 'WAIT') return ICONS.WAIT;
    if (type === 'CREATE_TASK') return ICONS.TASK;
    if (channel === Channel.ZALO) return ICONS.ZALO;
    if (channel === Channel.SMS) return ICONS.SMS;
    return ICONS.EMAIL;
};

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

const StatPill = ({ label, value, color = "bg-slate-100 text-slate-600" }: { label: string, value: string | number, color?: string }) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-transparent ${color}`}>
        <span className="text-xl font-bold">{value}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">{label}</span>
    </div>
);

const StepCard = memo(({ step, index, t }: { step: SequenceStep, index: number, t: any }) => (
    <div className="flex gap-4 relative">
        {/* Connector Line */}
        <div className="absolute left-6 top-8 bottom-[-24px] w-0.5 bg-slate-200 last:hidden"></div>
        
        <div className="w-12 h-12 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm z-10 shrink-0">
            {getStepIcon(step.type, step.channel)}
        </div>
        
        <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 relative group hover:border-indigo-200 transition-colors">
            <div className="absolute top-4 right-4 text-xs font-bold text-slate-400">
                +{step.delayHours}{t('seq.hours')}
            </div>
            
            <h4 className="font-bold text-sm text-slate-800 mb-1">
                {step.type === 'WAIT' ? t('seq.step_wait') : 
                 step.type === 'CREATE_TASK' ? t('seq.step_task') : 
                 step.channel === Channel.EMAIL ? t('seq.step_email') : 
                 step.channel === Channel.SMS ? t('seq.step_sms') : 
                 'Send Zalo'}
            </h4>
            
            <p className="text-xs text-slate-500 line-clamp-1">
                {step.type === 'WAIT' ? `Wait for ${step.delayHours} ${t('seq.hours')}` : 
                 step.type === 'CREATE_TASK' ? step.taskTitle : 
                 `Template: ${step.templateId || 'Default'}`}
            </p>
        </div>
    </div>
));

const SequenceDrawer = ({ isOpen, onClose, sequence, onSave, t }: any) => {
    if (!isOpen || !sequence) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="w-full max-w-2xl bg-slate-50 h-full shadow-2xl relative animate-slide-in-right flex flex-col">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{sequence.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sequence.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {sequence.isActive ? t('seq.status_active') : t('seq.status_draft')}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                    {/* Stats Section */}
                    {sequence.stats && (
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <StatPill label={t('seq.stats_enrolled')} value={sequence.stats.enrolled} color="bg-blue-50 text-blue-700" />
                            <StatPill label={t('seq.stats_open_rate')} value={`${sequence.stats.openRate}%`} color="bg-emerald-50 text-emerald-700" />
                            <StatPill label={t('seq.stats_reply_rate')} value={`${sequence.stats.replyRate}%`} color="bg-purple-50 text-purple-700" />
                            <StatPill label={t('seq.stats_click_rate')} value={`${sequence.stats.clickRate}%`} color="bg-amber-50 text-amber-700" />
                        </div>
                    )}

                    {/* Configuration */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-8">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">{t('seq.trigger_stage')}</label>
                        <div className="inline-block px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100">
                            {t(`stage.${sequence.triggerStage}`)}
                        </div>
                    </div>

                    {/* Timeline Builder */}
                    <div className="relative pl-2">
                        {sequence.steps.map((step: SequenceStep, idx: number) => (
                            <StepCard key={step.id} step={step} index={idx} t={t} />
                        ))}
                        
                        {/* Add Step Placeholder */}
                        <div className="flex gap-4 relative opacity-50 hover:opacity-100 transition-opacity cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-4 items-center justify-center bg-slate-50 hover:bg-white">
                            <div className="flex flex-col items-center gap-1">
                                {ICONS.ADD}
                                <span className="text-xs font-bold text-slate-500">{t('seq.add_step')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-4 border-t border-slate-200 shrink-0">
                    <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const SequenceCard = memo(({ sequence, onClick, onDelete, t }: { sequence: Sequence, onClick: () => void, onDelete: () => void, t: any }) => (
    <div 
        onClick={onClick}
        className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
    >
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{sequence.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${sequence.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    <span className="text-xs text-slate-500">{sequence.isActive ? t('seq.status_active') : t('seq.status_draft')}</span>
                </div>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                {ICONS.EDIT}
            </div>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-50 my-4">
            <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{sequence.stats?.enrolled || 0}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">{t('seq.stat_active')}</div>
            </div>
            <div className="text-center border-l border-slate-100">
                <div className="text-lg font-bold text-emerald-600">{sequence.stats?.openRate || 0}%</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">{t('seq.stat_open')}</div>
            </div>
            <div className="text-center border-l border-slate-100">
                <div className="text-lg font-bold text-indigo-600">{sequence.stats?.replyRate || 0}%</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">{t('seq.stat_reply')}</div>
            </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500">
            <span>{t('seq.steps_count', { count: sequence.steps.length })}</span>
            <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 rounded">{t(`stage.${sequence.triggerStage}`)}</span>
        </div>

        {/* Delete Action (Hover) */}
        <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-4 right-12 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
            {ICONS.TRASH}
        </button>
    </div>
));

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Sequences: React.FC = () => {
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDate } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await db.getSequences();
            setSequences(data || []);
        } catch (e) {
            console.error(e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [t, notify]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await db.deleteSequence(itemToDelete);
            setSequences(prev => prev.filter(s => s.id !== itemToDelete));
            notify(t('common.success'), 'success');
        } catch (e) {
            notify(t('common.error'), 'error');
        } finally {
            setItemToDelete(null);
        }
    };

    const handleCreate = async () => {
        const newSeq = await db.createSequence({ 
            name: `${t('seq.default_name')} ${formatDate(new Date().toISOString())}`,
            triggerStage: LeadStage.NEW,
            steps: [] 
        });
        setSequences([newSeq, ...sequences]);
        setSelectedSeq(newSeq);
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('seq.title')}</h2>
                    <p className="text-sm text-slate-500">{t('seq.subtitle')}</p>
                </div>
                <button onClick={handleCreate} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                    {ICONS.ADD} {t('seq.btn_new')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sequences.map(seq => (
                    <SequenceCard 
                        key={seq.id} 
                        sequence={seq} 
                        onClick={() => setSelectedSeq(seq)} 
                        onDelete={() => setItemToDelete(seq.id)}
                        t={t}
                    />
                ))}
            </div>

            <SequenceDrawer 
                isOpen={!!selectedSeq} 
                sequence={selectedSeq} 
                onClose={() => setSelectedSeq(null)} 
                onSave={() => { setSelectedSeq(null); fetchData(); notify(t('common.success'), 'success'); }}
                t={t} 
            />

            <ConfirmModal 
                isOpen={!!itemToDelete}
                title={t('common.delete')}
                message={t('seq.delete_confirm')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setItemToDelete(null)}
                variant="danger"
            />
        </div>
    );
};
