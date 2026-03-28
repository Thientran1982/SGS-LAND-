
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { RoutingRule, RoutingStrategy, User, Team, LEAD_SOURCES } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ConfirmModal } from '../components/ConfirmModal';

const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    PLAY: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
};

const RuleModal = ({ isOpen, onClose, onSave, rule, users, teams, t }: any) => {
    const [form, setForm] = useState<Partial<RoutingRule>>({});
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setValidationError('');
            setForm(rule || {
                name: '',
                priority: 1,
                conditions: {},
                action: { type: 'ASSIGN_USER', targetId: '', strategy: RoutingStrategy.ROUND_ROBIN },
                enabled: true
            });
        }
    }, [isOpen, rule]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!form.name?.trim() || !form.action?.targetId) {
            setValidationError(t('routing.validate_required'));
            return;
        }
        setValidationError('');
        onSave(form);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-[24px] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">{t('routing.modal_title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)]">{ICONS.CLOSE}</button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('routing.rule_name')}</label>
                        <input className="w-full border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('routing.priority')}</label>
                        <input type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})} />
                    </div>
                    
                    <div className="bg-[var(--glass-surface)] p-4 rounded-xl border border-[var(--glass-border)]">
                        <h4 className="font-bold text-sm text-[var(--text-secondary)] mb-3">{t('routing.conditions')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase block mb-1">{t('routing.cond_source')}</label>
                                <Dropdown
                                    value={form.conditions?.source?.[0] || ''}
                                    onChange={(v) => setForm({...form, conditions: {...form.conditions, source: v ? [v as string] : []}})}
                                    options={[
                                        { value: '', label: t('leads.all_sources') },
                                        ...LEAD_SOURCES.map(s => ({ value: s, label: s }))
                                    ]}
                                    className="text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase block mb-1">{t('routing.cond_region')}</label>
                                <input className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder={t('routing.placeholder_region')} value={form.conditions?.region?.[0] || ''} onChange={e => setForm({...form, conditions: {...form.conditions, region: e.target.value ? [e.target.value] : []}})} />
                            </div>
                            <div>
                                <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase block mb-1">{t('routing.cond_budget')}</label>
                                <input type="number" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={form.conditions?.budgetMin || 0} onChange={e => setForm({...form, conditions: {...form.conditions, budgetMin: Number(e.target.value)}})} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h4 className="font-bold text-sm text-indigo-900 mb-3">{t('routing.action')}</h4>
                        <div className="space-y-3">
                            <Dropdown 
                                label={t('routing.act_target_type')}
                                value={form.action?.type || 'ASSIGN_USER'}
                                onChange={(v) => setForm({...form, action: {...form.action!, type: v as any}})}
                                options={[{value: 'ASSIGN_USER', label: t('routing.act_assign_user')}, {value: 'ASSIGN_TEAM', label: t('routing.act_assign_team')}]}
                            />
                            <Dropdown 
                                label={t('routing.target')}
                                value={form.action?.targetId || ''}
                                onChange={(v) => setForm({...form, action: {...form.action!, targetId: v as string}})}
                                options={form.action?.type === 'ASSIGN_USER' 
                                    ? users.map((u: User) => ({value: u.id, label: u.name})) 
                                    : teams.map((t: Team) => ({value: t.id, label: t.name}))
                                }
                            />
                            <Dropdown 
                                label={t('routing.strategy')}
                                value={form.action?.strategy || RoutingStrategy.ROUND_ROBIN}
                                onChange={(v) => setForm({...form, action: {...form.action!, strategy: v as any}})}
                                options={Object.values(RoutingStrategy).map(s => ({value: s, label: t(`routing.stg_${s}`)}))}
                            />
                        </div>
                    </div>
                </div>

                {validationError && (
                    <div className="mt-4 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl font-medium">
                        {validationError}
                    </div>
                )}
                <div className="pt-6 mt-4 border-t border-[var(--glass-border)] flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-slate-200 transition-colors">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg">{t('common.save')}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const RoutingRules: React.FC = () => {
    const [rules, setRules] = useState<RoutingRule[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RoutingRule | undefined>(undefined);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    
    // Sim State
    const [simInput, setSimInput] = useState({ source: 'Facebook', region: 'HCM', budget: 5000000000 });
    const [simResult, setSimResult] = useState<{ matchedRule?: RoutingRule, assigned?: string } | null>(null);

    const { t } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const [r, u, tm] = await Promise.all([
                db.getRoutingRules(),
                db.getMembers(),
                db.getTeams()
            ]);
            setRules(r || []);
            setUsers(u.data || []);
            setTeams(tm || []);
        } catch {
            setLoadError(true);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await db.deleteRoutingRule(deleteConfirmId);
            setRules(prev => (prev || []).filter(r => r.id !== deleteConfirmId));
            notify(t('routing.delete_success'), 'success');
        } catch (e) {
            notify(t('common.error'), 'error');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleSave = async (rule: Partial<RoutingRule>) => {
        try {
            if (editingRule) {
                await db.updateRoutingRule(editingRule.id, rule);
            } else {
                await db.createRoutingRule(rule);
            }
            notify(t('routing.create_success'), 'success');
            setIsModalOpen(false);
            fetchData();
        } catch (e) {
            notify(t('common.error'), 'error');
        }
    };

    const runSimulation = () => {
        // Simple client-side simulation logic
        const matched = (rules || []).find(r => {
            if (r.conditions.source && !r.conditions.source.includes(simInput.source)) return false;
            if (r.conditions.region && !r.conditions.region.includes(simInput.region)) return false;
            if (r.conditions.budgetMin && simInput.budget < r.conditions.budgetMin) return false;
            return true;
        });

        let assigned = t('routing.sim_unassigned');
        if (matched) {
            if (matched.action.type === 'ASSIGN_USER') {
                const u = (users || []).find(x => x.id === matched.action.targetId);
                assigned = u ? u.name : matched.action.targetId;
            } else {
                const tm = (teams || []).find(x => x.id === matched.action.targetId);
                assigned = tm ? tm.name : matched.action.targetId;
            }
        }

        setSimResult({ matchedRule: matched, assigned });
    };

    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;

    if (loadError) return (
        <div className="flex flex-col items-center justify-center h-full p-10 text-center animate-enter">
            <div className="w-14 h-14 bg-rose-50 text-rose-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            </div>
            <p className="font-bold text-[var(--text-primary)] mb-1">{t('common.error_loading')}</p>
            <button onClick={fetchData} className="mt-4 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-sm">
                {t('common.retry')}
            </button>
        </div>
    );

    // Map raw condition keys to translation keys
    const condLabel = (key: string) => {
        const map: Record<string, string> = {
            source: t('routing.cond_source'),
            region: t('routing.cond_region'),
            budgetMin: t('routing.cond_budgetMin'),
            budget_min: t('routing.cond_budgetMin'),
            budgetMax: t('routing.cond_budgetMax'),
            budget_max: t('routing.cond_budgetMax'),
            tags: t('routing.cond_tags'),
            projects: t('routing.cond_projects'),
            temperature: t('routing.cond_temperature'),
        };
        return map[key] ?? key;
    };

    // Translate raw condition values — DB stores source as string OR array
    const condValue = (key: string, v: unknown): string => {
        if (key === 'source') {
            const sources = Array.isArray(v) ? v : [v as string];
            return sources.map(s => {
                const translated = t(`source.${s}`);
                return translated !== `source.${s}` ? translated : s;
            }).join(', ');
        }
        if (key === 'budget_min' || key === 'budget_max' || key === 'budgetMin' || key === 'budgetMax') {
            const num = Number(v);
            return isNaN(num) ? String(v) : (num >= 1_000_000_000 ? `${(num / 1_000_000_000).toFixed(1)} tỷ` : `${(num / 1_000_000).toFixed(0)} triệu`);
        }
        return Array.isArray(v) ? v.join(', ') : String(v);
    };

    return (
        <>
        <div className="p-4 sm:p-6 space-y-6 pb-20 animate-enter relative">

            <div className="flex justify-between items-center bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('routing.title')}</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{t('routing.subtitle')}</p>
                </div>
                <button onClick={() => { setEditingRule(undefined); setIsModalOpen(true); }} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                    {ICONS.ADD} {t('routing.btn_add')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* RULES LIST */}
                <div className="lg:col-span-2 space-y-4">
                    {rules.length === 0 && (
                        <div className="text-center py-16 px-8 bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] border-dashed">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4 text-indigo-400">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            </div>
                            <p className="font-bold text-[var(--text-primary)] mb-1">{t('routing.empty_title')}</p>
                            <p className="text-sm text-[var(--text-tertiary)] mb-6">{t('routing.empty_desc')}</p>
                            <button
                                onClick={() => { setEditingRule(undefined); setIsModalOpen(true); }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-sm"
                            >
                                {ICONS.ADD} {t('routing.btn_add')}
                            </button>
                        </div>
                    )}
                    {rules.map(rule => (
                        <div key={rule.id} className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all group relative">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs2 font-bold bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase tracking-wider">{t('routing.priority')}: {rule.priority}</span>
                                        {rule.enabled ? <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> : <span className="w-2 h-2 bg-slate-300 rounded-full"></span>}
                                    </div>
                                    <h3 className="font-bold text-[var(--text-primary)]">{rule.name}</h3>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingRule(rule); setIsModalOpen(true); }} className="p-2 text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{ICONS.EDIT}</button>
                                    <button onClick={() => setDeleteConfirmId(rule.id)} className="p-2 text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">{ICONS.TRASH}</button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-[var(--glass-surface)] p-3 rounded-xl">
                                    <div className="font-bold text-[var(--text-tertiary)] uppercase text-xs2 mb-1">{t('routing.conditions')}</div>
                                    <div className="space-y-1 font-mono text-[var(--text-secondary)]">
                                        {Object.entries(rule.conditions || {}).map(([k, v]) => (
                                            <div key={k} className="flex justify-between gap-2">
                                                <span className="text-[var(--text-tertiary)]">{condLabel(k)}:</span>
                                                <span className="font-bold text-right">{condValue(k, v)}</span>
                                            </div>
                                        ))}
                                        {Object.keys(rule.conditions || {}).length === 0 && <span className="text-[var(--text-secondary)] italic text-xs2">{t('routing.no_conditions')}</span>}
                                    </div>
                                </div>
                                <div className="bg-indigo-50 p-3 rounded-xl">
                                    <div className="font-bold text-indigo-400 uppercase text-xs2 mb-1">{t('routing.action')}</div>
                                    {rule.action.strategy && (
                                        <div className="font-bold text-indigo-900">{t(`routing.stg_${rule.action.strategy}`)}</div>
                                    )}
                                    <div className="text-indigo-700">➔ {(() => {
                                        const a = rule.action as any;
                                        if (a.type === 'ASSIGN_USER') {
                                            return users.find(u => u.id === (a.targetId || a.userId))?.name || a.userName || a.targetId || '--';
                                        }
                                        return teams.find(t => t.id === (a.targetId || a.teamId))?.name || a.teamName || a.targetId || '--';
                                    })()}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* SIMULATOR */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm h-fit">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4">{t('routing.tab_sim')}</h3>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('routing.cond_source')}</label>
                            <Dropdown
                                value={simInput.source}
                                onChange={(v) => setSimInput({...simInput, source: v as string})}
                                options={[
                                    { value: '', label: t('leads.all_sources') },
                                    ...LEAD_SOURCES.map(s => ({ value: s, label: s }))
                                ]}
                                className="text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('routing.cond_region')}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={simInput.region} onChange={e => setSimInput({...simInput, region: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-1 block">{t('routing.cond_budget')}</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={simInput.budget} onChange={e => setSimInput({...simInput, budget: Number(e.target.value)})} />
                        </div>
                        <button onClick={runSimulation} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                            {ICONS.PLAY} {t('routing.sim_btn_run')}
                        </button>
                    </div>

                    {simResult && (
                        <div className="bg-[var(--glass-surface)] p-4 rounded-xl border border-[var(--glass-border)] animate-enter">
                            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">{t('routing.sim_result')}</div>
                            {simResult.matchedRule ? (
                                <div className="space-y-2">
                                    <div className="text-emerald-600 font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        {simResult.matchedRule.name}
                                    </div>
                                    <div className="text-[var(--text-secondary)] text-sm">
                                        <span className="text-[var(--text-secondary)] text-xs mr-2">➔</span>
                                        <span className="font-bold">{simResult.assigned}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-amber-600 font-bold">{t('routing.sim_no_match')}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <RuleModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                rule={editingRule}
                users={users}
                teams={teams}
                t={t}
            />
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title={t('common.delete')}
                message={t('routing.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmId(null)}
                variant="danger"
            />
        </div>
        {createPortal(
            toast ? (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};
