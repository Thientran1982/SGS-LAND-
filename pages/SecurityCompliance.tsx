
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ComplianceConfig, DlpRule, SecuritySession } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    LOCK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    SHIELD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

const RuleEditor = ({ isOpen, onClose, onSave, t }: any) => {
    const [form, setForm] = useState({ name: '', pattern: '', action: 'REDACT' });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-[24px] shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('security.modal_add_title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-slate-400">{ICONS.CLOSE}</button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('security.label_rule_name')}</label>
                        <input className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('security.placeholder_name')} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('security.label_pattern')}</label>
                        <input className="w-full border rounded-xl px-4 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none" value={form.pattern} onChange={e => setForm({...form, pattern: e.target.value})} placeholder={t('security.placeholder_pattern')} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('security.label_action')}</label>
                        <select className="w-full border rounded-xl px-4 py-2 text-sm bg-[var(--bg-surface)] focus:ring-2 focus:ring-indigo-500/20 outline-none" value={form.action} onChange={e => setForm({...form, action: e.target.value})}>
                            <option value="REDACT">{t('security.action_redact')}</option>
                            <option value="BLOCK">{t('security.action_block')}</option>
                            <option value="LOG_ONLY">{t('security.action_log')}</option>
                        </select>
                    </div>
                    <button onClick={() => onSave(form)} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl mt-2 hover:bg-slate-800 transition-colors">{t('security.btn_save_rule')}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const SecurityCompliance: React.FC = () => {
    const [config, setConfig] = useState<ComplianceConfig | null>(null);
    const [sessions, setSessions] = useState<SecuritySession[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'POLICIES' | 'ACCESS'>('POLICIES');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const { t, formatDateTime } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [c, s] = await Promise.all([
                    db.getComplianceConfig(),
                    db.getActiveSessions()
                ]);
                setConfig(c);
                // Defensive: Ensure sessions is always an array
                setSessions(s || []);
            } catch (e) {
                console.error(e);
                notify(t('security.alert_load_fail'), 'error');
                setSessions([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [notify, t]);

    const handleSaveConfig = async () => {
        if (!config) return;
        try {
            await db.saveComplianceConfig(config);
            notify(t('security.alert_save_success'), 'success');
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    const handleRevokeSession = async (id: string) => {
        try {
            await db.revokeSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
            notify(t('security.alert_session_revoked'), 'success');
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    const toggleRule = (id: string) => {
        if (!config) return;
        const rules = (config.dlpRules || []).map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
        setConfig({ ...config, dlpRules: rules });
    };

    const handleDeleteRule = (id: string) => {
        if (!config) return;
        const rules = (config.dlpRules || []).filter(r => r.id !== id);
        setConfig({ ...config, dlpRules: rules });
    };

    const handleAddRule = (rule: Partial<DlpRule>) => {
        if (!config) return;
        const newRule: DlpRule = { id: Date.now().toString(), name: rule.name!, pattern: rule.pattern!, action: rule.action as any, enabled: true };
        setConfig({ ...config, dlpRules: [...(config.dlpRules || []), newRule] });
        setIsEditorOpen(false);
    };

    if (loading || !config) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' : 'bg-rose-900/90 text-rose-100 border-rose-500'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="flex justify-between items-center bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('security.title')}</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{t('security.subtitle')}</p>
                </div>
                <div className="flex bg-[var(--glass-surface-hover)] p-1 rounded-xl">
                    <button onClick={() => setActiveTab('POLICIES')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'POLICIES' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('security.tab_policies')}</button>
                    <button onClick={() => setActiveTab('ACCESS')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ACCESS' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('security.tab_access')}</button>
                </div>
            </div>

            {activeTab === 'POLICIES' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-enter">
                    {/* Retention Policy */}
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-[var(--text-primary)]">{t('security.retention')}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${config.legalHold ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>{t('security.legal_hold')}</span>
                                <input type="checkbox" checked={config.legalHold} onChange={e => setConfig({...config, legalHold: e.target.checked})} className="toggle accent-rose-500 cursor-pointer" />
                            </div>
                        </div>
                        {config.legalHold && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl mb-6 border border-rose-100 flex items-center gap-2">{ICONS.LOCK} {t('security.legal_hold_active')}</div>}
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('security.msg_days')}</label>
                                <input 
                                    type="number" 
                                    disabled={config.legalHold} 
                                    value={config.retention?.messagesDays || 0} 
                                    onChange={e => setConfig({...config, retention: {...(config.retention || { messagesDays: 0, auditLogsDays: 0 }), messagesDays: Number(e.target.value)}})} 
                                    className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-[var(--glass-surface-hover)]" 
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('security.log_days')}</label>
                                <input 
                                    type="number" 
                                    disabled={config.legalHold} 
                                    value={config.retention?.auditLogsDays || 0} 
                                    onChange={e => setConfig({...config, retention: {...(config.retention || { messagesDays: 0, auditLogsDays: 0 }), auditLogsDays: Number(e.target.value)}})} 
                                    className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-[var(--glass-surface-hover)]" 
                                />
                            </div>
                            <button onClick={handleSaveConfig} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95">{t('security.save_policy')}</button>
                        </div>
                    </div>

                    {/* DLP Rules */}
                    <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-[var(--text-primary)]">{t('security.dlp_rules')}</h3>
                            <button onClick={() => setIsEditorOpen(true)} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-slate-400">{ICONS.ADD}</button>
                        </div>
                        <div className="space-y-3">
                            {(config.dlpRules || []).map(rule => (
                                <div key={rule.id} className="p-4 border rounded-xl flex justify-between items-center group hover:border-indigo-200 transition-colors">
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-secondary)]">{rule.name}</div>
                                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">{rule.pattern}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rule.action === 'BLOCK' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-[var(--glass-surface-hover)] border-[var(--glass-border)] text-[var(--text-tertiary)]'}`}>
                                            {t(`security.action_${rule.action.toLowerCase().replace('_', '')}`) || rule.action}
                                        </span>
                                        <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} className="toggle accent-indigo-500 w-4 h-4 cursor-pointer" />
                                        <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-300 hover:text-rose-500 transition-colors">{ICONS.TRASH}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ACCESS' && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm animate-enter">
                    <h3 className="font-bold text-[var(--text-primary)] mb-6">{t('security.active_sessions')}</h3>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] text-xs font-bold uppercase">
                                <tr>
                                    <th className="p-3 rounded-l-lg">{t('security.session_user')}</th>
                                    <th className="p-3">{t('table.ip_address')}</th>
                                    <th className="p-3">{t('table.device')}</th>
                                    <th className="p-3">{t('table.last_active')}</th>
                                    <th className="p-3 rounded-r-lg text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {/* Defensive iteration with optional chaining */}
                                {sessions?.map(s => (
                                    <tr key={s.id} className="hover:bg-[var(--glass-surface)] transition-colors">
                                        <td className="p-3 font-bold text-[var(--text-secondary)]">{s.userId}</td>
                                        <td className="p-3 font-mono text-[var(--text-secondary)]">{s.ipAddress}</td>
                                        <td className="p-3 text-[var(--text-secondary)]">{s.deviceType}</td>
                                        <td className="p-3 text-[var(--text-tertiary)]">{formatDateTime(s.lastActiveAt)}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleRevokeSession(s.id)} className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-rose-100">
                                                {t('security.revoke')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!sessions || sessions.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">{t('sec.no_sessions')}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <RuleEditor isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} onSave={handleAddRule} t={t} />
        </div>
    );
};
