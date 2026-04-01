import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { aiService } from '../services/aiService';
import { AiTenantConfig, PromptTemplate, AiSafetyLog, AiModelType } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

interface ConfigTabProps {
    config: AiTenantConfig;
    onSave: () => void;
    onUpdateConfig: (k: keyof AiTenantConfig, v: any) => void;
    t: any;
}

// Models grouped by generation — verified working with Google GenAI API (April 2026)
const MODEL_GROUPS: { label: string; badge: string; badgeColor: string; models: AiModelType[] }[] = [
    {
        label: 'Gemini 3.x — Preview',
        badge: 'Mới nhất',
        badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
        models: ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'],
    },
    {
        label: 'Gemini 2.5 — Ổn định',
        badge: 'Khuyến nghị',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    },
];

const SUPPORTED_MODELS: AiModelType[] = MODEL_GROUPS.flatMap(g => g.models);

const DEPRECATED_MODELS = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);

// Helper to format model names for display
const formatModelName = (model: string) => {
    return model
        .replace(/-/g, ' ')
        .replace('gemini', 'Gemini')
        .replace('veo', 'Veo')
        .replace('preview', '')
        .replace('flash lite', 'Flash Lite')
        .replace('flash', 'Flash')
        .replace('pro', 'Pro')
        .replace('lite', 'Lite')
        .replace(/\s+/g, ' ')
        .trim();
};

interface PromptsTabProps {
    prompts: PromptTemplate[];
    selectedPrompt: PromptTemplate | null;
    editContent: string;
    isEvalRunning: boolean;
    testInput: string;
    lastEvalRun: any;
    onSelect: (p: PromptTemplate) => void;
    onEditContent: (c: string) => void;
    onInsertVar: (v: string) => void;
    onRunSim: () => void;
    onSaveVersion: (status: 'DRAFT' | 'APPROVED') => void;
    onCreateOpen: () => void;
    onSetTestInput: (s: string) => void;
    t: any;
}

const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    SAVE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
    VARIABLE: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    PLAY: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
};

const PROMPT_VARIABLES = ['{{name}}', '{{role}}', '{{context}}', '{{history}}', '{{market_data}}'];

