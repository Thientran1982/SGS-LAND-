
import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { db } from '../services/dbApi';
import { ScoringConfig } from '../types';
import { useTranslation } from '../services/i18n';

// -----------------------------------------------------------------------------
// 1. CONSTANTS & CONFIG
// -----------------------------------------------------------------------------
const CONSTANTS = {
    DEFAULT_MAX_SCORE: 20,
    BUDGET_MAX_SCORE: 50,
    TOAST_DURATION: 3000
};

// -----------------------------------------------------------------------------
// 2. SUB-COMPONENT: SCORING SLIDER (MEMOIZED)
// -----------------------------------------------------------------------------
interface ScoringSliderProps {
    label: string;
    value: number;
    field: string;
    max?: number;
    onChange: (field: string, val: number) => void;
    t: (k: string) => string;
}

const ScoringSlider: React.FC<ScoringSliderProps> = memo(({ label, value, field, max = CONSTANTS.DEFAULT_MAX_SCORE, onChange, t }) => {
    // Calculate percentage for background gradient
    const percent = (value / max) * 100;
    
    return (
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm transition-all hover:shadow-md group">
            <div className="flex justify-between mb-4 items-center">
                <label className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{label}</label>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs border border-indigo-100 min-w-[60px] text-center">
                    {value} {t('scoring.pts')}
                </span>
            </div>
            
            <div className="relative h-6 flex items-center">
                <input 
                    type="range" 
                    min="0" 
                    max={max} 
                    value={value} 
                    onChange={(e) => onChange(field, Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all z-10 relative"
                    style={{
                        background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${percent}%, #E2E8F0 ${percent}%, #E2E8F0 100%)`
                    }}
                />
            </div>

            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400 font-medium">0</span>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{t('scoring.max_weight')}: {max}</p>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -----------------------------------------------------------------------------
export const ScoringRules: React.FC = () => {
    const [config, setConfig] = useState<ScoringConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [weights, setWeights] = useState<Record<string, number>>({ engagement: 0, completeness: 0, budgetFit: 0, velocity: 0 });
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const { t } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), CONSTANTS.TOAST_DURATION);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await db.getScoringConfig();
            setConfig(data);
            // Safety check for weights
            setWeights(data.weights || { engagement: 0, completeness: 0, budgetFit: 0, velocity: 0 });
        } catch (e) {
            console.error("Failed to load scoring config", e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [t, notify]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleWeightChange = useCallback((field: string, val: number) => {
        setWeights(prev => ({ ...prev, [field]: val }));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await db.updateScoringConfig(weights);
            notify(t('scoring.update_success'), 'success');
            // Optimistically update version in UI or reload
            if (config) setConfig({ ...config, version: config.version + 1 });
        } catch (e: any) {
            notify(e.message || t('common.error'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Calculate Total Max Score based on current weights
    const totalMaxScore = useMemo(() => {
        return Object.values(weights || {}).reduce((a: number, b: number) => a + b, 0);
    }, [weights]);

    // Live Preview Calculation (Mock Logic for simulation)
    const simulatedScore = useMemo(() => {
        if (!weights) return 0;
        // Assume a lead has: 50% engagement, 80% completeness, 100% budget fit, 20% velocity
        const factors = { engagement: 0.5, completeness: 0.8, budgetFit: 1.0, velocity: 0.2 };
        let score = 0;
        Object.entries(factors).forEach(([key, factor]) => {
            score += (weights[key] || 0) * factor;
        });
        return Math.min(100, Math.round((score / (totalMaxScore || 1)) * 100)) || 0;
    }, [weights, totalMaxScore]);

    // Configuration for Fields (Data-Driven UI)
    const SCORING_FIELDS = useMemo(() => [
        { key: 'engagement', max: CONSTANTS.DEFAULT_MAX_SCORE },
        { key: 'completeness', max: CONSTANTS.DEFAULT_MAX_SCORE },
        { key: 'budgetFit', max: CONSTANTS.BUDGET_MAX_SCORE },
        { key: 'velocity', max: CONSTANTS.DEFAULT_MAX_SCORE },
    ], []);

    if (loading || !config) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 relative animate-enter">
            {/* TOAST NOTIFICATION */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${
                    toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'
                }`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('scoring.title')}</h2>
                    <p className="text-sm text-slate-500">{t('scoring.subtitle')}</p>
                </div>
                <div className="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('scoring.version')}</div>
                    <div className="font-mono text-lg font-bold text-slate-800">v{config.version}.0</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sliders Area */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
                    {SCORING_FIELDS.map(field => (
                        <ScoringSlider 
                            key={field.key}
                            label={t(`scoring.${field.key === 'budgetFit' ? 'budget_fit' : field.key}`)} 
                            value={weights?.[field.key] || 0} 
                            field={field.key}
                            max={field.max} 
                            onChange={handleWeightChange} 
                            t={t}
                        />
                    ))}
                </div>

                {/* Live Preview Card */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white p-6 rounded-[24px] shadow-xl flex flex-col justify-between relative overflow-hidden h-[300px]">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
                    
                    <div>
                        <h3 className="font-bold text-lg mb-1">{t('scoring.sim_title')}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {t('scoring.sim_desc')}
                        </p>
                    </div>

                    <div className="text-center my-6 relative z-10">
                        <div className="text-5xl font-extrabold tracking-tighter mb-2 transition-all duration-300">
                            {simulatedScore}
                            <span className="text-2xl opacity-50 font-normal">/100</span>
                        </div>
                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${simulatedScore >= 80 ? 'bg-emerald-500 text-white' : simulatedScore >= 50 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {simulatedScore >= 80 ? t('scoring.status_hot') : simulatedScore >= 50 ? t('scoring.status_warm') : t('scoring.status_cold')}
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 flex justify-between text-xs font-mono opacity-60">
                        <span>{t('scoring.total_max')}: {totalMaxScore}</span>
                        <span>{t('scoring.total_weights')}: {Object.keys(weights || {}).length}</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-amber-500 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">{t('scoring.note_title')}</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">{t('scoring.note_desc')}</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                        onClick={() => loadData()}
                        disabled={saving}
                        className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        {t('common.reset')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="flex-1 sm:flex-none px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
