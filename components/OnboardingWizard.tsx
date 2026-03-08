
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { db } from '../services/mockDb';
import { OnboardingState, UserRole } from '../types';
import { useTranslation } from '../services/i18n';

// -----------------------------------------------------------------------------
// 1. CONSTANTS & ASSETS
// -----------------------------------------------------------------------------

const WIZARD_CONFIG = {
    STEPS: [
        { id: 'TEAM', labelKey: 'onboard.step.teams' },
        { id: 'DATA', labelKey: 'onboard.step.data' },
        { id: 'CHANNEL', labelKey: 'onboard.step.channel' },
        { id: 'ROUTING', labelKey: 'onboard.step.routing' },
        { id: 'SLA', labelKey: 'onboard.step.sla' },
    ] as const,
    SIZES: {
        MINI: 36,
        FULL: 48
    }
};

const ICONS = {
    CLOSE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
};

// -----------------------------------------------------------------------------
// 2. SUB-COMPONENTS
// -----------------------------------------------------------------------------

const ProgressRing = memo(({ percentage, size = 44, stroke = 3, colorClass }: { percentage: number, size?: number, stroke?: number, colorClass: string }) => {
    const radius = (size - stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg height={size} width={size} className="transform -rotate-90">
                {/* Track */}
                <circle
                    stroke="currentColor"
                    className="text-white/20"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Indicator */}
                <circle
                    stroke="currentColor"
                    className={`${colorClass} transition-all duration-1000 ease-out`}
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <span className="absolute text-[9px] font-bold text-white">{percentage}%</span>
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
    const { t } = useTranslation();

    useEffect(() => {
        let mounted = true;
        const loadStatus = async () => {
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
                console.error("Onboarding load failed", e);
            }
        };
        loadStatus();
        return () => { mounted = false; };
    }, []);

    const handleDismiss = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsVisible(false);
        try {
            await db.dismissOnboarding();
        } catch (error) {
            console.error(error);
        }
    }, []);

    const handleStepClick = useCallback(async (stepId: string) => {
        if (!state) return;
        
        const isCompleted = state.completedSteps.includes(stepId);
        if (isCompleted) return;

        const nextSteps = [...state.completedSteps, stepId];
        const nextPercent = Math.round((nextSteps.length / WIZARD_CONFIG.STEPS.length) * 100);

        // Optimistic update
        setState(prev => prev ? { ...prev, completedSteps: nextSteps, percentage: nextPercent } : null);

        try {
            await db.updateOnboardingProgress(stepId, true);
        } catch (e) {
            console.error("Failed to sync step", e);
        }
    }, [state]);

    const statusColor = useMemo(() => {
        if (!state) return 'text-slate-400';
        if (state.percentage < 30) return 'text-rose-500';
        if (state.percentage < 70) return 'text-amber-500';
        return 'text-emerald-500';
    }, [state?.percentage]);

    if (!isVisible || !state) return null;

    if (isMinimized) {
        return (
            <button 
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-full shadow-2xl hover:scale-110 transition-transform animate-enter overflow-hidden group focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
                title={t('onboard.title')}
                aria-label={t('onboard.title')}
            >
                <div className="p-1">
                    <ProgressRing percentage={state.percentage} size={WIZARD_CONFIG.SIZES.FULL} stroke={4} colorClass={statusColor} />
                </div>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 glass-card shadow-2xl overflow-hidden animate-enter border border-white/20 dark:border-white/10 flex flex-col rounded-2xl">
            {/* Header */}
            <div className="bg-slate-900/95 dark:bg-black/90 p-4 flex justify-between items-center backdrop-blur-md">
                <div>
                    <h3 className="text-white font-bold text-sm tracking-tight">{t('onboard.title')}</h3>
                    <p className="text-slate-400 text-[10px]">{t('onboard.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <ProgressRing percentage={state.percentage} size={WIZARD_CONFIG.SIZES.MINI} stroke={3} colorClass={statusColor} />
                    <button 
                        onClick={() => setIsMinimized(true)} 
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        aria-label={t('common.close')}
                    >
                        {ICONS.CLOSE}
                    </button>
                </div>
            </div>

            {/* Steps List */}
            <div className="p-2 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm max-h-[300px] overflow-y-auto no-scrollbar" role="list">
                {WIZARD_CONFIG.STEPS.map((step, idx) => {
                    const isDone = state.completedSteps.includes(step.id);
                    return (
                        <button 
                            key={step.id}
                            onClick={() => handleStepClick(step.id)}
                            disabled={isDone}
                            className={`
                                w-full flex items-center p-3 mb-1 rounded-xl transition-all duration-200 group text-left
                                ${isDone 
                                    ? 'bg-emerald-50/50 dark:bg-emerald-900/20 opacity-60 cursor-default' 
                                    : 'bg-white dark:bg-white/5 hover:bg-white hover:shadow-sm dark:hover:bg-white/10 cursor-pointer'}
                            `}
                            aria-label={`${t(step.labelKey)} ${isDone ? 'Completed' : 'Pending'}`}
                        >
                            <div className={`
                                w-5 h-5 rounded-full flex items-center justify-center mr-3 text-[9px] font-bold transition-colors shrink-0
                                ${isDone 
                                    ? 'bg-emerald-500 text-white shadow-sm' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 group-hover:border-indigo-400 group-hover:text-indigo-500'}
                            `}>
                                {isDone ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs font-medium transition-colors ${isDone ? 'text-slate-500 line-through dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {t(step.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex justify-center">
                <button 
                    onClick={handleDismiss}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors px-4 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                    {t('onboard.dismiss')}
                </button>
            </div>
        </div>
    );
};