const ConfigTab = memo(({ config, onSave, onUpdateConfig, t }: ConfigTabProps) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-enter">
        <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">{t('ai.policy')}</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('ai.allowed')}</label>
                    <div className="mt-2 space-y-3">
                        {MODEL_GROUPS.map(group => (
                            <div key={group.label}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wide">{group.label}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${group.badgeColor}`}>{group.badge}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.models.map(m => {
                                        const isChecked = config.allowedModels?.includes(m) || false;
                                        const isDeprecated = DEPRECATED_MODELS.has(m as string);
                                        return (
                                            <label key={m} className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${isChecked ? (isDeprecated ? 'bg-rose-50 border-rose-300 text-rose-700 line-through' : 'bg-indigo-50 border-indigo-200 text-indigo-700') : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-tertiary)]'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="hidden" 
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const current = config.allowedModels || [];
                                                        const newModels = e.target.checked 
                                                            ? [...current, m] 
                                                            : current.filter(x => x !== m);
                                                        onUpdateConfig('allowedModels', newModels);
                                                    }}
                                                />
                                                {formatModelName(m)}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('ai.default')}</label>
                    <Dropdown
                        value={config.defaultModel}
                        onChange={(v) => onUpdateConfig('defaultModel', v as AiModelType)}
                        options={(config.allowedModels || []).map(m => ({
                            value: m,
                            label: formatModelName(m),
                            icon: <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>
                        }))}
                        disabled={!config.allowedModels?.length}
                        placeholder="Chọn mô hình mặc định"
                    />
                </div>
            </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-4">{t('ai.budget_title')}</h3>
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-[var(--text-tertiary)]">{t('ai.spend')}</span>
                        <span className="font-mono text-[var(--text-secondary)]">${(config.currentSpendUsd || 0).toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-[var(--glass-surface-hover)] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((config.currentSpendUsd || 0) / config.budgetCapUsd) * 100)}%` }}></div>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('ai.cap')}</label>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[var(--text-secondary)] font-bold">$</span>
                        <input 
                            type="number" 
                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500"
                            value={config.budgetCapUsd}
                            onChange={(e) => onUpdateConfig('budgetCapUsd', Number(e.target.value))}
                        />
                    </div>
                </div>
                <button onClick={onSave} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                    {t('ai.save_config')}
                </button>
            </div>
        </div>
    </div>
));

const PromptsTab = memo(({ 
    prompts, selectedPrompt, editContent, isEvalRunning, testInput, lastEvalRun,
    onSelect, onEditContent, onInsertVar, onRunSim, onSaveVersion, onCreateOpen, onSetTestInput, t 
}: PromptsTabProps) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-enter">
        {/* LIST */}
        <div className="bg-[var(--bg-surface)] p-4 rounded-[24px] border border-[var(--glass-border)] shadow-sm h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-[var(--text-primary)]">{t('ai.tab_prompts')}</h3>
                <button onClick={onCreateOpen} className="bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg text-indigo-600 transition-colors" title={t('ai.btn_create')}>
                    {ICONS.ADD}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {(!prompts || prompts.length === 0) ? (
                    <div className="flex-1 flex items-center justify-center py-12 text-center text-[var(--text-secondary)] italic text-sm px-4">
                        {t('ai.no_prompts')}
                    </div>
                ) : prompts.map((p) => (
                    <div 
                        key={p.id} 
                        onClick={() => onSelect(p)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all group ${selectedPrompt?.id === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] hover:bg-[var(--glass-surface)]'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div className={`font-bold text-sm ${selectedPrompt?.id === p.id ? 'text-indigo-700' : 'text-[var(--text-secondary)]'}`}>{p.name}</div>
                            <span className="text-2xs bg-slate-200 text-[var(--text-secondary)] px-1.5 py-0.5 rounded font-mono font-bold">v{p.activeVersion}</span>
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1 truncate group-hover:text-[var(--text-secondary)]">{p.description}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* EDITOR */}
        <div className="lg:col-span-2 bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col h-[600px]">
            {selectedPrompt ? (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">{selectedPrompt.name} <span className="text-[var(--text-secondary)] font-normal text-sm ml-1">v{selectedPrompt.activeVersion}</span></h3>
                            <p className="text-xs text-[var(--text-tertiary)] max-w-md truncate">{selectedPrompt.description}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onSaveVersion('DRAFT')} className="px-3 py-1.5 border border-[var(--glass-border)] text-[var(--text-secondary)] font-bold text-xs rounded-lg hover:bg-[var(--glass-surface)] transition-colors">{t('ai.draft')}</button>
                            <button onClick={() => onSaveVersion('APPROVED')} className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg shadow hover:bg-slate-800 transition-colors flex items-center gap-2">
                                {ICONS.SAVE} {t('ai.publish')}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col relative min-h-0">
                        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                            {PROMPT_VARIABLES.map(v => (
                                <button 
                                    key={v}
                                    onClick={() => onInsertVar(v)}
                                    className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs2 font-bold rounded border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1 shrink-0 transition-colors"
                                >
                                    {ICONS.VARIABLE} {v}
                                </button>
                            ))}
                        </div>
                        <textarea 
                            className="flex-1 w-full bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl p-4 font-mono text-sm outline-none focus:border-indigo-500 resize-none leading-relaxed"
                            value={editContent}
                            onChange={(e) => onEditContent(e.target.value)}
                        />
                    </div>

                    {/* SIMULATOR */}
                    <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                        <div className="flex gap-3">
                            <input 
                                className="flex-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                                placeholder={t('ai.sim_placeholder')}
                                value={testInput}
                                onChange={(e) => onSetTestInput(e.target.value)}
                            />
                            <button onClick={onRunSim} disabled={isEvalRunning} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2 transition-colors">
                                {isEvalRunning ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : ICONS.PLAY}
                                {t('ai.run_sim')}
                            </button>
                        </div>
                        {lastEvalRun && (
                            <div className="mt-3 p-3 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] text-xs font-mono text-[var(--text-secondary)] max-h-24 overflow-y-auto no-scrollbar">
                                <span className="text-emerald-600 font-bold">{t('ai.sim_output_label')}</span> {lastEvalRun}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] italic">
                    {t('ai.select_prompt')}
                </div>
            )}
        </div>
    </div>
));

export const AiGovernance: React.FC = () => {
    const [config, setConfig] = useState<AiTenantConfig | null>(null);
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [safetyLogs, setSafetyLogs] = useState<AiSafetyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CONFIG' | 'PROMPTS' | 'SAFETY'>('CONFIG');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    
    // Prompts State
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [editContent, setEditContent] = useState('');
    const [testInput, setTestInput] = useState('');
    const [isEvalRunning, setIsEvalRunning] = useState(false);
    const [lastEvalRun, setLastEvalRun] = useState<string>('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const { t, formatTime } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [c, p, l] = await Promise.all([
                db.getAiConfig(),
                db.getPromptTemplates(),
                db.getAiSafetyLogs()
            ]);
            setConfig(c);
            setPrompts(p);
            setSafetyLogs(l);
        } catch {
            // silent — UI stays with empty state
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpdateConfig = useCallback((key: keyof AiTenantConfig, value: any) => {
        if (!config) return;
        setConfig({ ...config, [key]: value });
    }, [config]);

    const handleSaveConfig = async () => {
        if (!config) return;
        try {
            await db.saveAiConfig(config);
            notify(t('ai.config_updated'), 'success');
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    const handleSelectPrompt = (p: PromptTemplate) => {
        setSelectedPrompt(p);
        const version = p.versions.find(v => v.version === p.activeVersion);
        setEditContent(version ? version.content : '');
        setLastEvalRun('');
    };

    const handleRunSim = async () => {
        if (!selectedPrompt || !testInput.trim()) return;
        setIsEvalRunning(true);
        try {
            const result = await db.simulatePrompt(editContent, testInput, config?.defaultModel);
            setLastEvalRun(result.output || t('ai.sim_error'));
        } catch (e: any) {
            setLastEvalRun(e?.message || t('ai.sim_error'));
        } finally {
            setIsEvalRunning(false);
        }
    };

    const handleSaveVersion = async (status: 'DRAFT' | 'APPROVED') => {
        if (!selectedPrompt) return;
        try {
            const currentVersions = selectedPrompt.versions || [];
            const existingIdx = currentVersions.findIndex(v => v.version === selectedPrompt.activeVersion);
            let newVersions;
            if (existingIdx >= 0) {
                newVersions = currentVersions.map((v, i) =>
                    i === existingIdx ? { ...v, content: editContent, status } : v
                );
            } else {
                const newVer = (selectedPrompt.activeVersion || 0) + 1;
                newVersions = [...currentVersions, { version: newVer, content: editContent, status, createdAt: new Date().toISOString() }];
            }
            await db.updatePromptTemplate(selectedPrompt.id, { versions: newVersions, activeVersion: selectedPrompt.activeVersion });
            notify(status === 'APPROVED' ? t('ai.prompt_published') : t('ai.prompt_draft'), 'success');
            fetchData();
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    const handleCreatePrompt = async (name: string, desc: string) => {
        try {
            await db.createPromptTemplate({ name, description: desc, content: '' });
            notify(t('ai.prompt_created'), 'success');
            setIsCreateOpen(false);
            fetchData();
        } catch (e) { notify(t('common.error'), 'error'); }
    };

    if (loading || !config) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('ai.loading')}</div>;

    return (
        <>
        <div className="space-y-6 pb-20 relative animate-enter p-4 sm:p-6">

            <div className="flex justify-between items-center bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('ai.title')}</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{t('ai.subtitle')}</p>
                </div>
                <div className="flex bg-[var(--glass-surface-hover)] p-1 rounded-xl">
                    <button onClick={() => setActiveTab('CONFIG')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CONFIG' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_config')}</button>
                    <button onClick={() => setActiveTab('PROMPTS')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'PROMPTS' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_prompts')}</button>
                    <button onClick={() => setActiveTab('SAFETY')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'SAFETY' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_safety')}</button>
                </div>
            </div>

            {activeTab === 'CONFIG' && <ConfigTab config={config} onSave={handleSaveConfig} onUpdateConfig={handleUpdateConfig} t={t} />}
            
            {activeTab === 'PROMPTS' && (
                <PromptsTab 
                    prompts={prompts}
                    selectedPrompt={selectedPrompt}
                    editContent={editContent}
                    isEvalRunning={isEvalRunning}
                    testInput={testInput}
                    lastEvalRun={lastEvalRun}
                    onSelect={handleSelectPrompt}
                    onEditContent={setEditContent}
                    onInsertVar={(v) => setEditContent(prev => prev + v)}
                    onRunSim={handleRunSim}
                    onSaveVersion={handleSaveVersion}
                    onCreateOpen={() => setIsCreateOpen(true)}
                    onSetTestInput={setTestInput}
                    t={t}
                />
            )}

            {activeTab === 'SAFETY' && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm animate-enter">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                        {t('ai.tab_safety')}
                        <span className="bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] text-xs2 px-2 py-0.5 rounded-full">
                            {t('ai.events_count', { count: safetyLogs?.length || 0 })}
                        </span>
                    </h3>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="min-w-full text-xs text-left">
                            <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)]">
                                <tr>
                                    <th className="p-3 rounded-l-lg">{t('table.time')}</th>
                                    <th className="p-3">{t('table.task')}</th>
                                    <th className="p-3">{t('table.model')}</th>
                                    <th className="p-3">{t('table.latency')}</th>
                                    <th className="p-3">{t('table.cost')}</th>
                                    <th className="p-3 rounded-r-lg">{t('table.flags')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {safetyLogs?.map(log => (
                                    <tr key={log.id} className="hover:bg-[var(--glass-surface)] transition-colors">
                                        <td className="p-3 text-[var(--text-secondary)] font-mono">{formatTime(log.timestamp)}</td>
                                        <td className="p-3 font-bold text-[var(--text-secondary)]">{log.taskType}</td>
                                        <td className="p-3 font-mono text-[var(--text-secondary)]">{formatModelName(log.model)}</td>
                                        <td className="p-3 text-[var(--text-secondary)]">{log.latencyMs}ms</td>
                                        <td className="p-3 text-emerald-600 font-mono">${(log.costUsd || 0).toFixed(4)}</td>
                                        <td className="p-3">
                                            {log.safetyFlags.length > 0 ? (
                                                <div className="flex gap-1">
                                                    {log.safetyFlags.map(f => (
                                                        <span key={f} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-2xs font-bold uppercase tracking-wide">{f}</span>
                                                    ))}
                                                </div>
                                            ) : <span className="text-emerald-500 font-bold text-xs2">{t('ai.safe')}</span>}
                                        </td>
                                    </tr>
                                ))}
                                {(!safetyLogs || safetyLogs.length === 0) && (
                                    <tr><td colSpan={6} className="p-8 text-center text-[var(--text-secondary)] italic">{t('ai.no_safety_logs')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Prompt Modal */}
            {isCreateOpen && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
                    <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-[24px] p-6 shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">{t('ai.create_title')}</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target as any;
                            handleCreatePrompt(form.name.value, form.desc.value);
                        }}>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ai.prompt_name')}</label>
                                    <input name="name" required className="w-full border rounded-xl px-3 py-2 text-sm" autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ai.prompt_desc')}</label>
                                    <input name="desc" className="w-full border rounded-xl px-3 py-2 text-sm" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm">{t('common.cancel')}</button>
                                    <button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm">{t('common.create')}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
        {createPortal(
            toast ? (
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' : 'bg-rose-900/90 text-rose-100 border-rose-500'}`}
                >
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};