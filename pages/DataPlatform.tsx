import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ConnectorConfig, SyncJob, ConnectorType, SyncStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { connectorService } from '../services/connectorService';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import { userApi } from '../services/api/userApi';
const ICONS = {
    ADD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    SYNC: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    DB: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    PLUG: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    INFO: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01M11 12h1v4h1m7-4a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>,
    CLIPBOARD: <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5h6m-5-2h4a1 1 0 011 1v2H9V4a1 1 0 011-1zM7 5H5a1 1 0 00-1 1v13a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-2M8 11h8M8 15h5" /></svg>,
};
const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
    GOOGLE_SHEETS: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M8 8h8M8 12h8M8 16h8M12 8v8" /></svg>,
    HUBSPOT: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="14" r="3" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M10.5 12l5-5M16 4v3h3M11 14h8M19 12v4a3 3 0 11-3-3" /></svg>,
    ZOHO_CRM: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 6h16M4 12h10M4 18h16M17 9l3 3-3 3" /></svg>,
    SALESFORCE: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 17a4 4 0 01-.5-7.97A5.5 5.5 0 0117 7.5a3.5 3.5 0 01.5 6.96A4 4 0 017 17z" /></svg>,
    WEBHOOK_EXPORT: <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10 13a5 5 0 007.07.07l1.42-1.42a5 5 0 00-7.07-7.07L10.6 5.4M14 11a5 5 0 00-7.07-.07L5.5 12.35a5 5 0 007.07 7.07l.82-.82" /></svg>,
};
type SocialConnectionType = Extract<ConnectorType, ConnectorType.FACEBOOK_PAGE | ConnectorType.ZALO_OA | ConnectorType.INSTAGRAM | ConnectorType.TIKTOK | ConnectorType.LINKEDIN_PAGE>;
type ConnectionChoice = ConnectorType;
type AddConnectionForm = { type: ConnectionChoice; name: string; config: Record<string, unknown> };
type ConnectionResult = {
    kind: 'connected' | 'ready' | 'not_ready' | 'error';
    title: string;
    message: string;
    reasonCode?: string;
    checks?: { oaId: string; quota: string };
};
const SOCIAL_CONNECTIONS: Record<SocialConnectionType, { label: string; description: string }> = {
    FACEBOOK_PAGE: {
        label: 'Facebook Page',
        description: 'Lưu Page ID và Page Access Token riêng cho user đang đăng nhập.',
    },
    ZALO_OA: {
        label: 'Zalo OA',
        description: 'Lưu App/OA định danh và Access Token riêng cho user đang đăng nhập.',
    },
    INSTAGRAM: {
        label: 'Instagram Business',
        description: 'Lưu Business Account ID và Access Token riêng cho user đang đăng nhập.',
    },
    TIKTOK: {
        label: 'TikTok Business',
        description: 'Lưu Account ID và Access Token riêng cho user đang đăng nhập.',
    },
    LINKEDIN_PAGE: {
        label: 'LinkedIn Page',
        description: 'Lưu Organization ID và Access Token riêng cho user đang đăng nhập.',
    },
};
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
const SOCIAL_CONNECTION_ICON = <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3" strokeWidth={1.7} /><circle cx="16" cy="7" r="3" strokeWidth={1.7} /><circle cx="16" cy="17" r="3" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M10.5 10.5l3-2M10.5 13.5l3 2" /></svg>;
const FIELD_LABEL_CLASS = 'text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5';
const FIELD_INPUT_CLASS = 'w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all';
const CONNECTION_OPTIONS = [
    ...Object.values(ConnectorType).map(value => ({
        value: value as ConnectionChoice,
        label: CONNECTION_LABELS[value],
        icon: CONNECTOR_ICONS[value] || (SOCIAL_CONNECTIONS[value as SocialConnectionType] ? SOCIAL_CONNECTION_ICON : ICONS.INFO),
    })),
];
const ConnectorModal = ({ isOpen, onClose, onSave, connectors = [], currentUser, t }: any) => {
    const [form, setForm] = useState<AddConnectionForm>({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
    const [connecting, setConnecting] = useState(false);
    const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
    useEffect(() => {
        if (isOpen) {
            setForm({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
            setConnectionResult(null);
        }
    }, [isOpen]);
    if (!isOpen) return null;

    const handleConfigChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
        setConnectionResult(null);
    };
    const socialConnection = SOCIAL_CONNECTIONS[form.type as SocialConnectionType];
    const isSocialConnection = Boolean(socialConnection);
    const handleTypeChange = (value: ConnectionChoice) => {
        setForm(prev => ({ ...prev, type: value, name: '', config: {} }));
        setConnectionResult(null);
    };
    const existingConnector = connectors.find((connector: ConnectorConfig) => connector.type === form.type);
    const ownerLabel = currentUser?.name || currentUser?.email || 'user hiện tại';
    const handleApiConnect = async () => {
        if (!form.name.trim()) {
            setConnectionResult({ kind: 'error', title: 'Thiếu tên kết nối', message: 'Hãy đặt tên để nhận diện kết nối của user hiện tại.' });
            return;
        }
        setConnecting(true);
        setConnectionResult(null);
        try {
            const saved = await onSave({ ...form, id: existingConnector?.id }, { keepOpen: true });
            setForm(prev => ({
                ...prev,
                config: Object.fromEntries(Object.entries(prev.config).map(([key, value]) =>
                    /token|secret|key|password/i.test(key) ? [key, ''] : [key, value],
                )),
            }));
            const check = saved?.id ? await db.checkConnectorConfig(saved.id) : null;
            setConnectionResult({
                kind: check?.providerVerified === true ? 'connected' : 'not_ready',
                title: check?.providerVerified === true ? 'Đã xác minh kết nối cho user hiện tại' : 'Đã lưu cấu hình, chưa live verify',
                message: check?.message || 'Credential đã được lưu riêng cho user hiện tại. Provider live verification chưa được bật cho loại kết nối này.',
            });
        } catch (error: any) {
            setConnectionResult({ kind: 'error', title: 'Không thể lưu kết nối', message: error?.message || 'Vui lòng kiểm tra lại cấu hình API.' });
        } finally {
            setConnecting(false);
        }
    };
    const requiredConfigKeys: Record<string, string[]> = {
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
    const canSubmit = Boolean(form.name.trim()) && (requiredConfigKeys[form.type] || []).every(key => String(form.config[key] || '').trim());
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-enter">
            <div className="bg-[var(--bg-surface)] w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[24px] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-[var(--glass-border)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('data.modal_title')}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('data.modal_subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors">{ICONS.CLOSE}</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.type')}</label>
                        <Dropdown
                            value={form.type || ConnectorType.GOOGLE_SHEETS}
                            onChange={(v) => handleTypeChange(v as ConnectionChoice)}
                            options={CONNECTION_OPTIONS}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.name')}</label>
                        <input
                            className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                            placeholder={t('data.name_placeholder')}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    {existingConnector && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
                            <p className="font-bold">Đã lưu cấu hình của {ownerLabel}</p>
                            <p className="mt-1">Tên: {existingConnector.name}. Chưa coi là live connected khi provider chưa xác minh; credential không được hiển thị lại.</p>
                        </div>
                    )}
                    {isSocialConnection ? (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                                <p className="text-sm font-bold text-indigo-950">{socialConnection.label}</p>
                                <p className="mt-1 text-xs leading-5 text-indigo-900/75">{socialConnection.description}</p>
                                <p className="mt-2 text-[11px] font-semibold text-indigo-800">
                                    Đây là form credential theo user, không phải OAuth giả lập. Hệ thống chỉ báo đã lưu cấu hình nếu provider chưa có live adapter.
                                </p>
                            </div>
                            {form.type === ConnectorType.FACEBOOK_PAGE && (
                                <>
                                    <div>
                                        <label className={FIELD_LABEL_CLASS}>Page ID <span className="text-rose-500">*</span></label>
                                        <input className={FIELD_INPUT_CLASS} value={String(form.config.pageId || '')} onChange={e => handleConfigChange('pageId', e.target.value)} autoComplete="off" />
                                    </div>
                                    <div>
                                        <label className={FIELD_LABEL_CLASS}>Page URL</label>
                                        <input className={FIELD_INPUT_CLASS} type="url" value={String(form.config.pageUrl || '')} onChange={e => handleConfigChange('pageUrl', e.target.value)} autoComplete="url" />
                                    </div>
                                </>
                            )}
                            {form.type === ConnectorType.ZALO_OA && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className={FIELD_LABEL_CLASS}>App ID <span className="text-rose-500">*</span></label>
                                        <input className={FIELD_INPUT_CLASS} value={String(form.config.appId || '')} onChange={e => handleConfigChange('appId', e.target.value)} autoComplete="off" />
                                    </div>
                                    <div>
                                        <label className={FIELD_LABEL_CLASS}>OA ID <span className="text-rose-500">*</span></label>
                                        <input className={FIELD_INPUT_CLASS} value={String(form.config.oaId || '')} onChange={e => handleConfigChange('oaId', e.target.value)} autoComplete="off" />
                                    </div>
                                </div>
                            )}
                            {form.type === ConnectorType.INSTAGRAM && (
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>Business Account ID <span className="text-rose-500">*</span></label>
                                    <input className={FIELD_INPUT_CLASS} value={String(form.config.businessAccountId || '')} onChange={e => handleConfigChange('businessAccountId', e.target.value)} autoComplete="off" />
                                </div>
                            )}
                            {form.type === ConnectorType.TIKTOK && (
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>Business/Account ID <span className="text-rose-500">*</span></label>
                                    <input className={FIELD_INPUT_CLASS} value={String(form.config.accountId || '')} onChange={e => handleConfigChange('accountId', e.target.value)} autoComplete="off" />
                                </div>
                            )}
                            {form.type === ConnectorType.LINKEDIN_PAGE && (
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>Organization ID <span className="text-rose-500">*</span></label>
                                    <input className={FIELD_INPUT_CLASS} value={String(form.config.organizationId || '')} onChange={e => handleConfigChange('organizationId', e.target.value)} autoComplete="off" />
                                </div>
                            )}
                            {form.type === ConnectorType.ZALO_OA && (
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>OA name</label>
                                    <input className={FIELD_INPUT_CLASS} value={String(form.config.oaName || '')} onChange={e => handleConfigChange('oaName', e.target.value)} autoComplete="organization" />
                                </div>
                            )}
                            <div>
                                <label className={FIELD_LABEL_CLASS}>Access Token <span className="text-rose-500">*</span></label>
                                <input type="password" className={FIELD_INPUT_CLASS} value={String(form.config.accessToken || '')} onChange={e => handleConfigChange('accessToken', e.target.value)} autoComplete="new-password" />
                                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">Token chỉ gửi tới backend và không được trả lại trên trình duyệt.</p>
                            </div>
                            {connectionResult && <div className={`rounded-xl border p-3 text-xs ${connectionResult.kind === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : connectionResult.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}><p className="font-bold">{connectionResult.title}</p><p className="mt-1 leading-relaxed">{connectionResult.message}</p></div>}
                        </div>
                    ) : form.type === ConnectorType.GOOGLE_SHEETS && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.spreadsheet_id')}</label>
                            <input
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                placeholder={t('data.spreadsheet_placeholder')}
                                value={String(form.config?.spreadsheetId || '')}
                                onChange={e => handleConfigChange('spreadsheetId', e.target.value)}
                            />
                            <p className="text-xs text-[var(--text-secondary)] mt-1.5 flex items-center gap-1">
                                <span className="text-sgs-primary">{ICONS.INFO}</span> {t('data.hint_gsheet')}
                            </p>
                        </div>
                    )}
                    {form.type === ConnectorType.WEBHOOK_EXPORT && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.target_url')}</label>
                            <input
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                placeholder={t('data.webhook_placeholder')}
                                value={String(form.config?.targetUrl || '')}
                                onChange={e => handleConfigChange('targetUrl', e.target.value)}
                            />
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mt-3 mb-1.5">Webhook secret <span className="font-normal normal-case text-[var(--text-secondary)]">(tuỳ chọn)</span></label>
                            <input
                                type="password"
                                className={FIELD_INPUT_CLASS}
                                placeholder="Secret ký request"
                                value={String(form.config?.secret || '')}
                                onChange={e => handleConfigChange('secret', e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                    )}
                    {(form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE || form.type === ConnectorType.ZOHO_CRM) && (
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.api_key')}</label>
                            <input
                                type="password"
                                className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                placeholder={t('data.api_key_placeholder')}
                                value={String(form.config?.apiKey || '')}
                                onChange={e => handleConfigChange('apiKey', e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6">
                    {isSocialConnection ? (
                        <button
                            onClick={() => void handleApiConnect()}
                            disabled={connecting || !canSubmit}
                            className="w-full py-3 bg-indigo-700 text-white font-bold rounded-xl hover:bg-indigo-800 shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {connecting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {connecting ? 'Đang lưu và kiểm tra…' : 'Mở cài đặt và kiểm tra'}
                        </button>
                    ) : (
                        <button
                            onClick={() => onSave(form)}
                            disabled={!canSubmit}
                            className="w-full py-3 bg-sgs-primary-deep text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('common.save')}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
const StatusBadge = ({ status, t }: { status: SyncStatus; t: any }) => {
    const styles: Record<string, string> = {
        [SyncStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        [SyncStatus.FAILED]: 'bg-rose-50 text-rose-700 border-rose-200',
        [SyncStatus.RUNNING]: 'bg-blue-50 text-blue-700 border-blue-200',
        [SyncStatus.QUEUED]: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
            {t(`data.status_${status.toLowerCase()}`)}
        </span>
    );
};
export const DataPlatform: React.FC = () => {
    const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
    const [orphanedConnectors, setOrphanedConnectors] = useState<ConnectorConfig[]>([]);
    const [activeMembers, setActiveMembers] = useState<Array<{ id: string; name: string; email?: string }>>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [assignmentTarget, setAssignmentTarget] = useState<Record<string, string>>({});
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [checkResults, setCheckResults] = useState<Record<string, { ok: boolean; status: string; message: string }>>({});
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { t, formatDateTime } = useTranslation();
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
        } catch {
            // silent — UI stays with empty state
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { fetchData(); }, [fetchData]);
    const handleCreate = async (data: Partial<ConnectorConfig>, options?: { keepOpen?: boolean }) => {
        try {
            await connectorService.validateConnection(data.type!, data.config, t);
            const saved = data.id
                ? await db.saveConnectorConfig(data.id, data)
                : await db.createConnectorConfig(data);
            notify(t('data.create_success'), 'success');
            if (!options?.keepOpen) setIsModalOpen(false);
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
            notify(e.message || 'Không thể kiểm tra connector', 'error');
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
    const activeCount = connectors.filter(c => c.status === 'ACTIVE').length;
    const lastJob = jobs[0];
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
    if (loading) {
        return (
                        <div className="p-4 sm:p-6 space-y-6 animate-enter">
                <div className="h-20 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-64 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                    <div className="h-64 bg-[var(--glass-surface)] rounded-[20px] animate-pulse" />
                </div>
            </div>
        );
    }
    return (
        <>
          <SeoHead title="Nền Tảng Dữ Liệu | SGS LAND" description="Phân tích dữ liệu thị trường bất động sản, xu hướng giá và báo cáo chuyên sâu." canonicalPath="/data-platform" />
        <div className="p-4 sm:p-6 space-y-6 pb-20 animate-enter relative">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('data.title')}</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{t('data.subtitle')}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="shrink-0 px-5 py-2.5 bg-sgs-primary-deep text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 text-sm"
                >
                    {ICONS.ADD}
                    {t('data.btn_new')}
                </button>
            </div>
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_connections')}</p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">{connectors.length}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{activeCount} {t('data.stat_active_count')}</p>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_syncs')}</p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">{jobs.length}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {jobs.filter(j => j.status === SyncStatus.COMPLETED).length} {t('data.stat_success_count')}
                    </p>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm col-span-2 sm:col-span-1">
                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('data.stat_last_sync')}</p>
                    <div className="mt-2">
                        {lastJob ? (
                            <>
                                <StatusBadge status={lastJob.status} t={t} />
                                <p className="text-xs text-[var(--text-secondary)] mt-1.5 flex items-center gap-1">
                                    {ICONS.CLOCK} {formatDateTime(lastJob.startedAt)}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('data.never')}</p>
                        )}
                    </div>
                </div>
            </div>
            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Connectors Panel */}
                <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col max-h-[520px]">
                    <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0">
                        <h3 className="font-bold text-[var(--text-primary)]">{t('data.active_connectors')}</h3>
                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--glass-surface)] px-2 py-0.5 rounded-full font-mono">{connectors.length}</span>
                    </div>
                    {connectors.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center gap-3 flex-1 justify-center">
                            <div className="w-14 h-14 bg-[var(--glass-surface)] rounded-2xl flex items-center justify-center text-[var(--text-tertiary)]">
                                {ICONS.PLUG}
                            </div>
                            <div>
                                <p className="font-bold text-[var(--text-primary)] text-sm">{t('data.empty_connectors')}</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">{t('data.empty_connectors_hint')}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="mt-1 px-4 py-2 bg-sgs-primary-deep text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1.5"
                            >
                                {ICONS.ADD} {t('data.btn_new')}
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-y-auto no-scrollbar overscroll-contain p-4 space-y-3">
                            {connectors.map(c => {
                                const sync = getSyncDisplay(c);
                                return (
                                <div key={c.id} className="bg-[var(--glass-surface)] p-4 rounded-[18px] border border-[var(--glass-border)] flex justify-between items-center group hover:bg-[var(--glass-surface-hover)] transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-lg shrink-0 shadow-sm">
                                            {CONNECTOR_ICONS[c.type] || ICONS.INFO}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                                <h4 className="font-bold text-[var(--text-primary)] text-sm truncate">{c.name}</h4>
                                            </div>
                                            <div className="text-xs text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[10px]">{t(`data.type_${c.type}`)}</span>
                                            </div>
                                             <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                 {sync.status ? (
                                                     <StatusBadge status={sync.status} t={t} />
                                                 ) : (
                                                     <span className="text-xs text-[var(--text-secondary)]">{t('data.never')}</span>
                                                 )}
                                                 {sync.at && (
                                                     <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                         {ICONS.CLOCK}
                                                         {formatDateTime(sync.at)}
                                                     </span>
                                                 )}
                                             </div>
                                             {checkResults[c.id] && (
                                                 <p className={`mt-1 text-[10px] font-semibold ${checkResults[c.id].ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                     {checkResults[c.id].status === 'CONFIGURED' ? 'Đã kiểm tra cấu hình' : 'Cấu hình cần sửa'}
                                                 </p>
                                             )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                                         <button
                                             onClick={() => void handleCheck(c.id)}
                                             disabled={checkingId === c.id}
                                             className="p-2 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                             title="Kiểm tra sâu cấu hình"
                                         >
                                             <span className={checkingId === c.id ? 'animate-spin inline-block' : ''}>{ICONS.CHECK}</span>
                                         </button>
                                         {![ConnectorType.FACEBOOK_PAGE, ConnectorType.ZALO_OA, ConnectorType.INSTAGRAM, ConnectorType.TIKTOK, ConnectorType.LINKEDIN_PAGE].includes(c.type) && (
                                             <button
                                                 onClick={() => handleSync(c.id)}
                                                 disabled={syncingId === c.id}
                                                 className="p-2 text-sgs-primary bg-sgs-champagne rounded-lg hover:bg-sgs-champagne transition-colors disabled:opacity-50"
                                                 title={t('data.sync_now')}
                                             >
                                                 <span className={syncingId === c.id ? 'animate-spin inline-block' : ''}>{ICONS.SYNC}</span>
                                             </button>
                                         )}
                                        <button
                                            onClick={() => setDeleteConfirmId(c.id)}
                                            className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                                            title={t('common.delete')}
                                        >
                                            {ICONS.TRASH}
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && orphanedConnectors.length > 0 && (
                    <div className="lg:col-span-2 bg-amber-50/70 rounded-[24px] border border-amber-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-amber-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-amber-950">{t('data.orphaned_connectors')}</h3>
                                <p className="text-xs text-amber-800 mt-1">{t('data.orphaned_connectors_hint')}</p>
                            </div>
                            <span className="text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full font-mono">{orphanedConnectors.length}</span>
                        </div>
                        <div className="p-4 grid gap-3 md:grid-cols-2">
                            {orphanedConnectors.map(connector => (
                                <div key={connector.id} className="bg-white/80 p-4 rounded-[18px] border border-amber-200 flex flex-col gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                                            {CONNECTOR_ICONS[connector.type] || ICONS.INFO}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-amber-950 text-sm truncate">{connector.name}</h4>
                                            <span className="text-xs text-amber-800">{t(`data.type_${connector.type}`)}</span>
                                             <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                 {connector.lastSyncStatus ? (
                                                     <StatusBadge status={connector.lastSyncStatus} t={t} />
                                                 ) : (
                                                     <span className="text-xs text-amber-800">{t('data.never')}</span>
                                                 )}
                                                 {connector.lastSyncAt && (
                                                     <span className="text-xs text-amber-800 flex items-center gap-1">
                                                         {ICONS.CLOCK}
                                                         {formatDateTime(connector.lastSyncAt)}
                                                     </span>
                                                 )}
                                             </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={assignmentTarget[connector.id] || ''}
                                            onChange={event => setAssignmentTarget(prev => ({ ...prev, [connector.id]: event.target.value }))}
                                            className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-950"
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
                                            onClick={() => void handleReassign(connector.id)}
                                            disabled={!assignmentTarget[connector.id] || assigningId === connector.id}
                                            className="shrink-0 px-3 py-2 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 disabled:opacity-50"
                                        >
                                            {assigningId === connector.id ? t('common.loading') : t('data.reassign_owner')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Job History Panel */}
                <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col max-h-[520px]">
                    <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0">
                        <h3 className="font-bold text-[var(--text-primary)]">{t('data.sync_history')}</h3>
                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--glass-surface)] px-2 py-0.5 rounded-full font-mono">{jobs.length}</span>
                    </div>
                    {jobs.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)] flex flex-col items-center justify-center flex-1">
                            <div className="mb-2 text-[var(--text-tertiary)]">{ICONS.CLIPBOARD}</div>
                            <p className="text-sm font-medium">{t('data.empty_jobs')}</p>
                            <p className="text-xs mt-1 text-[var(--text-tertiary)]">{t('data.empty_jobs_hint')}</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto no-scrollbar overscroll-contain divide-y divide-[var(--glass-border)]">
                            {jobs.map(job => {
                                const connector = connectors.find(c => c.id === job.connectorId);
                                return (
                                    <div key={job.id} className="px-6 py-3.5 flex justify-between items-center hover:bg-[var(--glass-surface)] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-base shrink-0 text-[var(--text-secondary)]">
                                                {connector ? CONNECTOR_ICONS[connector.type] || ICONS.INFO : ICONS.INFO}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                                    {connector?.name || t('data.unknown')}
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 flex items-center gap-1">
                                                    {ICONS.CLOCK} {formatDateTime(job.startedAt)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <StatusBadge status={job.status} t={t} />
                                            {job.recordsProcessed > 0 && (
                                                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                                                    {job.recordsProcessed} {t('table.records')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <ConnectorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreate}
                connectors={connectors}
                currentUser={currentUser}
                t={t}
            />
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title={t('common.delete')}
                message={t('data.confirm_delete')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDeleteConnector}
                onCancel={() => setDeleteConfirmId(null)}
                variant="danger"
            />
        </div>
        {createPortal(
            toast ? (
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-900/95 border-emerald-700 text-white' : 'bg-rose-900/95 border-rose-700 text-white'}`}
                >
                    <span className="text-sm">{toast.type === 'success' ? '✓' : '✕'}</span>
                    <span className="font-semibold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        </>
    );
};