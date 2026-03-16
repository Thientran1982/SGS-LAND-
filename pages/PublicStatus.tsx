
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
};

const ServiceBar = ({ name, status = 'operational' }: { name: string, status?: 'operational' | 'degraded' }) => (
    <div className="flex justify-between items-center py-4 border-b border-[var(--glass-border)] last:border-0 group">
        <span className="font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{name}</span>
        <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${status === 'operational' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {status === 'operational' ? 'Hoạt động tốt' : 'Hiệu năng giảm'}
            </span>
            <div className={`w-2 h-2 rounded-full ${status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
        </div>
    </div>
);

const UptimeGraph = () => (
    <div className="flex gap-1 h-8 items-end mt-4" title="99.9% Uptime">
        {Array.from({ length: 60 }).map((_, i) => (
            <div 
                key={i} 
                className={`flex-1 rounded-sm transition-all hover:opacity-80 ${Math.random() > 0.98 ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                style={{ height: `${Math.max(40, Math.random() * 100)}%` }}
            ></div>
        ))}
    </div>
);

export const PublicStatus: React.FC = () => {
    const { t, formatDateTime } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

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
                        <span className="font-bold text-lg">TRẠNG THÁI HỆ THỐNG</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-16 animate-enter">
                <div className="bg-emerald-500 text-white p-8 rounded-[32px] shadow-2xl shadow-emerald-500/20 mb-12 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('status.operational')}</h1>
                        <p className="text-emerald-100 font-medium">Cập nhật lúc: {formatDateTime(new Date().toISOString())}</p>
                    </div>
                    <div className="w-16 h-16 bg-[var(--bg-surface)]/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--glass-border)] shadow-sm p-8 mb-12">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">{t('status.uptime')}</h2>
                    <UptimeGraph />
                    <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">
                        <span>90 ngày trước</span>
                        <span className="text-emerald-600">99.99%</span>
                        <span>Hôm nay</span>
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
                    <div className="p-8">
                        <ServiceBar name={t('status.service_api')} />
                        <ServiceBar name={t('status.service_dashboard')} />
                        <ServiceBar name={t('status.service_webhooks')} />
                        <ServiceBar name={t('status.service_ai')} />
                    </div>
                </div>

                <div className="mt-16">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">{t('status.past_incidents')}</h2>
                    <div className="text-[var(--text-tertiary)] text-sm italic border-l-4 border-[var(--glass-border)] pl-4 py-2">
                        {t('status.no_incidents')}
                    </div>
                </div>
            </div>
        </div>
    );
};
