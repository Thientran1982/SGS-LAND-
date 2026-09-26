import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ScoringConfig } from '../types';
import { useTranslation } from '../services/i18n';
import { SeoHead } from '../components/SeoHead';

type WeightKey = 'engagement' | 'completeness' | 'budgetFit' | 'velocity';
type Grade = 'A' | 'B' | 'C' | 'D';

const FIELDS: Array<{ key: WeightKey; label: string; hint: string; max: number }> = [
    { key: 'engagement', label: 'scoring.engagement', hint: 'scoring.hint_engagement', max: 50 },
    { key: 'completeness', label: 'scoring.completeness', hint: 'scoring.hint_completeness', max: 50 },
    { key: 'budgetFit', label: 'scoring.budget_fit', hint: 'scoring.hint_budget_fit', max: 50 },
    { key: 'velocity', label: 'scoring.velocity', hint: 'scoring.hint_velocity', max: 50 },
];
const GRADES: Grade[] = ['A', 'B', 'C', 'D'];
const DEFAULT_WEIGHTS: Record<WeightKey, number> = { engagement: 15, completeness: 10, budgetFit: 40, velocity: 10 };
const DEFAULT_THRESHOLDS: Record<Grade, number> = { A: 80, B: 60, C: 40, D: 20 };
// Literal classes so Tailwind keeps them; one tone per criterion in the distribution bar.
const FIELD_TONE: Record<WeightKey, string> = {
    engagement: 'bg-[#1B3A5C]',
    completeness: 'bg-[#4A6FA5]',
    budgetFit: 'bg-[#C8963E]',
    velocity: 'bg-[#7BA7C9]',
};
const GRADE_BADGE: Record<Grade | 'none', string> = {
    A: 'ui-badge ui-badge-success',
    B: 'ui-badge ui-badge-info',
    C: 'ui-badge ui-badge-warning',
    D: 'ui-badge ui-badge-neutral',
    none: 'ui-badge ui-badge-danger',
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(n) || 0)));

/** Normalised 0–100 score: each criterion contributes weight × fulfilment, divided by total weight. */
export function scoreOf(weights: Record<WeightKey, number>, sample: Record<WeightKey, number>): number {
    const total = FIELDS.reduce((s, f) => s + (weights[f.key] || 0), 0);
    if (total <= 0) return 0;
    const got = FIELDS.reduce((s, f) => s + (weights[f.key] || 0) * ((sample[f.key] || 0) / 100), 0);
    return Math.round((got / total) * 100);
}
function gradeOf(score: number, th: Record<Grade, number>): Grade | 'none' {
    for (const g of GRADES) if (score >= th[g]) return g;
    return 'none';
}

