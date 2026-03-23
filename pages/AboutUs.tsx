
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';

const ASSETS = {
    OFFICE: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop",
    CEO: "https://ui-avatars.com/api/?name=Tran+Minh+Tuan&background=0D8ABC&color=fff&size=512",
    CTO: "https://ui-avatars.com/api/?name=Nguyen+Hoang+Nam&background=10B981&color=fff&size=512",
    COO: "https://ui-avatars.com/api/?name=Le+Thi+Hoa&background=F59E0B&color=fff&size=512"
};

const ICONS = {
    MISSION: <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    VISION: <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    VALUES: <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
};

export const AboutUs: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const leaders = [
        { name: "Trần Minh Tuấn", role: "Founder & CEO", img: ASSETS.CEO, bio: t('about.ceo_bio') },
        { name: "Nguyễn Hoàng Nam", role: "CTO", img: ASSETS.CTO, bio: t('about.cto_bio') },
        { name: "Lê Thị Hoa", role: "COO", img: ASSETS.COO, bio: t('about.coo_bio') }
    ];

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">

            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} {t('about.home')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">SGS LAND</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('about.dashboard') : t('about.login')}
                    </button>
                </div>
            </div>

            {/* Hero */}
            <section className="relative py-24 bg-slate-900 text-white overflow-hidden">
                <div className="absolute inset-0 opacity-40">
                    <img src={ASSETS.OFFICE} className="w-full h-full object-cover" alt="Office" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center animate-enter">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
                        {t('about.hero_badge')}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                        {t('about.hero_title')} <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">{t('about.hero_title_highlight')}</span>
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        {t('about.hero_desc')}
                    </p>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 -mt-24 relative z-20">
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.MISSION}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.mission_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.mission_desc')}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.VISION}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.vision_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.vision_desc')}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] shadow-xl border border-[var(--glass-border)] flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.VALUES}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{t('about.values_title')}</h3>
                        <p className="text-[var(--text-tertiary)] leading-relaxed">{t('about.values_desc')}</p>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 bg-[var(--bg-surface)] border-y border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div className="text-4xl font-black text-indigo-600 mb-2">5+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_years')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-emerald-600 mb-2">15k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_agents')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-amber-500 mb-2">45k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_listings')}</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-rose-500 mb-2">$2B+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('about.stat_txn')}</div>
                    </div>
                </div>
            </section>

            {/* Leadership */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">{t('about.team_title')}</h2>
                        <p className="text-[var(--text-tertiary)] max-w-2xl mx-auto">{t('about.team_desc')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {leaders.map((leader, i) => (
                            <div key={i} className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] text-center group hover:border-indigo-100 transition-colors">
                                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-6 border-4 border-slate-50 shadow-lg group-hover:scale-105 transition-transform">
                                    <img src={leader.img} className="w-full h-full object-cover" alt={leader.name} />
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">{leader.name}</h3>
                                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">{leader.role}</div>
                                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{leader.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-24 bg-slate-900 text-center px-6">
                <h2 className="text-3xl font-bold text-white mb-6">{t('about.cta_title')}</h2>
                <button
                    onClick={handleLogin}
                    className="px-8 py-4 bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                >
                    {currentUser ? t('about.cta_dashboard') : t('about.cta_contact')}
                </button>
            </section>
        </div>
    );
};
