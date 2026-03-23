
import React, { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
import { Skeleton } from '../components/Skeleton';

// -----------------------------------------------------------------------------
//  1. CONSTANTS & UTILS
// -----------------------------------------------------------------------------
const CONSTANTS = {
    MAX_AVATAR_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
    TOAST_DURATION: 3000,
    // Strictly require 10 digits for VN mobile numbers
    VN_PHONE_REGEX: /^(03|05|07|08|09)([0-9]{8})$/
};

// -----------------------------------------------------------------------------
//  2. ISOLATED SUB-COMPONENTS
// -----------------------------------------------------------------------------

const ICONS = {
    UPLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    CAMERA: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    GENERAL: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    SECURITY: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    SUCCESS: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    ERROR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SAVE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

interface TabButtonProps {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = memo(({ active, label, icon, onClick }) => (
    <button 
        onClick={onClick}
        type="button"
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200
        ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-secondary)]'}`}
    >
        <span className={active ? 'text-indigo-200' : 'text-[var(--text-secondary)]'}>{icon}</span>
        {label}
    </button>
));

interface InputFieldProps {
    id: string; // Added ID for A11y
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
    isTextArea?: boolean;
    error?: string | null;
    action?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = memo(({ id, label, value, onChange, disabled, placeholder, type = 'text', isTextArea, error, action }) => (
    <div className="space-y-1.5 group">
        <div className="flex justify-between">
            <label htmlFor={id} className={`text-xs3 font-bold uppercase tracking-wider ml-1 transition-colors ${error ? 'text-rose-500' : 'text-[var(--text-tertiary)] group-focus-within:text-indigo-500'}`}>{label}</label>
            {action && <div className="text-xs">{action}</div>}
        </div>
        
        <div className="relative">
            {isTextArea ? (
                <textarea
                    id={id}
                    value={value} 
                    onChange={onChange}
                    disabled={disabled}
                    className={`w-full bg-[var(--glass-surface)] border rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none h-32 placeholder:text-[var(--text-muted)]
                        ${error 
                            ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20 bg-rose-50 text-rose-900' 
                            : 'border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500/20 focus:bg-[var(--bg-surface)] text-[var(--text-primary)]'}
                        ${disabled ? 'opacity-60 cursor-not-allowed bg-[var(--glass-surface-hover)]' : ''}
                    `}
                    placeholder={placeholder}
                />
            ) : (
                <input 
                    id={id}
                    type={type}
                    value={value} 
                    onChange={onChange}
                    disabled={disabled}
                    className={`w-full bg-[var(--glass-surface)] border rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--text-muted)]
                        ${error 
                            ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20 bg-rose-50 text-rose-900' 
                            : 'border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500/20 focus:bg-[var(--bg-surface)] text-[var(--text-primary)]'}
                        ${disabled ? 'opacity-60 cursor-not-allowed bg-[var(--glass-surface-hover)]' : ''}
                    `}
                    placeholder={placeholder}
                />
            )}
            
            {error && (
                <div className="absolute right-3 top-3 text-rose-500 pointer-events-none animate-enter">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
            )}
        </div>
        
        {error && (
            <p className="text-xs2 font-bold text-rose-500 ml-1 animate-enter">{error}</p>
        )}
    </div>
));

// -----------------------------------------------------------------------------
//  3. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Profile: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'SECURITY'>('GENERAL');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    
    // Form Data
    const [formData, setFormData] = useState({ name: '', phone: '', bio: '', avatar: '' });
    const [avatarError, setAvatarError] = useState(false);
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Email change state
    const [emailChangeOpen, setEmailChangeOpen] = useState(false);
    const [emailData, setEmailData] = useState({ newEmail: '', confirmPass: '' });
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const loadData = useCallback(async () => {
        setLoading(true);
        const u = await db.getCurrentUser();
        if (u) {
            setUser(u);
            setFormData({ 
                name: u.name, 
                phone: u.phone || '', 
                bio: u.bio || '', 
                avatar: u.avatar || '' 
            });
            setAvatarError(false);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Reset avatarError whenever the avatar URL is changed (new upload or load)
    useEffect(() => { setAvatarError(false); }, [formData.avatar]);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), CONSTANTS.TOAST_DURATION);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const getLocalizedError = useCallback((msg: string) => {
        if (msg === 'Email already exists') return t('profile.err_email_exists');
        if (msg === 'Invalid credentials') return t('auth.error_generic');
        return msg || t('common.error');
    }, [t]);

    const handleSaveProfile = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setErrors({});

        // 1. Validation
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = t('auth.error_name_required');
        
        if (formData.phone && !CONSTANTS.VN_PHONE_REGEX.test(formData.phone)) {
            newErrors.phone = t('profile.error_phone_invalid');
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setMessage({ text: t('common.error'), type: 'error' });
            return;
        }

        // 2. Save
        setSaving(true);
        try {
            const updatedUser = await db.updateUserProfile(user.id, {
                name: formData.name,
                phone: formData.phone,
                bio: formData.bio,
                avatar: formData.avatar
            });
            
            setUser(updatedUser);
            // Consistent state update
            setFormData({
                name: updatedUser.name,
                phone: updatedUser.phone || '',
                bio: updatedUser.bio || '',
                avatar: updatedUser.avatar || ''
            });
            
            window.dispatchEvent(new Event('user-updated'));
            
            setMessage({ text: t('profile.success_update'), type: 'success' });
        } catch (err: any) {
            setMessage({ text: getLocalizedError(err.message), type: 'error' });
        } finally {
            setSaving(false);
        }
    }, [user, formData, t, getLocalizedError]);

    const handleSavePassword = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setErrors({});
        
        if (!passData.current || !passData.new) {
            setErrors({ 
                current: !passData.current ? t('auth.error_password_required') : '', 
                new: !passData.new ? t('auth.error_password_required') : '' 
            });
            setMessage({ text: t('auth.error_password_required'), type: 'error' });
            return;
        }
        if (passData.new !== passData.confirm) {
            setErrors({ confirm: t('profile.error_pass_match') });
            return;
        }

        setSaving(true);
        try {
            await db.changeUserPassword(user.id, passData.current, passData.new);
            setMessage({ text: t('profile.success_pass'), type: 'success' });
            setPassData({ current: '', new: '', confirm: '' });
        } catch (err: any) {
            setErrors({ current: getLocalizedError(err.message) });
            setMessage({ text: getLocalizedError(err.message), type: 'error' });
        } finally {
            setSaving(false);
        }
    }, [user, passData, t, getLocalizedError]);

    const handleReset = useCallback(() => {
        if (!user) return;
        setFormData({
            name: user.name,
            phone: user.phone || '',
            bio: user.bio || '',
            avatar: user.avatar || ''
        });
        setErrors({});
        setMessage(null);
    }, [user]);

    const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setMessage({ text: t('profile.error_image_only'), type: 'error' });
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            if (file.size > CONSTANTS.MAX_AVATAR_SIZE_BYTES) {
                setMessage({ text: t('profile.error_file_size'), type: 'error' });
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            setUploading(true);
            try {
                const result = await db.uploadFiles([file]);
                const url = result.files[0].url;
                setFormData(prev => ({ ...prev, avatar: url }));
                setMessage({ text: t('profile.msg_avatar_selected'), type: 'success' });
            } catch (err: any) {
                setMessage({ text: err.message || t('profile.error_read_file'), type: 'error' });
            } finally {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    }, [t]);

    const handleRequestEmailChange = () => {
        setEmailChangeOpen(true);
        setEmailData({ newEmail: '', confirmPass: '' });
        setEmailErrors({});
    };

    const handleCancelEmailChange = () => {
        setEmailChangeOpen(false);
        setEmailData({ newEmail: '', confirmPass: '' });
        setEmailErrors({});
    };

    const handleSubmitEmailChange = async () => {
        if (!user) return;
        const errs: Record<string, string> = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailData.newEmail) {
            errs.newEmail = t('profile.err_email_invalid');
        } else if (!emailRegex.test(emailData.newEmail)) {
            errs.newEmail = t('profile.err_email_invalid');
        } else if (emailData.newEmail.toLowerCase() === user.email?.toLowerCase()) {
            errs.newEmail = t('profile.err_email_same');
        }
        if (!emailData.confirmPass) {
            errs.confirmPass = t('profile.err_pass_required');
        }
        if (Object.keys(errs).length > 0) {
            setEmailErrors(errs);
            return;
        }

        setEmailSaving(true);
        setEmailErrors({});
        try {
            const updated = await db.changeUserEmail(user.id, emailData.confirmPass, emailData.newEmail);
            if (updated) {
                setUser({ ...user, email: emailData.newEmail });
                setEmailChangeOpen(false);
                setEmailData({ newEmail: '', confirmPass: '' });
                setMessage({ text: t('profile.success_email'), type: 'success' });
                window.dispatchEvent(new CustomEvent('user-updated', { detail: updated }));
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || '';
            if (msg.includes('đã được sử dụng') || msg.includes('already in use')) {
                setEmailErrors({ newEmail: t('profile.err_email_exists') });
            } else if (msg.includes('khác email hiện tại') || msg.includes('different from current')) {
                setEmailErrors({ newEmail: t('profile.err_email_same') });
            } else if (msg.includes('không hợp lệ') || msg.includes('Invalid email')) {
                setEmailErrors({ newEmail: t('profile.err_email_invalid') });
            } else if (msg.includes('không đúng') || msg.includes('incorrect') || msg.includes('wrong password')) {
                setEmailErrors({ confirmPass: t('profile.err_pass_wrong') });
            } else if (msg.includes('nhập mật khẩu') || msg.includes('enter your password')) {
                setEmailErrors({ confirmPass: t('profile.err_pass_required') });
            } else {
                setMessage({ text: msg || t('common.error'), type: 'error' });
            }
        } finally {
            setEmailSaving(false);
        }
    };

    // Calculate dirty state by deep comparing relevant fields
    const isDirty = useMemo(() => {
        if (!user) return false;
        
        // Normalize fields for comparison to avoid null vs undefined vs empty string issues
        const current = {
            name: formData.name,
            phone: formData.phone || '',
            bio: formData.bio || '',
            avatar: formData.avatar
        };
        const original = {
            name: user.name,
            phone: user.phone || '',
            bio: user.bio || '',
            avatar: user.avatar || ''
        };
        
        return JSON.stringify(current) !== JSON.stringify(original);
    }, [formData, user]);

    if (loading) return <div className="p-4 sm:p-6"><Skeleton className="h-64 w-full" /></div>;
    if (!user) return null;

    return (
        <>
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-20 animate-enter">
            {/* Header Card */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] border border-[var(--glass-border)] shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
                <div className="absolute top-0 right-0 p-40 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
                
                {/* Avatar */}
                <div className="relative group cursor-pointer z-10" onClick={() => !saving && !uploading && fileInputRef.current?.click()} role="button" aria-label={t('common.upload')}>
                    <div className="w-32 h-32 rounded-full p-1 border-4 border-white shadow-xl bg-[var(--bg-surface)] overflow-hidden relative">
                        {uploading ? (
                            <div className="w-full h-full flex items-center justify-center bg-[var(--glass-surface-hover)]">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : formData.avatar && !avatarError ? (
                            <img 
                                src={formData.avatar} 
                                className="w-full h-full object-cover rounded-full" 
                                alt="Avatar"
                                onError={() => setAvatarError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 rounded-full">
                                <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-300 select-none">
                                    {formData.name?.charAt(0).toUpperCase() ?? '?'}
                                </span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <div className="bg-[var(--bg-surface)]/20 p-2 rounded-full text-white">{ICONS.UPLOAD}</div>
                        </div>
                    </div>
                    <button className="absolute bottom-1 right-1 bg-[var(--bg-surface)] text-[var(--text-secondary)] p-2 rounded-full shadow-lg border border-[var(--glass-border)] hover:text-indigo-600 transition-colors">
                        {ICONS.CAMERA}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/png, image/jpeg, image/webp" aria-hidden="true" />
                </div>

                {/* Identity */}
                <div className="text-center md:text-left z-10 flex-1">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2">{user.name}</h1>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                        <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wide shadow-md shadow-slate-200">
                            {t(`role.${user.role}`)}
                        </span>
                        <span className="px-3 py-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-xs font-mono text-[var(--text-tertiary)]">
                            {user.email}
                        </span>
                        {/* SSO Badge */}
                        {user.source === 'SSO' && (
                            <span className="px-3 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wide">
                                Google Workspace
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-3">
                    <div className="bg-[var(--bg-surface)] p-3 rounded-[24px] border border-[var(--glass-border)] shadow-sm sticky top-6 space-y-1">
                        <TabButton 
                            active={activeTab === 'GENERAL'} 
                            label={t('profile.tab_general')} 
                            icon={ICONS.GENERAL} 
                            onClick={() => { setActiveTab('GENERAL'); setMessage(null); setErrors({}); }} 
                        />
                        <TabButton 
                            active={activeTab === 'SECURITY'} 
                            label={t('profile.tab_security')} 
                            icon={ICONS.SECURITY} 
                            onClick={() => { setActiveTab('SECURITY'); setMessage(null); setErrors({}); }} 
                        />
                    </div>
                </div>

                {/* Form Content */}
                <div className="lg:col-span-9">
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] border border-[var(--glass-border)] shadow-sm min-h-[500px] relative">
                            <div className="flex justify-between items-center mb-8 border-b border-[var(--glass-border)] pb-6">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">
                                {activeTab === 'GENERAL' ? t('profile.tab_general') : t('profile.tab_security')}
                            </h2>
                        </div>

                        {activeTab === 'GENERAL' ? (
                            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl animate-enter">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField 
                                        id="name"
                                        label={t('profile.name')} 
                                        value={formData.name} 
                                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                        placeholder={t('auth.placeholder_name')}
                                        error={errors.name}
                                    />
                                    <InputField 
                                        id="phone"
                                        label={t('profile.phone')} 
                                        value={formData.phone} 
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        placeholder={t('profile.placeholder_phone')}
                                        error={errors.phone}
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs3 font-bold uppercase tracking-wider ml-1 text-[var(--text-tertiary)]">{t('profile.email')}</label>
                                        {user.source === 'SSO' ? (
                                            <span className="text-xs text-[var(--text-secondary)] italic">{t('profile.sso_email_managed')}</span>
                                        ) : !emailChangeOpen ? (
                                            <button
                                                type="button"
                                                onClick={handleRequestEmailChange}
                                                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                                            >
                                                {t('profile.btn_change')}
                                            </button>
                                        ) : null}
                                    </div>
                                    <input
                                        value={user.email}
                                        disabled
                                        className="w-full bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-tertiary)] cursor-not-allowed outline-none"
                                    />

                                    {emailChangeOpen && (
                                        <div className="mt-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 animate-enter">
                                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{t('profile.email_change_title')}</p>
                                            <div className="space-y-1.5">
                                                <label className="text-xs3 font-bold uppercase tracking-wider ml-1 text-[var(--text-tertiary)]">{t('profile.email_new_label')}</label>
                                                <input
                                                    type="email"
                                                    value={emailData.newEmail}
                                                    onChange={e => { setEmailData(d => ({ ...d, newEmail: e.target.value })); setEmailErrors(er => ({ ...er, newEmail: '' })); }}
                                                    placeholder={t('profile.email_new_placeholder')}
                                                    className={`w-full bg-[var(--bg-surface)] border rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--text-muted)] focus:ring-2
                                                        ${emailErrors.newEmail ? 'border-rose-300 focus:ring-rose-500/20 bg-rose-50 text-rose-900' : 'border-[var(--glass-border)] focus:ring-indigo-500/20 text-[var(--text-primary)]'}`}
                                                />
                                                {emailErrors.newEmail && <p className="text-xs2 font-bold text-rose-500 ml-1">{emailErrors.newEmail}</p>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs3 font-bold uppercase tracking-wider ml-1 text-[var(--text-tertiary)]">{t('profile.email_confirm_pass')}</label>
                                                <input
                                                    type="password"
                                                    value={emailData.confirmPass}
                                                    onChange={e => { setEmailData(d => ({ ...d, confirmPass: e.target.value })); setEmailErrors(er => ({ ...er, confirmPass: '' })); }}
                                                    placeholder="••••••••"
                                                    onKeyDown={e => e.key === 'Enter' && handleSubmitEmailChange()}
                                                    className={`w-full bg-[var(--bg-surface)] border rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--text-muted)] focus:ring-2
                                                        ${emailErrors.confirmPass ? 'border-rose-300 focus:ring-rose-500/20 bg-rose-50 text-rose-900' : 'border-[var(--glass-border)] focus:ring-indigo-500/20 text-[var(--text-primary)]'}`}
                                                />
                                                {emailErrors.confirmPass && <p className="text-xs2 font-bold text-rose-500 ml-1">{emailErrors.confirmPass}</p>}
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleSubmitEmailChange}
                                                    disabled={emailSaving}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {emailSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                                    {t('profile.email_submit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEmailChange}
                                                    disabled={emailSaving}
                                                    className="px-5 bg-[var(--bg-surface)] hover:bg-[var(--glass-surface)] text-[var(--text-secondary)] text-sm font-bold py-2.5 rounded-xl border border-[var(--glass-border)] transition-colors"
                                                >
                                                    {t('profile.email_cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                    <InputField 
                                        id="bio"
                                        label={t('profile.bio')} 
                                        value={formData.bio} 
                                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                        placeholder={t('profile.placeholder_bio')}
                                        isTextArea={true}
                                    />

                                <div className="pt-6 flex justify-end gap-3">
                                    <button 
                                        type="button"
                                        onClick={handleReset}
                                        disabled={saving || !isDirty}
                                        className={`px-6 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-slate-200 transition-all ${!isDirty ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                    >
                                        {t('common.reset')}
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={saving || !isDirty} 
                                        className={`px-8 py-3 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                                            saving || !isDirty 
                                            ? 'bg-slate-200 text-[var(--text-secondary)] cursor-not-allowed shadow-none' 
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'
                                        }`}
                                    >
                                        {saving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div> : ICONS.SAVE}
                                        {t('common.save')}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            // Security Tab - Differentiate for SSO vs Standard
                            user.source === 'SSO' ? (
                                <div className="animate-enter max-w-2xl text-center py-10 bg-[var(--glass-surface)] rounded-2xl border border-[var(--glass-border)]">
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t('profile.sso_managed_title')}</h3>
                                    <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto leading-relaxed">
                                        {t('profile.sso_managed_desc')}
                                    </p>
                                    <a 
                                        href="https://myaccount.google.com/" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="mt-6 inline-block px-6 py-2 bg-[var(--bg-surface)] border border-slate-300 text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-[var(--glass-surface)] transition-colors"
                                    >
                                        {t('profile.sso_manage_btn')}
                                    </a>
                                </div>
                            ) : (
                                <form onSubmit={handleSavePassword} className="space-y-6 max-w-2xl animate-enter">
                                    <InputField 
                                        id="current-password"
                                        label={t('profile.pass_current')}
                                        type="password"
                                        value={passData.current} 
                                        onChange={(e) => setPassData({...passData, current: e.target.value})}
                                        placeholder="••••••••" 
                                        error={errors.current}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <InputField 
                                            id="new-password"
                                            label={t('profile.pass_new')}
                                            type="password"
                                            value={passData.new} 
                                            onChange={(e) => setPassData({...passData, new: e.target.value})}
                                            placeholder="••••••••"
                                            error={errors.new}
                                        />
                                        <InputField 
                                            id="confirm-password"
                                            label={t('profile.pass_confirm')}
                                            type="password"
                                            value={passData.confirm} 
                                            onChange={(e) => setPassData({...passData, confirm: e.target.value})}
                                            placeholder="••••••••"  
                                            error={errors.confirm}
                                        />
                                    </div>
                                    <div className="pt-6 flex justify-end">
                                        <button 
                                            type="submit" 
                                            disabled={saving || !passData.current || !passData.new || !passData.confirm} 
                                            className={`px-8 py-3 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                                                saving || !passData.current || !passData.new || !passData.confirm
                                                ? 'bg-slate-200 text-[var(--text-secondary)] cursor-not-allowed shadow-none' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'
                                            }`}
                                        >
                                            {saving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div> : ICONS.SAVE}
                                            {t('common.save')}
                                        </button>
                                    </div>
                                </form>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
        {createPortal(
            message ? (
                <div className={`fixed top-6 right-6 max-w-sm px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 animate-enter z-[9999] shadow-lg ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {message.type === 'success' ? ICONS.SUCCESS : ICONS.ERROR}
                    {message.text}
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
