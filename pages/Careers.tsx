
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    LOCATION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    MONEY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ARROW: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
    CHECK: <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
};

const JOBS = [
    {
        id: 1,
        title: "Senior Full-stack Engineer",
        dept: "Engineering",
        location: "TP. Hồ Chí Minh",
        type: "Full-time",
        salary: "$2,500 - $4,000",
        tags: ["React", "Node.js", "AI"]
    },
    {
        id: 2,
        title: "AI Research Scientist",
        dept: "Data Science",
        location: "Remote / Hybrid",
        type: "Full-time",
        salary_key: "careers.negotiable",
        tags: ["Python", "LLM", "TensorFlow"]
    },
    {
        id: 3,
        title: "Trưởng Phòng Kinh Doanh B2B",
        dept: "Sales",
        location: "Hà Nội",
        type: "Full-time",
        salary: "$1,500 + Commission",
        tags: ["B2B", "Real Estate", "SaaS"]
    },
    {
        id: 4,
        title: "Product Designer (UI/UX)",
        dept: "Product",
        location: "TP. Hồ Chí Minh",
        type: "Full-time",
        salary: "$1,200 - $2,000",
        tags: ["Figma", "Design System"]
    }
];

export const Careers: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [appliedJob, setAppliedJob] = useState<string | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const handleApply = (jobTitle: string) => {
        setAppliedJob(jobTitle);
        setTimeout(() => setAppliedJob(null), 5000);
    };

    return (
        <div className="min-h-screen bg-[var(--bg-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors min-h-[44px] shrink-0">
                        {ICONS.BACK} <span className="hidden sm:inline">{t('careers.home')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">{t('careers.header')}</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? t('careers.dashboard') : t('careers.login')}
                    </button>
                </div>
            </div>

            {/* Hero */}
            <section className="py-24 px-6 text-center bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
                <div className="relative z-10 max-w-4xl mx-auto animate-enter">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8">
                        {t('careers.hero_badge')}
                    </div>
                    <h1 className="text-4xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
                        {t('careers.hero_title')} <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{t('careers.hero_title_highlight')}</span>
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
                        {t('careers.hero_desc')}
                    </p>
                    <button onClick={() => document.getElementById('jobs')?.scrollIntoView({behavior: 'smooth'})} className="px-8 py-4 bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl">
                        {t('careers.hero_cta')}
                    </button>
                </div>
            </section>

            {/* Values */}
            <section className="py-24 bg-[var(--glass-surface)] border-b border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl">1</div>
                            <h3 className="text-2xl font-bold text-[var(--text-primary)]">{t('careers.val1_title')}</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed">{t('careers.val1_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-xl">2</div>
                            <h3 className="text-2xl font-bold text-[var(--text-primary)]">{t('careers.val2_title')}</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed">{t('careers.val2_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-bold text-xl">3</div>
                            <h3 className="text-2xl font-bold text-[var(--text-primary)]">{t('careers.val3_title')}</h3>
                            <p className="text-[var(--text-tertiary)] leading-relaxed">{t('careers.val3_desc')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Job Listings */}
            <section id="jobs" className="py-24 px-6 bg-[var(--bg-surface)]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-12 text-center">{t('careers.open_positions')}</h2>
                    <div className="space-y-6">
                        {JOBS.map(job => (
                            <div key={job.id} className="group bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-[24px] p-6 hover:border-indigo-200 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wide">{job.dept}</span>
                                            {job.tags.map(tag => (
                                                <span key={tag} className="text-xs2 font-bold text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] px-2 py-1 rounded border border-[var(--glass-border)]">{tag}</span>
                                            ))}
                                        </div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 group-hover:text-indigo-600 transition-colors">{job.title}</h3>
                                        <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
                                            <span className="flex items-center gap-1.5">{ICONS.LOCATION} {job.location}</span>
                                            <span className="flex items-center gap-1.5">{ICONS.CLOCK} {job.type}</span>
                                            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                                {ICONS.MONEY} {'salary_key' in job ? t(job.salary_key as Parameters<typeof t>[0]) : job.salary}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleApply(job.title)}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg group-hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {t('careers.apply_btn')} {ICONS.ARROW}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Apply success toast */}
            {appliedJob && (
                <div className="fixed bottom-6 right-6 z-[100] max-w-sm px-5 py-4 rounded-xl shadow-2xl flex items-start gap-3 animate-enter border bg-emerald-900/90 border-emerald-500 text-white">
                    {ICONS.CHECK}
                    <div>
                        <p className="font-bold text-sm">{t('careers.toast_title')}</p>
                        <p className="text-xs text-emerald-200 mt-0.5">{t('careers.toast_desc')} <span className="font-semibold">careers@sgsland.vn</span> — <span className="font-semibold">{appliedJob}</span></p>
                    </div>
                </div>
            )}
        </div>
    );
};
