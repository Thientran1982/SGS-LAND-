import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, RefreshCw, Trash2, X, Database, ShieldCheck, Clock, Pencil, Plug,
    Info, ClipboardList, UserPlus,
} from 'lucide-react';
import { db } from '../services/dbApi';
import { ConnectorConfig, SyncJob, ConnectorType, SyncStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { connectorService } from '../services/connectorService';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import { userApi } from '../services/api/userApi';
import {
    SettingsPage, SettingsHeader, SettingsCard, StatTile, StatGrid, DistributionBar,
    TrendBars, Sparkline, StatusBadge, EmptyState, TONE_COLOR,
    type Tone, type Segment, type TrendPoint,
} from '../components/settings/SettingsUI';
import { DashboardMetricRing } from '../components/dashboard/DashboardVisuals';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/* ---------------- Constants ---------------- */

/** Default page size of GET /api/connectors/jobs; a full page means older jobs were not loaded. */
const JOBS_PAGE_LIMIT = 50;
const TREND_DAYS = 14;

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
    GOOGLE_SHEETS: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M8 8h8M8 12h8M8 16h8M12 8v8" /></svg>,
    HUBSPOT: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="14" r="3" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M10.5 12l5-5M16 4v3h3M11 14h8M19 12v4a3 3 0 11-3-3" /></svg>,
    ZOHO_CRM: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 6h16M4 12h10M4 18h16M17 9l3 3-3 3" /></svg>,
    SALESFORCE: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 17a4 4 0 01-.5-7.97A5.5 5.5 0 0117 7.5a3.5 3.5 0 01.5 6.96A4 4 0 017 17z" /></svg>,
    WEBHOOK_EXPORT: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10 13a5 5 0 007.07.07l1.42-1.42a5 5 0 00-7.07-7.07L10.6 5.4M14 11a5 5 0 00-7.07-.07L5.5 12.35a5 5 0 007.07 7.07l.82-.82" /></svg>,
};
const SOCIAL_CONNECTION_ICON = <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3" strokeWidth={1.7} /><circle cx="16" cy="7" r="3" strokeWidth={1.7} /><circle cx="16" cy="17" r="3" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M10.5 10.5l3-2M10.5 13.5l3 2" /></svg>;
const FALLBACK_ICON = <Info size={16} aria-hidden="true" />;

type SocialConnectionType = Extract<ConnectorType, ConnectorType.FACEBOOK_PAGE | ConnectorType.ZALO_OA | ConnectorType.INSTAGRAM | ConnectorType.TIKTOK | ConnectorType.LINKEDIN_PAGE>;
type ConnectionChoice = ConnectorType;
type AddConnectionForm = { type: ConnectionChoice; name: string; config: Record<string, unknown> };
type ConnectionResult = { kind: 'connected' | 'not_ready' | 'error'; title: string; message: string };

/** Social connectors only store per-user credentials; the server has no sync adapter for them. */
const SOCIAL_CONNECTIONS: Record<SocialConnectionType, { label: string; descKey: string }> = {
    FACEBOOK_PAGE: { label: 'Facebook Page', descKey: 'dataplat.v2_social_desc_facebook' },
    ZALO_OA: { label: 'Zalo OA', descKey: 'dataplat.v2_social_desc_zalo' },
    INSTAGRAM: { label: 'Instagram Business', descKey: 'dataplat.v2_social_desc_instagram' },
    TIKTOK: { label: 'TikTok Business', descKey: 'dataplat.v2_social_desc_tiktok' },
    LINKEDIN_PAGE: { label: 'LinkedIn Page', descKey: 'dataplat.v2_social_desc_linkedin' },
};
const isSocialType = (type: ConnectorType) => Boolean(SOCIAL_CONNECTIONS[type as SocialConnectionType]);

/** Brand names (proper nouns, not translated). */
const CONNECTION_LABELS: Record<ConnectorType, string> = {
    [ConnectorType.GOOGLE_SHEETS]: 'Google Sheets',
    [ConnectorType.HUBSPOT]: 'HubSpot CRM',
    [ConnectorType.ZOHO_CRM]: 'Zoho CRM',
    [ConnectorType.WEBHOOK_EXPORT]: 'Webhook',
    [ConnectorType.SALESFORCE]: 'Salesforce',
    [ConnectorType.FACEBOOK_PAGE]: 'Facebook',
    [ConnectorType.ZALO_OA]: 'Zalo',
    [ConnectorType.INSTAGRAM]: 'Instagram',
    [ConnectorType.TIKTOK]: 'TikTok',
    [ConnectorType.LINKEDIN_PAGE]: 'LinkedIn',
};
const connectorIcon = (type: ConnectorType) => CONNECTOR_ICONS[type] || (isSocialType(type) ? SOCIAL_CONNECTION_ICON : FALLBACK_ICON);

const CONNECTION_OPTIONS = Object.values(ConnectorType).map(value => ({
    value: value as ConnectionChoice,
    label: CONNECTION_LABELS[value],
    icon: connectorIcon(value),
}));

const REQUIRED_CONFIG_KEYS: Record<string, string[]> = {
    [ConnectorType.GOOGLE_SHEETS]: ['spreadsheetId'],
    [ConnectorType.HUBSPOT]: ['apiKey'],
    [ConnectorType.ZOHO_CRM]: ['apiKey'],
    [ConnectorType.SALESFORCE]: ['apiKey'],
    [ConnectorType.WEBHOOK_EXPORT]: ['targetUrl'],
    [ConnectorType.FACEBOOK_PAGE]: ['pageId', 'accessToken'],
    [ConnectorType.ZALO_OA]: ['appId', 'oaId', 'accessToken'],
    [ConnectorType.INSTAGRAM]: ['businessAccountId', 'accessToken'],
    [ConnectorType.TIKTOK]: ['accountId', 'accessToken'],
    [ConnectorType.LINKEDIN_PAGE]: ['organizationId', 'accessToken'],
};

