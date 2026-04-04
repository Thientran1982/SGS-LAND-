import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { aiService } from '../services/aiService';
import { AiTenantConfig, PromptTemplate, AiSafetyLog, AiModelType } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

const AGENT_SKILL_CATALOG: { key: string; agent: string; desc: string }[] = [
    { key: 'ROUTER_SYSTEM',       agent: 'Router',          desc: 'Phân tích ý định & định tuyến agent phù hợp' },
    { key: 'WRITER_PERSONA',      agent: 'Writer',          desc: 'Tính cách & phong cách tư vấn viên trả lời' },
    { key: 'INVENTORY_SYSTEM',    agent: 'Inventory',       desc: 'Phân tích & tìm kiếm bất động sản' },
    { key: 'FINANCE_SYSTEM',      agent: 'Finance',         desc: 'Tư vấn tài chính, vay ngân hàng, lãi suất' },
    { key: 'LEGAL_SYSTEM',        agent: 'Legal',           desc: 'Tư vấn pháp lý, sổ đỏ, thủ tục sang tên' },
    { key: 'SALES_SYSTEM',        agent: 'Sales',           desc: 'Chuẩn bị brief xem nhà, chốt deal' },
    { key: 'MARKETING_SYSTEM',    agent: 'Marketing',       desc: 'Phân tích ưu đãi, chiến dịch marketing' },
    { key: 'CONTRACT_SYSTEM',     agent: 'Contract',        desc: 'Phân tích điều khoản hợp đồng BĐS' },
    { key: 'LEAD_ANALYST_SYSTEM', agent: 'Lead Analyst',   desc: 'Phân tích tâm lý & hành vi khách hàng' },
];

