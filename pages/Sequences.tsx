
import React, { useEffect, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { Sequence, LeadStage } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
interface Step {
    id: string;
    type: 'EMAIL' | 'SMS' | 'ZALO' | 'WAIT' | 'CREATE_TASK';
    delayHours: number;
    channel?: string;
    subject?: string;
    content?: string;
    taskTitle?: string;
}

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
    ZALO: <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S16.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v4h-4v2h4v4h2v-4h4v-2h-4V6h-2z" fillRule="evenodd" /></svg>,
    CLOSE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    SAVE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
};

const getStepIcon = (type: string) => {
    if (type === 'WAIT') return ICONS.WAIT;
    if (type === 'CREATE_TASK') return ICONS.TASK;
    if (type === 'SMS') return ICONS.SMS;
    if (type === 'ZALO') return ICONS.ZALO;
    return ICONS.EMAIL;
};

const getStepColor = (type: string): string => {
    if (type === 'WAIT') return 'bg-slate-100 border-slate-200';
    if (type === 'CREATE_TASK') return 'bg-indigo-50 border-indigo-100';
    if (type === 'SMS') return 'bg-emerald-50 border-emerald-100';
    if (type === 'ZALO') return 'bg-blue-50 border-blue-100';
    return 'bg-amber-50 border-amber-100';
};

// -----------------------------------------------------------------------------
// STEP MODAL
// -----------------------------------------------------------------------------
const STEP_TYPE_OPTIONS = (t: any) => [
    { value: 'EMAIL', label: t('seq.step_type_email') },
    { value: 'SMS', label: t('seq.step_type_sms') },
    { value: 'ZALO', label: t('seq.step_type_zalo') },
    { value: 'WAIT', label: t('seq.step_type_wait') },
    { value: 'CREATE_TASK', label: t('seq.step_type_task') },
];

interface StepModalProps {
    isOpen: boolean;
    step: Step | null;
    onClose: () => void;
    onSave: (step: Step) => void;
    t: any;
}

