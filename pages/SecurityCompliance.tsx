import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ComplianceConfig, DlpRule, SecuritySession } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { SeoHead } from '../components/SeoHead';
import {
    SettingsPage,
    SettingsHeader,
    SettingsCard,
    StatTile,
    StatGrid,
    DistributionBar,
    StatusBadge,
    EmptyState,
    TONE_COLOR,
    Tone,
} from '../components/settings/SettingsUI';

const ICONS = {
    LOCK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    SHIELD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    DEVICE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
};
const ACTION_ICONS = {
    REDACT: <svg className="w-3.5 h-3.5 text-sgs-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    BLOCK: <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    LOG_ONLY: <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
};

/** DLP action → label key, badge tone and chart colour. */
const DLP_ACTIONS: Array<{ value: DlpRule['action']; labelKey: string; tone: Tone }> = [
    { value: 'REDACT', labelKey: 'security.action_redact', tone: 'accent' },
    { value: 'BLOCK', labelKey: 'security.action_block', tone: 'danger' },
    { value: 'LOG_ONLY', labelKey: 'security.action_log', tone: 'info' },
];
const actionMeta = (action: string) => DLP_ACTIONS.find(a => a.value === action);

const EMPTY_RETENTION = { messagesDays: 0, auditLogsDays: 0 };

/* ---------------- Small local controls ---------------- */

