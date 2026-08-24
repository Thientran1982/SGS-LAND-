import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { Dropdown } from './Dropdown';
import { Lead, LEAD_SOURCES, VN_PHONE_REGEX, LeadStage } from '../types';
import { useSocket } from '../services/websocket';
import { formatLeadTagsInput, normalizeLeadEmail, normalizeLeadTags, normalizeVNPhone } from '../utils/leadNormalization';
const ICONS = {
    DUPLICATE: <svg className="w-5 h-5 text-sgs-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 00-2-2v-2" /></svg>
};
const GENERIC_ADDRESS_SUGGESTIONS = [
    'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai',
    'Quận 1, TP. Hồ Chí Minh', 'Quận 7, TP. Hồ Chí Minh', 'Thủ Đức, TP. Hồ Chí Minh',
];
const FormInput = ({ label, value, onChange, onBlur, placeholder, required, type = 'text', autoFocus, error, className = "" }: any) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 block">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <input 
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            className={`w-full border rounded-xl px-4 py-2.5 text-[16px] outline-none focus:ring-2 transition-all ${error ? 'border-rose-300 focus:ring-rose-500/20 bg-rose-50' : 'border-[var(--glass-border)] focus:ring-[var(--sgs-primary)]/20 focus:border-[var(--sgs-primary)]'}`}
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
            className="w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/20 focus:border-sgs-primary transition-all resize-none h-20"
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
    const [emailWarning, setEmailWarning] = useState<Lead | null>(null);
    const [emailChecking, setEmailChecking] = useState(false);
    const emailCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t, formatDate } = useTranslation();
    const { socket } = useSocket();
    const updateField = (key: string, value: string | LeadStage) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        // Clear error on type
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
    };
    const [users, setUsers] = useState<{value: string, label: string}[]>([]);
    const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);

    React.useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await db.getMembers();
                setUsers([
                    { value: '', label: t('inbox.unassigned') },
                    ...res.data.map((u: any) => ({ value: u.id, label: u.name }))
                ]);
                setAddressSuggestions(GENERIC_ADDRESS_SUGGESTIONS);
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
        const normalizedPhone = normalizeVNPhone(formData.phone);
        if (!VN_PHONE_REGEX.test(normalizedPhone)) {
            setPhoneWarning(null);
            setPhoneChecking(false);
            return;
        }
        setPhoneChecking(true);
        phoneCheckRef.current = setTimeout(async () => {
            try {
                const existing = await db.checkDuplicateLead(normalizedPhone);
                setPhoneWarning(existing);
            } catch {
                setPhoneWarning(null);
            } finally {
                setPhoneChecking(false);
            }
        }, 600);
        return () => { if (phoneCheckRef.current) clearTimeout(phoneCheckRef.current); };
    }, [formData.phone]);
    // Debounced email duplicate check — fires 700ms after the user stops typing a valid email
    useEffect(() => {
        if (emailCheckRef.current) clearTimeout(emailCheckRef.current);
        const normalizedEmail = normalizeLeadEmail(formData.email);
        const emailValid = normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
        if (!emailValid) {
            setEmailWarning(null);
            setEmailChecking(false);
            return;
        }
        setEmailChecking(true);
        emailCheckRef.current = setTimeout(async () => {
            try {
                const existing = await db.checkDuplicateLeadByEmail(normalizedEmail);
                setEmailWarning(existing);
            } catch {
                setEmailWarning(null);
            } finally {
                setEmailChecking(false);
            }
        }, 700);
        return () => { if (emailCheckRef.current) clearTimeout(emailCheckRef.current); };
    }, [formData.email]);
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();        
        // 1. Validation
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) {
            newErrors.name = t('auth.error_name_required');
        }
        const normalizedPhone = normalizeVNPhone(formData.phone);
        const normalizedEmail = normalizeLeadEmail(formData.email);
        if (!VN_PHONE_REGEX.test(normalizedPhone)) {
            newErrors.phone = t('validation.phone_invalid');
        }
        if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            newErrors.email = t('validation.email_invalid');
        }        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setLoading(true);        
        try {
            // Use pre-detected phone warning if available, otherwise check API
            const existing = phoneWarning ?? await db.checkDuplicateLead(normalizedPhone);
            if (existing) {
                setDuplicateLead(existing);
                setStep('MERGE');
                setLoading(false);
                return;
            }
            // Prepare payload
            const payload = {
                ...formData,
                phone: normalizedPhone,
                email: normalizedEmail,
                assignedTo: formData.assignedTo as any,
                tags: normalizeLeadTags(formData.tags)
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
            const newTags = normalizeLeadTags(formData.tags);
            // Additive-only: never send name (identity), only send fields the existing lead is missing
            const mergePayload: Record<string, any> = {
                tags: newTags,
            };
            // Only contribute email/address if existing lead doesn't have them
            if (formData.email && !duplicateLead.email) mergePayload.email = formData.email;
            if (formData.address && !duplicateLead.address) mergePayload.address = formData.address;
            // Notes are always appended with timestamp
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
    // Compute what the merge will actually contribute — shown in the preview
    const mergePreview = duplicateLead ? (() => {
        const items: string[] = [];
        if (formData.email && !duplicateLead.email) items.push(`Email: ${formData.email}`);
        if (formData.address && !duplicateLead.address) items.push(`Địa chỉ: ${formData.address}`);
        if (formData.notes) items.push('Ghi chú: được bổ sung');
        const newTags = normalizeLeadTags(formData.tags);
        const addedTags = newTags.filter(tag => !(duplicateLead.tags || []).includes(tag));
        if (addedTags.length > 0) items.push(`Tags: +${addedTags.join(', ')}`);
        return items;
    })() : [];
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
                                    onBlur={() => updateField('phone', normalizeVNPhone(formData.phone))}
                                    placeholder={t('profile.placeholder_phone')}
                                    required
                                    error={errors.phone}
                                />
                                {phoneChecking && (
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-1 flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 border-2 border-[var(--sgs-primary)] border-t-transparent rounded-full animate-spin" />
                                        Đang kiểm tra...
                                    </p>
                                )}
                                {!phoneChecking && phoneWarning && (
                                    <div className="mt-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        <span className="text-sgs-accent-text text-sm mt-0.5">⚠</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-sgs-accent-text">Số điện thoại đã tồn tại</p>
                                            <p className="text-xs text-sgs-accent-text truncate">{phoneWarning.name} — {phoneWarning.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Row 2: Contact & Location */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <FormInput 
                                    label={t('leads.email')} 
                                    value={formData.email} 
                                    onChange={(v: string) => updateField('email', v)} 
                                    onBlur={() => updateField('email', normalizeLeadEmail(formData.email))}
                                    placeholder={t('auth.placeholder_email')}
                                    type="text"
                                    error={errors.email}
                                />
                                {emailChecking && (
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-1 flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 border-2 border-[var(--sgs-primary)] border-t-transparent rounded-full animate-spin" />
                                        Đang kiểm tra...
                                    </p>
                                )}
                                {!emailChecking && emailWarning && (
                                    <div className="mt-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                        <span className="text-sgs-accent-text text-sm mt-0.5">⚠</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-sgs-accent-text">Email đã tồn tại</p>
                                            <p className="text-xs text-sgs-accent-text truncate">{emailWarning.name}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 block">{t('leads.address')}</label>
                                <input
                                    list="lead-address-suggestions"
                                    value={formData.address}
                                    onChange={e => updateField('address', e.target.value)}
                                    placeholder={t('leads.placeholder_address')}
                                    className="w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/20 focus:border-[var(--sgs-primary)] transition-all"
                                />
                                <datalist id="lead-address-suggestions">
                                    {addressSuggestions.map(address => <option key={address} value={address} />)}
                                </datalist>
                                {addressSuggestions.length > 0 && <p className="text-xs text-[var(--text-tertiary)] ml-1">Gợi ý từ địa chỉ khách hàng đã có</p>}
                            </div>
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
                                onBlur={() => updateField('tags', formatLeadTagsInput(formData.tags))}
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
                                className="flex-1 py-3 bg-sgs-primary-deep text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
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
                                    <span className="text-sgs-accent-text/60 font-bold">{t('leads.name')}:</span>
                                    <span className="font-bold">{duplicateLead?.name}</span>
                                    
                                    <span className="text-sgs-accent-text/60 font-bold">{t('leads.phone')}:</span>
                                    <span className="font-mono tracking-wider">
                                        {duplicateLead?.phone
                                            ? duplicateLead.phone.slice(0, 3) + '****' + duplicateLead.phone.slice(-3)
                                            : '—'}
                                    </span>                                    
                                    <span className="text-sgs-accent-text/60 font-bold">{t('common.owner')}:</span>
                                    <span>
                                        {duplicateLead?.assignedToName
                                            || users.find(u => u.value === duplicateLead?.assignedTo)?.label
                                            || t('inbox.unassigned')}
                                    </span>
                                </div>
                            </div>
                            {/* What will actually be added */}
                            <div className="mt-3 pt-2 border-t border-amber-200/40">
                                <p className="text-xs font-bold text-sgs-accent-text/80 mb-1.5">Thông tin sẽ bổ sung vào hồ sơ:</p>
                                {mergePreview.length > 0 ? (
                                    <ul className="space-y-0.5">
                                        {mergePreview.map((item, i) => (
                                            <li key={i} className="text-xs text-sgs-verified flex items-center gap-1.5">
                                                <span className="text-sgs-verified">✓</span> {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-sgs-accent-text/70 italic">Không có thông tin mới để bổ sung — chỉ gộp hồ sơ.</p>
                                )}
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
                                className="flex-1 py-3 bg-sgs-primary text-white font-bold rounded-xl text-sm shadow-lg hover:bg-sgs-primary transition-all flex items-center justify-center gap-2"
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