export const ScoringRules: React.FC = () => {
    const { t } = useTranslation();
    const [config, setConfig] = useState<ScoringConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [weights, setWeights] = useState<Record<WeightKey, number>>(DEFAULT_WEIGHTS);
    const [thresholds, setThresholds] = useState<Record<Grade, number>>(DEFAULT_THRESHOLDS);
    const [saved, setSaved] = useState<{ w: Record<WeightKey, number>; th: Record<Grade, number> }>({ w: DEFAULT_WEIGHTS, th: DEFAULT_THRESHOLDS });
    const [sample, setSample] = useState<Record<WeightKey, number>>({ engagement: 60, completeness: 80, budgetFit: 100, velocity: 40 });
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        window.setTimeout(() => setToast(null), 3500);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const raw: any = await db.getScoringConfig();
            const w = { ...DEFAULT_WEIGHTS, ...(raw?.weights || {}) } as Record<WeightKey, number>;
            const th = { ...DEFAULT_THRESHOLDS, ...(raw?.thresholds || {}) } as Record<Grade, number>;
            setConfig(raw ? { ...raw, version: raw.version ?? 1 } : null);
            setWeights(w);
            setThresholds(th);
            setSaved({ w, th });
        } catch (e: any) {
            setLoadError(e?.message || t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    }, [t]);
    useEffect(() => { void loadData(); }, [loadData]);

    const total = useMemo(() => FIELDS.reduce((s, f) => s + (weights[f.key] || 0), 0), [weights]);
    const dirty = JSON.stringify(weights) !== JSON.stringify(saved.w) || JSON.stringify(thresholds) !== JSON.stringify(saved.th);
    const thresholdError = !(thresholds.A > thresholds.B && thresholds.B > thresholds.C && thresholds.C > thresholds.D && thresholds.D >= 0 && thresholds.A <= 100)
        ? t('scoring.err_thresholds') : '';
    const weightError = total <= 0 ? t('scoring.err_weights') : '';
    const simScore = scoreOf(weights, sample);
    const simGrade = gradeOf(simScore, thresholds);

    const handleSave = async () => {
        if (thresholdError || weightError) return;
        setSaving(true);
        try {
            const updated: any = await db.updateScoringConfig({ weights, thresholds });
            setConfig(c => ({ ...(c || {}), ...(updated || {}), version: updated?.version ?? ((c as any)?.version ?? 0) + 1 } as any));
            setSaved({ w: weights, th: thresholds });
            notify(t('scoring.update_success'));
        } catch (e: any) {
            notify(e?.message || t('common.error'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)] rounded-full animate-spin" /></div>;
    if (loadError) return (
        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
            <p className="font-semibold text-[var(--text-primary)] mb-1">{t('common.error_loading')}</p>
            <p className="text-sm text-[var(--text-secondary)]">{loadError}</p>
            <button type="button" onClick={() => void loadData()} className="mt-4 h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold">{t('common.retry')}</button>
        </div>
    );

    const numField = 'w-16 h-9 px-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-right tabular-nums text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary';

    return (
        <>
            <SeoHead title="Cấu hình điểm số lead | SGS LAND" description="Cấu hình trọng số và ngưỡng xếp hạng điểm khách hàng tiềm năng." canonicalPath="/scoring-rules" />
            <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
                <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">{t('scoring.title')}</h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('scoring.subtitle')}</p>
                    </div>
                    <span className="ui-badge ui-badge-neutral">{t('scoring.version_n', { n: (config as any)?.version ?? 1 })}</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 lg:p-6 pb-24">
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 lg:gap-6 items-start">
                        <div className="space-y-4">
                            {/* Weights */}
                            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('scoring.weights_title')}</h2>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('scoring.weights_desc')}</p>
                                    </div>
                                    <button type="button" onClick={() => setWeights(DEFAULT_WEIGHTS)} className="text-xs font-semibold text-sgs-primary px-2 py-1 rounded-lg hover:bg-[var(--glass-surface-hover)]">{t('scoring.use_defaults')}</button>
                                </div>
                                {/* Share of each criterion */}
                                <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-[var(--glass-surface-hover)]" aria-hidden="true">
                                    {FIELDS.map(f => total > 0 && weights[f.key] > 0 && (
                                        <div key={f.key} className={FIELD_TONE[f.key]} style={{ width: `${(weights[f.key] / total) * 100}%` }} />
                                    ))}
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {FIELDS.map(f => {
                                        const share = total > 0 ? Math.round((weights[f.key] / total) * 100) : 0;
                                        return (
                                            <div key={f.key} className="rounded-xl border border-[var(--glass-border)] p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2.5 h-2.5 rounded-sm ${FIELD_TONE[f.key]}`} aria-hidden="true" />
                                                            <label htmlFor={`w-${f.key}`} className="text-sm font-semibold text-[var(--text-primary)]">{t(f.label)}</label>
                                                        </div>
                                                        <p className="text-xs text-[var(--text-tertiary)] mt-1">{t(f.hint)}</p>
                                                    </div>
                                                    <input
                                                        id={`w-${f.key}`}
                                                        type="number"
                                                        min={0}
                                                        max={f.max}
                                                        value={weights[f.key]}
                                                        onChange={e => setWeights(w => ({ ...w, [f.key]: clamp(Number(e.target.value), 0, f.max) }))}
                                                        className={numField}
                                                    />
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={f.max}
                                                    value={weights[f.key]}
                                                    onChange={e => setWeights(w => ({ ...w, [f.key]: Number(e.target.value) }))}
                                                    aria-label={t(f.label)}
                                                    className="mt-3 w-full accent-[#1B3A5C]"
                                                />
                                                <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] tabular-nums">
                                                    <span>{t('scoring.points_n', { n: weights[f.key] })}</span>
                                                    <span>{t('scoring.share_n', { n: share })}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('scoring.total_note', { n: total })}</p>
                                {weightError && <p className="mt-1 text-xs text-rose-600">{weightError}</p>}
                            </section>

                            {/* Grade thresholds */}
                            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 sm:p-5">
                                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('scoring.thresholds_title')}</h2>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('scoring.thresholds_desc')}</p>
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {GRADES.map(g => (
                                        <label key={g} className="rounded-xl border border-[var(--glass-border)] p-3 flex flex-col gap-2">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className={GRADE_BADGE[g]}>{t(`scoring.grade_${g}`)}</span>
                                            </span>
                                            <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                {t('scoring.from')}
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={thresholds[g]}
                                                    onChange={e => setThresholds(th => ({ ...th, [g]: clamp(Number(e.target.value), 0, 100) }))}
                                                    className={numField}
                                                    aria-label={t(`scoring.grade_${g}`)}
                                                />
                                                {t('scoring.pts')}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {thresholdError && <p className="mt-2 text-xs text-rose-600">{thresholdError}</p>}
                            </section>
                        </div>

                        {/* Simulator */}
                        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 sm:p-5 xl:sticky xl:top-0" aria-labelledby="scoring-sim-title">
                            <h2 id="scoring-sim-title" className="text-sm font-semibold text-[var(--text-primary)]">{t('scoring.sim_title')}</h2>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('scoring.sim_desc')}</p>
                            <div className="mt-4 rounded-xl bg-[var(--glass-surface)] p-4 text-center">
                                <div className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">{simScore}<span className="text-lg font-normal text-[var(--text-tertiary)]">/100</span></div>
                                <span className={`mt-2 inline-flex ${GRADE_BADGE[simGrade]}`}>{simGrade === 'none' ? t('scoring.grade_none') : t(`scoring.grade_${simGrade}`)}</span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {FIELDS.map(f => (
                                    <div key={f.key}>
                                        <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                                            <span>{t(f.label)}</span>
                                            <span className="tabular-nums">{sample[f.key]}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={10}
                                            value={sample[f.key]}
                                            onChange={e => setSample(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                                            aria-label={t('scoring.sim_factor', { name: t(f.label) })}
                                            className="w-full accent-[#C8963E]"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('scoring.sim_formula')}</p>
                        </section>
                    </div>
                </div>

                {/* Save bar */}
                <div className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 lg:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-[var(--text-secondary)]">{dirty ? t('scoring.unsaved') : t('scoring.saved_state')}</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { setWeights(saved.w); setThresholds(saved.th); }} disabled={!dirty || saving} className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40">{t('scoring.discard')}</button>
                        <button type="button" onClick={() => void handleSave()} disabled={!dirty || saving || !!thresholdError || !!weightError} className="h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">{saving ? t('scoring.saving') : t('common.save')}</button>
                    </div>
                </div>
            </div>
            {toast && createPortal(
                <div role="status" className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[9999] px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-700' : 'bg-rose-700'}`}>{toast.msg}</div>,
                document.body
            )}
        </>
    );
};
