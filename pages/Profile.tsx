import React, { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
import { Skeleton } from '../components/Skeleton';
import { SeoHead } from '../components/SeoHead';
import {
    SettingsPage,
    SettingsHeader,
    SettingsCard,
    StatTile,
    StatGrid,
    DistributionBar,
    StatusBadge,
    EmptyState,
    TONE_COLOR,
    type Tone,
} from '../components/settings/SettingsUI';
import { DashboardMetricRing } from '../components/dashboard/DashboardVisuals';

// -----------------------------------------------------------------------------
//  1. CONSTANTS & UTILS
// -----------------------------------------------------------------------------
const CONSTANTS = {
    MAX_AVATAR_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
    TOAST_DURATION: 3000,
    // Strictly require 10 digits for VN mobile numbers
    VN_PHONE_REGEX: /^(03|05|07|08|09)([0-9]{8})$/
};

const FIELD_LABEL = 'mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]';
const FIELD_ERROR = 'mt-1 text-xs font-medium text-[var(--ui-danger)]';

type TabId = 'GENERAL' | 'SECURITY' | 'PERFORMANCE';

// -----------------------------------------------------------------------------
//  2. ISOLATED SUB-COMPONENTS
// -----------------------------------------------------------------------------
const ICONS = {
    CAMERA: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    GENERAL: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    SECURITY: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    SUCCESS: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    ERROR: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    SAVE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
    PERFORMANCE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    GLOBE: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>,
};

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
    <span
        className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 ${light ? 'border-white/30 border-t-white' : 'border-[var(--glass-border)] border-t-[var(--sgs-primary)]'}`}
        aria-hidden="true"
    />
);

/** Numbered heading for the 2FA setup steps. */
const StepTitle: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sgs-primary)] text-xs font-bold text-white" aria-hidden="true">{n}</span>
        {children}
    </h4>
);

interface NavButtonProps {
    id: TabId;
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}
const NavButton: React.FC<NavButtonProps> = memo(({ id, active, label, icon, onClick }) => (
    <button
        type="button"
        role="tab"
        id={`profile-tab-${id}`}
        aria-selected={active}
        aria-controls="profile-panel"
        onClick={onClick}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] lg:justify-start
        ${active ? 'bg-[var(--sgs-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)]'}`}
    >
        <span className="hidden sm:inline-flex">{icon}</span>
        <span className="min-w-0 text-center leading-tight lg:text-left">{label}</span>
    </button>
));

interface InputFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
    isTextArea?: boolean;
    error?: string | null;
    autoComplete?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}
const InputField: React.FC<InputFieldProps> = memo(({ id, label, value, onChange, disabled, placeholder, type = 'text', isTextArea, error, autoComplete, inputMode }) => {
    const errorId = `${id}-error`;
    const common = {
        id,
        value,
        onChange,
        disabled,
        placeholder,
        autoComplete,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
    };
    const cls = `ui-input w-full text-base sm:text-sm ${error ? 'border-[var(--ui-danger)]' : ''}`;
    return (
        <div>
            <label htmlFor={id} className={FIELD_LABEL}>{label}</label>
            {isTextArea
                ? <textarea {...common} rows={4} className={`${cls} resize-y`} />
                : <input {...common} type={type} inputMode={inputMode} className={`${cls} min-h-[44px]`} />}
            {error && <p id={errorId} className={FIELD_ERROR}>{error}</p>}
        </div>
    );
});

// -----------------------------------------------------------------------------
//  3. MAIN COMPONENT
// -----------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentStatsData {
    deals: number;
    lost: number;
    totalLeads: number;
    inProgress: number;
    closeRate: number;
    revenue: number;
    avgResponseMinutes: number | null;
    slaScore: number;
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    completedThisMonth: number;
    workloadScore: number;
}

