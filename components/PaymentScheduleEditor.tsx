import React, { useCallback } from 'react';
import { PaymentMilestone, PaymentStatus } from '../types';
import { useTranslation } from '../services/i18n';

interface PaymentScheduleEditorProps {
    milestones: PaymentMilestone[];
    totalPrice: number;
    onChange: (milestones: PaymentMilestone[]) => void;
    readOnly?: boolean;
}

const STATUS_CONFIG: Record<PaymentStatus, { label_key: string; color: string; bg: string; dot: string }> = {
    [PaymentStatus.PENDING]:  { label_key: 'payment.status_PENDING',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
    [PaymentStatus.PAID]:     { label_key: 'payment.status_PAID',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
    [PaymentStatus.OVERDUE]:  { label_key: 'payment.status_OVERDUE',  color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200',     dot: 'bg-rose-500 animate-pulse' },
    [PaymentStatus.WAIVED]:   { label_key: 'payment.status_WAIVED',   color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400' },
};

const generateId = () => `ms_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

const formatVND = (n: number) => {
    if (!n) return '0';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} Tr`;
    return n.toLocaleString('vi-VN');
};

export const PaymentScheduleEditor: React.FC<PaymentScheduleEditorProps> = ({
    milestones,
    totalPrice,
    onChange,
    readOnly = false,
}) => {
    const { t } = useTranslation();

    const totalScheduled    = milestones.reduce((s, m) => s + (m.amount || 0), 0);
    const totalPaid         = milestones.filter(m => m.status === PaymentStatus.PAID).reduce((s, m) => s + (m.paidAmount ?? m.amount ?? 0), 0);
    const overdueCount      = milestones.filter(m => m.status === PaymentStatus.OVERDUE || (m.status === PaymentStatus.PENDING && m.dueDate && new Date(m.dueDate) < new Date())).length;
    const progressPct       = totalPrice > 0 ? Math.min(100, Math.round((totalPaid / totalPrice) * 100)) : 0;
    const totalAllocatedPct = Math.round(milestones.reduce((s, m) => s + (m.percentage || 0), 0) * 10) / 10;
    const remainingPct      = Math.round((100 - totalAllocatedPct) * 10) / 10;
    const isOverAllocated   = totalAllocatedPct > 100.05;

    const addMilestone = useCallback(() => {
        const existing = milestones.length + 1;
        const alreadyAllocatedPct = milestones.reduce((s, m) => s + (m.percentage || 0), 0);
        const defaultPct = Math.max(0, Math.min(100, Math.round((100 - alreadyAllocatedPct) * 10) / 10)) || 30;
        const newMs: PaymentMilestone = {
            id: generateId(),
            name: `${t('payment.milestone_default_name')} ${existing}`,
            dueDate: new Date(Date.now() + existing * 30 * 86400000).toISOString().slice(0, 10),
            amount: totalPrice > 0 ? Math.round(totalPrice * defaultPct / 100) : 0,
            percentage: defaultPct,
            status: PaymentStatus.PENDING,
        };
        onChange([...milestones, newMs]);
    }, [milestones, onChange, totalPrice, t]);

    const updateField = useCallback(<K extends keyof PaymentMilestone>(id: string, field: K, value: PaymentMilestone[K]) => {
        onChange(milestones.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, [field]: value };
            // Auto-sync amount ↔ percentage when price is known
            if (field === 'percentage' && totalPrice > 0) {
                updated.amount = Math.round(totalPrice * (value as number) / 100);
            }
            if (field === 'amount' && totalPrice > 0) {
                updated.percentage = Math.round((value as number) / totalPrice * 100 * 10) / 10;
            }
            return updated;
        }));
    }, [milestones, onChange, totalPrice]);

    const removeMilestone = useCallback((id: string) => {
        onChange(milestones.filter(m => m.id !== id));
    }, [milestones, onChange]);

    const inputCls = "w-full border border-[var(--glass-border)] rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] disabled:opacity-60 disabled:cursor-not-allowed";

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            {milestones.length > 0 && (
                <div className="bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <span>{t('payment.progress')}</span>
                        <span className={overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {progressPct}%
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={t('payment.progress')}>
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${overdueCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                        <span>{t('payment.total_paid')}: <strong className="text-emerald-600">{formatVND(totalPaid)}</strong></span>
                        <span>{t('payment.total_scheduled')}: <strong>{formatVND(totalScheduled)}</strong></span>
                    </div>
                    {milestones.length > 0 && (
                        <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${isOverAllocated ? 'bg-rose-50 border-rose-200 text-rose-700' : remainingPct < 0.1 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                            <span>
                                {t('payment.percentage') || 'Tỷ lệ'}: <strong>{totalAllocatedPct}%</strong> / 100%
                            </span>
                            <span className="font-bold">
                                {isOverAllocated
                                    ? `⚠ Vượt ${(totalAllocatedPct - 100).toFixed(1)}%`
                                    : remainingPct < 0.1
                                    ? '✓ Đủ 100%'
                                    : `Còn lại: ${remainingPct}%`
                                }
                            </span>
                        </div>
                    )}
                    {overdueCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg px-3 py-2" role="alert">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                            {t('payment.overdue_warning').replace('{count}', String(overdueCount))}
                        </div>
                    )}
                </div>
            )}

            {/* Milestone rows */}
            {milestones.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-tertiary)] border-2 border-dashed border-[var(--glass-border)] rounded-2xl">
                    {t('payment.schedule_empty')}
                </div>
            ) : (
                <div className="space-y-3">
                    {milestones.map((ms, idx) => {
                        const cfg = STATUS_CONFIG[ms.status];
                        const isOverdue = ms.status === PaymentStatus.OVERDUE ||
                            (ms.status === PaymentStatus.PENDING && ms.dueDate && new Date(ms.dueDate) < new Date());
                        return (
                            <div key={ms.id} className={`border rounded-xl p-4 space-y-3 transition-all ${isOverdue ? 'border-rose-200 bg-rose-50/30' : 'border-[var(--glass-border)] bg-[var(--bg-surface)]'}`}>
                                {/* Row header */}
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <input
                                        value={ms.name}
                                        onChange={e => updateField(ms.id, 'name', e.target.value)}
                                        disabled={readOnly}
                                        className={`${inputCls} flex-1 font-bold`}
                                        placeholder={t('payment.placeholder_name')}
                                        aria-label={t('payment.milestone_name')}
                                    />
                                    {/* Status badge */}
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                        {t(cfg.label_key)}
                                    </span>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => removeMilestone(ms.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                            aria-label={t('payment.delete_milestone')}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                    )}
                                </div>

                                {/* Fields grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('payment.due_date')}</label>
                                        <input
                                            type="date"
                                            value={ms.dueDate || ''}
                                            onChange={e => updateField(ms.id, 'dueDate', e.target.value)}
                                            disabled={readOnly}
                                            className={inputCls}
                                            aria-label={t('payment.due_date')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('payment.amount')} (VNĐ)</label>
                                        <input
                                            type="number"
                                            value={ms.amount || ''}
                                            onChange={e => updateField(ms.id, 'amount', Number(e.target.value))}
                                            disabled={readOnly}
                                            className={inputCls}
                                            min={0}
                                            aria-label={t('payment.amount')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('payment.percentage')} (%)</label>
                                        <input
                                            type="number"
                                            value={ms.percentage || ''}
                                            onChange={e => updateField(ms.id, 'percentage', Number(e.target.value))}
                                            disabled={readOnly}
                                            className={inputCls}
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            aria-label={t('payment.percentage')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{t('payment.status')}</label>
                                        <select
                                            value={ms.status}
                                            onChange={e => updateField(ms.id, 'status', e.target.value as PaymentStatus)}
                                            disabled={readOnly}
                                            className={`${inputCls} cursor-pointer`}
                                            aria-label={t('payment.status')}
                                        >
                                            {Object.values(PaymentStatus).map(s => (
                                                <option key={s} value={s}>{t(STATUS_CONFIG[s].label_key)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Paid section — show when PAID or WAIVED */}
                                {(ms.status === PaymentStatus.PAID || ms.status === PaymentStatus.WAIVED) && (
                                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--glass-border)]">
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{t('payment.paid_date')}</label>
                                            <input
                                                type="date"
                                                value={ms.paidDate || ''}
                                                onChange={e => updateField(ms.id, 'paidDate', e.target.value)}
                                                disabled={readOnly}
                                                className={inputCls}
                                                aria-label={t('payment.paid_date')}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{t('payment.paid_amount')} (VNĐ)</label>
                                            <input
                                                type="number"
                                                value={ms.paidAmount ?? ms.amount ?? ''}
                                                onChange={e => updateField(ms.id, 'paidAmount', Number(e.target.value))}
                                                disabled={readOnly}
                                                className={inputCls}
                                                min={0}
                                                aria-label={t('payment.paid_amount')}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Note */}
                                <div>
                                    <input
                                        value={ms.note || ''}
                                        onChange={e => updateField(ms.id, 'note', e.target.value)}
                                        disabled={readOnly}
                                        className={inputCls}
                                        placeholder={t('payment.note_placeholder')}
                                        aria-label={t('payment.note')}
                                    />
                                </div>

                                {/* Formatted amount display */}
                                {ms.amount > 0 && (
                                    <div className="text-right text-xs font-bold text-indigo-600">
                                        ≈ {formatVND(ms.amount)}
                                        {ms.percentage > 0 && ` (${ms.percentage}%)`}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add button */}
            {!readOnly && (
                <button
                    type="button"
                    onClick={addMilestone}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    {t('payment.add_milestone')}
                </button>
            )}
        </div>
    );
};