const PromptsTab = memo(({ 
    prompts, selectedPrompt, editContent, isEvalRunning, testInput, lastEvalRun,
    onSelect, onEditContent, onInsertVar, onRunSim, onSaveVersion, onCreateOpen, onSetTestInput, t 
}: PromptsTabProps) => {
    const configuredKeys = new Set((prompts || []).map(p => p.name));
    return (
    <div className="space-y-4 animate-enter">
        {/* AGENT SKILLS CATALOG */}
        <div className="bg-[var(--bg-surface)] p-4 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
            <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Catalog Agent Skills — Tên template khớp key để override mặc định</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {AGENT_SKILL_CATALOG.map(({ key, agent, desc }) => {
                    const configured = configuredKeys.has(key);
                    return (
                        <div
                            key={key}
                            onClick={() => !configured && onCreateOpen()}
                            title={configured ? 'Đã có template — chọn từ danh sách bên dưới' : `Nhấn để tạo template "${key}"`}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none ${configured ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] hover:border-indigo-200 hover:bg-indigo-50'}`}
                        >
                            <div className="flex items-center gap-1.5 mb-0.5">
                                {configured
                                    ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    : <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] opacity-40 shrink-0"></span>
                                }
                                <span className={`font-bold truncate ${configured ? 'text-emerald-700' : 'text-[var(--text-secondary)]'}`}>{agent}</span>
                            </div>
                            <code className="text-[10px] text-[var(--text-tertiary)] font-mono block truncate">{key}</code>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-tight hidden sm:block">{desc}</p>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* LIST + EDITOR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    </div>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// RLHF Tab
// ─────────────────────────────────────────────────────────────────────────────

interface RlhfStats {
    totalFeedback: number;
    positiveCount: number;
    negativeCount: number;
    approvalRate: number;
    byIntent: Array<{ intent: string; positive: number; negative: number; rate: number }>;
    byNode: Array<{ agentNode: string; positive: number; negative: number; rate: number }>;
    recentCorrections: Array<{ userMessage: string; aiResponse: string; correction: string; intent: string; createdAt: string }>;
}

interface RewardSignal {
    intent: string;
    positiveCount: number;
    negativeCount: number;
    avgScore: number;
    lastComputed: string;
    fewShotCache: any[];
    topExamples: any[];
    negativePatterns: any[];
}

const INTENT_LABELS: Record<string, string> = {
    SEARCH_INVENTORY: 'Tìm BĐS',
    CALCULATE_LOAN: 'Tính vay',
    EXPLAIN_LEGAL: 'Pháp lý',
    DRAFT_BOOKING: 'Đặt cọc',
    EXPLAIN_MARKETING: 'Marketing',
    DRAFT_CONTRACT: 'Hợp đồng',
    ANALYZE_LEAD: 'Phân tích lead',
    ESTIMATE_VALUATION: 'Định giá',
    DIRECT_ANSWER: 'Trả lời',
    GREETING: 'Chào hỏi',
    UNKNOWN: 'Không xác định',
};

const RlhfTab = memo(({ stats, signals, trends, onRecompute, isRecomputing, formatTime }: {
    stats: RlhfStats | null;
    signals: RewardSignal[];
    trends: any[];
    onRecompute: () => void;
    isRecomputing: boolean;
    formatTime: (d: any) => string;
}) => {
    const [showCorrections, setShowCorrections] = useState(false);
    const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

    const approvalColor = (rate: number) => rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-500' : 'text-rose-500';
    const approvalBg = (rate: number) => rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-500';

    return (
        <div className="space-y-6 animate-enter">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng phản hồi', value: stats?.totalFeedback || 0, icon: '💬', color: 'text-indigo-600' },
                    { label: 'Tỷ lệ chấp thuận', value: `${stats?.approvalRate || 0}%`, icon: '⭐', color: stats?.approvalRate && stats.approvalRate >= 70 ? 'text-emerald-600' : 'text-amber-500' },
                    { label: 'Phản hồi tốt', value: stats?.positiveCount || 0, icon: '👍', color: 'text-emerald-600' },
                    { label: 'Cần cải thiện', value: stats?.negativeCount || 0, icon: '👎', color: 'text-rose-500' },
                ].map(card => (
                    <div key={card.label} className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                        <div className="text-2xl mb-2">{card.icon}</div>
                        <div className={`text-2xl font-extrabold ${card.color}`}>{card.value}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1 font-medium">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Trend Chart + Recompute */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 text-sm">Xu hướng phản hồi theo tuần</h3>
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={trends} barSize={16} barGap={2}>
                                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={w => w.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip
                                    formatter={(val: any, name: string) => [val, name === 'positive' ? 'Tốt' : 'Cần sửa']}
                                    labelFormatter={l => `Tuần ${l}`}
                                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                />
                                <Bar dataKey="positive" name="positive" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="negative" name="negative" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-[var(--text-tertiary)] italic text-sm">
                            Chưa có dữ liệu xu hướng — cần ít nhất 1 tuần phản hồi
                        </div>
                    )}
                </div>

                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col gap-4">
                    <h3 className="font-bold text-[var(--text-primary)] text-sm">Huấn luyện RLHF</h3>
                    <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                        Khi nhấn <strong>Tính lại Reward</strong>, hệ thống sẽ tổng hợp tất cả phản hồi tích cực/tiêu cực thành bộ quy tắc few-shot và negative-rule. AI sẽ tự động học từ các phản hồi này trong các cuộc hội thoại tiếp theo.
                    </p>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
                        <div className="font-bold">Kiến trúc RLHF:</div>
                        <div>① Thu feedback (👍/👎 + sửa lỗi)</div>
                        <div>② Tính Reward Signal per-intent</div>
                        <div>③ Inject few-shot vào Writer prompt</div>
                        <div>④ AI cải thiện tự động theo chu kỳ</div>
                    </div>
                    <button
                        onClick={onRecompute}
                        disabled={isRecomputing}
                        className="mt-auto w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                    >
                        {isRecomputing ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tính...</>
                        ) : (
                            <>🔄 Tính lại Reward Signals</>
                        )}
                    </button>
                    <div className="text-xs text-[var(--text-tertiary)] text-center">Tự động chạy hàng ngày lúc 2:00 SA</div>
                </div>
            </div>

            {/* Intent Breakdown */}
            {(stats?.byIntent || []).length > 0 && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 text-sm">Hiệu suất theo loại yêu cầu (Intent)</h3>
                    <div className="space-y-3">
                        {(stats?.byIntent || []).map(item => (
                            <div key={item.intent} className="flex items-center gap-3">
                                <div className="w-28 shrink-0">
                                    <span className="text-xs font-bold text-[var(--text-secondary)]">{INTENT_LABELS[item.intent] || item.intent}</span>
                                </div>
                                <div className="flex-1 bg-[var(--glass-surface-hover)] rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${approvalBg(item.rate)}`}
                                        style={{ width: `${item.rate}%` }}
                                    />
                                </div>
                                <div className={`w-12 text-right text-xs font-bold ${approvalColor(item.rate)}`}>{item.rate}%</div>
                                <div className="w-20 text-right text-xs text-[var(--text-tertiary)]">
                                    <span className="text-emerald-600">+{item.positive}</span> / <span className="text-rose-500">-{item.negative}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reward Signals Table */}
            {signals.length > 0 && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <h3 className="font-bold text-[var(--text-primary)] mb-4 text-sm">Reward Signals đã tích lũy</h3>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="min-w-full text-xs">
                            <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)]">
                                <tr>
                                    <th className="p-3 text-left rounded-l-lg">Intent</th>
                                    <th className="p-3 text-center">Tốt / Xấu</th>
                                    <th className="p-3 text-center">Điểm TB</th>
                                    <th className="p-3 text-center">Few-shot</th>
                                    <th className="p-3 text-center">Negative Rules</th>
                                    <th className="p-3 text-left rounded-r-lg">Cập nhật lần cuối</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {signals.map(sig => {
                                    const fewShot = Array.isArray(sig.fewShotCache) ? sig.fewShotCache.length : 0;
                                    const negRules = Array.isArray(sig.negativePatterns) ? sig.negativePatterns.length : 0;
                                    const isExpanded = expandedSignal === sig.intent;
                                    return (
                                        <React.Fragment key={sig.intent}>
                                            <tr
                                                className="hover:bg-[var(--glass-surface)] transition-colors cursor-pointer"
                                                onClick={() => setExpandedSignal(isExpanded ? null : sig.intent)}
                                            >
                                                <td className="p-3 font-bold text-[var(--text-secondary)]">{INTENT_LABELS[sig.intent] || sig.intent}</td>
                                                <td className="p-3 text-center">
                                                    <span className="text-emerald-600 font-bold">{sig.positiveCount}</span>
                                                    <span className="text-[var(--text-tertiary)] mx-1">/</span>
                                                    <span className="text-rose-500 font-bold">{sig.negativeCount}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`font-bold ${approvalColor(Math.round((sig.avgScore + 1) / 2 * 100))}`}>
                                                        {typeof sig.avgScore === 'number' ? sig.avgScore.toFixed(2) : '—'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${fewShot > 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-[var(--glass-surface)] text-[var(--text-tertiary)]'}`}>
                                                        {fewShot > 0 ? `${fewShot} mẫu` : '—'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${negRules > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-[var(--glass-surface)] text-[var(--text-tertiary)]'}`}>
                                                        {negRules > 0 ? `${negRules} quy tắc` : '—'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-[var(--text-tertiary)] font-mono">
                                                    {sig.lastComputed ? formatTime(sig.lastComputed) : '—'}
                                                </td>
                                            </tr>
                                            {isExpanded && (sig.topExamples?.length > 0 || sig.negativePatterns?.length > 0) && (
                                                <tr>
                                                    <td colSpan={6} className="px-4 pb-4 bg-[var(--glass-surface)]/50">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                                                            {sig.topExamples?.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-bold text-emerald-700 mb-2">✅ Mẫu trả lời tốt (Few-shot)</div>
                                                                    {sig.topExamples.slice(0, 2).map((ex: any, i: number) => (
                                                                        <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 mb-2">
                                                                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Khách: <span className="text-[var(--text-secondary)]">{(ex.userMessage || '').slice(0, 100)}</span></div>
                                                                            <div className="text-xs text-emerald-700">AI: {(ex.aiResponse || '').slice(0, 200)}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {sig.negativePatterns?.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-bold text-rose-700 mb-2">⚠️ Lỗi cần tránh (Negative Rules)</div>
                                                                    {sig.negativePatterns.slice(0, 2).map((p: any, i: number) => (
                                                                        <div key={i} className="bg-rose-50 border border-rose-100 rounded-lg p-2 mb-2">
                                                                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Câu hỏi: <span className="text-[var(--text-secondary)]">{(p.userMessage || '').slice(0, 80)}</span></div>
                                                                            <div className="text-xs text-rose-700">→ Nên sửa: {(p.correction || '').slice(0, 150)}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Recent Corrections */}
            {(stats?.recentCorrections || []).length > 0 && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-[var(--text-primary)] text-sm">Sửa lỗi gần đây từ người dùng</h3>
                        <button onClick={() => setShowCorrections(!showCorrections)} className="text-xs text-indigo-600 font-bold">
                            {showCorrections ? 'Ẩn bớt' : 'Xem tất cả'}
                        </button>
                    </div>
                    <div className="space-y-3">
                        {(stats?.recentCorrections || []).slice(0, showCorrections ? 20 : 5).map((c, i) => (
                            <div key={i} className="border border-[var(--glass-border)] rounded-xl overflow-hidden">
                                <div className="bg-[var(--glass-surface)] px-4 py-2 flex justify-between items-center">
                                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{INTENT_LABELS[c.intent] || c.intent || 'Chung'}</span>
                                    <span className="text-xs text-[var(--text-tertiary)] font-mono">{formatTime(c.createdAt)}</span>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <div className="font-bold text-[var(--text-tertiary)] mb-1">💬 Câu hỏi</div>
                                        <div className="text-[var(--text-secondary)]">{(c.userMessage || '').slice(0, 120)}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-rose-500 mb-1">❌ AI đã trả lời sai</div>
                                        <div className="text-[var(--text-secondary)] line-through opacity-60">{(c.aiResponse || '').slice(0, 120)}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-emerald-600 mb-1">✅ Sửa đúng</div>
                                        <div className="text-emerald-700">{(c.correction || '').slice(0, 150)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!stats?.totalFeedback && (
                <div className="bg-[var(--bg-surface)] p-12 rounded-[24px] border border-[var(--glass-border)] shadow-sm text-center">
                    <div className="text-5xl mb-4">🤖</div>
                    <div className="font-bold text-[var(--text-primary)] mb-2">Chưa có dữ liệu huấn luyện</div>
                    <div className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
                        Khi người dùng đánh giá câu trả lời AI (👍/👎) trong hộp thư inbox, dữ liệu sẽ tự động xuất hiện ở đây để AI học và cải thiện.
                    </div>
                </div>
            )}
        </div>
    );
});

export const AiGovernance: React.FC = () => {
    const [config, setConfig] = useState<AiTenantConfig | null>(null);
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [safetyLogs, setSafetyLogs] = useState<AiSafetyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CONFIG' | 'PROMPTS' | 'SAFETY' | 'RLHF'>('CONFIG');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    
    // Prompts State
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [editContent, setEditContent] = useState('');
    const [testInput, setTestInput] = useState('');
    const [isEvalRunning, setIsEvalRunning] = useState(false);
    const [lastEvalRun, setLastEvalRun] = useState<string>('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // RLHF State
    const [rlhfStats, setRlhfStats] = useState<RlhfStats | null>(null);
    const [rewardSignals, setRewardSignals] = useState<RewardSignal[]>([]);
    const [feedbackTrends, setFeedbackTrends] = useState<any[]>([]);
    const [isRecomputing, setIsRecomputing] = useState(false);

    const { t, formatTime } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchRlhfData = useCallback(async () => {
        try {
            const [stats, signals, trends] = await Promise.all([
                db.getFeedbackStats(30),
                db.getRewardSignals(),
                db.getFeedbackTrends(90),
            ]);
            setRlhfStats(stats);
            setRewardSignals(signals || []);
            setFeedbackTrends(trends || []);
        } catch {
            // silent
        }
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
    useEffect(() => { if (activeTab === 'RLHF') fetchRlhfData(); }, [activeTab, fetchRlhfData]);

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

    const handleRecompute = async () => {
        setIsRecomputing(true);
        try {
            await db.recomputeRewards();
            notify('Đã tính lại Reward Signals thành công — AI sẽ học từ dữ liệu mới!', 'success');
            await fetchRlhfData();
        } catch {
            notify('Lỗi khi tính lại Reward Signals', 'error');
        } finally {
            setIsRecomputing(false);
        }
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
                <div className="flex bg-[var(--glass-surface-hover)] p-1 rounded-xl flex-wrap gap-y-1">
                    <button onClick={() => setActiveTab('CONFIG')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CONFIG' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_config')}</button>
                    <button onClick={() => setActiveTab('PROMPTS')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'PROMPTS' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_prompts')}</button>
                    <button onClick={() => setActiveTab('SAFETY')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'SAFETY' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{t('ai.tab_safety')}</button>
                    <button onClick={() => setActiveTab('RLHF')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'RLHF' ? 'bg-[var(--bg-surface)] shadow text-indigo-600' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>🧠 RLHF</button>
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

            {activeTab === 'RLHF' && (
                <RlhfTab
                    stats={rlhfStats}
                    signals={rewardSignals}
                    trends={feedbackTrends}
                    onRecompute={handleRecompute}
                    isRecomputing={isRecomputing}
                    formatTime={formatTime}
                />
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
                                    <input name="name" required className="w-full border rounded-xl px-3 py-2 text-[16px]" autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ai.prompt_desc')}</label>
                                    <input name="desc" className="w-full border rounded-xl px-3 py-2 text-[16px]" />
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