const SYNC_STATUS_TONE: Record<SyncStatus, Tone> = {
    [SyncStatus.COMPLETED]: 'success',
    [SyncStatus.FAILED]: 'danger',
    [SyncStatus.RUNNING]: 'info',
    [SyncStatus.QUEUED]: 'warning',
};
const CONNECTOR_STATUS: Record<ConnectorConfig['status'], { tone: Tone; key: string }> = {
    ACTIVE: { tone: 'success', key: 'dataplat.v2_conn_status_active' },
    PAUSED: { tone: 'neutral', key: 'dataplat.v2_conn_status_paused' },
    ERROR: { tone: 'danger', key: 'dataplat.v2_conn_status_error' },
};

const FIELD_LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-[var(--text-secondary)]';
const FIELD_INPUT_CLASS = 'ui-input w-full min-h-10';

const localDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const toTime = (iso?: string) => {
    const ms = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(ms) ? ms : null;
};

/* ---------------- Small pieces ---------------- */

const SyncStatusBadge: React.FC<{ status: SyncStatus; t: TFn }> = ({ status, t }) => (
    <StatusBadge tone={SYNC_STATUS_TONE[status] || 'neutral'}>{t(`data.status_${String(status).toLowerCase()}`)}</StatusBadge>
);

/** Tinted notice used inside the modal (theme-aware, no hardcoded light backgrounds). */
const Notice: React.FC<{ tone: Tone; title?: React.ReactNode; children?: React.ReactNode }> = ({ tone, title, children }) => (
    <div className="rounded-xl border border-l-4 bg-[var(--glass-surface)] p-3 text-xs text-[var(--text-secondary)]" style={{ borderColor: 'var(--glass-border)', borderLeftColor: TONE_COLOR[tone] }}>
        {title && <p className="font-semibold text-[var(--text-primary)]">{title}</p>}
        {children && <div className={title ? 'mt-1 leading-relaxed' : 'leading-relaxed'}>{children}</div>}
    </div>
);

const Field: React.FC<{ label: React.ReactNode; required?: boolean; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, required, htmlFor, hint, children }) => (
    <div>
        <label htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>
            {label}{required && <span className="ml-0.5" style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span>}
        </label>
        {children}
        {hint && <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
);

/* ---------------- Connector modal (create / update) ---------------- */

interface ConnectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<ConnectorConfig>, options?: { keepOpen?: boolean }) => Promise<any>;
    connectors?: ConnectorConfig[];
    currentUser?: any;
    /** Connector opened from its card; its type/name and non-secret config are prefilled. */
    editConnector?: ConnectorConfig | null;
    t: TFn;
}

