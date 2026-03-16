
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    SEARCH: <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    GENERAL: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    ACCOUNT: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    API: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    SECURITY: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    ARROW: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

export const HelpCenter: React.FC = () => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const handleContact = () => window.location.hash = `#/${ROUTES.CONTACT}`;

    const categories = [
        { id: 'gen', title: t('help.cat_general'), icon: ICONS.GENERAL, color: 'bg-indigo-50 text-indigo-600' },
        { id: 'acc', title: t('help.cat_account'), icon: ICONS.ACCOUNT, color: 'bg-blue-50 text-blue-600' },
        { id: 'api', title: t('help.cat_api'), icon: ICONS.API, color: 'bg-emerald-50 text-emerald-600' },
        { id: 'sec', title: t('help.cat_security'), icon: ICONS.SECURITY, color: 'bg-rose-50 text-rose-600' }
    ];

    const faqs = [
        { id: 1, q: t('help.faq_1'), cat: 'gen' },
        { id: 2, q: t('help.faq_2'), cat: 'acc' },
        { id: 3, q: t('help.faq_3'), cat: 'api' },
        { id: 4, q: "Chính sách SLA cho Doanh nghiệp", cat: 'sec' },
        { id: 5, q: "Tuân thủ Nghị định 13 về Dữ liệu", cat: 'sec' },
    ];

    const filteredFaqs = faqs.filter(faq => 
        faq.q.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} {t('common.go_back')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">TRUNG TÂM HỖ TRỢ</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* Hero Search */}
            <section className="bg-slate-900 py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
                <div className="relative z-10 max-w-2xl mx-auto animate-enter">
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">{t('help.title')}</h1>
                    <p className="text-lg text-[var(--text-secondary)] mb-10">{t('help.subtitle')}</p>
                    
                    <div className="relative group">
                        <div className="absolute left-5 inset-y-0 flex items-center group-focus-within:text-indigo-500 text-[var(--text-tertiary)] transition-colors pointer-events-none">
                            {ICONS.SEARCH}
                        </div>
                        <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-16 pl-14 pr-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-lg shadow-2xl focus:ring-4 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-[var(--text-muted)]"
                            placeholder={t('help.search_placeholder')}
                        />
                        {searchQuery && (
                            <div className="absolute right-4 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-[var(--glass-surface-hover)] flex items-center justify-center"
                                    title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-[var(--bg-surface)] p-6 rounded-2xl shadow-xl shadow-slate-200/50 hover:-translate-y-1 transition-transform cursor-pointer group border border-[var(--glass-border)]">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${cat.color} group-hover:scale-110 transition-transform`}>
                                {cat.icon}
                            </div>
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">{cat.title}</h3>
                        </div>
                    ))}
                </div>

                <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--glass-border)] p-8 md:p-12 shadow-sm">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Bài viết phổ biến</h2>
                    {filteredFaqs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                            {filteredFaqs.map(faq => (
                                <a key={faq.id} href="#" className="flex items-center justify-between py-4 border-b border-[var(--glass-border)] group hover:border-indigo-100 transition-colors">
                                    <span className="font-medium text-[var(--text-secondary)] group-hover:text-indigo-600 transition-colors">{faq.q}</span>
                                    <span className="text-[var(--text-secondary)] group-hover:text-indigo-400 transition-colors">{ICONS.ARROW}</span>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-[var(--text-tertiary)]">Không tìm thấy kết quả nào cho "{searchQuery}"</p>
                        </div>
                    )}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-[var(--text-tertiary)] mb-4">Không tìm thấy nội dung bạn cần?</p>
                    <button 
                        onClick={handleContact}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        {t('help.contact_support')}
                    </button>
                </div>
            </div>
        </div>
    );
};
