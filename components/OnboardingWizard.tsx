
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { OnboardingState, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { ROUTES } from '../config/routes';

// -----------------------------------------------------------------------------
// 1. STEP CONFIGURATION
// -----------------------------------------------------------------------------

const STEP_CONFIG = [
    {
        id: 'TEAM',
        labelKey: 'onboard.step.teams',
        desc_vn: 'Mời nhân sự và tổ chức nhóm làm việc của bạn.',
        desc_en: 'Invite staff and organize your working teams.',
        route: ROUTES.ADMIN_USERS,
        gradient: 'from-indigo-500 to-violet-500',
        lightBg: 'bg-indigo-50 dark:bg-indigo-900/20',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        borderColor: 'border-indigo-100 dark:border-indigo-800/40',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        id: 'DATA',
        labelKey: 'onboard.step.data',
        desc_vn: 'Nhập dữ liệu khách hàng và kết nối nguồn dữ liệu.',
        desc_en: 'Import customer data and connect data sources.',
        route: ROUTES.DATA_PLATFORM,
        gradient: 'from-blue-500 to-cyan-500',
        lightBg: 'bg-blue-50 dark:bg-blue-900/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        borderColor: 'border-blue-100 dark:border-blue-800/40',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
        ),
    },
    {
        id: 'CHANNEL',
        labelKey: 'onboard.step.channel',
        desc_vn: 'Kết nối Zalo OA, Facebook Page để nhận lead.',
        desc_en: 'Connect Zalo OA, Facebook Page to receive leads.',
        route: ROUTES.ENTERPRISE_SETTINGS,
        gradient: 'from-violet-500 to-purple-500',
        lightBg: 'bg-violet-50 dark:bg-violet-900/20',
        iconColor: 'text-violet-600 dark:text-violet-400',
        borderColor: 'border-violet-100 dark:border-violet-800/40',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
    },
    {
        id: 'ROUTING',
        labelKey: 'onboard.step.routing',
        desc_vn: 'Thiết lập quy tắc phân bổ lead tự động cho nhóm.',
        desc_en: 'Set up automated lead routing rules for teams.',
        route: ROUTES.ROUTING_RULES,
        gradient: 'from-emerald-500 to-teal-500',
        lightBg: 'bg-emerald-50 dark:bg-emerald-900/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-100 dark:border-emerald-800/40',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
    },
    {
        id: 'SLA',
        labelKey: 'onboard.step.sla',
        desc_vn: 'Cấu hình thời gian phản hồi và mức độ ưu tiên.',
        desc_en: 'Configure response time and priority levels.',
        route: ROUTES.SCORING_RULES,
        gradient: 'from-amber-500 to-orange-500',
        lightBg: 'bg-amber-50 dark:bg-amber-900/20',
        iconColor: 'text-amber-600 dark:text-amber-500',
        borderColor: 'border-amber-100 dark:border-amber-800/40',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
] as const;

// -----------------------------------------------------------------------------
// 2. SUB-COMPONENTS
// -----------------------------------------------------------------------------

const ProgressRing = memo(({ percentage, size = 44, stroke = 3 }: { percentage: number, size?: number, stroke?: number }) => {
    const radius = (size - stroke * 2) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const color = percentage < 30 ? '#f43f5e' : percentage < 70 ? '#f59e0b' : '#10b981';

    return (
        <div className="relative flex items-center justify-center">
            <svg height={size} width={size} className="transform -rotate-90">
                <circle stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
                <circle
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <span className="absolute text-[9px] font-black text-white leading-none">{percentage}%</span>
        </div>
    );
});

// -----------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const OnboardingWizard: React.FC = () => {
    const [state, setState] = useState<OnboardingState | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const { t, language } = useTranslation();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const user = await db.getCurrentUser();
                if (user?.role !== UserRole.ADMIN) return;
                const config = await db.getEnterpriseConfig();
                if (mounted && config?.onboarding) {
                    setState(config.onboarding);
                    if (!config.onboarding.isDismissed && config.onboarding.percentage < 100) {
                        setIsVisible(true);
                    }
                }
            } catch (e) {
                console.error('Onboarding load failed', e);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const handleDismiss = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsVisible(false);
        try { await db.dismissOnboarding(); } catch (err) { console.error(err); }
    }, []);

    const handleStepComplete = useCallback(async (stepId: string) => {
        if (!state) return;
        const nextSteps = [...state.completedSteps, stepId];
        const nextPercent = Math.round((nextSteps.length / STEP_CONFIG.length) * 100);
        setState(prev => prev ? { ...prev, completedSteps: nextSteps, percentage: nextPercent } : null);
        try { await db.updateOnboardingProgress(stepId, true); } catch (e) { console.error(e); }
    }, [state]);

    const doneCount = useMemo(() => state?.completedSteps.length ?? 0, [state]);
    const totalCount = STEP_CONFIG.length;

    if (!isVisible || !state) return null;

    // ── Minimized floating button ──────────────────────────────────────────────
    if (isMinimized) {
        return createPortal(
            <button
                onClick={() => setIsMinimized(false)}
                title={t('onboard.title')}
                className="fixed bottom-6 right-6 z-50 group focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
            >
                <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 p-1.5 border border-white/10">
                    <ProgressRing percentage={state.percentage} size={48} stroke={3} />
                </div>
                <span className="absolute -top-8 right-0 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    {t('onboard.title')}
                </span>
            </button>,
            document.body
        );
    }

    // ── Full panel ─────────────────────────────────────────────────────────────
    return createPortal(
        <div className="fixed bottom-6 right-6 z-50 w-[320px] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-enter border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900">

            {/* ── HEADER ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 pt-4 pb-5 overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-violet-500/20 rounded-full blur-xl pointer-events-none" />

                <div className="relative flex justify-between items-start mb-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                {language === 'en' ? 'Getting Started' : 'Bắt Đầu'}
                            </span>
                        </div>
                        <h3 className="text-white font-black text-sm leading-tight">{t('onboard.title')}</h3>
                        <p className="text-slate-400 text-[10px] mt-0.5">{t('onboard.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ProgressRing percentage={state.percentage} size={40} stroke={3} />
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 ml-1"
                            title={language === 'en' ? 'Minimize' : 'Thu nhỏ'}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-slate-400">
                            {doneCount}/{totalCount} {language === 'en' ? 'steps done' : 'bước hoàn thành'}
                        </span>
                        <span className="text-[10px] font-bold text-white">{state.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${state.percentage}%`,
                                background: state.percentage < 30
                                    ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
                                    : state.percentage < 70
                                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                    : 'linear-gradient(90deg, #10b981, #34d399)',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── STEPS LIST ── */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/80 dark:bg-slate-900/80 p-2 space-y-1.5">
                {STEP_CONFIG.map((step, idx) => {
                    const isDone = state.completedSteps.includes(step.id);
                    const label = t(step.labelKey);
                    return (
                        <div key={step.id} className={`
                            relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 group
                            ${isDone
                                ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50 opacity-60'
                                : `bg-white dark:bg-slate-800/60 ${step.borderColor} hover:shadow-md hover:-translate-y-[1px] cursor-pointer`
                            }
                        `}
                            onClick={!isDone ? () => { window.location.hash = `#/${step.route}`; handleStepComplete(step.id); } : undefined}
                        >
                            {/* Icon bubble */}
                            <div className={`
                                w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all
                                ${isDone
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400'
                                    : `${step.lightBg} ${step.iconColor}`
                                }
                            `}>
                                {isDone
                                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    : step.icon
                                }
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    {!isDone && (
                                        <span className={`w-4 h-4 rounded-full text-[9px] font-black text-white bg-gradient-to-br ${step.gradient} flex items-center justify-center shrink-0 leading-none`}>
                                            {idx + 1}
                                        </span>
                                    )}
                                    <p className={`text-xs font-bold leading-tight ${isDone ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {label}
                                    </p>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {language === 'en' ? step.desc_en : step.desc_vn}
                                </p>
                            </div>

                            {/* Arrow */}
                            {!isDone && (
                                <div className={`shrink-0 pt-1 ${step.iconColor} opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── FOOTER ── */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {language === 'en' ? 'SGS Land CRM Setup' : 'Hệ thống SGS Land CRM'}
                </span>
                <button
                    onClick={handleDismiss}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 uppercase tracking-widest transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                    {t('onboard.dismiss')}
                </button>
            </div>
        </div>,
        document.body
    );
};