const ConnectorModal: React.FC<ConnectorModalProps> = ({ isOpen, onClose, onSave, connectors = [], currentUser, editConnector, t }) => {
    const [form, setForm] = useState<AddConnectionForm>({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
    const [connecting, setConnecting] = useState(false);
    const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (editConnector) {
            // Secrets come back redacted from the API, so only plain values are prefilled.
            const plainConfig = Object.fromEntries(
                Object.entries(editConnector.config || {}).filter(([, v]) => typeof v === 'string' && v !== '[REDACTED]'),
            );
            setForm({ type: editConnector.type, name: editConnector.name, config: plainConfig });
        } else {
            setForm({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
        }
        setConnectionResult(null);
    }, [isOpen, editConnector]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !connecting) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, connecting, onClose]);

    if (!isOpen) return null;

    const handleConfigChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
        setConnectionResult(null);
    };
    const handleTypeChange = (value: ConnectionChoice) => {
        setForm(prev => ({ ...prev, type: value, name: '', config: {} }));
        setConnectionResult(null);
    };
    const socialConnection = SOCIAL_CONNECTIONS[form.type as SocialConnectionType];
    const isSocialConnection = Boolean(socialConnection);
    const editMatchesType = editConnector && editConnector.type === form.type ? editConnector : null;
    const existingConnector = editMatchesType || connectors.find(connector => connector.type === form.type);
    const ownerLabel = currentUser?.name || currentUser?.email || t('dataplat.v2_current_user');
    const configValue = (key: string) => String(form.config[key] || '');

    const handleApiConnect = async () => {
        if (!form.name.trim()) {
            setConnectionResult({ kind: 'error', title: t('dataplat.v2_result_missing_name_title'), message: t('dataplat.v2_result_missing_name_msg') });
            return;
        }
        setConnecting(true);
        setConnectionResult(null);
        try {
            const saved = await onSave({ ...form, id: existingConnector?.id }, { keepOpen: true });
            // Clear secrets from local state once they are stored server-side.
            setForm(prev => ({
                ...prev,
                config: Object.fromEntries(Object.entries(prev.config).map(([key, value]) =>
                    /token|secret|key|password/i.test(key) ? [key, ''] : [key, value],
                )),
            }));
            const check = saved?.id ? await db.checkConnectorConfig(saved.id) : null;
            const verified = check?.providerVerified === true;
            setConnectionResult({
                kind: verified ? 'connected' : 'not_ready',
                title: verified ? t('dataplat.v2_result_verified_title') : t('dataplat.v2_result_saved_title'),
                message: check?.message || t('dataplat.v2_result_saved_msg'),
            });
        } catch (error: any) {
            setConnectionResult({ kind: 'error', title: t('dataplat.v2_result_error_title'), message: error?.message || t('dataplat.v2_result_error_msg') });
        } finally {
            setConnecting(false);
        }
    };
    const handleStandardSave = () => {
        // handleCreate already shows the error toast; swallow the rethrow here.
        void onSave({ ...form, id: editMatchesType?.id }).catch(() => undefined);
    };

    const canSubmit = Boolean(form.name.trim()) && (REQUIRED_CONFIG_KEYS[form.type] || []).every(key => configValue(key).trim());
    const resultTone: Tone = connectionResult?.kind === 'connected' ? 'success' : connectionResult?.kind === 'error' ? 'danger' : 'warning';

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-enter" role="dialog" aria-modal="true" aria-labelledby="dataplat-modal-title">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
                    <div className="min-w-0">
                        <h3 id="dataplat-modal-title" className="text-base font-bold text-[var(--text-primary)]">{t('data.modal_title')}</h3>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t('data.modal_subtitle')}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('dataplat.v2_close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <span className={FIELD_LABEL_CLASS}>{t('data.type')}</span>
                        <Dropdown
                            value={form.type || ConnectorType.GOOGLE_SHEETS}
                            onChange={(v) => handleTypeChange(v as ConnectionChoice)}
                            options={CONNECTION_OPTIONS}
                        />
                    </div>
                    <Field label={t('data.name')} htmlFor="dataplat-name" required>
                        <input id="dataplat-name" className={FIELD_INPUT_CLASS} placeholder={t('data.name_placeholder')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </Field>

                    {existingConnector && (
                        <Notice tone="success" title={t('dataplat.v2_existing_title', { owner: ownerLabel })}>
                            {t('dataplat.v2_existing_msg', { name: existingConnector.name })}
                        </Notice>
                    )}

                    {isSocialConnection ? (
                        <div className="space-y-3">
                            <Notice tone="info" title={socialConnection.label}>
                                <p>{t(socialConnection.descKey)}</p>
                                <p className="mt-1.5 font-medium">{t('dataplat.v2_social_notice')}</p>
                            </Notice>
                            {form.type === ConnectorType.FACEBOOK_PAGE && (
                                <>
                                    <Field label={t('dataplat.v2_field_page_id')} htmlFor="dataplat-pageId" required>
                                        <input id="dataplat-pageId" className={FIELD_INPUT_CLASS} value={configValue('pageId')} onChange={e => handleConfigChange('pageId', e.target.value)} autoComplete="off" />
                                    </Field>
                                    <Field label={t('dataplat.v2_field_page_url')} htmlFor="dataplat-pageUrl">
                                        <input id="dataplat-pageUrl" className={FIELD_INPUT_CLASS} type="url" value={configValue('pageUrl')} onChange={e => handleConfigChange('pageUrl', e.target.value)} autoComplete="url" />
                                    </Field>
                                </>
                            )}
                            {form.type === ConnectorType.ZALO_OA && (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label={t('dataplat.v2_field_app_id')} htmlFor="dataplat-appId" required>
                                            <input id="dataplat-appId" className={FIELD_INPUT_CLASS} value={configValue('appId')} onChange={e => handleConfigChange('appId', e.target.value)} autoComplete="off" />
                                        </Field>
                                        <Field label={t('dataplat.v2_field_oa_id')} htmlFor="dataplat-oaId" required>
                                            <input id="dataplat-oaId" className={FIELD_INPUT_CLASS} value={configValue('oaId')} onChange={e => handleConfigChange('oaId', e.target.value)} autoComplete="off" />
                                        </Field>
                                    </div>
                                    <Field label={t('dataplat.v2_field_oa_name')} htmlFor="dataplat-oaName">
                                        <input id="dataplat-oaName" className={FIELD_INPUT_CLASS} value={configValue('oaName')} onChange={e => handleConfigChange('oaName', e.target.value)} autoComplete="organization" />
                                    </Field>
                                </>
                            )}
                            {form.type === ConnectorType.INSTAGRAM && (
                                <Field label={t('dataplat.v2_field_business_account_id')} htmlFor="dataplat-businessAccountId" required>
                                    <input id="dataplat-businessAccountId" className={FIELD_INPUT_CLASS} value={configValue('businessAccountId')} onChange={e => handleConfigChange('businessAccountId', e.target.value)} autoComplete="off" />
                                </Field>
                            )}
                            {form.type === ConnectorType.TIKTOK && (
                                <Field label={t('dataplat.v2_field_account_id')} htmlFor="dataplat-accountId" required>
                                    <input id="dataplat-accountId" className={FIELD_INPUT_CLASS} value={configValue('accountId')} onChange={e => handleConfigChange('accountId', e.target.value)} autoComplete="off" />
                                </Field>
                            )}
                            {form.type === ConnectorType.LINKEDIN_PAGE && (
                                <Field label={t('dataplat.v2_field_organization_id')} htmlFor="dataplat-organizationId" required>
                                    <input id="dataplat-organizationId" className={FIELD_INPUT_CLASS} value={configValue('organizationId')} onChange={e => handleConfigChange('organizationId', e.target.value)} autoComplete="off" />
                                </Field>
                            )}
                            <Field label={t('dataplat.v2_field_access_token')} htmlFor="dataplat-accessToken" required hint={t('dataplat.v2_token_hint')}>
                                <input id="dataplat-accessToken" type="password" className={FIELD_INPUT_CLASS} value={configValue('accessToken')} onChange={e => handleConfigChange('accessToken', e.target.value)} autoComplete="new-password" />
                            </Field>
                            {connectionResult && <Notice tone={resultTone} title={connectionResult.title}>{connectionResult.message}</Notice>}
                        </div>
                    ) : form.type === ConnectorType.GOOGLE_SHEETS && (
                        <Field
                            label={t('data.spreadsheet_id')}
                            htmlFor="dataplat-spreadsheetId"
                            required
                            hint={<><Info size={14} className="shrink-0 text-[var(--sgs-primary)]" aria-hidden="true" /> {t('data.hint_gsheet')}</>}
                        >
                            <input id="dataplat-spreadsheetId" className={`${FIELD_INPUT_CLASS} font-mono`} placeholder={t('data.spreadsheet_placeholder')} value={configValue('spreadsheetId')} onChange={e => handleConfigChange('spreadsheetId', e.target.value)} />
                        </Field>
                    )}

                    {form.type === ConnectorType.WEBHOOK_EXPORT && (
                        <>
                            <Field label={t('data.target_url')} htmlFor="dataplat-targetUrl" required>
                                <input id="dataplat-targetUrl" className={`${FIELD_INPUT_CLASS} font-mono`} placeholder={t('data.webhook_placeholder')} value={configValue('targetUrl')} onChange={e => handleConfigChange('targetUrl', e.target.value)} />
                            </Field>
                            <Field label={<>{t('dataplat.v2_field_webhook_secret')} <span className="font-normal text-[var(--text-tertiary)]">{t('dataplat.v2_optional')}</span></>} htmlFor="dataplat-secret">
                                <input id="dataplat-secret" type="password" className={FIELD_INPUT_CLASS} placeholder={t('dataplat.v2_secret_placeholder')} value={configValue('secret')} onChange={e => handleConfigChange('secret', e.target.value)} autoComplete="new-password" />
                            </Field>
                        </>
                    )}

                    {(form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE || form.type === ConnectorType.ZOHO_CRM) && (
                        <Field label={t('data.api_key')} htmlFor="dataplat-apiKey" required>
                            <input id="dataplat-apiKey" type="password" className={`${FIELD_INPUT_CLASS} font-mono`} placeholder={t('data.api_key_placeholder')} value={configValue('apiKey')} onChange={e => handleConfigChange('apiKey', e.target.value)} autoComplete="new-password" />
                        </Field>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[var(--glass-border)] px-5 py-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="ui-button ui-button-secondary ui-button-md min-h-10">{t('common.cancel')}</button>
                    {isSocialConnection ? (
                        <button type="button" onClick={() => void handleApiConnect()} disabled={connecting || !canSubmit} className="ui-button ui-button-primary ui-button-md min-h-10">
                            {connecting && <RefreshCw size={14} className="animate-spin" aria-hidden="true" />}
                            {connecting ? t('dataplat.v2_connecting') : t('dataplat.v2_save_and_check')}
                        </button>
                    ) : (
                        <button type="button" onClick={handleStandardSave} disabled={!canSubmit} className="ui-button ui-button-primary ui-button-md min-h-10">
                            {t('common.save')}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

/* ---------------- Page ---------------- */

export const DataPlatform: React.FC = () => {
    const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
    const [orphanedConnectors, setOrphanedConnectors] = useState<ConnectorConfig[]>([]);
    const [activeMembers, setActiveMembers] = useState<Array<{ id: string; name: string; email?: string }>>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [assignmentTarget, setAssignmentTarget] = useState<Record<string, string>>({});
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editConnector, setEditConnector] = useState<ConnectorConfig | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [checkResults, setCheckResults] = useState<Record<string, { ok: boolean; status: string; message: string }>>({});
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { t, language, formatDateTime, formatTime } = useTranslation();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    const num = (n: number) => n.toLocaleString(locale);
    const dash = '—';

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const user = await db.getCurrentUser();
            const canReassign = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
            const [c, j, orphaned, members] = await Promise.all([
                db.getConnectorConfigs(),
                db.getSyncJobs(),
                canReassign ? db.getOrphanedConnectorConfigs() : Promise.resolve([]),
                canReassign ? userApi.getMembers(200) : Promise.resolve({ data: [] }),
            ]);
            setCurrentUser(user);
            setConnectors(c || []);
            setJobs(j || []);
            setOrphanedConnectors(orphaned || []);
            setActiveMembers(members?.data || []);
            setLoadFailed(false);
        } catch {
            // Keep the last known data; tiles fall back to '—' and a retry notice is shown.
            setLoadFailed(true);
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }, []);
    useEffect(() => { fetchData(); }, [fetchData]);

    const openCreate = () => { setEditConnector(null); setIsModalOpen(true); };
    const openEdit = (connector: ConnectorConfig) => { setEditConnector(connector); setIsModalOpen(true); };
    const closeModal = useCallback(() => { setIsModalOpen(false); setEditConnector(null); }, []);

    const handleCreate = async (data: Partial<ConnectorConfig>, options?: { keepOpen?: boolean }) => {
        try {
            await connectorService.validateConnection(data.type!, data.config, t);
            const saved = data.id
                ? await db.saveConnectorConfig(data.id, data)
                : await db.createConnectorConfig(data);
            notify(t('data.create_success'), 'success');
            if (!options?.keepOpen) closeModal();
            await fetchData();
            return saved;
        } catch (e: any) {
            notify(e.message, 'error');
            throw e;
        }
    };
    const handleDeleteConnector = async () => {
        if (!deleteConfirmId) return;
        try {
            await db.deleteConnectorConfig(deleteConfirmId);
            setConnectors(prev => prev.filter(c => c.id !== deleteConfirmId));
            notify(t('data.delete_success'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setDeleteConfirmId(null);
        }
    };
    const handleSync = async (id: string) => {
        setSyncingId(id);
        notify(t('data.sync_started'), 'success');
        try {
            await connectorService.runSync(id);
            // Give server-side async sync time to process before refreshing
            await new Promise(r => setTimeout(r, 2500));
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setSyncingId(null);
        }
    };
    const handleCheck = async (id: string) => {
        setCheckingId(id);
        try {
            const result = await db.checkConnectorConfig(id);
            setCheckResults(prev => ({ ...prev, [id]: result }));
            notify(result.message, result.ok ? 'success' : 'error');
        } catch (e: any) {
            notify(e.message || t('dataplat.v2_check_error'), 'error');
        } finally {
            setCheckingId(null);
        }
    };
    const handleReassign = async (connectorId: string) => {
        const ownerUserId = assignmentTarget[connectorId];
        if (!ownerUserId) {
            notify(t('data.reassign_select_user'), 'error');
            return;
        }
        setAssigningId(connectorId);
        try {
            await db.reassignConnectorOwner(connectorId, ownerUserId);
            setOrphanedConnectors(prev => prev.filter(connector => connector.id !== connectorId));
            setAssignmentTarget(prev => {
                const next = { ...prev };
                delete next[connectorId];
                return next;
            });
            notify(t('data.reassign_success'), 'success');
        } catch (e: any) {
            notify(e.message || t('data.reassign_error'), 'error');
        } finally {
            setAssigningId(null);
        }
    };

    const typeLabel = (type: ConnectorType) => {
        const key = `data.type_${type}`;
        const label = t(key);
        return label === key ? CONNECTION_LABELS[type] || type : label;
    };
    const getSyncDisplay = (connector: ConnectorConfig) => {
        const latestJob = jobs.find(job => job.connectorId === connector.id);
        if (!latestJob) {
            return { status: connector.lastSyncStatus, at: connector.lastSyncAt };
        }
        const isTerminal = latestJob.status === SyncStatus.COMPLETED || latestJob.status === SyncStatus.FAILED;
        return {
            status: latestJob.status,
            at: (isTerminal && latestJob.finishedAt) || latestJob.startedAt || connector.lastSyncAt,
        };
    };

    /* ---- Derived metrics (only from loaded connectors and jobs) ---- */
    const hasData = loaded && !loadFailed;
    const totalConnectors = connectors.length;
    const activeCount = connectors.filter(c => c.status === 'ACTIVE').length;
    const pausedCount = connectors.filter(c => c.status === 'PAUSED').length;
    const errorConnectorCount = connectors.filter(c => c.status === 'ERROR').length;
    const activePct = hasData && totalConnectors > 0 ? Math.round((activeCount / totalConnectors) * 100) : null;

    const statusCounts = useMemo(() => {
        const counts: Record<SyncStatus, number> = { [SyncStatus.COMPLETED]: 0, [SyncStatus.FAILED]: 0, [SyncStatus.RUNNING]: 0, [SyncStatus.QUEUED]: 0 };
        for (const job of jobs) if (counts[job.status] != null) counts[job.status] += 1;
        return counts;
    }, [jobs]);
    const finishedCount = statusCounts[SyncStatus.COMPLETED] + statusCounts[SyncStatus.FAILED];
    const successPct = hasData && finishedCount > 0 ? Math.round((statusCounts[SyncStatus.COMPLETED] / finishedCount) * 100) : null;
    const recordsTotal = jobs.reduce((s, j) => s + (Number(j.recordsProcessed) || 0), 0);
    const jobsTruncated = jobs.length >= JOBS_PAGE_LIMIT;

    const lastJob = useMemo(() => {
        let best: SyncJob | undefined;
        for (const job of jobs) {
            const tm = toTime(job.startedAt);
            if (tm != null && (!best || tm > (toTime(best.startedAt) ?? 0))) best = job;
        }
        return best;
    }, [jobs]);

    // Syncs per day for the last TREND_DAYS days. When the API returned a full page, days older
    // than the oldest loaded job are unknown (null), not zero.
    const trendPoints: TrendPoint[] = useMemo(() => {
        if (!jobs.length) return [];
        const byDay = new Map<string, number>();
        let oldest: number | null = null;
        for (const job of jobs) {
            const tm = toTime(job.startedAt);
            if (tm == null) continue;
            oldest = oldest == null ? tm : Math.min(oldest, tm);
            const k = localDayKey(new Date(tm));
            byDay.set(k, (byDay.get(k) ?? 0) + 1);
        }
        const coverageStart = jobsTruncated && oldest != null
            ? new Date(new Date(oldest).getFullYear(), new Date(oldest).getMonth(), new Date(oldest).getDate()).getTime()
            : null;
        const today = new Date();
        const out: TrendPoint[] = [];
        for (let i = TREND_DAYS - 1; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const known = coverageStart == null || d.getTime() >= coverageStart;
            out.push({
                label: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
                value: known ? byDay.get(localDayKey(d)) ?? 0 : null,
            });
        }
        return out;
    }, [jobs, jobsTruncated, locale]);
    const trendKnown = trendPoints.filter(p => p.value != null).map(p => p.value as number);
    const trendSum = trendKnown.reduce((s, v) => s + v, 0);

    const statusSegments: Segment[] = [
        { label: t('data.status_completed'), value: statusCounts[SyncStatus.COMPLETED], color: TONE_COLOR.success },
        { label: t('data.status_failed'), value: statusCounts[SyncStatus.FAILED], color: TONE_COLOR.danger },
        { label: t('data.status_running'), value: statusCounts[SyncStatus.RUNNING], color: TONE_COLOR.info },
        { label: t('data.status_queued'), value: statusCounts[SyncStatus.QUEUED], color: TONE_COLOR.warning },
    ];

    const formatDuration = (job: SyncJob) => {
        const start = toTime(job.startedAt);
        const end = toTime(job.finishedAt);
        if (start == null || end == null || end < start) return null;
        const secs = Math.round((end - start) / 1000);
        return secs < 60 ? t('dataplat.v2_duration_seconds', { n: num(secs) }) : t('dataplat.v2_duration_minutes', { n: num(Math.round(secs / 60)) });
    };

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role);
    const connectorName = (id: string) => connectors.find(c => c.id === id)?.name;
    const deleteTargetName = deleteConfirmId ? connectorName(deleteConfirmId) : undefined;

    if (loading && !loaded) {
        return (
            <SettingsPage>
                <div className="space-y-5" aria-busy="true" aria-label={t('common.loading')}>
                    <div className="h-14 animate-pulse rounded-2xl bg-[var(--glass-surface)]" />
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--glass-surface)]" />)}
                    </div>
                    <div className="h-64 animate-pulse rounded-2xl bg-[var(--glass-surface)]" />
                </div>
            </SettingsPage>
        );
    }

    return (
        <>
            <SeoHead title={t('dataplat.v2_seo_title')} description={t('dataplat.v2_seo_description')} canonicalPath="/data-platform" />
            <SettingsPage>
                <SettingsHeader
                    icon={<Database size={20} />}
                    title={t('data.title')}
                    description={t('data.subtitle')}
                    meta={errorConnectorCount > 0 ? <StatusBadge tone="danger">{t('dataplat.v2_error_badge', { n: num(errorConnectorCount) })}</StatusBadge> : undefined}
                    actions={
                        <>
                            <button type="button" onClick={() => void fetchData()} disabled={loading} className="ui-button ui-button-secondary ui-button-md min-h-10">
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                                {t('dataplat.v2_refresh')}
                            </button>
                            <button type="button" onClick={openCreate} className="ui-button ui-button-primary ui-button-md min-h-10">
                                <Plus size={14} aria-hidden="true" />
                                {t('data.btn_new')}
                            </button>
                        </>
                    }
                />

                {loadFailed && (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-l-4 border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]" style={{ borderLeftColor: TONE_COLOR.danger }}>
                        <span>{t('dataplat.v2_load_error')}</span>
                        <button type="button" onClick={() => void fetchData()} className="ui-button ui-button-secondary ui-button-sm min-h-10">{t('dataplat.v2_retry')}</button>
                    </div>
                )}

                {/* KPI tiles */}
                <StatGrid cols={4}>
                    <StatTile
                        label={t('dataplat.v2_kpi_active')}
                        value={hasData ? `${num(activeCount)}/${num(totalConnectors)}` : dash}
                        tone={hasData && activeCount > 0 ? 'success' : 'neutral'}
                        hint={hasData
                            ? totalConnectors > 0
                                ? t('dataplat.v2_kpi_active_hint', { paused: num(pausedCount), error: num(errorConnectorCount) })
                                : t('data.empty_connectors')
                            : undefined}
                        visual={
                            <DashboardMetricRing
                                value={activePct}
                                label={activePct != null ? t('dataplat.v2_kpi_active_ring', { n: activePct }) : t('dataplat.v2_no_data')}
                                color={TONE_COLOR.success}
                                size={48}
                            />
                        }
                    />
                    <StatTile
                        label={t('dataplat.v2_kpi_success')}
                        value={successPct != null ? `${successPct}%` : dash}
                        tone={successPct == null ? 'neutral' : successPct >= 90 ? 'success' : successPct >= 60 ? 'warning' : 'danger'}
                        hint={hasData && finishedCount > 0
                            ? t('dataplat.v2_kpi_success_hint', { ok: num(statusCounts[SyncStatus.COMPLETED]), n: num(finishedCount) })
                            : hasData ? t('dataplat.v2_kpi_success_none') : undefined}
                        visual={
                            <DashboardMetricRing
                                value={successPct}
                                label={successPct != null ? t('dataplat.v2_kpi_success_ring', { n: successPct }) : t('dataplat.v2_no_data')}
                                color={successPct != null && successPct < 60 ? TONE_COLOR.danger : TONE_COLOR.success}
                                size={48}
                            />
                        }
                    />
                    <StatTile
                        label={t('dataplat.v2_kpi_last_sync')}
                        value={!hasData ? dash : lastJob ? formatTime(lastJob.startedAt) : t('data.never')}
                        hint={lastJob && hasData ? (
                            <span className="flex flex-wrap items-center gap-1.5">
                                <SyncStatusBadge status={lastJob.status} t={t} />
                                <span>{formatDateTime(lastJob.startedAt)}</span>
                            </span>
                        ) : undefined}
                    />
                    <StatTile
                        label={t('dataplat.v2_kpi_records')}
                        value={hasData && jobs.length > 0 ? num(recordsTotal) : dash}
                        hint={hasData && jobs.length > 0 ? t('dataplat.v2_kpi_records_hint', { n: num(jobs.length) }) : undefined}
                        visual={
                            <Sparkline
                                values={trendKnown.slice(-7)}
                                width={64}
                                height={28}
                                color={TONE_COLOR.brand}
                                ariaLabel={t('dataplat.v2_kpi_spark')}
                            />
                        }
                    />
                </StatGrid>

                {/* Connectors */}
                <SettingsCard
                    title={t('dataplat.v2_connectors_title')}
                    description={hasData && totalConnectors > 0 ? t('dataplat.v2_connectors_desc', { n: num(totalConnectors), active: num(activeCount) }) : undefined}
                    actions={totalConnectors > 0 ? (
                        <button type="button" onClick={openCreate} className="ui-button ui-button-secondary ui-button-sm min-h-10">
                            <Plus size={14} aria-hidden="true" />
                            {t('data.btn_new')}
                        </button>
                    ) : undefined}
                >
                    {totalConnectors === 0 ? (
                        <EmptyState
                            icon={<Plug size={20} />}
                            title={t('data.empty_connectors')}
                            description={t('data.empty_connectors_hint')}
                            action={
                                <button type="button" onClick={openCreate} className="ui-button ui-button-primary ui-button-md min-h-10">
                                    <Plus size={14} aria-hidden="true" />
                                    {t('data.btn_new')}
                                </button>
                            }
                        />
                    ) : (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {connectors.map(c => {
                                const sync = getSyncDisplay(c);
                                const status = CONNECTOR_STATUS[c.status] || CONNECTOR_STATUS.PAUSED;
                                const check = checkResults[c.id];
                                const syncable = !isSocialType(c.type);
                                return (
                                    <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--sgs-primary)]" aria-hidden="true">
                                                {connectorIcon(c.type)}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">{c.name}</h4>
                                                    <StatusBadge tone={status.tone}>{t(status.key)}</StatusBadge>
                                                </div>
                                                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{typeLabel(c.type)}</p>
                                            </div>
                                        </div>

                                        <dl className="space-y-1.5 text-xs">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <dt className="text-[var(--text-tertiary)]">{t('dataplat.v2_last_sync')}</dt>
                                                <dd className="flex flex-wrap items-center gap-1.5 text-[var(--text-secondary)]">
                                                    {sync.status ? <SyncStatusBadge status={sync.status} t={t} /> : <span>{t('data.never')}</span>}
                                                    {sync.at && (
                                                        <span className="flex items-center gap-1" title={formatDateTime(sync.at)}>
                                                            <Clock size={12} aria-hidden="true" />
                                                            {formatTime(sync.at)}
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                            {check && (
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <dt className="text-[var(--text-tertiary)]">{t('dataplat.v2_config_check')}</dt>
                                                    <dd>
                                                        <StatusBadge tone={check.ok ? 'success' : 'danger'}>
                                                            {check.status === 'CONFIGURED' ? t('dataplat.v2_check_ok') : t('dataplat.v2_check_fix')}
                                                        </StatusBadge>
                                                    </dd>
                                                </div>
                                            )}
                                            {!syncable && (
                                                <p className="text-[var(--text-tertiary)]">{t('dataplat.v2_no_sync_adapter')}</p>
                                            )}
                                        </dl>

                                        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] pt-3">
                                            {syncable && (
                                                <button type="button" onClick={() => handleSync(c.id)} disabled={syncingId === c.id} className="ui-button ui-button-primary ui-button-sm min-h-10">
                                                    <RefreshCw size={14} className={syncingId === c.id ? 'animate-spin' : ''} aria-hidden="true" />
                                                    {t('data.sync_now')}
                                                </button>
                                            )}
                                            <button type="button" onClick={() => void handleCheck(c.id)} disabled={checkingId === c.id} className="ui-button ui-button-secondary ui-button-sm min-h-10" title={t('dataplat.v2_check_title')}>
                                                <ShieldCheck size={14} className={checkingId === c.id ? 'animate-pulse' : ''} aria-hidden="true" />
                                                {t('dataplat.v2_check')}
                                            </button>
                                            <div className="ml-auto flex items-center gap-1">
                                                <button type="button" onClick={() => openEdit(c)} aria-label={t('dataplat.v2_edit_aria', { name: c.name })} title={t('dataplat.v2_edit')} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]">
                                                    <Pencil size={16} aria-hidden="true" />
                                                </button>
                                                <button type="button" onClick={() => setDeleteConfirmId(c.id)} aria-label={t('dataplat.v2_delete_aria', { name: c.name })} title={t('common.delete')} className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]" style={{ color: TONE_COLOR.danger }}>
                                                    <Trash2 size={16} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SettingsCard>

                {/* Unassigned connectors (tenant admins only) */}
                {isAdmin && orphanedConnectors.length > 0 && (
                    <SettingsCard
                        title={t('data.orphaned_connectors')}
                        description={t('data.orphaned_connectors_hint')}
                        actions={<StatusBadge tone="warning">{num(orphanedConnectors.length)}</StatusBadge>}
                    >
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {orphanedConnectors.map(connector => (
                                <li key={connector.id} className="flex flex-col gap-3 rounded-xl border border-l-4 border-[var(--glass-border)] bg-[var(--glass-surface)] p-4" style={{ borderLeftColor: TONE_COLOR.warning }}>
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)]" aria-hidden="true">
                                            {connectorIcon(connector.type)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate text-sm font-semibold text-[var(--text-primary)]">{connector.name}</h4>
                                            <p className="text-xs text-[var(--text-tertiary)]">{typeLabel(connector.type)}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                {connector.lastSyncStatus ? <SyncStatusBadge status={connector.lastSyncStatus} t={t} /> : <span>{t('data.never')}</span>}
                                                {connector.lastSyncAt && (
                                                    <span className="flex items-center gap-1" title={formatDateTime(connector.lastSyncAt)}>
                                                        <Clock size={12} aria-hidden="true" />
                                                        {formatTime(connector.lastSyncAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <select
                                            value={assignmentTarget[connector.id] || ''}
                                            onChange={event => setAssignmentTarget(prev => ({ ...prev, [connector.id]: event.target.value }))}
                                            className="ui-input min-h-10 min-w-0 flex-1 text-xs"
                                            aria-label={t('data.reassign_user')}
                                        >
                                            <option value="">{t('data.reassign_select_user')}</option>
                                            {activeMembers.map(member => (
                                                <option key={member.id} value={member.id}>
                                                    {member.name}{member.email ? ` (${member.email})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => void handleReassign(connector.id)}
                                            disabled={!assignmentTarget[connector.id] || assigningId === connector.id}
                                            className="ui-button ui-button-primary ui-button-sm min-h-10 shrink-0"
                                        >
                                            <UserPlus size={14} aria-hidden="true" />
                                            {assigningId === connector.id ? t('common.loading') : t('data.reassign_owner')}
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </SettingsCard>
                )}

                {/* Sync activity */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SettingsCard
                        className="lg:col-span-2"
                        title={t('dataplat.v2_trend_title', { n: TREND_DAYS })}
                        description={trendPoints.length
                            ? jobsTruncated
                                ? t('dataplat.v2_trend_desc_partial', { n: num(trendSum), limit: num(jobs.length) })
                                : t('dataplat.v2_trend_desc', { n: num(trendSum) })
                            : undefined}
                    >
                        <TrendBars
                            points={trendPoints}
                            ariaLabel={t('dataplat.v2_trend_aria', { days: TREND_DAYS, n: num(trendSum) })}
                            formatValue={n => t('dataplat.v2_syncs_count', { n: num(n) })}
                            emptyText={hasData ? t('data.empty_jobs') : t('dataplat.v2_no_data')}
                            height={112}
                        />
                    </SettingsCard>
                    <SettingsCard
                        title={t('dataplat.v2_status_title')}
                        description={hasData && jobs.length > 0 ? t('dataplat.v2_status_desc', { n: num(jobs.length) }) : undefined}
                    >
                        <DistributionBar
                            segments={statusSegments}
                            ariaLabel={t('dataplat.v2_status_aria')}
                            formatValue={num}
                            emptyText={hasData ? t('data.empty_jobs') : t('dataplat.v2_no_data')}
                        />
                    </SettingsCard>
                </div>

                {/* Sync history */}
                <SettingsCard
                    title={t('data.sync_history')}
                    description={jobs.length > 0 ? t('dataplat.v2_history_desc', { n: num(jobs.length) }) : undefined}
                    bodyClassName="p-0 sm:p-0"
                >
                    {jobs.length === 0 ? (
                        <EmptyState icon={<ClipboardList size={20} />} title={t('data.empty_jobs')} description={t('data.empty_jobs_hint')} />
                    ) : (
                        <ul className="max-h-[480px] divide-y divide-[var(--glass-border)] overflow-y-auto overscroll-contain" aria-label={t('data.sync_history')}>
                            {jobs.map(job => {
                                const connector = connectors.find(c => c.id === job.connectorId);
                                const duration = formatDuration(job);
                                const firstError = job.status === SyncStatus.FAILED && Array.isArray(job.errors) ? job.errors[job.errors.length - 1] : undefined;
                                return (
                                    <li key={job.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--glass-surface)] text-[var(--text-secondary)]" aria-hidden="true">
                                                {connector ? connectorIcon(connector.type) : FALLBACK_ICON}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{connector?.name || t('data.unknown')}</div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-tertiary)]">
                                                    <span className="flex items-center gap-1" title={formatDateTime(job.startedAt)}>
                                                        <Clock size={12} aria-hidden="true" />
                                                        {formatDateTime(job.startedAt)}
                                                    </span>
                                                    {duration && <span>· {duration}</span>}
                                                    {job.retryCount > 0 && <span>· {t('dataplat.v2_retries', { n: num(job.retryCount) })}</span>}
                                                </div>
                                                {firstError && <p className="mt-1 line-clamp-2 text-xs" style={{ color: TONE_COLOR.danger }}>{firstError}</p>}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
                                            <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                                                {job.recordsProcessed > 0 ? `${num(job.recordsProcessed)} ${t('table.records')}` : dash}
                                            </span>
                                            <SyncStatusBadge status={job.status} t={t} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SettingsCard>

                <ConnectorModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={handleCreate}
                    connectors={connectors}
                    currentUser={currentUser}
                    editConnector={editConnector}
                    t={t}
                />
                <ConfirmModal
                    isOpen={!!deleteConfirmId}
                    title={t('common.delete')}
                    message={deleteTargetName ? t('dataplat.v2_confirm_delete_named', { name: deleteTargetName }) : t('data.confirm_delete')}
                    confirmLabel={t('common.delete')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={handleDeleteConnector}
                    onCancel={() => setDeleteConfirmId(null)}
                    variant="danger"
                />
            </SettingsPage>
            {createPortal(
                toast ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className={`fixed bottom-6 left-4 right-4 z-[200] flex items-center gap-3 rounded-xl border px-5 py-3 text-white shadow-2xl sm:left-auto sm:right-6 ${toast.type === 'success' ? 'border-emerald-700 bg-emerald-900/95' : 'border-rose-700 bg-rose-900/95'}`}
                    >
                        <span className="text-sm" aria-hidden="true">{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span className="text-sm font-semibold">{toast.msg}</span>
                    </div>
                ) : null,
                document.body,
            )}
        </>
    );
};