const StepModal: React.FC<StepModalProps> = ({ isOpen, step, onClose, onSave, t }) => {
    const [form, setForm] = useState<Step>({
        id: '',
        type: 'EMAIL',
        delayHours: 24,
        subject: '',
        content: '',
        taskTitle: '',
    });

    useEffect(() => {
        if (isOpen && step) {
            setForm({ ...step });
        } else if (isOpen && !step) {
            setForm({ id: crypto.randomUUID(), type: 'EMAIL', delayHours: 24, subject: '', content: '', taskTitle: '' });
        }
    }, [isOpen, step]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!form.id) form.id = crypto.randomUUID();
        onSave(form);
    };

    const isMessage = form.type === 'EMAIL' || form.type === 'SMS' || form.type === 'ZALO';

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {step ? t('seq.modal_edit_step_title') : t('seq.modal_add_step_title')}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1">
                        {ICONS.CLOSE}
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <Dropdown
                            label={t('seq.step_type_label')}
                            value={form.type}
                            onChange={(val) => setForm(f => ({ ...f, type: val as Step['type'] }))}
                            options={STEP_TYPE_OPTIONS(t)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                            {t('seq.step_delay_label')}
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={form.delayHours}
                            onChange={e => setForm(f => ({ ...f, delayHours: parseInt(e.target.value) || 0 }))}
                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-[var(--glass-surface)] transition-all"
                        />
                    </div>

                    {isMessage && (
                        <>
                            {form.type === 'EMAIL' && (
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                        {t('seq.step_subject_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={form.subject || ''}
                                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                        className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-[var(--glass-surface)] transition-all"
                                        placeholder={t('seq.placeholder_subject')}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                    {t('seq.step_content_label')}
                                </label>
                                <textarea
                                    value={form.content || ''}
                                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                                    rows={4}
                                    className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-[var(--glass-surface)] transition-all resize-none"
                                    placeholder={t('seq.placeholder_content')}
                                />
                            </div>
                        </>
                    )}

                    {form.type === 'CREATE_TASK' && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                {t('seq.step_task_title_label')}
                            </label>
                            <input
                                type="text"
                                value={form.taskTitle || ''}
                                onChange={e => setForm(f => ({ ...f, taskTitle: e.target.value }))}
                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-[var(--glass-surface)] transition-all"
                                placeholder={t('seq.placeholder_task')}
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        {ICONS.SAVE}
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------
const StatPill = ({ label, value, color = "bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" }: { label: string, value: string | number, color?: string }) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-transparent ${color}`}>
        <span className="text-xl font-bold">{value}</span>
        <span className="text-xs2 uppercase font-bold tracking-wider opacity-70">{label}</span>
    </div>
);

const StepCard = memo(({ step, index, onEdit, onDelete, t }: { step: Step, index: number, onEdit: () => void, onDelete: () => void, t: any }) => {
    const getStepLabel = () => {
        if (step.type === 'WAIT') return t('seq.step_wait');
        if (step.type === 'CREATE_TASK') return t('seq.step_task');
        if (step.type === 'SMS') return t('seq.step_sms');
        if (step.type === 'ZALO') return t('seq.step_zalo');
        return t('seq.step_email');
    };

    const getStepDetail = () => {
        if (step.type === 'WAIT') return `${step.delayHours} ${t('seq.hours')}`;
        if (step.type === 'CREATE_TASK') return step.taskTitle || '—';
        if (step.subject) return step.subject;
        if (step.content) return step.content.substring(0, 60) + (step.content.length > 60 ? '...' : '');
        return '—';
    };

    return (
        <div className="flex gap-4 relative group/step">
            <div className="absolute left-6 top-12 bottom-[-24px] w-0.5 bg-slate-200 dark:bg-slate-700"></div>

            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm z-10 shrink-0 border-2 ${getStepColor(step.type)}`}>
                {getStepIcon(step.type)}
            </div>

            <div className="flex-1 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--glass-border)] shadow-sm mb-6 hover:border-indigo-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-[var(--text-tertiary)] tabular-nums">#{index + 1}</span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{getStepLabel()}</h4>
                            <span className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] px-2 py-0.5 rounded">
                                +{step.delayHours}h
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{getStepDetail()}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/step:opacity-100 transition-opacity shrink-0">
                        <button
                            onClick={onEdit}
                            className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors text-[var(--text-secondary)]"
                            title={t('common.edit')}
                        >
                            {ICONS.EDIT}
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors text-[var(--text-secondary)]"
                            title={t('common.delete')}
                        >
                            {ICONS.TRASH}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// SEQUENCE DRAWER
// -----------------------------------------------------------------------------
interface SequenceDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    sequence: Sequence | null;
    onSaved: (seq: Sequence) => void;
    t: any;
    notify: (msg: string, type: 'success' | 'error') => void;
}

const SequenceDrawer: React.FC<SequenceDrawerProps> = ({ isOpen, onClose, sequence, onSaved, t, notify }) => {
    const [name, setName] = useState('');
    const [triggerStage, setTriggerStage] = useState<LeadStage>(LeadStage.NEW);
    const [isActive, setIsActive] = useState(false);
    const [steps, setSteps] = useState<Step[]>([]);
    const [saving, setSaving] = useState(false);

    const [stepModalOpen, setStepModalOpen] = useState(false);
    const [editingStep, setEditingStep] = useState<Step | null>(null);
    const [stepToDelete, setStepToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && sequence) {
            setName(sequence.name);
            setTriggerStage(sequence.triggerStage);
            setIsActive(sequence.isActive ?? false);
            setSteps((sequence.steps || []) as unknown as Step[]);
        }
    }, [isOpen, sequence]);

    if (!isOpen || !sequence) return null;

    const stageOptions = Object.values(LeadStage).map(s => ({ value: s, label: t(`stage.${s}`) }));

    const handleAddStep = () => {
        setEditingStep(null);
        setStepModalOpen(true);
    };

    const handleEditStep = (step: Step) => {
        setEditingStep(step);
        setStepModalOpen(true);
    };

    const handleSaveStep = (step: Step) => {
        setSteps(prev => {
            const idx = prev.findIndex(s => s.id === step.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = step;
                return next;
            }
            return [...prev, step];
        });
        setStepModalOpen(false);
    };

    const handleDeleteStep = () => {
        if (!stepToDelete) return;
        setSteps(prev => prev.filter(s => s.id !== stepToDelete));
        setStepToDelete(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await db.updateSequence(sequence.id, {
                name,
                triggerStage,
                isActive,
                steps,
            });
            notify(t('seq.save_success'), 'success');
            onSaved(updated);
        } catch {
            notify(t('common.error'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="w-full max-w-2xl bg-[var(--glass-surface)] h-full shadow-2xl relative animate-slide-in-right flex flex-col">
                {/* Header */}
                <div className="bg-[var(--bg-surface)] px-6 py-4 border-b border-[var(--glass-border)] flex justify-between items-center shrink-0">
                    <div className="flex-1 min-w-0 pr-4">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="text-lg font-bold text-[var(--text-primary)] bg-transparent border-none outline-none w-full truncate focus:bg-[var(--glass-surface)] focus:px-2 rounded-lg transition-all"
                        />
                        <div className="flex items-center gap-3 mt-1">
                            <button
                                onClick={() => setIsActive(v => !v)}
                                className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] hover:bg-slate-200'}`}
                            >
                                {isActive ? t('seq.status_active') : t('seq.status_draft')}
                            </button>
                            <span className="text-xs text-[var(--text-tertiary)]">{steps.length} {t('seq.steps_count', { count: '' }).replace('{count} ', '')}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full transition-colors text-[var(--text-secondary)]">
                        {ICONS.CLOSE}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                    {/* Stats (if available) */}
                    {sequence.stats && (
                        <div className="grid grid-cols-4 gap-3">
                            <StatPill label={t('seq.stats_enrolled')} value={sequence.stats.enrolled} color="bg-blue-50 text-blue-700" />
                            <StatPill label={t('seq.stats_open_rate')} value={`${sequence.stats.openRate}%`} color="bg-emerald-50 text-emerald-700" />
                            <StatPill label={t('seq.stats_reply_rate')} value={`${sequence.stats.replyRate}%`} color="bg-purple-50 text-purple-700" />
                            <StatPill label={t('seq.stats_click_rate')} value={`${sequence.stats.clickRate}%`} color="bg-amber-50 text-amber-700" />
                        </div>
                    )}

                    {/* Trigger */}
                    <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--glass-border)] shadow-sm">
                        <Dropdown
                            label={t('seq.trigger_stage')}
                            value={triggerStage}
                            onChange={val => setTriggerStage(val as LeadStage)}
                            options={stageOptions}
                        />
                    </div>

                    {/* Step Builder */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                {t('seq.add_step')} ({steps.length})
                            </h3>
                            <button
                                onClick={handleAddStep}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs shadow hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                {ICONS.ADD}
                                {t('seq.add_step')}
                            </button>
                        </div>

                        <div className="relative pl-2">
                            {steps.length === 0 ? (
                                <div
                                    onClick={handleAddStep}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-[var(--text-tertiary)] hover:text-indigo-600"
                                >
                                    {ICONS.ADD}
                                    <span className="text-sm font-bold">{t('seq.empty_steps')}</span>
                                </div>
                            ) : (
                                <>
                                    {steps.map((step, idx) => (
                                        <StepCard
                                            key={step.id}
                                            step={step}
                                            index={idx}
                                            onEdit={() => handleEditStep(step)}
                                            onDelete={() => setStepToDelete(step.id)}
                                            t={t}
                                        />
                                    ))}
                                    <div
                                        onClick={handleAddStep}
                                        className="flex gap-4 relative opacity-60 hover:opacity-100 transition-opacity cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-4 items-center justify-center bg-[var(--glass-surface)] hover:bg-[var(--bg-surface)] hover:border-indigo-300"
                                    >
                                        <div className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-indigo-600">
                                            {ICONS.ADD}
                                            <span className="text-xs font-bold">{t('seq.add_step')}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-[var(--bg-surface)] p-4 border-t border-[var(--glass-border)] shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : ICONS.SAVE}
                        {saving ? t('common.processing') : t('common.save')}
                    </button>
                </div>
            </div>

            {/* Step modal */}
            <StepModal
                isOpen={stepModalOpen}
                step={editingStep}
                onClose={() => setStepModalOpen(false)}
                onSave={handleSaveStep}
                t={t}
            />

            {/* Delete step confirm */}
            <ConfirmModal
                isOpen={!!stepToDelete}
                title={t('common.delete')}
                message={t('seq.step_delete_confirm')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDeleteStep}
                onCancel={() => setStepToDelete(null)}
                variant="danger"
            />
        </div>,
        document.body
    );
};

// -----------------------------------------------------------------------------
// SEQUENCE CARD
// -----------------------------------------------------------------------------
const SequenceCard = memo(({ sequence, onClick, onDelete, t }: { sequence: Sequence, onClick: () => void, onDelete: () => void, t: any }) => (
    <div
        onClick={onClick}
        className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
    >
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold text-[var(--text-primary)] group-hover:text-indigo-600 transition-colors">{sequence.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${sequence.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    <span className="text-xs text-[var(--text-tertiary)]">{sequence.isActive ? t('seq.status_active') : t('seq.status_draft')}</span>
                </div>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                {ICONS.EDIT}
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-50 my-4">
            <div className="text-center">
                <div className="text-lg font-bold text-[var(--text-primary)]">{sequence.stats?.enrolled || 0}</div>
                <div className="text-2xs text-[var(--text-secondary)] font-bold uppercase">{t('seq.stat_active')}</div>
            </div>
            <div className="text-center border-l border-[var(--glass-border)]">
                <div className="text-lg font-bold text-emerald-600">{sequence.stats?.openRate || 0}%</div>
                <div className="text-2xs text-[var(--text-secondary)] font-bold uppercase">{t('seq.stat_open')}</div>
            </div>
            <div className="text-center border-l border-[var(--glass-border)]">
                <div className="text-lg font-bold text-indigo-600">{sequence.stats?.replyRate || 0}%</div>
                <div className="text-2xs text-[var(--text-secondary)] font-bold uppercase">{t('seq.stat_reply')}</div>
            </div>
        </div>

        <div className="flex justify-between items-center text-xs text-[var(--text-tertiary)]">
            <span>{t('seq.steps_count', { count: sequence.steps.length })}</span>
            <span className="font-mono text-xs2 px-2 py-0.5 bg-[var(--glass-surface-hover)] rounded">{t(`stage.${sequence.triggerStage}`)}</span>
        </div>

        <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-4 right-12 p-2 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
        try {
            const newSeq = await db.createSequence({
                name: `${t('seq.default_name')} ${formatDate(new Date().toISOString())}`,
                triggerStage: LeadStage.NEW,
                steps: []
            });
            setSequences(prev => [newSeq, ...prev]);
            setSelectedSeq(newSeq);
        } catch {
            notify(t('common.error'), 'error');
        }
    };

    const handleSaved = (updated: Sequence) => {
        setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
        setSelectedSeq(null);
    };

    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex justify-between items-center bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('seq.title')}</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{t('seq.subtitle')}</p>
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
                onSaved={handleSaved}
                t={t}
                notify={notify}
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
