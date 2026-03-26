
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { Dropdown } from './Dropdown';
import { Lead, LEAD_SOURCES, VN_PHONE_REGEX, LeadStage } from '../types';
import { useSocket } from '../services/websocket';

const ICONS = {
    DUPLICATE: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 00-2-2v-2" /></svg>
};

const FormInput = ({ label, value, onChange, placeholder, required, type = 'text', autoFocus, error, className = "" }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 block">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <input 
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 transition-all ${error ? 'border-rose-300 focus:ring-rose-500/20 bg-rose-50' : 'border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500'}`}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
        />
        {error && <p className="text-xs2 text-rose-500 font-bold ml-1">{error}</p>}
    </div>
);

const FormTextArea = ({ label, value, onChange, placeholder }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 block">{label}</label>
        <textarea 
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none h-20"
            placeholder={placeholder}
        />
    </div>
);

interface CreateLeadModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<'FORM' | 'MERGE'>('FORM');
    // Enhanced State to match Lead Type
    const [formData, setFormData] = useState({ 
        name: '', 
        phone: '', 
        email: '', 
        address: '', 
        source: 'Facebook',
        stage: LeadStage.NEW,
        tags: '', // Managed as string for input, converted to array on save
        notes: '',
        assignedTo: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [phoneWarning, setPhoneWarning] = useState<Lead | null>(null);
    const [phoneChecking, setPhoneChecking] = useState(false);
    const phoneCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t, formatDate } = useTranslation();
    const { socket } = useSocket();

    const updateField = (key: string, value: string | LeadStage) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        // Clear error on type
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
    };

    const [users, setUsers] = useState<{value: string, label: string}[]>([]);

    React.useEffect(() => {
        const fetchUsers = async () => {
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
        fetchUsers();
    }, [t]);

    // Debounced phone duplicate check — fires 600ms after the user stops typing a valid VN phone
    useEffect(() => {
        if (phoneCheckRef.current) clearTimeout(phoneCheckRef.current);
        // Only check if phone passes basic format validation
        if (!VN_PHONE_REGEX.test(formData.phone)) {
            setPhoneWarning(null);
            setPhoneChecking(false);
            return;
        }
        setPhoneChecking(true);
        phoneCheckRef.current = setTimeout(async () => {
            try {
                const existing = await db.checkDuplicateLead(formData.phone);
                setPhoneWarning(existing);
            } catch {
                setPhoneWarning(null);
            } finally {
                setPhoneChecking(false);
            }
        }, 600);
        return () => { if (phoneCheckRef.current) clearTimeout(phoneCheckRef.current); };
    }, [formData.phone]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Validation
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) {
            newErrors.name = t('auth.error_name_required');
        }
        if (!VN_PHONE_REGEX.test(formData.phone)) {
            newErrors.phone = t('validation.phone_invalid');
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t('validation.email_invalid');
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        
        try {
            // Use pre-detected phone warning if available, otherwise check API
            const existing = phoneWarning ?? await db.checkDuplicateLead(formData.phone);
            
            if (existing) {
                setDuplicateLead(existing);
                setStep('MERGE');
                setLoading(false);
                return;
            }

            // Prepare payload
            const payload = {
                ...formData,
                assignedTo: formData.assignedTo as any,
                // Enhanced tag processing: Split by comma, trim spaces, remove empty strings
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            const createdLead = await db.createLead(payload);
            socket?.emit("lead_created", createdLead);
            onSuccess();
        } catch (error: any) {
            if (error?.status === 409 && error?.data?.error === 'DUPLICATE_LEAD') {
                const existingLead = error.data.existingLead ?? null;
                if (existingLead) {
                    setDuplicateLead(existingLead);
                    setStep('MERGE');
                    setLoading(false);
                    return;
                }
            }
            console.error(error);
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!duplicateLead) return;
        setLoading(true);
        try {
            // Enhanced Merge logic: Combine tags, update info, append notes
            const newTags = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            const mergedTags = Array.from(new Set([...(duplicateLead.tags || []), ...newTags]));

            const mergePayload: Record<string, any> = {
                name: formData.name,
                tags: mergedTags,
            };
            if (formData.email) mergePayload.email = formData.email;
            if (formData.address) mergePayload.address = formData.address;
            if (formData.notes) {
                mergePayload.notes = `${duplicateLead.notes || ''}\n[Merge ${formatDate(new Date().toISOString())}]: ${formData.notes}`.trim();
            }

            const updatedLead = await db.mergeLead(duplicateLead.id, mergePayload);
            socket?.emit("lead_updated", updatedLead ?? { ...duplicateLead, ...mergePayload });
            onSuccess();
        } catch (e) {
            setLoading(false);
        }
    };

    // Use memoized options with translation
    const sourceOptions = useMemo(() => 
        LEAD_SOURCES.map(s => ({ 
            value: s, 
            label: t(`source.${s}`) !== `source.${s}` ? t(`source.${s}`) : s
        }))
    , [t]);

    const stageOptions = useMemo(() => 
        Object.values(LeadStage).map(s => ({ value: s, label: t(`stage.${s}`) }))
    , [t]);

    // Escape key + body scroll lock
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [loading, onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="create-lead-title">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={!loading ? onClose : undefined} />
            
            {/* Modal */}
            <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-[24px] p-8 shadow-2xl border border-[var(--glass-border)] relative z-10 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h3 id="create-lead-title" className="text-xl font-bold text-[var(--text-primary)]">
                        {step === 'FORM' ? t('leads.create_modal_title') : t('leads.merge_modal_title')}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)]">✕</button>
                </div>

                {step === 'FORM' ? (
                    <form onSubmit={handleCreate} className="space-y-5">
                        
                        {/* Row 1: Identity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormInput 
                                label={t('leads.name')} 
                                value={formData.name} 
                                onChange={(v: string) => updateField('name', v)} 
                                placeholder={t('auth.placeholder_name')}
                                required
                                autoFocus
                                error={errors.name}
                            />
                            <div>
                                <FormInput 
                                    label={t('leads.phone')} 
                                    value={formData.phone} 
                                    onChange={(v: string) => updateField('phone', v)} 
                                    placeholder={t('profile.placeholder_phone')}
                                    required
                                    error={errors.phone}
                                />
                                {phoneChecking && (
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-1 flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                        Đang kiểm tra...
                                    </p>
                                )}
                                {!phoneChecking && phoneWarning && (
                                    <div className="mt-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-amber-700">Số điện thoại đã tồn tại</p>
                                            <p className="text-xs text-amber-600 truncate">{phoneWarning.name} — {phoneWarning.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Contact & Location */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormInput 
                                label={t('leads.email')} 
                                value={formData.email} 
                                onChange={(v: string) => updateField('email', v)} 
                                placeholder={t('auth.placeholder_email')}
                                type="text"
                                error={errors.email}
                            />
                            <FormInput 
                                label={t('leads.address')} 
                                value={formData.address} 
                                onChange={(v: string) => updateField('address', v)} 
                                placeholder={t('leads.placeholder_address')}
                            />
                        </div>

                        {/* Row 3: Status & Classification */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Dropdown
                                    label={t('leads.source')}
                                    value={formData.source}
                                    onChange={(val) => updateField('source', val as string)}
                                    options={sourceOptions}
                                />
                            </div>
                            <div>
                                <Dropdown
                                    label={t('leads.stage')}
                                    value={formData.stage}
                                    onChange={(val) => updateField('stage', val as LeadStage)}
                                    options={stageOptions}
                                />
                            </div>
                        </div>

                        {/* Row 4: Tags & AssignedTo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormInput 
                                label={t('leads.tags')} 
                                value={formData.tags} 
                                onChange={(v: string) => updateField('tags', v)} 
                                placeholder={t('leads.placeholder_tags') + ' (VD: VIP, căn hộ, Q2)'}
                            />
                            <div>
                                <Dropdown
                                    label={t('leads.assigned_to') || 'Người phụ trách'}
                                    value={formData.assignedTo}
                                    onChange={(val) => updateField('assignedTo', val as string)}
                                    options={users}
                                />
                            </div>
                        </div>

                        {/* Row 5: Notes */}
                        <FormTextArea 
                            label={t('leads.notes')}
                            value={formData.notes}
                            onChange={(v: string) => updateField('notes', v)}
                            placeholder={t('leads.placeholder_notes')}
                        />

                        <div className="pt-4 flex gap-3 border-t border-[var(--glass-border)] mt-2">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {t('common.add_new')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-5 animate-enter">
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-900 text-sm">
                            <div className="flex items-start gap-3">
                                {ICONS.DUPLICATE}
                                <div>
                                    <p className="font-bold mb-1">{t('leads.duplicate_msg')}</p>
                                    <p className="text-xs opacity-90 leading-relaxed">{t('leads.merge_confirm')}</p>
                                </div>
                            </div>
                            
                            <div className="bg-[var(--bg-surface)]/60 p-3 rounded-lg mt-3 text-xs border border-amber-200/50">
                                <div className="grid grid-cols-[60px_1fr] gap-1">
                                    <span className="text-amber-700/60 font-bold">{t('leads.name')}:</span>
                                    <span className="font-bold">{duplicateLead?.name}</span>
                                    
                                    <span className="text-amber-700/60 font-bold">{t('leads.phone')}:</span>
                                    <span className="font-mono">{duplicateLead?.phone}</span>
                                    
                                    <span className="text-amber-700/60 font-bold">{t('common.owner')}:</span>
                                    <span>{duplicateLead?.assignedToName || duplicateLead?.assignedTo || t('inbox.unassigned')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-2 flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setStep('FORM')} 
                                className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleMerge} 
                                disabled={loading}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {t('leads.btn_merge')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
