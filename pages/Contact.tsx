
import React, { useState, useCallback, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { Dropdown } from '../components/Dropdown';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    MAP_PIN: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    PHONE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    EMAIL: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    SEND: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    ERROR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export const Contact: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const SUBJECT_OPTIONS = [
        { value: "support", label: t('contact.subj_support') },
        { value: "sales", label: t('contact.subj_sales') },
        { value: "partnership", label: t('contact.subj_partner') },
        { value: "other", label: t('contact.subj_other') }
    ];

    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const notify = useCallback((msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = t('contact.err_name');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!form.email.trim()) newErrors.email = t('contact.err_email_required');
        else if (!emailRegex.test(form.email)) newErrors.email = t('contact.err_email_invalid');

        if (!form.message.trim()) newErrors.message = t('contact.err_message_required');
        else if (form.message.length < 10) newErrors.message = t('contact.err_message_short');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            notify(t('contact.err_check'), "error");
            return;
        }

        setSending(true);
        setTimeout(() => {
            notify(`${t('contact.success')} ${form.name}.`, 'success');
            setSending(false);
            setForm({ name: '', email: '', subject: '', message: '' });
            setErrors({});
        }, 1500);
    };

    const handleInputChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar relative">

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-20 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${
                    toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'
                }`}>
                    {toast.type === 'success' ? ICONS.CHECK : ICONS.ERROR}
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} {t('contact.home')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">{t('contact.header')}</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('contact.dashboard') : t('contact.login')}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 animate-enter">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">{t('contact.page_title')}</h1>
                    <p className="text-[var(--text-tertiary)] text-lg max-w-2xl mx-auto">{t('contact.page_desc')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
                    {/* Contact Info */}
                    <div className="space-y-10">
                        <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] border border-[var(--glass-border)] shadow-xl">
                            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">{t('contact.info_title')}</h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                        {ICONS.MAP_PIN}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-primary)]">{t('contact.hq_title')}</h4>
                                        <p className="text-[var(--text-tertiary)] text-sm mt-1" style={{whiteSpace: 'pre-line'}}>{t('contact.hq_addr')}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                        {ICONS.PHONE}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-primary)]">{t('contact.hotline_title')}</h4>
                                        <p className="text-[var(--text-tertiary)] text-sm mt-1">0971 132 378 (24/7)</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                                        {ICONS.EMAIL}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-primary)]">{t('contact.email_label')}</h4>
                                        <p className="text-[var(--text-tertiary)] text-sm mt-1">info@sgsgroup.vn</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Map */}
                        <div className="rounded-[32px] overflow-hidden border border-[var(--glass-border)] h-64 bg-[var(--glass-surface-hover)] relative group cursor-pointer shadow-sm hover:shadow-md transition-all">
                            <iframe
                                title="map"
                                width="100%"
                                height="100%"
                                style={{ border: 0, opacity: 0.9 }}
                                loading="lazy"
                                allowFullScreen
                                src="https://maps.google.com/maps?q=122+Đường+B2,+An+Lợi+Đông,+Thủ+Đức,+Thành+phố+Hồ+Chí+Minh&t=&z=16&ie=UTF8&iwloc=B&output=embed"
                            ></iframe>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-[var(--bg-surface)] p-8 md:p-10 rounded-[40px] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

                        <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-6 relative z-10">{t('contact.form_title')}</h3>
                        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1 group">
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 group-focus-within:text-indigo-600 transition-colors">{t('contact.label_name')} <span className="text-rose-500">*</span></label>
                                    <input
                                        className={`w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all ${errors.name ? 'border-rose-300 bg-rose-50 focus:ring-rose-500/20' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)]'}`}
                                        placeholder={t('contact.placeholder_name')}
                                        value={form.name}
                                        onChange={e => handleInputChange('name', e.target.value)}
                                    />
                                    {errors.name && <p className="text-xs2 font-bold text-rose-500 ml-1 animate-enter">{errors.name}</p>}
                                </div>
                                <div className="space-y-1 group">
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 group-focus-within:text-indigo-600 transition-colors">{t('contact.label_email')} <span className="text-rose-500">*</span></label>
                                    <input
                                        className={`w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all ${errors.email ? 'border-rose-300 bg-rose-50 focus:ring-rose-500/20' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)]'}`}
                                        placeholder="name@example.com"
                                        value={form.email}
                                        onChange={e => handleInputChange('email', e.target.value)}
                                    />
                                    {errors.email && <p className="text-xs2 font-bold text-rose-500 ml-1 animate-enter">{errors.email}</p>}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Dropdown
                                    label={t('contact.label_subject')}
                                    value={form.subject}
                                    onChange={(val) => handleInputChange('subject', val as string)}
                                    options={SUBJECT_OPTIONS}
                                    placeholder={t('contact.placeholder_subject')}
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-1 group">
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase ml-1 group-focus-within:text-indigo-600 transition-colors">{t('contact.label_message')} <span className="text-rose-500">*</span></label>
                                <textarea
                                    rows={5}
                                    className={`w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all resize-none ${errors.message ? 'border-rose-300 bg-rose-50 focus:ring-rose-500/20' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)]'}`}
                                    placeholder={t('contact.placeholder_message')}
                                    value={form.message}
                                    onChange={e => handleInputChange('message', e.target.value)}
                                ></textarea>
                                {errors.message && <p className="text-xs2 font-bold text-rose-500 ml-1 animate-enter">{errors.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={sending}
                                className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {sending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        {t('contact.btn_sending')}
                                    </>
                                ) : (
                                    <>
                                        {t('contact.btn_send')} {ICONS.SEND}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
