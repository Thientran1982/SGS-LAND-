
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../services/mockDb';
import { RoutingRule, RoutingStrategy, User, Team } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    PLAY: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
};

const RuleModal = ({ isOpen, onClose, onSave, rule, users, teams, t }: any) => {
    const [form, setForm] = useState<Partial<RoutingRule>>({});

    useEffect(() => {
        if (isOpen) {
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
        if (!form.name || !form.action?.targetId) return;
        onSave(form);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{t('routing.modal_title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">{ICONS.CLOSE}</button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('routing.rule_name')}</label>
                        <input className="w-full border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('routing.priority')}</label>
                        <input type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})} />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-sm text-slate-700 mb-3">{t('routing.conditions')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('routing.cond_source')}</label>
                                <input className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="e.g. Facebook" value={form.conditions?.source?.[0] || ''} onChange={e => setForm({...form, conditions: {...form.conditions, source: e.target.value ? [e.target.value] : []}})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('routing.cond_region')}</label>
                                <input className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="e.g. HCM" value={form.conditions?.region?.[0] || ''} onChange={e => setForm({...form, conditions: {...form.conditions, region: e.target.value ? [e.target.value] : []}})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('routing.cond_budget')}</label>
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

                <div className="pt-6 mt-6 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};

export const RoutingRules: React.FC = () => {
    const [rules, setRules] = useState<RoutingRule[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RoutingRule | undefined>(undefined);
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
        try {
            const [r, u, tm] = await Promise.all([
                db.getRoutingRules(),
                db.getTenantUsers(1, 100),
                db.getTeams()
            ]);
            setRules(r || []);
            setUsers(u.data || []);
            setTeams(tm || []);
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async (id: string) => {
        if (!confirm(t('routing.confirm_delete'))) return;
        try {
            await db.deleteRoutingRule(id);
            setRules(prev => (prev || []).filter(r => r.id !== id));
            notify(t('routing.delete_success'), 'success');
        } catch (e) {
            notify(t('common.error'), 'error');
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

        let assigned = 'Unassigned';
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

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('routing.title')}</h2>
                    <p className="text-sm text-slate-500">{t('routing.subtitle')}</p>
                </div>
                <button onClick={() => { setEditingRule(undefined); setIsModalOpen(true); }} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                    {ICONS.ADD} {t('routing.btn_add')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* RULES LIST */}
                <div className="lg:col-span-2 space-y-4">
                    {rules.length === 0 && <div className="text-center p-10 text-slate-400 italic bg-white rounded-[24px] border border-slate-100">{t('common.no_results')}</div>}
                    {rules.map(rule => (
                        <div key={rule.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">{t('routing.priority')}: {rule.priority}</span>
                                        {rule.enabled ? <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> : <span className="w-2 h-2 bg-slate-300 rounded-full"></span>}
                                    </div>
                                    <h3 className="font-bold text-slate-800">{rule.name}</h3>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingRule(rule); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">{ICONS.EDIT}</button>
                                    <button onClick={() => handleDelete(rule.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">{ICONS.TRASH}</button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-slate-50 p-3 rounded-xl">
                                    <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">{t('routing.conditions')}</div>
                                    <div className="space-y-1 font-mono text-slate-600">
                                        {Object.entries(rule.conditions || {}).map(([k, v]) => (
                                            <div key={k} className="flex justify-between">
                                                <span>{k}:</span>
                                                <span className="font-bold">{Array.isArray(v) ? v.join(', ') : v}</span>
                                            </div>
                                        ))}
                                        {Object.keys(rule.conditions || {}).length === 0 && <span className="text-slate-400 italic text-[10px]">None</span>}
                                    </div>
                                </div>
                                <div className="bg-indigo-50 p-3 rounded-xl">
                                    <div className="font-bold text-indigo-400 uppercase text-[10px] mb-1">{t('routing.action')}</div>
                                    <div className="font-bold text-indigo-900">{t(`routing.stg_${rule.action.strategy}`)}</div>
                                    <div className="text-indigo-700">➔ {rule.action.type === 'ASSIGN_USER' ? users.find(u => u.id === rule.action.targetId)?.name : teams.find(t => t.id === rule.action.targetId)?.name}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* SIMULATOR */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 mb-4">{t('routing.tab_sim')}</h3>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{t('routing.cond_source')}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={simInput.source} onChange={e => setSimInput({...simInput, source: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{t('routing.cond_region')}</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={simInput.region} onChange={e => setSimInput({...simInput, region: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{t('routing.cond_budget')}</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={simInput.budget} onChange={e => setSimInput({...simInput, budget: Number(e.target.value)})} />
                        </div>
                        <button onClick={runSimulation} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                            {ICONS.PLAY} {t('routing.sim_btn_run')}
                        </button>
                    </div>

                    {simResult && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-enter">
                            <div className="text-xs font-bold text-slate-400 uppercase mb-2">{t('routing.sim_result')}</div>
                            {simResult.matchedRule ? (
                                <div className="space-y-2">
                                    <div className="text-emerald-600 font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        {simResult.matchedRule.name}
                                    </div>
                                    <div className="text-slate-700 text-sm">
                                        <span className="text-slate-400 text-xs mr-2">➔</span>
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
        </div>
    );
};
