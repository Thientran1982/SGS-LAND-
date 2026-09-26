import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { RoutingRule, RoutingStrategy, User, Team, LEAD_SOURCES } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import { formatVnd, parseMoney } from '../utils/auction';

type RuleForm = {
    name: string;
    priority: number;
    isActive: boolean;
    source: string;
    region: string;
    budgetMin: string;
    budgetMax: string;
    actionType: 'ASSIGN_USER' | 'ASSIGN_TEAM';
    targetId: string;
    strategy: RoutingStrategy;
};

const asList = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x)).filter(Boolean);
const isRuleActive = (r: RoutingRule) => (r.isActive ?? r.enabled) !== false;

const IconEdit = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconPlus = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-[var(--sgs-primary)]' : 'bg-[var(--glass-surface-hover)] border border-[var(--glass-border)]'}`}
        >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );
}

function RuleModal({ isOpen, onClose, onSaved, rule, users, teams, nextPriority }: {
    isOpen: boolean; onClose: () => void; onSaved: () => void; rule?: RoutingRule;
    users: User[]; teams: Team[]; nextPriority: number;
}) {
    const { t } = useTranslation();
    const money = (n: number) => formatVnd(n, { billion: t('format.billion'), million: t('format.million'), dong: 'đ' });
    const [form, setForm] = useState<RuleForm | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        const c: any = rule?.conditions || {};
        const a: any = rule?.action || {};
        setForm({
            name: rule?.name || '',
            priority: rule?.priority ?? nextPriority,
            isActive: rule ? isRuleActive(rule) : true,
            source: asList(c.source)[0] || '',
            region: asList(c.region).join(', '),
            budgetMin: c.budgetMin ? Number(c.budgetMin).toLocaleString('vi-VN') : '',
            budgetMax: c.budgetMax ? Number(c.budgetMax).toLocaleString('vi-VN') : '',
            actionType: a.type === 'ASSIGN_TEAM' ? 'ASSIGN_TEAM' : 'ASSIGN_USER',
            targetId: a.targetId || a.userId || a.teamId || '',
            strategy: a.strategy || RoutingStrategy.ROUND_ROBIN,
        });
    }, [isOpen, rule, nextPriority]);

    if (!isOpen || !form) return null;
    const set = (patch: Partial<RuleForm>) => setForm(f => (f ? { ...f, ...patch } : f));
    const min = form.budgetMin.trim() ? parseMoney(form.budgetMin) : 0;
    const max = form.budgetMax.trim() ? parseMoney(form.budgetMax) : 0;

    const save = async () => {
        if (!form.name.trim()) return setError(t('routing.err_name'));
        if (!form.targetId) return setError(t('routing.err_target'));
        if (min === null || max === null) return setError(t('routing.err_budget_format'));
        if (min && max && min > max) return setError(t('routing.err_budget_range'));
        setError('');
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            priority: Math.max(0, Math.round(Number(form.priority) || 0)),
            isActive: form.isActive,
            conditions: {
                source: form.source ? [form.source] : [],
                region: form.region.split(',').map(s => s.trim()).filter(Boolean),
                budgetMin: min || 0,
                budgetMax: max || 0,
            },
            action: {
                type: form.actionType,
                targetId: form.targetId,
                strategy: form.actionType === 'ASSIGN_TEAM' ? form.strategy : RoutingStrategy.ROUND_ROBIN,
            },
        };
        try {
            if (rule) await db.updateRoutingRule(rule.id, payload);
            else await db.createRoutingRule(payload);
            onSaved();
        } catch (e: any) {
            setError(e?.message || t('routing.err_save'));
        } finally {
            setSaving(false);
        }
    };

    const field = 'w-full h-11 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[16px] md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary';
    const label = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1.5';
    const targetOptions = form.actionType === 'ASSIGN_USER'
        ? users.map(u => ({ value: u.id, label: u.name }))
        : teams.map(tm => ({ value: tm.id, label: tm.name }));

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="routing-modal-title">
            <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--glass-border)] shadow-2xl">
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--glass-border)]">
                    <h3 id="routing-modal-title" className="text-base font-bold text-[var(--text-primary)]">{rule ? t('routing.modal_edit') : t('routing.modal_title')}</h3>
                    <button type="button" onClick={onClose} aria-label={t('common.close')} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="grid grid-cols-[1fr_110px] gap-3">
                        <div>
                            <label htmlFor="rr-name" className={label}>{t('routing.rule_name')}</label>
                            <input id="rr-name" className={field} value={form.name} onChange={e => set({ name: e.target.value })} placeholder={t('routing.placeholder_name')} />
                        </div>
                        <div>
                            <label htmlFor="rr-priority" className={label}>{t('routing.priority')}</label>
                            <input id="rr-priority" type="number" min={0} inputMode="numeric" className={field} value={form.priority} onChange={e => set({ priority: Number(e.target.value) })} />
                        </div>
                    </div>
                    <p className="-mt-2 text-xs text-[var(--text-tertiary)]">{t('routing.priority_hint')}</p>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] px-3 py-2.5">
                        <span className="text-sm text-[var(--text-primary)]">{t('routing.active_label')}</span>
                        <Toggle checked={form.isActive} onChange={v => set({ isActive: v })} label={t('routing.active_label')} />
                    </div>

                    <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('routing.conditions')}</h4>
                            <p className="text-xs text-[var(--text-tertiary)]">{t('routing.conditions_hint')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <span className={label}>{t('routing.cond_source')}</span>
                                <Dropdown
                                    value={form.source}
                                    onChange={v => set({ source: String(v) })}
                                    options={[{ value: '', label: t('leads.all_sources') }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]}
                                    variant="compact"
                                />
                            </div>
                            <div>
                                <label htmlFor="rr-region" className={label}>{t('routing.cond_region')}</label>
                                <input id="rr-region" className={field} value={form.region} onChange={e => set({ region: e.target.value })} placeholder={t('routing.placeholder_region')} />
                            </div>
                            <div>
                                <label htmlFor="rr-min" className={label}>{t('routing.cond_budgetMin')}</label>
                                <input id="rr-min" inputMode="decimal" className={field} value={form.budgetMin} onChange={e => set({ budgetMin: e.target.value })} placeholder={t('routing.placeholder_budget')} />
                                {min ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{money(min)}</p> : null}
                            </div>
                            <div>
                                <label htmlFor="rr-max" className={label}>{t('routing.cond_budgetMax')}</label>
                                <input id="rr-max" inputMode="decimal" className={field} value={form.budgetMax} onChange={e => set({ budgetMax: e.target.value })} placeholder={t('routing.placeholder_budget')} />
                                {max ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{money(max)}</p> : null}
                            </div>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('routing.region_hint')}</p>
                    </section>

                    <section className="rounded-xl border border-[var(--glass-border)] p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('routing.action')}</h4>
                        <div className="flex p-0.5 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)]" role="tablist">
                            {(['ASSIGN_USER', 'ASSIGN_TEAM'] as const).map(k => (
                                <button key={k} type="button" role="tab" aria-selected={form.actionType === k}
                                    onClick={() => set({ actionType: k, targetId: '' })}
                                    className={`flex-1 min-h-[36px] rounded-[10px] text-xs font-semibold ${form.actionType === k ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                                    {k === 'ASSIGN_USER' ? t('routing.act_assign_user') : t('routing.act_assign_team')}
                                </button>
                            ))}
                        </div>
                        <div>
                            <span className={label}>{form.actionType === 'ASSIGN_USER' ? t('routing.target_user') : t('routing.target_team')}</span>
                            <Dropdown
                                value={form.targetId}
                                onChange={v => set({ targetId: String(v) })}
                                options={targetOptions}
                                placeholder={t('routing.target_placeholder')}
                                variant="compact"
                            />
                            {form.actionType === 'ASSIGN_TEAM' && teams.length === 0 && <p className="mt-1 text-xs text-sgs-accent-text">{t('routing.no_teams')}</p>}
                        </div>
                        {form.actionType === 'ASSIGN_TEAM' && (
                            <div>
                                <span className={label}>{t('routing.strategy')}</span>
                                <Dropdown
                                    value={form.strategy}
                                    onChange={v => set({ strategy: v as RoutingStrategy })}
                                    options={[RoutingStrategy.ROUND_ROBIN, RoutingStrategy.BEST_AVAILABLE].map(s => ({ value: s, label: t(`routing.stg_${s}`) }))}
                                    variant="compact"
                                />
                                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t(`routing.stg_hint_${form.strategy === RoutingStrategy.BEST_AVAILABLE ? 'BEST_AVAILABLE' : 'ROUND_ROBIN'}`)}</p>
                            </div>
                        )}
                    </section>
                    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">{error}</div>}
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--glass-border)] pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)]">{t('common.cancel')}</button>
                    <button type="button" onClick={() => void save()} disabled={saving} className="h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? t('routing.saving') : t('common.save')}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export const RoutingRules: React.FC = () => {
    const { t } = useTranslation();
    const money = (n: number) => formatVnd(n, { billion: t('format.billion'), million: t('format.million'), dong: 'đ' });
    const [rules, setRules] = useState<RoutingRule[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RoutingRule | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [sim, setSim] = useState({ source: 'Facebook', region: 'TP.HCM', budget: '5 tỷ' });
    const [simResult, setSimResult] = useState<any>(null);
    const [simRunning, setSimRunning] = useState(false);

    const canEdit = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(me?.role);
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        window.setTimeout(() => setToast(null), 3500);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [r, u, tm, current] = await Promise.all([db.getRoutingRules(), db.getMembers(), db.getTeams(), db.getCurrentUser()]);
            setRules(r || []);
            setUsers(u?.data || []);
            setTeams(tm || []);
            setMe(current);
        } catch (e: any) {
            setLoadError(e?.message || t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    }, [t]);
    useEffect(() => { void fetchData(); }, [fetchData]);

    const nextPriority = useMemo(() => (rules.length ? Math.max(...rules.map(r => Number(r.priority) || 0)) + 1 : 1), [rules]);
    const nameOfTarget = (rule: RoutingRule) => {
        const a: any = rule.action || {};
        const id = a.targetId || a.userId || a.teamId;
        if (a.type === 'ASSIGN_TEAM') return teams.find(x => x.id === id)?.name || a.teamName || t('routing.unknown_target');
        return users.find(x => x.id === id)?.name || a.userName || t('routing.unknown_target');
    };
    const conditionChips = (rule: RoutingRule) => {
        const c: any = rule.conditions || {};
        const chips: string[] = [];
        const src = asList(c.source);
        if (src.length) chips.push(`${t('routing.cond_source')}: ${src.join(', ')}`);
        const reg = asList(c.region);
        if (reg.length) chips.push(`${t('routing.cond_region')}: ${reg.join(', ')}`);
        const bMin = Number(c.budgetMin ?? c.budget_min) || 0;
        const bMax = Number(c.budgetMax ?? c.budget_max) || 0;
        if (bMin && bMax) chips.push(`${t('routing.cond_budget')}: ${money(bMin)} – ${money(bMax)}`);
        else if (bMin) chips.push(t('routing.chip_budget_min', { amount: money(bMin) }));
        else if (bMax) chips.push(t('routing.chip_budget_max', { amount: money(bMax) }));
        const tags = asList(c.tags);
        if (tags.length) chips.push(`${t('routing.cond_tags')}: ${tags.join(', ')}`);
        return chips;
    };

    const toggleActive = async (rule: RoutingRule, value: boolean) => {
        setToggling(rule.id);
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: value } : r));
        try {
            await db.updateRoutingRule(rule.id, { isActive: value });
            notify(value ? t('routing.enabled_ok') : t('routing.disabled_ok'));
        } catch (e: any) {
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !value } : r));
            notify(e?.message || t('routing.err_save'), 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await db.deleteRoutingRule(deleteId);
            setRules(prev => prev.filter(r => r.id !== deleteId));
            notify(t('routing.delete_success'));
        } catch (e: any) {
            notify(e?.message || t('routing.err_delete'), 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const runSimulation = async () => {
        const budget = sim.budget.trim() ? parseMoney(sim.budget) : 0;
        if (budget === null) { setSimResult({ error: t('routing.err_budget_format') }); return; }
        setSimRunning(true);
        try {
            setSimResult(await db.simulateRouting({ source: sim.source, region: sim.region, budget }));
        } catch (e: any) {
            setSimResult({ error: e?.message || t('routing.err_sim') });
        } finally {
            setSimRunning(false);
        }
    };
    const failLabel = (k: string) => t(`routing.fail_${k}`);

    if (loading) {
        return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)] rounded-full animate-spin" /></div>;
    }
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <p className="font-semibold text-[var(--text-primary)] mb-1">{t('common.error_loading')}</p>
                <p className="text-sm text-[var(--text-secondary)]">{loadError}</p>
                <button type="button" onClick={() => void fetchData()} className="mt-4 h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold">{t('common.retry')}</button>
            </div>
        );
    }

    const field = 'w-full h-11 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[16px] md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary';
    const label = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1.5';

    return (
        <>
            <SeoHead title="Luật phân bổ lead | SGS LAND" description="Cấu hình luật tự động phân bổ khách hàng tiềm năng." canonicalPath="/routing-rules" />
            <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
                <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">{t('routing.title')}</h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('routing.subtitle')}</p>
                    </div>
                    {canEdit && (
                        <button type="button" onClick={() => { setEditing(undefined); setModalOpen(true); }} className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90">
                            <IconPlus />{t('routing.btn_add')}
                        </button>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 lg:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 items-start">
                        {/* Rules */}
                        <div className="space-y-3">
                            <p className="text-xs text-[var(--text-tertiary)]">{t('routing.order_hint')}</p>
                            {rules.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('routing.empty_title')}</h3>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('routing.empty_desc')}</p>
                                    {canEdit && <button type="button" onClick={() => { setEditing(undefined); setModalOpen(true); }} className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold"><IconPlus />{t('routing.btn_add')}</button>}
                                </div>
                            ) : rules.map(rule => {
                                const active = isRuleActive(rule);
                                const chips = conditionChips(rule);
                                const a: any = rule.action || {};
                                return (
                                    <article key={rule.id} className={`rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 ${active ? '' : 'opacity-70'}`}>
                                        <div className="flex items-start gap-3">
                                            <span className="shrink-0 w-8 h-8 rounded-lg bg-[var(--glass-surface)] text-xs font-bold text-[var(--text-secondary)] flex items-center justify-center tabular-nums" title={t('routing.priority')}>{rule.priority}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-[var(--text-primary)] break-words">{rule.name}</h3>
                                                    <span className={active ? 'ui-badge ui-badge-success' : 'ui-badge ui-badge-neutral'}>{active ? t('routing.status_on') : t('routing.status_off')}</span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {chips.length ? chips.map(c => <span key={c} className="ui-badge ui-badge-neutral">{c}</span>) : <span className="text-xs text-[var(--text-tertiary)]">{t('routing.no_conditions')}</span>}
                                                </div>
                                                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                                    {a.type === 'ASSIGN_TEAM'
                                                        ? t('routing.assign_team_line', { name: nameOfTarget(rule), strategy: t(`routing.stg_${a.strategy || 'ROUND_ROBIN'}`) })
                                                        : t('routing.assign_user_line', { name: nameOfTarget(rule) })}
                                                </p>
                                            </div>
                                            {canEdit && (
                                                <div className="shrink-0 flex items-center gap-1">
                                                    <Toggle checked={active} disabled={toggling === rule.id} onChange={v => void toggleActive(rule, v)} label={active ? t('routing.turn_off') : t('routing.turn_on')} />
                                                    <button type="button" onClick={() => { setEditing(rule); setModalOpen(true); }} aria-label={t('common.edit')} title={t('common.edit')} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)]"><IconEdit /></button>
                                                    <button type="button" onClick={() => setDeleteId(rule.id)} aria-label={t('common.delete')} title={t('common.delete')} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"><IconTrash /></button>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        {/* Simulator */}
                        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 lg:sticky lg:top-0" aria-labelledby="routing-sim-title">
                            <h2 id="routing-sim-title" className="text-sm font-semibold text-[var(--text-primary)]">{t('routing.tab_sim')}</h2>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 mb-3">{t('routing.sim_desc')}</p>
                            <div className="space-y-3">
                                <div>
                                    <span className={label}>{t('routing.cond_source')}</span>
                                    <Dropdown value={sim.source} onChange={v => setSim({ ...sim, source: String(v) })} options={[{ value: '', label: t('routing.sim_no_source') }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} variant="compact" />
                                </div>
                                <div>
                                    <label htmlFor="sim-region" className={label}>{t('routing.sim_address')}</label>
                                    <input id="sim-region" className={field} value={sim.region} onChange={e => setSim({ ...sim, region: e.target.value })} placeholder={t('routing.placeholder_region')} />
                                </div>
                                <div>
                                    <label htmlFor="sim-budget" className={label}>{t('routing.cond_budget')}</label>
                                    <input id="sim-budget" inputMode="decimal" className={field} value={sim.budget} onChange={e => setSim({ ...sim, budget: e.target.value })} placeholder={t('routing.placeholder_budget')} />
                                </div>
                                <button type="button" onClick={() => void runSimulation()} disabled={simRunning} className="w-full h-11 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                                    {simRunning ? t('routing.sim_running') : t('routing.sim_btn_run')}
                                </button>
                            </div>
                            {simResult && (
                                <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3" role="status">
                                    {simResult.error ? (
                                        <p className="text-sm text-rose-600">{simResult.error}</p>
                                    ) : simResult.matched ? (
                                        <>
                                            <div className="text-xs text-[var(--text-secondary)]">{t('routing.sim_result')}</div>
                                            <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{t('routing.sim_matched', { name: simResult.matched.name })}</div>
                                            <div className="text-sm text-[var(--text-primary)]">
                                                {simResult.matched.action?.type === 'ASSIGN_TEAM'
                                                    ? t('routing.assign_team_line', { name: nameOfTarget(simResult.matched), strategy: t(`routing.stg_${simResult.matched.action?.strategy || 'ROUND_ROBIN'}`) })
                                                    : t('routing.assign_user_line', { name: nameOfTarget(simResult.matched) })}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-sm font-semibold text-sgs-accent-text">{t('routing.sim_no_match')}</div>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('routing.sim_fallback')}</p>
                                        </>
                                    )}
                                    {Array.isArray(simResult.checked) && simResult.checked.length > 0 && (
                                        <ul className="mt-3 space-y-1 text-xs">
                                            {simResult.checked.map((c: any) => (
                                                <li key={c.id} className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-[var(--text-secondary)]">{c.name}</span>
                                                    <span className={c.failed ? 'text-[var(--text-tertiary)] shrink-0' : 'text-emerald-700 dark:text-emerald-400 font-semibold shrink-0'}>{c.failed ? failLabel(c.failed) : t('routing.fail_none')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            <RuleModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={() => { setModalOpen(false); notify(t('routing.create_success')); void fetchData(); }}
                rule={editing}
                users={users}
                teams={teams}
                nextPriority={nextPriority}
            />
            <ConfirmModal
                isOpen={!!deleteId}
                title={t('common.delete')}
                message={t('routing.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
                variant="danger"
            />
            {toast && createPortal(
                <div role="status" className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[9999] px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-700' : 'bg-rose-700'}`}>
                    {toast.msg}
                </div>,
                document.body
            )}
        </>
    );
};
