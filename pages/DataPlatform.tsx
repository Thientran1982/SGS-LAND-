import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { ConnectorConfig, SyncJob, ConnectorType, SyncStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { connectorService } from '../services/connectorService';
import { ConfirmModal } from '../components/ConfirmModal';
import { SeoHead } from '../components/SeoHead';
import { ROUTES } from '../config/routes';
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
type SocialConnectionType = 'FACEBOOK_PAGE' | 'ZALO_OA' | 'INSTAGRAM' | 'TIKTOK' | 'LINKEDIN_PAGE';
type ConnectionChoice = ConnectorType | SocialConnectionType;
type AddConnectionForm = { type: ConnectionChoice; name: string; config: Record<string, unknown> };
type ZaloConnectionResult = {
    kind: 'connected' | 'ready' | 'not_ready' | 'error';
    title: string;
    message: string;
    reasonCode?: string;
    checks?: { oaId: string; quota: string };
};
const SOCIAL_CONNECTIONS: Record<SocialConnectionType, { label: string; description: string; route: string }> = {
    FACEBOOK_PAGE: {
        label: 'Facebook Page',
        description: 'Kết nối Page và xác minh quyền đăng bài công khai.',
        route: `/${ROUTES.ENTERPRISE_SETTINGS}?tab=FACEBOOK`,
    },
    ZALO_OA: {
        label: 'Zalo OA',
        description: 'Kết nối Official Account và kiểm tra quyền broadcast.',
        route: `/${ROUTES.ENTERPRISE_SETTINGS}?tab=ZALO`,
    },
    INSTAGRAM: {
        label: 'Instagram Business',
        description: 'Kiểm tra trạng thái publisher Instagram Business.',
        route: `/${ROUTES.SOCIAL_PUBLISHING}?platform=INSTAGRAM`,
    },
    TIKTOK: {
        label: 'TikTok Business',
        description: 'Kiểm tra trạng thái Content Posting API của TikTok.',
        route: `/${ROUTES.SOCIAL_PUBLISHING}?platform=TIKTOK`,
    },
    LINKEDIN_PAGE: {
        label: 'LinkedIn Page',
        description: 'Kiểm tra trạng thái publisher cho LinkedIn Organization.',
        route: `/${ROUTES.SOCIAL_PUBLISHING}?platform=LINKEDIN_PAGE`,
    },
};
const SOCIAL_CONNECTION_ICON = <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3" strokeWidth={1.7} /><circle cx="16" cy="7" r="3" strokeWidth={1.7} /><circle cx="16" cy="17" r="3" strokeWidth={1.7} /><path strokeLinecap="round" strokeWidth={1.7} d="M10.5 10.5l3-2M10.5 13.5l3 2" /></svg>;
const CONNECTION_OPTIONS = [
    ...Object.values(ConnectorType).map(value => ({
        value: value as ConnectionChoice,
        label: value === ConnectorType.GOOGLE_SHEETS ? 'Google Sheets'
            : value === ConnectorType.HUBSPOT ? 'HubSpot CRM'
                : value === ConnectorType.ZOHO_CRM ? 'Zoho CRM'
                    : value === ConnectorType.SALESFORCE ? 'Salesforce'
                        : 'Webhook Export',
        icon: CONNECTOR_ICONS[value] || ICONS.INFO,
    })),
    ...Object.entries(SOCIAL_CONNECTIONS).map(([value, connection]) => ({
        value: value as ConnectionChoice,
        label: connection.label,
        icon: SOCIAL_CONNECTION_ICON,
    })),
];
const ConnectorModal = ({ isOpen, onClose, onSave, onOpenSocial, t }: any) => {
    const [form, setForm] = useState<AddConnectionForm>({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
    const [zaloConnecting, setZaloConnecting] = useState(false);
    const [zaloResult, setZaloResult] = useState<ZaloConnectionResult | null>(null);
    useEffect(() => {
        if (isOpen) {
            setForm({ type: ConnectorType.GOOGLE_SHEETS, name: '', config: {} });
            setZaloResult(null);
        }
    }, [isOpen]);
    if (!isOpen) return null;

    const handleConfigChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
        if (form.type === 'ZALO_OA') setZaloResult(null);
    };
    const socialConnection = SOCIAL_CONNECTIONS[form.type as SocialConnectionType];
    const isSocialConnection = Boolean(socialConnection);
    const isZaloConnection = form.type === 'ZALO_OA';
    const zaloConfig = form.config;
    const handleTypeChange = (value: ConnectionChoice) => {
        setForm(prev => ({ ...prev, type: value, name: '', config: {} }));
        setZaloResult(null);
    };
    const handleZaloConnect = async () => {
        const appId = String(zaloConfig.appId || '').trim();
        const oaId = String(zaloConfig.oaId || '').trim();
        const oaName = String(zaloConfig.oaName || '').trim();
        const appSecret = String(zaloConfig.appSecret || '').trim();
        const accessToken = String(zaloConfig.accessToken || '').trim();
        if (!appId || !oaId || !oaName) {
            setZaloResult({
                kind: 'error',
                title: 'Thiếu thông tin kết nối',
                message: 'App ID, OA ID và Tên OA là bắt buộc.',
            });
            return;
        }

        setZaloConnecting(true);
        setZaloResult(null);
        try {
            await db.connectZaloOA({
                appId,
                oaId,
                oaName,
                appSecret: appSecret || undefined,
                accessToken: accessToken || undefined,
            });

            // Do not leave either credential in the form after it has been saved.
            setForm(prev => ({
                ...prev,
                config: { ...prev.config, appSecret: '', accessToken: '' },
            }));

            let verification: any;
            try {
                verification = await db.verifyZaloBroadcastAccess();
            } catch (error: any) {
                setZaloResult({
                    kind: 'error',
                    title: 'Lỗi/ambiguous — chưa báo READY',
                    message: error?.message || 'Không thể hoàn tất kiểm tra broadcast. Trạng thái READY chưa được cấp.',
                });
                return;
            }

            if (verification.status === 'READY' && verification.ready === true) {
                setZaloResult({
                    kind: 'ready',
                    title: 'Đã xác minh broadcast và quota',
                    message: verification.reason || 'Zalo OA đã vượt qua kiểm tra định danh OA và hạn mức broadcast.',
                    reasonCode: verification.reasonCode,
                    checks: verification.checks,
                });
            } else {
                setZaloResult({
                    kind: 'not_ready',
                    title: 'Kết nối thành công nhưng chưa đủ quyền',
                    message: verification.reason || 'Quyền broadcast hoặc hạn mức chưa được xác minh đầy đủ.',
                    reasonCode: verification.reasonCode,
                    checks: verification.checks,
                });
            }
        } catch (error: any) {
            setZaloResult({
                kind: 'error',
                title: 'Lỗi kết nối — chưa báo READY',
                message: error?.message || 'Không thể kết nối Zalo OA.',
            });
        } finally {
            setZaloConnecting(false);
        }
    };
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
                    {!isSocialConnection && <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">{t('data.name')}</label>
                        <input
                            className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                            placeholder={t('data.name_placeholder')}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>}
                    {isZaloConnection ? (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                                <p className="text-sm font-bold text-blue-950">Kết nối Zalo OA</p>
                                <p className="mt-1 text-xs leading-5 text-blue-900/75">
                                    Thông tin sẽ được lưu theo tenant và kiểm tra live ngay sau khi kết nối. Secret và token không được hiển thị lại.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                                        {t('ent.zalo_app_id')} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                        value={String(zaloConfig.appId || '')}
                                        onChange={e => handleConfigChange('appId', e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                                        {t('ent.zalo_oa_id')} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                        value={String(zaloConfig.oaId || '')}
                                        onChange={e => handleConfigChange('oaId', e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                                    {t('ent.zalo_oa_name')} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                    value={String(zaloConfig.oaName || '')}
                                    onChange={e => handleConfigChange('oaName', e.target.value)}
                                    autoComplete="organization"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                                    {t('ent.zalo_app_secret')} <span className="font-normal normal-case text-[var(--text-secondary)]">{t('ent.zalo_secret_optional')}</span>
                                </label>
                                <input
                                    type="password"
                                    className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                    value={String(zaloConfig.appSecret || '')}
                                    onChange={e => handleConfigChange('appSecret', e.target.value)}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                                    {t('ent.zalo_oa_access_token')} <span className="font-normal normal-case text-[var(--text-secondary)]">{t('ent.zalo_token_optional')}</span>
                                </label>
                                <input
                                    type="password"
                                    className="w-full border border-[var(--glass-border)] bg-[var(--glass-surface)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/40 transition-all"
                                    value={String(zaloConfig.accessToken || '')}
                                    onChange={e => handleConfigChange('accessToken', e.target.value)}
                                    autoComplete="new-password"
                                />
                                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                                    Không có Access Token thì cấu hình vẫn được lưu, nhưng kiểm tra broadcast sẽ không thể báo READY.
                                </p>
                            </div>
                            {zaloResult && (
                                <div className={`rounded-xl border p-3 text-xs ${
                                    zaloResult.kind === 'ready'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                        : zaloResult.kind === 'not_ready'
                                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                                            : zaloResult.kind === 'error'
                                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                                : 'bg-blue-50 border-blue-200 text-blue-900'
                                }`}>
                                    <p className="font-bold">{zaloResult.title}</p>
                                    <p className="mt-1 leading-relaxed">{zaloResult.message}</p>
                                    {(zaloResult.reasonCode || zaloResult.checks) && (
                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] opacity-80">
                                            {zaloResult.reasonCode && <span>Mã: {zaloResult.reasonCode}</span>}
                                            {zaloResult.checks && <span>OA: {zaloResult.checks.oaId} · Quota: {zaloResult.checks.quota}</span>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : isSocialConnection ? (
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-white p-2 text-indigo-700 shadow-sm">{SOCIAL_CONNECTION_ICON}</div>
                                <div>
                                    <p className="text-sm font-bold text-indigo-950">Kết nối nền tảng social</p>
                                    <p className="mt-1 text-xs leading-5 text-indigo-900/75">{socialConnection.description}</p>
                                    <p className="mt-2 text-[11px] font-semibold text-indigo-800">Cấu hình và kiểm tra sâu sẽ chạy ở màn hình quản trị nền tảng, không lưu token vào connector đồng bộ dữ liệu.</p>
                                </div>
                            </div>
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
                    {isZaloConnection ? (
                        <button
                            onClick={() => void handleZaloConnect()}
                            disabled={zaloConnecting || !String(zaloConfig.appId || '').trim() || !String(zaloConfig.oaId || '').trim() || !String(zaloConfig.oaName || '').trim()}
                            className="w-full py-3 bg-sgs-primary-deep text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {zaloConnecting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {zaloConnecting ? 'Đang kết nối và kiểm tra…' : 'Kết nối và kiểm tra'}
                        </button>
                    ) : isSocialConnection ? (
                        <button
                            onClick={() => onOpenSocial(socialConnection.route)}
                            className="w-full py-3 bg-indigo-700 text-white font-bold rounded-xl hover:bg-indigo-800 shadow-lg transition-all active:scale-95"
                        >
                            Mở cài đặt và kiểm tra
                        </button>
                    ) : (
                        <button
                            onClick={() => onSave(form)}
                            disabled={
                                !form.name?.trim() ||
                                (form.type === ConnectorType.GOOGLE_SHEETS && !String(form.config?.spreadsheetId || '').trim()) ||
                                ((form.type === ConnectorType.HUBSPOT || form.type === ConnectorType.SALESFORCE || form.type === ConnectorType.ZOHO_CRM) && !String(form.config?.apiKey || '').trim()) ||
                                (form.type === ConnectorType.WEBHOOK_EXPORT && !String(form.config?.targetUrl || '').trim())
                            }
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
    const handleCreate = async (data: Partial<ConnectorConfig>) => {
        try {
            await connectorService.validateConnection(data.type!, data.config, t);
            await db.createConnectorConfig(data);
            notify(t('data.create_success'), 'success');
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            notify(e.message, 'error');
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
                            {connectors.map(c => (
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
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    {ICONS.CLOCK}
                                                    {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : t('data.never')}
                                                </span>
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
                                        <button
                                            onClick={() => handleSync(c.id)}
                                            disabled={syncingId === c.id}
                                            className="p-2 text-sgs-primary bg-sgs-champagne rounded-lg hover:bg-sgs-champagne transition-colors disabled:opacity-50"
                                            title={t('data.sync_now')}
                                        >
                                            <span className={syncingId === c.id ? 'animate-spin inline-block' : ''}>{ICONS.SYNC}</span>
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmId(c.id)}
                                            className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                                            title={t('common.delete')}
                                        >
                                            {ICONS.TRASH}
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                onOpenSocial={(route: string) => {
                    setIsModalOpen(false);
                    window.location.href = route;
                }}
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