const Switch: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string; danger?: boolean }> = ({ checked, onChange, label, danger }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
    >
        <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? (danger ? 'bg-[var(--ui-danger)]' : 'bg-[var(--sgs-primary)]') : 'bg-[var(--ui-border-strong)]'}`}>
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </span>
    </button>
);

const RuleEditor = ({ isOpen, onClose, onSave, t }: any) => {
    const [form, setForm] = useState({ name: '', pattern: '', action: 'REDACT' });
    const actionOptions = useMemo(() => DLP_ACTIONS.map(a => ({
        value: a.value,
        label: t(a.labelKey),
        icon: ACTION_ICONS[a.value],
    })), [t]);
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    const canSave = form.name.trim() !== '' && form.pattern.trim() !== '';
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-enter">
            <div role="dialog" aria-modal="true" aria-labelledby="dlp-rule-editor-title" className="w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-2xl sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 id="dlp-rule-editor-title" className="text-base font-bold text-[var(--text-primary)]">{t('security.modal_add_title')}</h3>
                    <button type="button" onClick={onClose} aria-label={t('security.v2_close')} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]">{ICONS.CLOSE}</button>
                </div>
                <form
                    className="space-y-4"
                    onSubmit={e => { e.preventDefault(); if (canSave) onSave(form); }}
                >
                    <div>
                        <label htmlFor="dlp-rule-name" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{t('security.label_rule_name')}</label>
                        <input id="dlp-rule-name" className="ui-input w-full min-h-[44px] text-[16px] sm:text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('security.placeholder_name')} autoFocus />
                    </div>
                    <div>
                        <label htmlFor="dlp-rule-pattern" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{t('security.label_pattern')}</label>
                        <input id="dlp-rule-pattern" className="ui-input w-full min-h-[44px] font-mono text-[16px] sm:text-sm" value={form.pattern} onChange={e => setForm({ ...form, pattern: e.target.value })} placeholder={t('security.placeholder_pattern')} spellCheck={false} />
                    </div>
                    <Dropdown
                        label={t('security.label_action')}
                        value={form.action}
                        onChange={(v) => setForm({ ...form, action: v as string })}
                        options={actionOptions}
                    />
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="ui-button ui-button-secondary ui-button-md min-h-[44px]">{t('security.v2_cancel')}</button>
                        <button type="submit" disabled={!canSave} className="ui-button ui-button-primary ui-button-md min-h-[44px] disabled:cursor-not-allowed disabled:opacity-60">{t('security.btn_save_rule')}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export const SecurityCompliance: React.FC = () => {
    const [config, setConfig] = useState<ComplianceConfig | null>(null);
    // Serialized copy of the last loaded/saved config, used for the "unsaved changes" hint.
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SecuritySession[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'POLICIES' | 'ACCESS'>('POLICIES');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDateTime, language } = useTranslation();

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
                setSavedSnapshot(c ? JSON.stringify(c) : null);
                // Defensive: Ensure sessions is always an array
                setSessions(s || []);
            } catch {
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
        setSaving(true);
        try {
            await db.saveComplianceConfig(config);
            setSavedSnapshot(JSON.stringify(config));
            notify(t('security.alert_save_success'), 'success');
        } catch (e) { notify(t('common.error'), 'error'); }
        finally { setSaving(false); }
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
        const buf = new Uint32Array(2);
        crypto.getRandomValues(buf);
        const newRuleId = buf[0].toString(16).padStart(8, '0') + buf[1].toString(16).padStart(8, '0');
        const newRule: DlpRule = { id: newRuleId, name: rule.name!, pattern: rule.pattern!, action: rule.action as any, enabled: true };
        setConfig({ ...config, dlpRules: [...(config.dlpRules || []), newRule] });
        setIsEditorOpen(false);
    };
    const closeEditor = useCallback(() => setIsEditorOpen(false), []);
    const setRetentionDays = (field: 'messagesDays' | 'auditLogsDays', value: number) => {
        if (!config) return;
        setConfig({ ...config, retention: { ...(config.retention || EMPTY_RETENTION), [field]: value } });
    };

    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    /** Days → readable duration (days under a month, else ≈ months, else ≈ years). Missing value → '—'. */
    const formatDuration = useCallback((days: number | null | undefined) => {
        if (days == null || !Number.isFinite(days)) return '—';
        const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });
        if (days < 30) return t('security.v2_dur_days', { n: fmt(days) });
        if (days < 365) return t('security.v2_dur_months', { n: fmt(days / 30) });
        return t('security.v2_dur_years', { n: fmt(days / 365) });
    }, [t, locale]);

    const rules = config?.dlpRules || [];
    const enabledRules = rules.filter(r => r.enabled).length;
    const blockingRules = rules.filter(r => r.enabled && r.action === 'BLOCK').length;
    const dlpSegments = useMemo(() => DLP_ACTIONS.map(a => ({
        label: t(a.labelKey),
        value: rules.filter(r => r.action === a.value).length,
        color: TONE_COLOR[a.tone],
    })), [rules, t]);

    const sessionUser = (s: SecuritySession) => s.userName || s.userEmail || s.userId;
    const sessionStats = useMemo(() => {
        const byUser = new Map<string, number>();
        const ips = new Set<string>();
        for (const s of sessions) {
            const u = String(sessionUser(s) || '—');
            byUser.set(u, (byUser.get(u) || 0) + 1);
            if (s.ipAddress) ips.add(s.ipAddress);
        }
        // Top 5 users, the rest grouped as "other".
        const sorted = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
        const segments = sorted.slice(0, 5).map(([label, value]) => ({ label, value }));
        const rest = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
        if (rest > 0) segments.push({ label: t('security.v2_other'), value: rest });
        return { users: byUser.size, ips: ips.size, segments };
    }, [sessions, t]);

    const seo = <SeoHead title={t('security.v2_seo_title')} description={t('security.v2_seo_description')} canonicalPath="/security-compliance" />;

    if (loading || !config) {
        return (
            <>
                {seo}
                <SettingsPage>
                    {loading ? (
                        <div className="p-10 text-center text-sm text-[var(--text-secondary)] animate-pulse" role="status">{t('common.loading')}</div>
                    ) : (
                        <SettingsCard>
                            <EmptyState icon={ICONS.SHIELD} title={t('security.alert_load_fail')} />
                        </SettingsCard>
                    )}
                </SettingsPage>
                {toastPortal(toast)}
            </>
        );
    }

    const isDirty = savedSnapshot !== null && savedSnapshot !== JSON.stringify(config);
    const retention = config.retention;
    const tabs: Array<{ id: 'POLICIES' | 'ACCESS'; label: string }> = [
        { id: 'POLICIES', label: t('security.tab_policies') },
        { id: 'ACCESS', label: t('security.tab_access') },
    ];

    const retentionField = (field: 'messagesDays' | 'auditLogsDays', labelKey: string) => {
        const id = `retention-${field}`;
        const value = retention?.[field];
        return (
            <div>
                <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{t(labelKey)}</label>
                <div className="flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                        <input
                            id={id}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            disabled={config.legalHold}
                            value={value || 0}
                            onChange={e => setRetentionDays(field, Number(e.target.value))}
                            aria-describedby={`${id}-duration`}
                            className="ui-input w-full min-h-[44px] pr-14 text-[16px] tabular-nums sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)]">{t('security.v2_unit_days')}</span>
                    </div>
                    <span id={`${id}-duration`} className="shrink-0 rounded-xl bg-[var(--glass-surface)] px-3 py-2 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                        {formatDuration(value ?? null)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <>
            {seo}
            <SettingsPage>
                <SettingsHeader
                    icon={ICONS.SHIELD}
                    title={t('security.title')}
                    description={t('security.subtitle')}
                    meta={<>
                        {config.legalHold && <StatusBadge tone="danger">{t('security.v2_legal_hold_on')}</StatusBadge>}
                        {isDirty && <StatusBadge tone="warning">{t('security.v2_unsaved')}</StatusBadge>}
                    </>}
                    actions={
                        <div role="tablist" aria-label={t('security.v2_tabs_aria')} className="flex rounded-xl bg-[var(--glass-surface-hover)] p-1">
                            {tabs.map(tab => {
                                const selected = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        id={`security-tab-${tab.id}`}
                                        aria-selected={selected}
                                        aria-controls={`security-panel-${tab.id}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] ${selected ? 'bg-[var(--bg-surface)] text-[var(--sgs-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    }
                />

                <StatGrid cols={4}>
                    <StatTile label={t('security.v2_tile_msg')} value={formatDuration(retention?.messagesDays)} hint={retention?.messagesDays != null ? t('security.v2_dur_days', { n: retention.messagesDays.toLocaleString(locale) }) : undefined} tone="brand" />
                    <StatTile label={t('security.v2_tile_logs')} value={formatDuration(retention?.auditLogsDays)} hint={retention?.auditLogsDays != null ? t('security.v2_dur_days', { n: retention.auditLogsDays.toLocaleString(locale) }) : undefined} tone="brand" />
                    <StatTile
                        label={t('security.v2_tile_dlp')}
                        value={<>{enabledRules}<span className="text-base font-semibold text-[var(--text-tertiary)]"> / {rules.length}</span></>}
                        hint={t('security.v2_tile_dlp_hint', { n: blockingRules })}
                        tone={enabledRules > 0 ? 'success' : 'neutral'}
                    />
                    <StatTile
                        label={t('security.v2_tile_sessions')}
                        value={sessions.length.toLocaleString(locale)}
                        hint={t('security.v2_tile_sessions_hint', { n: sessionStats.users })}
                        onClick={() => setActiveTab('ACCESS')}
                        active={activeTab === 'ACCESS'}
                    />
                </StatGrid>

                {activeTab === 'POLICIES' && (
                    <div id="security-panel-POLICIES" role="tabpanel" aria-labelledby="security-tab-POLICIES" className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {/* Retention policy */}
                            <SettingsCard
                                title={t('security.retention')}
                                description={t('security.v2_retention_desc')}
                                actions={
                                    <div className="flex items-center gap-1">
                                        <span className={`text-xs font-semibold ${config.legalHold ? 'text-[var(--ui-danger)]' : 'text-[var(--text-secondary)]'}`}>{t('security.legal_hold')}</span>
                                        <Switch checked={config.legalHold} onChange={v => setConfig({ ...config, legalHold: v })} label={t('security.legal_hold')} danger />
                                    </div>
                                }
                            >
                                <div className="space-y-4">
                                    {config.legalHold ? (
                                        <div className="flex items-start gap-2 rounded-xl border border-[var(--ui-danger)] bg-[var(--glass-surface)] p-3 text-xs font-semibold text-[var(--ui-danger)]" role="status">
                                            <span className="shrink-0">{ICONS.LOCK}</span>
                                            <span>{t('security.legal_hold_active')}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-[var(--text-tertiary)]">{t('security.v2_legal_hold_desc')}</p>
                                    )}
                                    {retentionField('messagesDays', 'security.msg_days')}
                                    {retentionField('auditLogsDays', 'security.log_days')}
                                </div>
                            </SettingsCard>

                            {/* DLP rules */}
                            <SettingsCard
                                title={t('security.dlp_rules')}
                                description={t('security.v2_dlp_desc')}
                                actions={
                                    <button type="button" onClick={() => setIsEditorOpen(true)} className="ui-button ui-button-secondary ui-button-sm inline-flex min-h-[40px] items-center gap-1.5">
                                        {ICONS.ADD} {t('security.v2_add_rule')}
                                    </button>
                                }
                            >
                                {rules.length === 0 ? (
                                    <EmptyState
                                        icon={ICONS.SHIELD}
                                        title={t('security.v2_no_dlp_title')}
                                        description={t('security.no_dlp_rules')}
                                        action={
                                            <button type="button" onClick={() => setIsEditorOpen(true)} className="ui-button ui-button-primary ui-button-md inline-flex min-h-[44px] items-center gap-1.5">
                                                {ICONS.ADD} {t('security.v2_add_rule')}
                                            </button>
                                        }
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('security.v2_dlp_mix')}</div>
                                            <DistributionBar segments={dlpSegments} ariaLabel={t('security.v2_dlp_mix_aria')} />
                                        </div>
                                        <ul className="space-y-2">
                                            {rules.map(rule => {
                                                const meta = actionMeta(rule.action);
                                                return (
                                                    <li key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] p-3 transition-colors hover:border-[var(--ui-border-strong)]">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`text-sm font-semibold ${rule.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>{rule.name}</span>
                                                                <StatusBadge tone={meta?.tone ?? 'neutral'}>
                                                                    {t(meta?.labelKey ?? `security.action_${String(rule.action).toLowerCase()}`)}
                                                                </StatusBadge>
                                                                {!rule.enabled && <StatusBadge tone="neutral">{t('security.v2_rule_off')}</StatusBadge>}
                                                            </div>
                                                            <div className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]" title={rule.pattern}>{rule.pattern}</div>
                                                        </div>
                                                        <div className="flex shrink-0 items-center">
                                                            <Switch checked={rule.enabled} onChange={() => toggleRule(rule.id)} label={t('security.v2_toggle_rule_aria', { name: rule.name })} />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRule(rule.id)}
                                                                aria-label={t('security.v2_delete_rule_aria', { name: rule.name })}
                                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-[var(--ui-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                                                            >
                                                                {ICONS.TRASH}
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </SettingsCard>
                        </div>

                        {/* One save for retention + DLP rules (both live in the compliance config). */}
                        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-[var(--text-secondary)]">{t('security.v2_save_hint')}</p>
                            <button type="button" onClick={handleSaveConfig} disabled={saving} className="ui-button ui-button-primary ui-button-md min-h-[44px] shrink-0 disabled:cursor-not-allowed disabled:opacity-60">
                                {saving ? '…' : t('security.save_policy')}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'ACCESS' && (
                    <div id="security-panel-ACCESS" role="tabpanel" aria-labelledby="security-tab-ACCESS">
                        <SettingsCard
                            title={t('security.active_sessions')}
                            description={sessions.length > 0 ? t('security.v2_sessions_desc', { n: sessions.length, u: sessionStats.users, ip: sessionStats.ips }) : undefined}
                        >
                            {sessions.length === 0 ? (
                                <EmptyState icon={ICONS.DEVICE} title={t('sec.no_sessions')} />
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('security.v2_by_user')}</div>
                                        <DistributionBar segments={sessionStats.segments} ariaLabel={t('security.v2_by_user_aria')} />
                                    </div>

                                    {/* Mobile: stacked rows */}
                                    <ul className="divide-y divide-[var(--glass-border)] sm:hidden">
                                        {sessions.map(s => (
                                            <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{sessionUser(s)}</div>
                                                    <div className="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">{s.ipAddress}</div>
                                                    <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                                                        <span className="truncate" title={s.userAgent}>{s.userAgent?.split(' ')[0] || '—'}</span> · <span className="tabular-nums">{formatDateTime(s.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <RevokeButton label={t('security.revoke')} ariaLabel={t('security.v2_revoke_aria', { name: sessionUser(s) })} onClick={() => handleRevokeSession(s.id)} />
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Tablet/desktop: table */}
                                    <div className="hidden overflow-x-auto sm:block">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-[var(--glass-border)] text-left text-xs font-medium text-[var(--text-secondary)]">
                                                    <th scope="col" className="pb-3 pr-4">{t('security.session_user')}</th>
                                                    <th scope="col" className="pb-3 pr-4">{t('table.ip_address')}</th>
                                                    <th scope="col" className="pb-3 pr-4">{t('table.device')}</th>
                                                    <th scope="col" className="pb-3 pr-4">{t('table.last_active')}</th>
                                                    <th scope="col" className="pb-3 text-right">{t('common.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sessions.map(s => (
                                                    <tr key={s.id} className="border-b border-[var(--glass-border)] transition-colors last:border-0 hover:bg-[var(--glass-surface)]">
                                                        <td className="py-2 pr-4 font-semibold text-[var(--text-primary)]">{sessionUser(s)}</td>
                                                        <td className="py-2 pr-4 font-mono text-xs text-[var(--text-secondary)]">{s.ipAddress}</td>
                                                        <td className="max-w-[160px] truncate py-2 pr-4 text-[var(--text-secondary)]" title={s.userAgent}>{s.userAgent?.split(' ')[0] || '—'}</td>
                                                        <td className="py-2 pr-4 tabular-nums text-[var(--text-tertiary)]">{formatDateTime(s.createdAt)}</td>
                                                        <td className="py-2 text-right">
                                                            <RevokeButton label={t('security.revoke')} ariaLabel={t('security.v2_revoke_aria', { name: sessionUser(s) })} onClick={() => handleRevokeSession(s.id)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </SettingsCard>
                    </div>
                )}

                <RuleEditor isOpen={isEditorOpen} onClose={closeEditor} onSave={handleAddRule} t={t} />
            </SettingsPage>
            {toastPortal(toast)}
        </>
    );
};

const RevokeButton: React.FC<{ label: string; ariaLabel: string; onClick: () => void }> = ({ label, ariaLabel, onClick }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="ui-button ui-button-danger ui-button-sm min-h-[40px] shrink-0">
        {label}
    </button>
);

function toastPortal(toast: { msg: string, type: 'success' | 'error' } | null) {
    return createPortal(
        toast ? (
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-xl border px-6 py-3 shadow-2xl ${toast.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' : 'bg-rose-900/90 text-rose-100 border-rose-500'}`}
            >
                <span className="text-sm font-bold">{toast.msg}</span>
            </div>
        ) : null,
        document.body
    );
}