export const Profile: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('GENERAL');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    // Performance tab state
    const [perfLoading, setPerfLoading] = useState(false);
    const [perfData, setPerfData] = useState<AgentStatsData | null>(null);
    const [perfError, setPerfError] = useState(false);
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
    // TOTP 2FA state
    const [totpEnabled, setTotpEnabled] = useState(false);
    const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauthUrl: string; backupCodes: string[] } | null>(null);
    const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');
    const [totpCode, setTotpCode] = useState('');
    const [totpMsg, setTotpMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [totpLoading, setTotpLoading] = useState(false);
    const { t, language } = useTranslation();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';

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
    useEffect(() => {
        db.getTotpStatus().then(s => setTotpEnabled(s.enabled)).catch(() => {});
    }, []);
    // Reset avatarError whenever the avatar URL is changed (new upload or load)
    useEffect(() => { setAvatarError(false); }, [formData.avatar]);
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), CONSTANTS.TOAST_DURATION);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Fetch performance data lazily when the PERFORMANCE tab is first opened
    useEffect(() => {
        if (activeTab !== 'PERFORMANCE' || !user) return;
        if (perfData) return; // already loaded — don't re-fetch on every visit
        let cancelled = false;
        (async () => {
            setPerfLoading(true);
            setPerfError(false);
            try {
                const res = await fetch(`/api/analytics/agent-stats/${user.id}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!cancelled) setPerfData(data);
            } catch {
                if (!cancelled) setPerfError(true);
            } finally {
                if (!cancelled) setPerfLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [activeTab, user, perfData]);

    const handleTotpSetup = async () => {
        setTotpLoading(true);
        setTotpMsg(null);
        try {
            const data = await db.setupTotp();
            setTotpSetupData(data);
            setTotpStep('setup');
        } catch {
            setTotpMsg({ text: t('profile.v2_totp_err_init'), type: 'error' });
        } finally {
            setTotpLoading(false);
        }
    };
    const handleTotpEnable = async () => {
        if (!totpCode.trim()) return;
        setTotpLoading(true);
        setTotpMsg(null);
        try {
            await db.enableTotp(totpCode.trim());
            setTotpEnabled(true);
            setTotpStep('idle');
            setTotpSetupData(null);
            setTotpCode('');
            setTotpMsg({ text: t('profile.v2_totp_enabled_ok'), type: 'success' });
        } catch (e: any) {
            setTotpMsg({ text: e.message?.includes('Invalid') ? t('profile.v2_totp_err_code') : t('profile.v2_totp_err_enable'), type: 'error' });
            setTotpCode('');
        } finally {
            setTotpLoading(false);
        }
    };
    const handleTotpDisable = async () => {
        if (!totpCode.trim()) return;
        setTotpLoading(true);
        setTotpMsg(null);
        try {
            await db.disableTotp(totpCode.trim());
            setTotpEnabled(false);
            setTotpStep('idle');
            setTotpCode('');
            setTotpMsg({ text: t('profile.v2_totp_disabled_ok'), type: 'success' });
        } catch (e: any) {
            setTotpMsg({ text: e.message?.includes('Invalid') ? t('profile.v2_totp_err_code') : t('profile.v2_totp_err_disable'), type: 'error' });
            setTotpCode('');
        } finally {
            setTotpLoading(false);
        }
    };
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

    const switchTab = useCallback((tab: TabId) => {
        setActiveTab(tab);
        setMessage(null);
        setErrors({});
    }, []);

    if (loading) {
        return (
            <SettingsPage>
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <Skeleton className="h-72 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </SettingsPage>
        );
    }
    if (!user) return null;

    const isSso = user.source === 'SSO';
    const avatarPending = formData.avatar !== (user.avatar || '');
    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'GENERAL', label: t('profile.tab_general'), icon: ICONS.GENERAL },
        { id: 'SECURITY', label: t('profile.tab_security'), icon: ICONS.SECURITY },
        { id: 'PERFORMANCE', label: t('profile.tab_perf'), icon: ICONS.PERFORMANCE },
    ];
    const passwordReady = !!passData.current && !!passData.new && !!passData.confirm;

    /* ---------------- Left column: identity + section navigation ---------------- */
    const identity = (
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <SettingsCard as="div" bodyClassName="flex flex-row items-center gap-4 lg:flex-col lg:items-center lg:text-center">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploading}
                    aria-label={t('common.upload')}
                    className="group relative h-20 w-20 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 disabled:cursor-wait lg:h-24 lg:w-24"
                >
                    <span className="block h-full w-full overflow-hidden rounded-full border border-[var(--glass-border)] bg-[var(--glass-surface)]">
                        {uploading ? (
                            <span className="flex h-full w-full items-center justify-center"><Spinner /></span>
                        ) : formData.avatar && !avatarError ? (
                            <img
                                src={formData.avatar}
                                className="h-full w-full object-cover"
                                alt={t('profile.avatar_alt')}
                                onError={() => setAvatarError(true)}
                            />
                        ) : (
                            <span className="flex h-full w-full select-none items-center justify-center text-3xl font-bold text-[var(--sgs-primary)]" aria-hidden="true">
                                {formData.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                        )}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm transition-colors group-hover:text-[var(--sgs-primary)]" aria-hidden="true">
                        {ICONS.CAMERA}
                    </span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/png, image/jpeg, image/webp" aria-hidden="true" tabIndex={-1} />
                <div className="min-w-0 flex-1 lg:w-full">
                    <h2 className="truncate text-base font-bold text-[var(--text-primary)]">{user.name}</h2>
                    <p className="mt-0.5 break-all text-xs text-[var(--text-tertiary)]">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-center">
                        <StatusBadge tone="brand">{t(`role.${user.role?.toUpperCase()}`)}</StatusBadge>
                        {isSso && <StatusBadge tone="info">{t('profile.sso_badge')}</StatusBadge>}
                    </div>
                    {avatarPending ? (
                        <p className="mt-2 text-xs font-medium" style={{ color: TONE_COLOR.warning }}>{t('profile.v2_avatar_pending')}</p>
                    ) : (
                        <p className="mt-2 text-xs text-[var(--text-tertiary)]">{t('profile.v2_avatar_hint')}</p>
                    )}
                </div>
            </SettingsCard>
            <nav aria-label={t('profile.v2_nav_aria')}>
                <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-1.5 lg:grid-cols-1">
                    {tabs.map(tab => (
                        <NavButton key={tab.id} id={tab.id} active={activeTab === tab.id} label={tab.label} icon={tab.icon} onClick={() => switchTab(tab.id)} />
                    ))}
                </div>
            </nav>
        </aside>
    );

    /* ---------------- General ---------------- */
    const saveState = saving
        ? { text: t('profile.v2_state_saving'), color: 'var(--text-secondary)' }
        : isDirty
            ? { text: t('profile.v2_state_dirty'), color: TONE_COLOR.warning }
            : { text: t('profile.v2_state_saved'), color: 'var(--text-tertiary)' };

    const general = (
        <SettingsCard title={t('profile.tab_general')} description={t('profile.v2_general_desc')}>
            <form onSubmit={handleSaveProfile} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InputField
                        id="profile-name"
                        label={t('profile.name')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('auth.placeholder_name')}
                        error={errors.name}
                        autoComplete="name"
                    />
                    <InputField
                        id="profile-phone"
                        label={t('profile.phone')}
                        type="tel"
                        inputMode="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t('profile.placeholder_phone')}
                        error={errors.phone}
                        autoComplete="tel"
                    />
                </div>

                <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="profile-email" className="text-xs font-semibold text-[var(--text-secondary)]">{t('profile.email')}</label>
                        {isSso ? (
                            <span className="text-xs text-[var(--text-tertiary)]">{t('profile.sso_email_managed')}</span>
                        ) : !emailChangeOpen ? (
                            <button type="button" onClick={handleRequestEmailChange} className="ui-button ui-button-ghost ui-button-sm">
                                {t('profile.btn_change')}
                            </button>
                        ) : null}
                    </div>
                    <input id="profile-email" value={user.email} disabled readOnly className="ui-input min-h-[44px] w-full cursor-not-allowed text-base opacity-70 sm:text-sm" />
                    {emailChangeOpen && (
                        <fieldset className="mt-3 space-y-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
                            <legend className="px-1 text-sm font-semibold text-[var(--text-primary)]">{t('profile.email_change_title')}</legend>
                            <div>
                                <label htmlFor="profile-new-email" className={FIELD_LABEL}>{t('profile.email_new_label')}</label>
                                <input
                                    id="profile-new-email"
                                    type="email"
                                    autoComplete="email"
                                    value={emailData.newEmail}
                                    onChange={e => { setEmailData(d => ({ ...d, newEmail: e.target.value })); setEmailErrors(er => ({ ...er, newEmail: '' })); }}
                                    placeholder={t('profile.email_new_placeholder')}
                                    aria-invalid={emailErrors.newEmail ? true : undefined}
                                    aria-describedby={emailErrors.newEmail ? 'profile-new-email-error' : undefined}
                                    className={`ui-input min-h-[44px] w-full text-base sm:text-sm ${emailErrors.newEmail ? 'border-[var(--ui-danger)]' : ''}`}
                                />
                                {emailErrors.newEmail && <p id="profile-new-email-error" className={FIELD_ERROR}>{emailErrors.newEmail}</p>}
                            </div>
                            <div>
                                <label htmlFor="profile-email-password" className={FIELD_LABEL}>{t('profile.email_confirm_pass')}</label>
                                <input
                                    id="profile-email-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={emailData.confirmPass}
                                    onChange={e => { setEmailData(d => ({ ...d, confirmPass: e.target.value })); setEmailErrors(er => ({ ...er, confirmPass: '' })); }}
                                    placeholder={t('common.password_placeholder')}
                                    // Enter submits the email change only, not the surrounding profile form
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitEmailChange(); } }}
                                    aria-invalid={emailErrors.confirmPass ? true : undefined}
                                    aria-describedby={emailErrors.confirmPass ? 'profile-email-password-error' : undefined}
                                    className={`ui-input min-h-[44px] w-full text-base sm:text-sm ${emailErrors.confirmPass ? 'border-[var(--ui-danger)]' : ''}`}
                                />
                                {emailErrors.confirmPass && <p id="profile-email-password-error" className={FIELD_ERROR}>{emailErrors.confirmPass}</p>}
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button type="button" onClick={handleCancelEmailChange} disabled={emailSaving} className="ui-button ui-button-secondary ui-button-md min-h-[44px]">
                                    {t('profile.email_cancel')}
                                </button>
                                <button type="button" onClick={handleSubmitEmailChange} disabled={emailSaving} className="ui-button ui-button-primary ui-button-md min-h-[44px] gap-2">
                                    {emailSaving && <Spinner light />}
                                    {t('profile.email_submit')}
                                </button>
                            </div>
                        </fieldset>
                    )}
                </div>

                <InputField
                    id="profile-bio"
                    label={t('profile.bio')}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder={t('profile.placeholder_bio')}
                    isTextArea
                />

                <div className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-xs font-medium" style={{ color: saveState.color }} role="status" aria-live="polite">
                        {saving ? <Spinner /> : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: saveState.color }} aria-hidden="true" />}
                        {saveState.text}
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        {isDirty && (
                            <button type="button" onClick={handleReset} disabled={saving} className="ui-button ui-button-secondary ui-button-md min-h-[44px]">
                                {t('common.reset')}
                            </button>
                        )}
                        <button type="submit" disabled={saving || !isDirty} className="ui-button ui-button-primary ui-button-md min-h-[44px] gap-2 disabled:cursor-not-allowed disabled:opacity-60">
                            {saving ? <Spinner light /> : ICONS.SAVE}
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </form>
        </SettingsCard>
    );

    /* ---------------- Security ---------------- */
    const totpMsgBox = totpMsg && (
        <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-start gap-2 rounded-xl border bg-[var(--glass-surface)] p-3 text-xs font-medium"
            style={{ color: totpMsg.type === 'success' ? TONE_COLOR.success : TONE_COLOR.danger, borderColor: totpMsg.type === 'success' ? TONE_COLOR.success : TONE_COLOR.danger }}
        >
            {totpMsg.type === 'success' ? ICONS.SUCCESS : ICONS.ERROR}
            <span>{totpMsg.text}</span>
        </div>
    );

    const security = isSso ? (
        <SettingsCard title={t('profile.tab_security')}>
            <EmptyState
                icon={ICONS.GLOBE}
                title={t('profile.sso_managed_title')}
                description={t('profile.sso_managed_desc')}
                action={
                    <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer" className="ui-button ui-button-secondary ui-button-md min-h-[44px]">
                        {t('profile.sso_manage_btn')}
                    </a>
                }
            />
        </SettingsCard>
    ) : (
        <>
            <SettingsCard title={t('profile.v2_password_title')} description={t('profile.v2_password_desc')}>
                <form onSubmit={handleSavePassword} className="space-y-4" noValidate>
                    <div className="md:max-w-[calc(50%-0.5rem)]">
                        <InputField
                            id="current-password"
                            label={t('profile.pass_current')}
                            type="password"
                            autoComplete="current-password"
                            value={passData.current}
                            onChange={(e) => setPassData({ ...passData, current: e.target.value })}
                            placeholder={t('common.password_placeholder')}
                            error={errors.current}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <InputField
                            id="new-password"
                            label={t('profile.pass_new')}
                            type="password"
                            autoComplete="new-password"
                            value={passData.new}
                            onChange={(e) => setPassData({ ...passData, new: e.target.value })}
                            placeholder={t('common.password_placeholder')}
                            error={errors.new}
                        />
                        <InputField
                            id="confirm-password"
                            label={t('profile.pass_confirm')}
                            type="password"
                            autoComplete="new-password"
                            value={passData.confirm}
                            onChange={(e) => setPassData({ ...passData, confirm: e.target.value })}
                            placeholder={t('common.password_placeholder')}
                            error={errors.confirm}
                        />
                    </div>
                    <div className="flex justify-end border-t border-[var(--glass-border)] pt-4">
                        <button type="submit" disabled={saving || !passwordReady} className="ui-button ui-button-primary ui-button-md min-h-[44px] w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                            {saving ? <Spinner light /> : ICONS.SAVE}
                            {t('profile.v2_password_submit')}
                        </button>
                    </div>
                </form>
            </SettingsCard>

            <SettingsCard
                title={t('profile.v2_totp_title')}
                description={t('profile.v2_totp_desc')}
                actions={<StatusBadge tone={totpEnabled ? 'success' : 'neutral'}>{totpEnabled ? t('profile.v2_totp_on') : t('profile.v2_totp_off')}</StatusBadge>}
            >
                {totpMsgBox}

                {totpStep === 'idle' && !totpEnabled && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[var(--text-secondary)]">{t('profile.v2_totp_off_hint')}</p>
                        <button type="button" onClick={handleTotpSetup} disabled={totpLoading} className="ui-button ui-button-primary ui-button-md min-h-[44px] shrink-0 gap-2 disabled:opacity-60">
                            {totpLoading ? <Spinner light /> : ICONS.SECURITY}
                            {t('profile.v2_totp_enable')}
                        </button>
                    </div>
                )}

                {totpStep === 'setup' && totpSetupData && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <section className="space-y-3">
                                <StepTitle n={1}>{t('profile.v2_totp_step_scan')}</StepTitle>
                                <p className="text-xs text-[var(--text-secondary)]">{t('profile.v2_totp_scan')}</p>
                                <div className="flex justify-center md:justify-start">
                                    <div className="inline-block rounded-xl border border-[var(--glass-border)] bg-white p-3" role="img" aria-label={t('profile.v2_totp_qr_aria')}>
                                        <QRCodeSVG value={totpSetupData.otpauthUrl} size={168} />
                                    </div>
                                </div>
                                <div className="rounded-xl bg-[var(--glass-surface)] p-3">
                                    <p className="mb-1 text-xs text-[var(--text-tertiary)]">{t('profile.v2_totp_manual')}</p>
                                    <code className="break-all font-mono text-xs font-bold text-[var(--text-primary)]">{totpSetupData.secret}</code>
                                </div>
                            </section>
                            <section className="space-y-3">
                                <StepTitle n={2}>{t('profile.v2_totp_step_backup')}</StepTitle>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                                    <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">{t('profile.v2_totp_backup')}</p>
                                    <ul className="grid grid-cols-2 gap-1.5">
                                        {totpSetupData.backupCodes.map((c, i) => (
                                            <li key={i}>
                                                <code className="block rounded-md border border-amber-200 bg-[var(--bg-surface)] px-2 py-1 text-center font-mono text-xs dark:border-slate-700">{c}</code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        </div>
                        <section className="space-y-3 border-t border-[var(--glass-border)] pt-4">
                            <StepTitle n={3}>{t('profile.v2_totp_step_verify')}</StepTitle>
                            <div className="sm:max-w-xs">
                                <label htmlFor="totp-enable-code" className={FIELD_LABEL}>{t('profile.v2_totp_code_label')}</label>
                                <input
                                    id="totp-enable-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={8}
                                    value={totpCode}
                                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="ui-input min-h-[44px] w-full text-center font-mono text-lg tracking-[0.4em]"
                                />
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row">
                                <button type="button" onClick={() => { setTotpStep('idle'); setTotpSetupData(null); setTotpCode(''); }} className="ui-button ui-button-secondary ui-button-md min-h-[44px]">
                                    {t('profile.v2_cancel')}
                                </button>
                                <button type="button" onClick={handleTotpEnable} disabled={totpLoading || totpCode.length < 6} className="ui-button ui-button-primary ui-button-md min-h-[44px] gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    {totpLoading && <Spinner light />}
                                    {t('profile.v2_totp_confirm_enable')}
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {totpStep === 'idle' && totpEnabled && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[var(--text-secondary)]">{t('profile.v2_totp_on_hint')}</p>
                        <button type="button" onClick={() => { setTotpStep('disable'); setTotpCode(''); setTotpMsg(null); }} className="ui-button ui-button-danger ui-button-md min-h-[44px] shrink-0">
                            {t('profile.v2_totp_disable')}
                        </button>
                    </div>
                )}

                {totpStep === 'disable' && (
                    <div className="space-y-4">
                        <div className="sm:max-w-xs">
                            <label htmlFor="totp-disable-code" className={FIELD_LABEL}>{t('profile.v2_totp_code_label')}</label>
                            <input
                                id="totp-disable-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={8}
                                value={totpCode}
                                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                                placeholder="000000"
                                aria-describedby="totp-disable-hint"
                                className="ui-input min-h-[44px] w-full text-center font-mono text-lg tracking-[0.4em]"
                            />
                            <p id="totp-disable-hint" className="mt-1 text-xs text-[var(--text-tertiary)]">{t('profile.v2_totp_disable_hint')}</p>
                        </div>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <button type="button" onClick={() => { setTotpStep('idle'); setTotpCode(''); }} className="ui-button ui-button-secondary ui-button-md min-h-[44px]">
                                {t('profile.v2_cancel')}
                            </button>
                            <button type="button" onClick={handleTotpDisable} disabled={totpLoading || totpCode.length < 6} className="ui-button ui-button-danger ui-button-md min-h-[44px] gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                                {totpLoading && <Spinner light />}
                                {t('profile.v2_totp_confirm_disable')}
                            </button>
                        </div>
                    </div>
                )}
            </SettingsCard>
        </>
    );

    /* ---------------- Performance ---------------- */
    const performance = (() => {
        if (perfLoading) {
            return (
                <SettingsCard>
                    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
                        <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)]" aria-hidden="true" />
                        <span className="text-sm text-[var(--text-secondary)]">{t('profile.perf_loading')}</span>
                    </div>
                </SettingsCard>
            );
        }
        if (perfError || !perfData) {
            return (
                <SettingsCard>
                    <EmptyState icon={ICONS.PERFORMANCE} title={t('profile.perf_no_data')} />
                </SettingsCard>
            );
        }
        const nf = new Intl.NumberFormat(locale);
        // closeRate/slaScore come back as 0 when nothing is resolved yet — show '—' instead of a fake zero.
        const hasResolved = perfData.deals + perfData.lost > 0;
        const hasSla = hasResolved || perfData.avgResponseMinutes != null;
        const sla = hasSla ? perfData.slaScore : null;
        const closeRate = hasResolved ? perfData.closeRate : null;
        const slaTone: Tone = sla == null ? 'neutral' : sla >= 90 ? 'success' : sla >= 70 ? 'brand' : 'warning';
        const slaLabel = sla == null
            ? t('profile.v2_sla_insufficient')
            : sla >= 90 ? t('profile.perf_sla_excellent') : sla >= 70 ? t('profile.perf_sla_good') : t('profile.perf_sla_needs_work');
        const revenueText = perfData.revenue >= 1e9
            ? `${(perfData.revenue / 1e9).toFixed(1)} ${t('profile.perf_billion')}`
            : perfData.revenue >= 1e6
                ? `${(perfData.revenue / 1e6).toFixed(0)} ${t('profile.perf_million')}`
                : nf.format(perfData.revenue);
        // Lead stages are exact: WON leads = total − in progress − LOST (deals also count SOLD listings).
        const wonLeads = Math.max(0, perfData.totalLeads - perfData.inProgress - perfData.lost);

        return (
            <>
                <SettingsCard title={t('profile.perf_sla')} description={t('profile.v2_sla_hint')}>
                    <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <DashboardMetricRing
                            value={sla}
                            size={104}
                            color={TONE_COLOR[slaTone]}
                            centerValue={sla == null ? '—' : String(sla)}
                            label={sla == null ? `${t('profile.perf_sla')}: —` : t('profile.v2_sla_aria', { n: sla })}
                        />
                        <div className="min-w-0 text-center sm:text-left">
                            <p className="text-xl font-bold" style={{ color: sla == null ? 'var(--text-secondary)' : TONE_COLOR[slaTone] }}>{slaLabel}</p>
                            {sla != null && <p className="text-xs text-[var(--text-tertiary)]">{t('profile.v2_sla_scale', { n: sla })}</p>}
                            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <dt className="text-[var(--text-secondary)]">{t('profile.perf_close_rate')}</dt>
                                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">{closeRate == null ? '—' : `${closeRate}%`}</dd>
                                <dt className="text-[var(--text-secondary)]">{t('profile.perf_avg_resp')}</dt>
                                <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                                    {perfData.avgResponseMinutes == null ? '—' : `${nf.format(perfData.avgResponseMinutes)} ${t('dash.minutes')}`}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </SettingsCard>

                <section aria-labelledby="profile-perf-leads" className="space-y-3">
                    <h3 id="profile-perf-leads" className="text-sm font-semibold text-[var(--text-primary)]">{t('profile.perf_lead_section')}</h3>
                    <StatGrid cols={3}>
                        <StatTile label={t('profile.perf_deals')} value={nf.format(perfData.deals)} tone="success" hint={t('profile.v2_deals_hint')} />
                        <StatTile
                            label={t('profile.perf_close_rate')}
                            value={closeRate == null ? '—' : `${closeRate}%`}
                            tone="brand"
                            hint={t('profile.perf_close_formula')}
                            visual={<DashboardMetricRing value={closeRate} size={44} showValue={false} label={closeRate == null ? `${t('profile.perf_close_rate')}: —` : t('profile.v2_close_rate_aria', { n: closeRate })} />}
                        />
                        <StatTile label={t('profile.perf_revenue')} value={revenueText} tone="brand" hint={t('profile.v2_revenue_hint')} />
                        <StatTile label={t('profile.perf_total_leads')} value={nf.format(perfData.totalLeads)} />
                        <StatTile label={t('profile.perf_in_progress')} value={nf.format(perfData.inProgress)} tone="accent" />
                        <StatTile label={t('profile.perf_lost')} value={nf.format(perfData.lost)} tone={perfData.lost > 0 ? 'danger' : 'neutral'} />
                    </StatGrid>
                </section>

                <SettingsCard title={t('profile.v2_lead_mix_title')} description={t('profile.v2_lead_mix_desc')}>
                    <DistributionBar
                        ariaLabel={t('profile.v2_lead_mix_title')}
                        emptyText={t('profile.v2_lead_mix_empty')}
                        formatValue={n => nf.format(n)}
                        segments={[
                            { label: t('profile.perf_in_progress'), value: perfData.inProgress, color: TONE_COLOR.accent },
                            { label: t('profile.v2_mix_won'), value: wonLeads, color: TONE_COLOR.success },
                            { label: t('profile.perf_lost'), value: perfData.lost, color: TONE_COLOR.danger },
                        ]}
                    />
                </SettingsCard>

                <section aria-labelledby="profile-perf-tasks" className="space-y-3">
                    <h3 id="profile-perf-tasks" className="text-sm font-semibold text-[var(--text-primary)]">{t('profile.perf_task_section')}</h3>
                    <StatGrid cols={4}>
                        <StatTile label={t('profile.perf_tasks_active')} value={nf.format(perfData.activeTasks)} tone={perfData.activeTasks > 5 ? 'warning' : 'neutral'} />
                        <StatTile label={t('profile.perf_tasks_overdue')} value={nf.format(perfData.overdueTasks)} tone={perfData.overdueTasks > 0 ? 'danger' : 'neutral'} />
                        <StatTile label={t('profile.perf_tasks_week')} value={nf.format(perfData.completedThisWeek)} tone="success" hint={t('profile.v2_last_7_days')} />
                        <StatTile label={t('profile.perf_tasks_month')} value={nf.format(perfData.completedThisMonth)} tone="brand" hint={t('profile.v2_last_30_days')} />
                    </StatGrid>
                </section>
            </>
        );
    })();

    return (
        <>
            <SeoHead title={t('profile.v2_seo_title')} description={t('profile.v2_seo_desc')} canonicalPath="/profile" />
            <SettingsPage>
                <SettingsHeader
                    title={t('profile.v2_title')}
                    description={t('profile.v2_subtitle')}
                    icon={ICONS.GENERAL}
                />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    {identity}
                    <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${activeTab}`} className="min-w-0 space-y-5">
                        {activeTab === 'GENERAL' ? general : activeTab === 'SECURITY' ? security : performance}
                    </div>
                </div>
            </SettingsPage>
            {createPortal(
                message ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`fixed left-4 right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm ${message.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
                    >
                        {message.type === 'success' ? ICONS.SUCCESS : ICONS.ERROR}
                        <span>{message.text}</span>
                    </div>
                ) : null,
                document.body
            )}
        </>
    );
};
