
import React, { useEffect, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { EnterpriseConfig, AuditLog, User, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { copyToClipboard } from '../utils/clipboard';

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const CONSTANTS = {
    TOAST_DURATION: 3000,
    MASK: '••••••••••••••••'
};

// -----------------------------------------------------------------------------
// HELPER COMPONENTS
// -----------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; subtitle: string; action?: React.ReactNode }> = memo(({ title, subtitle, action }) => (
    <div className="flex justify-between items-start gap-4 mb-6 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[var(--text-primary)] break-words">{title}</h3>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{subtitle}</p>
        </div>
        {action && <div className="shrink-0 mt-1">{action}</div>}
    </div>
));

const StatusBadge: React.FC<{ active: boolean; label: string }> = memo(({ active, label }) => (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-[var(--glass-surface)] text-[var(--text-secondary)] border-[var(--glass-border)]'}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
        {label}
    </span>
));

// -----------------------------------------------------------------------------
// PANELS (Optimized & Localized)
// -----------------------------------------------------------------------------

const ZaloPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t, formatDate } = useTranslation();
    const [connecting, setConnecting] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [zaloStatus, setZaloStatus] = useState<{ webhookSecretConfigured: boolean; appIdConfigured: boolean; webhookUrl: string } | null>(null);
    const [form, setForm] = useState({ appId: '', oaId: '', oaName: '', appSecret: '', accessToken: '' });
    const [showSecret, setShowSecret] = useState(false);
    const [showAccessToken, setShowAccessToken] = useState(false);
    const [tokenForm, setTokenForm] = useState('');
    const [updatingToken, setUpdatingToken] = useState(false);
    const [showTokenForm, setShowTokenForm] = useState(false);

    useEffect(() => {
        db.getZaloStatus().then(setZaloStatus);
    }, []);

    const handleConnect = async () => {
        if (!form.appId.trim() || !form.oaId.trim() || !form.oaName.trim()) {
            notify(t('ent.zalo_form_required') || 'Vui lòng nhập đầy đủ App ID, OA ID và Tên OA', 'error');
            return;
        }
        setConnecting(true);
        try {
            await db.connectZaloOA({
                appId: form.appId.trim(),
                oaId: form.oaId.trim(),
                oaName: form.oaName.trim(),
                appSecret: form.appSecret.trim() || undefined,
                accessToken: form.accessToken.trim() || undefined,
            });
            notify(t('ent.zalo_success'), 'success');
            setForm({ appId: '', oaId: '', oaName: '', appSecret: '', accessToken: '' });
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setConnecting(false); }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await db.disconnectZaloOA();
            notify(t('common.success'), 'success');
            setConfirmDisconnect(false);
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setDisconnecting(false); }
    };

    const copyWebhook = async (url: string) => {
        if (url) {
            await copyToClipboard(url);
            notify(t('common.copied'), 'success');
        }
    };

    const handleUpdateToken = async () => {
        if (!tokenForm.trim()) {
            notify(t('enterprise.access_token_required'), 'error');
            return;
        }
        setUpdatingToken(true);
        try {
            await db.updateZaloToken(tokenForm.trim());
            notify(t('enterprise.token_updated'), 'success');
            setTokenForm('');
            setShowTokenForm(false);
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setUpdatingToken(false); }
    };

    const webhookUrl = config.zalo?.webhookUrl || zaloStatus?.webhookUrl || `${window.location.origin}/api/webhooks/zalo`;

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader
                title={t('ent.zalo_title')}
                subtitle={t('ent.zalo_subtitle')}
                action={<StatusBadge active={!!config.zalo?.enabled} label={config.zalo?.enabled ? t('ent.zalo_status_connected') : t('ent.zalo_status_disconnected')} />}
            />

            {/* Env var warning */}
            {zaloStatus && !zaloStatus.webhookSecretConfigured && (
                <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs">
                    <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>
                        <span className="font-bold block mb-0.5">{t('ent.zalo_secret_warning') || 'Cần cấu hình biến môi trường'}</span>
                        {t('enterprise.zalo_secret_hint')}
                    </span>
                </div>
            )}

            {config.zalo?.enabled ? (
                <>
                    {/* Connected state */}
                    <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col md:flex-row">
                        <div className="p-6 md:p-8 flex-1">
                            <div className="flex items-center gap-5 mb-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20 shrink-0">Z</div>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] break-words">{config.zalo.oaName}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <div className="inline-flex items-center px-2 py-1 bg-[var(--glass-surface-hover)] rounded text-xs text-[var(--text-tertiary)] font-mono border border-[var(--glass-border)]">OA ID: {config.zalo.oaId}</div>
                                        {(config.zalo as any).appId && (
                                            <div className="inline-flex items-center px-2 py-1 bg-[var(--glass-surface-hover)] rounded text-xs text-[var(--text-tertiary)] font-mono border border-[var(--glass-border)]">App ID: {(config.zalo as any).appId}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-[var(--glass-surface)] rounded-2xl border border-[var(--glass-border)]">
                                    <div className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-1">{t('ent.zalo_role')}</div>
                                    <div className="flex flex-wrap gap-1">
                                        <span className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded text-xs2 font-bold text-[var(--text-secondary)]">{t('ent.zalo_perm_msg')}</span>
                                        <span className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded text-xs2 font-bold text-[var(--text-secondary)]">{t('ent.zalo_perm_user')}</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-[var(--glass-surface)] rounded-2xl border border-[var(--glass-border)]">
                                    <div className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-1">{t('ent.zalo_connected_at')}</div>
                                    <div className="text-xs font-bold text-[var(--text-secondary)]">{config.zalo.connectedAt ? formatDate(config.zalo.connectedAt) : '-'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <button
                                    onClick={() => setShowTokenForm(s => !s)}
                                    className="text-blue-600 text-sm font-bold hover:underline decoration-2 underline-offset-4"
                                >
                                    {config.zalo?.accessToken ? t('enterprise.update_token') : t('enterprise.add_token')}
                                </button>
                                <button
                                    onClick={() => setConfirmDisconnect(true)}
                                    className="text-rose-600 text-sm font-bold hover:underline decoration-2 underline-offset-4"
                                >
                                    {t('ent.zalo_disconnect_btn')}
                                </button>
                            </div>
                            {showTokenForm && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                    <p className="text-xs text-blue-700 font-bold mb-2">OA Access Token mới</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            className="flex-1 border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
                                            placeholder="Dán token từ Zalo Developers Console..."
                                            value={tokenForm}
                                            onChange={e => setTokenForm(e.target.value)}
                                        />
                                        <button
                                            onClick={handleUpdateToken}
                                            disabled={updatingToken}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70 flex items-center gap-2 shrink-0"
                                        >
                                            {updatingToken && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="bg-[var(--glass-surface)] border-t md:border-t-0 md:border-l border-[var(--glass-border)] p-6 md:p-8 w-full md:w-[320px] flex flex-col justify-center gap-5">
                            <div>
                                <label className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-2 block">{t('ent.zalo_webhook')}</label>
                                <div
                                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl p-3 flex items-center gap-2 group cursor-pointer hover:border-blue-400 transition-colors"
                                    onClick={() => copyWebhook(webhookUrl)}
                                >
                                    <code className="text-xs2 font-mono text-[var(--text-secondary)] flex-1 truncate">{webhookUrl}</code>
                                    <div className="p-1.5 rounded-lg bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] group-hover:text-blue-500 shrink-0">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${zaloStatus?.webhookSecretConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                                <span className="text-xs2 text-[var(--text-tertiary)] font-bold">
                                    ZALO_OA_SECRET: {zaloStatus?.webhookSecretConfigured ? <span className="text-emerald-600">Đã cấu hình</span> : <span className="text-amber-600">Chưa cấu hình</span>}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${config.zalo?.accessToken ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                                <span className="text-xs2 text-[var(--text-tertiary)] font-bold">
                                    OA Access Token: {config.zalo?.accessToken ? <span className="text-emerald-600">Đã cấu hình — gửi tin ✓</span> : <span className="text-amber-600">Chưa có — không thể gửi tin</span>}
                                </span>
                            </div>
                            <div className="text-xs2 text-[var(--text-tertiary)] leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                <span className="font-bold text-blue-600 block mb-1">{t('common.tips')}:</span> {t('ent.zalo_tips')}
                            </div>
                        </div>
                    </div>

                    {/* Disconnect confirmation dialog */}
                    {confirmDisconnect && createPortal(
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                            <div className="bg-[var(--bg-surface)] rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-enter">
                                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t('ent.zalo_disconnect_btn')}</h3>
                                <p className="text-sm text-[var(--text-tertiary)] mb-6">{t('ent.zalo_disconnect_confirm')}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmDisconnect(false)}
                                        className="flex-1 py-2.5 border-2 border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] font-bold hover:bg-[var(--glass-surface)] transition-colors text-sm"
                                    >
                                        {t('common.cancel') || 'Huỷ'}
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        disabled={disconnecting}
                                        className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {disconnecting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                        {t('ent.zalo_disconnect_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            ) : (
                /* Connect form */
                <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--glass-border)] shadow-sm p-6 md:p-8 max-w-2xl">
                    <p className="text-sm text-[var(--text-tertiary)] mb-6 leading-relaxed">{t('ent.zalo_guide')}</p>

                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                    App ID <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder="VD: 123456789"
                                    value={form.appId}
                                    onChange={e => setForm({ ...form, appId: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                    OA ID <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder="VD: 987654321"
                                    value={form.oaId}
                                    onChange={e => setForm({ ...form, oaId: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                {t('ent.zalo_oa_name') || 'Tên Official Account'} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                placeholder="VD: SGS Land Official"
                                value={form.oaName}
                                onChange={e => setForm({ ...form, oaName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                App Secret <span className="text-[var(--text-secondary)] font-normal normal-case">(tuỳ chọn — để bảo mật webhook)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder={CONSTANTS.MASK}
                                    value={form.appSecret}
                                    onChange={e => setForm({ ...form, appSecret: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute right-3 top-2.5 text-xs2 font-bold text-blue-600 hover:underline"
                                >
                                    {showSecret ? t('ent.sso_hide') : t('ent.sso_show')}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                OA Access Token <span className="text-[var(--text-secondary)] font-normal normal-case">(để gửi tin nhắn phản hồi cho khách)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showAccessToken ? 'text' : 'password'}
                                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder={CONSTANTS.MASK}
                                    value={form.accessToken}
                                    onChange={e => setForm({ ...form, accessToken: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAccessToken(!showAccessToken)}
                                    className="absolute right-3 top-2.5 text-xs2 font-bold text-blue-600 hover:underline"
                                >
                                    {showAccessToken ? t('ent.sso_hide') : t('ent.sso_show')}
                                </button>
                            </div>
                            <p className="mt-1 text-xs2 text-[var(--text-tertiary)]">
                                Lấy token tại <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="text-blue-500 underline">Zalo Developers Console</a> → Official Account → OA Access Token.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-2xl p-4 mb-6 text-xs3 text-[var(--text-tertiary)]">
                        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                            <span className="font-bold text-[var(--text-secondary)] block mb-0.5">Webhook URL sẽ được tạo tự động:</span>
                            <code className="font-mono text-xs2 break-all text-blue-600">{webhookUrl}</code>
                            <span className="block mt-1">Sau khi kết nối, copy URL này vào cấu hình Webhook trên Zalo Developers Console.</span>
                        </div>
                    </div>

                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {connecting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {t('ent.zalo_connect_btn')}
                    </button>
                </div>
            )}
        </div>
    );
});

const FacebookPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const emptyForm = { name: '', pageId: '', pageUrl: '', accessToken: '' };
    const [form, setForm] = useState(emptyForm);
    const [showToken, setShowToken] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [confirmPageId, setConfirmPageId] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [fbStatus, setFbStatus] = useState<{ appSecretConfigured: boolean; verifyTokenConfigured: boolean; webhookUrl: string } | null>(null);

    useEffect(() => {
        db.getFacebookStatus().then(setFbStatus).catch(() => {});
    }, []);

    const handleConnect = async () => {
        if (!form.name.trim() || !form.pageId.trim()) {
            notify(t('ent.facebook_form_required') || 'Vui lòng nhập Tên Page và Page ID', 'error');
            return;
        }
        setConnecting(true);
        try {
            await db.connectFacebookPage({
                name: form.name.trim(),
                pageId: form.pageId.trim(),
                pageUrl: form.pageUrl.trim() || undefined,
                accessToken: form.accessToken.trim() || undefined,
            });
            notify(t('ent.facebook_success'), 'success');
            setForm(emptyForm);
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setConnecting(false); }
    };

    const handleDisconnect = async () => {
        if (!confirmPageId) return;
        setDisconnecting(true);
        try {
            await db.disconnectFacebookPage(confirmPageId);
            notify(t('common.success'), 'success');
            setConfirmPageId(null);
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setDisconnecting(false); }
    };

    const secretsMissing = fbStatus && (!fbStatus.appSecretConfigured || !fbStatus.verifyTokenConfigured);

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader title={t('ent.facebook_title')} subtitle={t('ent.facebook_subtitle')} />

            {/* Env var warning */}
            {secretsMissing && (
                <div className="mb-5 flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    <div>
                        <p className="text-sm font-bold text-amber-800">{t('ent.facebook_secret_warning')}</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{t('ent.facebook_secret_hint')}</p>
                        <div className="mt-2 flex gap-2 text-xs3 text-amber-700">
                            <span className={`px-2 py-0.5 rounded-full font-mono ${fbStatus?.appSecretConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                FB_APP_SECRET {fbStatus?.appSecretConfigured ? '✓' : '✗'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-mono ${fbStatus?.verifyTokenConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                FB_VERIFY_TOKEN {fbStatus?.verifyTokenConfigured ? '✓' : '✗'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Webhook URL (when env vars are OK) */}
            {fbStatus && fbStatus.appSecretConfigured && fbStatus.verifyTokenConfigured && (
                <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
                    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-green-800">Webhook URL đang hoạt động</p>
                        <p className="text-xs font-mono text-green-700 truncate mt-0.5">{fbStatus.webhookUrl}</p>
                    </div>
                </div>
            )}

            {/* Connect form */}
            <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--glass-border)] shadow-sm p-6 md:p-8 max-w-2xl mb-8">
                <p className="text-sm text-[var(--text-tertiary)] mb-5 leading-relaxed">
                    Nhập thông tin Facebook Page để kết nối. Page ID và Access Token lấy từ{' '}
                    <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-500 underline">Facebook for Developers</a>.
                </p>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                {t('ent.facebook_page_name')} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                placeholder="VD: SGS Land Fanpage"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                                {t('ent.facebook_page_id')} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                placeholder="VD: 123456789012345"
                                value={form.pageId}
                                onChange={e => setForm({ ...form, pageId: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                            {t('ent.facebook_page_url')}
                        </label>
                        <input
                            className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            placeholder="https://facebook.com/your-page"
                            value={form.pageUrl}
                            onChange={e => setForm({ ...form, pageUrl: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                            {t('ent.facebook_access_token')}
                            <span className="ml-1 text-[var(--text-secondary)] font-normal normal-case">(để gửi tin Messenger)</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 pr-10"
                                placeholder="EAAxxxxx..."
                                value={form.accessToken}
                                onChange={e => setForm({ ...form, accessToken: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowToken(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]">
                                {showToken
                                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                }
                            </button>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="mt-6 w-full py-3 bg-[#1877F2] text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {connecting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    {t('ent.facebook_connect_btn')}
                </button>
            </div>

            {/* Connected pages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.facebookPages?.map(page => (
                    <div key={page.id} className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm flex items-center justify-between group hover:border-blue-100 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-[#1877F2]/10 text-[#1877F2] rounded-full flex items-center justify-center font-bold text-lg shrink-0">f</div>
                            <div className="min-w-0">
                                <div className="font-bold text-[var(--text-primary)] text-sm truncate">{page.name}</div>
                                <div className="text-xs2 text-[var(--text-secondary)] font-mono truncate">ID: {page.id}</div>
                                {page.pageUrl && (
                                    <a href={page.pageUrl} target="_blank" rel="noreferrer" className="text-xs2 text-blue-400 hover:underline truncate block">{page.pageUrl}</a>
                                )}
                                {page.connectedAt && (
                                    <div className="text-xs2 text-[var(--text-secondary)]">{t('ent.facebook_connected_at')}: {new Date(page.connectedAt).toLocaleDateString('vi-VN')}</div>
                                )}
                                {page.accessToken && (
                                    <span className="inline-block mt-0.5 text-2xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Token ✓</span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setConfirmPageId(page.id)}
                            className="text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
                {(!config.facebookPages || config.facebookPages.length === 0) && (
                    <div className="col-span-full text-center py-10 text-[var(--text-secondary)] italic bg-[var(--glass-surface)] rounded-2xl border border-dashed border-[var(--glass-border)]">
                        {t('ent.facebook_empty')}
                    </div>
                )}
            </div>

            {/* Disconnect confirmation modal */}
            {confirmPageId && createPortal(
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-surface)] rounded-3xl shadow-2xl p-6 max-w-sm w-full">
                        <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm12-5h-4m0 0l2-2m-2 2l2 2" /></svg>
                        </div>
                        <h3 className="text-base font-bold text-[var(--text-primary)] text-center mb-2">{t('ent.facebook_disconnect_confirm')}</h3>
                        <p className="text-xs text-[var(--text-tertiary)] text-center mb-5 font-mono bg-[var(--glass-surface)] rounded-lg px-3 py-2">ID: {confirmPageId}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmPageId(null)}
                                disabled={disconnecting}
                                className="flex-1 py-2.5 border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] font-medium hover:bg-[var(--glass-surface)] text-sm"
                            >
                                {t('common.cancel') || 'Huỷ'}
                            </button>
                            <button
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {disconnecting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {t('ent.disconnect_confirm') || 'Ngắt kết nối'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

const EmailPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [form, setForm] = useState(config.email);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    useEffect(() => { setForm(config.email); }, [config.email]);

    const handleSave = async () => {
        setSaving(true);
        try { await db.saveEmailConfig(form); notify(t('common.success'), 'success'); onRefresh(); } 
        catch (e: any) { notify(e.message, 'error'); } 
        finally { setSaving(false); }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try { await db.testSmtpConnection(); notify('SMTP connection successful!', 'success'); }
        catch (e: any) { notify(e.message || 'SMTP connection failed', 'error'); }
        finally { setTesting(false); }
    };

    const handleSendTestEmail = async () => {
        setSendingTest(true);
        try { await db.sendTestEmail(); notify('Test email sent!', 'success'); }
        catch (e: any) { notify(e.message || 'Failed to send test email', 'error'); }
        finally { setSendingTest(false); }
    };

    return (
        <div className="animate-enter max-w-2xl">
            <SectionHeader title={t('ent.email_title')} subtitle={t('ent.email_subtitle')} action={
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${form.enabled ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>{form.enabled ? t('common.active') : t('common.disabled')}</span>
                    <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} className="accent-emerald-500 w-5 h-5 cursor-pointer rounded" />
                </div>
            } />
            <div className={`bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--glass-border)] shadow-sm space-y-5 transition-opacity ${!form.enabled ? 'opacity-50' : 'opacity-100'}`}>
                <div className={!form.enabled ? 'pointer-events-none' : ''}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.email_host')}</label><input className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.host} onChange={e => setForm({...form, host: e.target.value.trim()})} placeholder="smtp.example.com" /></div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.email_port')}</label>
                            <input type="number" min={1} max={65535} className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={isNaN(form.port) || form.port === 0 ? '' : form.port} onChange={e => { const v = parseInt(e.target.value); setForm({...form, port: isNaN(v) ? 0 : v}); }} onBlur={e => { if (!form.port) setForm({...form, port: 587}); }} placeholder="587" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.email_user')}</label><input className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.user} onChange={e => setForm({...form, user: e.target.value.trim()})} placeholder="user@example.com" /></div>
                        <div><label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.email_pass')}</label><input type="password" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} placeholder={CONSTANTS.MASK} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">Tên hiển thị (From Name)</label><input className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.fromName || ''} onChange={e => setForm({...form, fromName: e.target.value})} placeholder="SGS LAND" /></div>
                        <div><label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">Địa chỉ gửi (From Address)</label><input type="email" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.fromAddress || ''} onChange={e => setForm({...form, fromAddress: e.target.value.trim()})} placeholder="noreply@company.com" /></div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)]">
                        <input type="checkbox" id="smtp-secure" checked={!!form.secure} onChange={e => setForm({...form, secure: e.target.checked})} className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        <label htmlFor="smtp-secure" className="text-sm text-[var(--text-secondary)] cursor-pointer select-none">
                            <span className="font-semibold">SSL/TLS</span> — Bật nếu dùng port 465. Tắt nếu dùng STARTTLS (port 587).
                        </label>
                    </div>
                </div>
                <div className="pt-2 flex flex-col gap-3">
                    <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-70 shadow-lg shadow-indigo-500/20">{saving ? t('auth.processing') : t('ent.email_save')}</button>
                    {form.enabled && (
                        <div className="flex gap-3">
                            <button onClick={handleTestConnection} disabled={testing || !form.host} className="flex-1 py-2.5 border-2 border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                                {testing && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>}
                                {testing ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button onClick={handleSendTestEmail} disabled={sendingTest || !form.host} className="flex-1 py-2.5 border-2 border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                                {sendingTest && <div className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>}
                                {sendingTest ? 'Sending...' : 'Send Test Email'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const SSOPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [sso, setSso] = useState(config.sso);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [verifyResult, setVerifyResult] = useState<{ success: boolean; message?: string; error?: string; metadata?: any } | null>(null);

    const redirectUri = `${window.location.origin}/api/auth/callback`;

    useEffect(() => { setSso(config.sso); }, [config.sso]);

    const handleSave = async () => {
        if (sso.enabled && (!sso.issuerUrl || !sso.clientId)) {
            notify(t('ent.sso_save_error') || 'Issuer URL và Client ID là bắt buộc khi SSO được bật', 'error');
            return;
        }
        setSaving(true);
        try {
            await db.saveSSOConfig(sso);
            notify(t('common.success'), 'success');
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyResult(null);
        try {
            const result = await db.verifySsoConfig();
            setVerifyResult(result);
            if (result.success) notify('OIDC configuration verified!', 'success');
        } catch (e: any) {
            setVerifyResult({ success: false, error: e.message });
            notify(e.message || 'SSO verification failed', 'error');
        } finally { setVerifying(false); }
    };

    return (
        <div className="animate-enter max-w-3xl">
            <SectionHeader title={t('ent.sso_title')} subtitle={t('ent.sso_subtitle')} action={
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${sso.enabled ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>{sso.enabled ? t('common.active') : t('common.disabled')}</span>
                    <input type="checkbox" checked={sso.enabled} onChange={e => setSso({...sso, enabled: e.target.checked})} className="accent-emerald-500 w-5 h-5 cursor-pointer rounded" />
                </div>
            } />
            <div className={`bg-[var(--bg-surface)] p-6 md:p-8 rounded-[24px] border border-[var(--glass-border)] shadow-sm space-y-6 transition-opacity ${!sso.enabled ? 'opacity-50' : 'opacity-100'}`}>
                <div className={`space-y-6 ${!sso.enabled ? 'pointer-events-none' : ''}`}>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">Provider</label>
                        <div className="flex gap-3">
                            {(['OIDC', 'SAML'] as const).map(p => (
                                <button key={p} onClick={() => setSso({...sso, provider: p})}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-colors ${sso.provider === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-[var(--glass-border)] text-[var(--text-tertiary)] hover:border-[var(--glass-border)]'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.sso_issuer')} {sso.provider === 'OIDC' ? '(Discovery URL)' : ''}</label>
                        <input placeholder={sso.provider === 'SAML' ? 'https://idp.example.com/saml' : 'https://dev-123.okta.com'} className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.issuerUrl || ''} onChange={e => setSso({...sso, issuerUrl: e.target.value.trim()})} />
                        {sso.provider === 'OIDC' && sso.issuerUrl && (
                            <p className="text-xs3 text-[var(--text-secondary)] mt-1 font-mono">Discovery: {sso.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration</p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.sso_client_id')}</label>
                            <input className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.clientId || ''} onChange={e => setSso({...sso, clientId: e.target.value.trim()})} placeholder="your-client-id" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">{t('ent.sso_client_secret')}</label>
                            <div className="relative">
                                <input type={showSecret ? "text" : "password"} className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.clientSecret || ''} onChange={e => setSso({...sso, clientSecret: e.target.value})} placeholder={CONSTANTS.MASK} />
                                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-3.5 text-xs2 font-bold text-indigo-600 hover:underline">{showSecret ? t('ent.sso_hide') : t('ent.sso_show')}</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">Login URL <span className="text-[var(--text-secondary)] normal-case font-normal">(tùy chọn — cho SAML hoặc IdP tùy chỉnh)</span></label>
                        <input type="url" placeholder="https://idp.example.com/sso/login" className="w-full border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" value={sso.loginUrl || ''} onChange={e => setSso({...sso, loginUrl: e.target.value.trim()})} />
                    </div>
                    <div className="bg-[var(--glass-surface)] p-4 rounded-xl border border-[var(--glass-border)]">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                            <span className="text-xs text-[var(--text-tertiary)] font-bold uppercase shrink-0">{t('ent.redirect_uri')}</span>
                            <div className="flex items-center gap-2 min-w-0">
                                <code className="text-xs3 font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-1 rounded border border-[var(--glass-border)] break-all">{redirectUri}</code>
                                <button onClick={() => { navigator.clipboard?.writeText(redirectUri); notify('Copied!', 'success'); }} className="shrink-0 text-xs2 font-bold text-indigo-600 hover:underline px-1">Copy</button>
                            </div>
                        </div>
                        <p className="text-xs3 text-[var(--text-secondary)] mt-2">Thêm URL này vào danh sách Redirect URIs trong cấu hình IdP của bạn.</p>
                    </div>

                    {verifyResult && (
                        <div className={`p-4 rounded-xl border text-sm ${verifyResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                            {verifyResult.success ? (
                                <div>
                                    <p className="font-bold mb-2">✓ OIDC cấu hình hợp lệ</p>
                                    {verifyResult.metadata && (
                                        <div className="space-y-1 text-xs3 font-mono">
                                            <p><span className="text-emerald-600 font-bold">Issuer:</span> {verifyResult.metadata.issuer}</p>
                                            <p><span className="text-emerald-600 font-bold">Auth Endpoint:</span> {verifyResult.metadata.authorizationEndpoint}</p>
                                            <p><span className="text-emerald-600 font-bold">Token Endpoint:</span> {verifyResult.metadata.tokenEndpoint}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p>✗ {verifyResult.error}</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3 pt-2">
                    <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-70 shadow-lg">{saving ? t('auth.processing') : t('ent.sso_save')}</button>
                    {sso.enabled && sso.provider === 'OIDC' && (
                        <button onClick={handleVerify} disabled={verifying || !sso.issuerUrl || !sso.clientId} className="w-full py-2.5 border-2 border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                            {verifying && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>}
                            {verifying ? t('enterprise.verifying_oidc') : t('enterprise.verify_oidc')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

const DomainPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: (m: string, t: 'success'|'error') => void }) => {
    const { t } = useTranslation();
    const [newDomain, setNewDomain] = useState('');
    const [verifying, setVerifying] = useState<string | null>(null);

    const handleAdd = async () => {
        const domain = newDomain.trim();
        if (!domain.includes('.') || domain.length < 4) { notify(t('ent.domain_invalid'), 'error'); return; }
        try { await db.addDomain(domain); setNewDomain(''); onRefresh(); notify(t('common.success'), 'success'); }
        catch (e: any) { notify(e.message, 'error'); }
    };

    const handleVerify = async (domain: string) => {
        setVerifying(domain);
        try { await db.verifyDomain(domain); notify(t('ent.domain_verified_success'), 'success'); onRefresh(); }
        catch (e: any) { notify(e.message, 'error'); }
        finally { setVerifying(null); }
    };

    const handleRemove = async (domain: string) => {
        try { await db.removeDomain(domain); onRefresh(); } catch (e: any) { notify(e.message, 'error'); }
    };

    return (
        <div className="animate-enter max-w-4xl">
            <SectionHeader title={t('ent.domain_title')} subtitle={t('ent.domain_subtitle')} />
            <div className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder={t('ent.domain_placeholder')} value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    <button onClick={handleAdd} className="px-6 py-3 sm:py-0 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors">{t('ent.domain_add')}</button>
                </div>
            </div>
            <div className="space-y-4">
                {config.domains?.map(d => (
                    <div key={d.domain} className="bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm group">
                        <div className="flex justify-between items-start mb-4 gap-4">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-[var(--text-primary)] break-all">{d.domain}</h3>
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs2 font-bold uppercase mt-1 border ${d.verified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.verified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    {d.verified ? t('ent.domain_verified') : t('ent.domain_pending')}
                                </div>
                            </div>
                            <button onClick={() => handleRemove(d.domain)} className="text-[var(--text-secondary)] hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        {!d.verified && (
                            <div className="bg-[var(--glass-surface)] p-4 rounded-xl border border-[var(--glass-border)]">
                                <div className="text-xs2 font-bold text-[var(--text-secondary)] uppercase mb-2">{t('ent.domain_dns_config')}</div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-[var(--bg-surface)] p-2 rounded border border-[var(--glass-border)] text-[var(--text-secondary)] gap-3">
                                    <span className="font-mono break-all px-1">TXT @ {d.verificationTxtRecord}</span>
                                    <button onClick={() => handleVerify(d.domain)} disabled={verifying === d.domain} className="text-indigo-600 font-bold hover:underline sm:ml-4 disabled:opacity-50 whitespace-nowrap self-end sm:self-auto">{verifying === d.domain ? t('ent.domain_checking') : t('ent.domain_verify')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {(!config.domains || config.domains.length === 0) && <div className="text-center text-[var(--text-secondary)] italic py-10">{t('ent.domain_empty')}</div>}
            </div>
        </div>
    );
});

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-50 text-blue-700 border-blue-100',
    LOGIN_FAILED: 'bg-rose-50 text-rose-700 border-rose-100',
    DOMAIN_ADDED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    DOMAIN_REMOVED: 'bg-rose-50 text-rose-700 border-rose-100',
    DOMAIN_VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ZALO_OA_CONNECTED: 'bg-sky-50 text-sky-700 border-sky-100',
    ZALO_OA_DISCONNECTED: 'bg-orange-50 text-orange-700 border-orange-100',
    FACEBOOK_PAGE_CONNECTED: 'bg-violet-50 text-violet-700 border-violet-100',
    FACEBOOK_PAGE_DISCONNECTED: 'bg-pink-50 text-pink-700 border-pink-100',
    PASSWORD_RESET_REQUEST: 'bg-amber-50 text-amber-700 border-amber-100',
    PASSWORD_RESET_COMPLETE: 'bg-teal-50 text-teal-700 border-teal-100',
    EMAIL_CONFIG_UPDATED: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    SSO_CONFIG_UPDATED: 'bg-purple-50 text-purple-700 border-purple-100',
    ENTERPRISE_CONFIG_UPDATED: 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] border-[var(--glass-border)]',
    USER_CREATED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    USER_INVITED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    USER_REINVITED: 'bg-sky-50 text-sky-700 border-sky-100',
    USER_UPDATED: 'bg-amber-50 text-amber-700 border-amber-100',
    USER_DELETED: 'bg-rose-50 text-rose-700 border-rose-100',
};

const PAGE_SIZE = 20;

const AuditPanel = memo(() => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterAction, setFilterAction] = useState('');
    const [filterEntity, setFilterEntity] = useState('');
    const { t, formatDateTime } = useTranslation();

    const load = useCallback(async (p: number, action: string, entity: string) => {
        setLoading(true);
        setError(null);
        try {
            const filters: any = {};
            if (action) filters.action = action;
            if (entity) filters.entityType = entity;
            const result = await db.getAuditLogs(p, PAGE_SIZE, filters);
            setLogs(result.data || []);
            setTotal(result.total || 0);
            setTotalPages(result.totalPages || 0);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, filterAction, filterEntity); }, [load, page, filterAction, filterEntity]);

    const handleFilterChange = (action: string, entity: string) => {
        setPage(1);
        setFilterAction(action);
        setFilterEntity(entity);
    };

    const ENTITY_OPTIONS = [
        { value: '', label: t('audit.entity_all') },
        { value: 'auth', label: t('audit.entity_auth') },
        { value: 'USER', label: t('audit.entity_user') },
        { value: 'enterprise_config', label: t('audit.entity_enterprise') },
        { value: 'lead', label: 'Lead' },
        { value: 'listing', label: 'Tin đăng' },
    ];

    return (
        <div className="animate-enter">
            <SectionHeader title={t('ent.audit_title')} subtitle={t('ent.audit_subtitle')} />

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 items-center px-4 sm:px-6">
                <Dropdown
                    value={filterEntity}
                    onChange={(val) => handleFilterChange(filterAction, val as string)}
                    options={ENTITY_OPTIONS}
                    className="w-52"
                />
                <input
                    value={filterAction}
                    onChange={e => handleFilterChange(e.target.value.toUpperCase(), filterEntity)}
                    placeholder="Lọc theo action (VD: LOGIN)"
                    className="border rounded-xl px-3 py-2.5 text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] outline-none focus:ring-2 focus:ring-indigo-500/20 w-52"
                />
                {(filterAction || filterEntity) && (
                    <button
                        onClick={() => handleFilterChange('', '')}
                        className="text-xs font-bold text-rose-500 hover:underline"
                    >
                        Xoá bộ lọc
                    </button>
                )}
                <span className="text-xs text-[var(--text-secondary)] ml-auto pr-1">{total} bản ghi</span>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-xs min-w-[640px]">
                        <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_time')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_actor')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_action')}</th>
                                <th className="p-4 whitespace-nowrap">{t('ent.audit_details')}</th>
                                <th className="p-4 whitespace-nowrap">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {loading && (
                                <tr><td colSpan={5} className="p-10 text-center text-[var(--text-secondary)] animate-pulse">{t('common.loading')}</td></tr>
                            )}
                            {!loading && error && (
                                <tr><td colSpan={5} className="p-10 text-center text-rose-500">{error}</td></tr>
                            )}
                            {!loading && !error && logs.length === 0 && (
                                <tr><td colSpan={5} className="p-10 text-center text-[var(--text-secondary)] italic">{t('common.no_data') || 'Chưa có nhật ký nào'}</td></tr>
                            )}
                            {!loading && logs.map(log => (
                                <tr key={log.id} className="hover:bg-[var(--glass-surface)] transition-colors">
                                    <td className="p-4 text-[var(--text-secondary)] font-mono whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                                    <td className="p-4 font-bold text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate" title={log.actorName || log.actorId}>{log.actorName || log.actorId}</td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded border font-bold text-xs2 uppercase tracking-wide ${ACTION_COLORS[log.action] || 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] border-[var(--glass-border)]'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-4 text-[var(--text-secondary)] max-w-[200px] truncate" title={log.details}>{log.details || '—'}</td>
                                    <td className="p-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">{log.ipAddress || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--glass-border)] bg-[var(--glass-surface)]">
                        <span className="text-xs text-[var(--text-secondary)]">Trang {page} / {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-40 transition-colors"
                            >
                                ← Trước
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                                const pageNum = start + i;
                                return pageNum <= totalPages ? (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-8 h-8 text-xs font-bold rounded-lg border transition-colors ${pageNum === page ? 'bg-slate-900 text-white border-slate-900' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'}`}
                                    >
                                        {pageNum}
                                    </button>
                                ) : null;
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-40 transition-colors"
                            >
                                Sau →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const EnterpriseSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('ZALO');
    const [config, setConfig] = useState<EnterpriseConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), CONSTANTS.TOAST_DURATION);
    }, []);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const me = await db.getCurrentUser();
            setCurrentUser(me);
            
            if (me?.role !== UserRole.ADMIN) {
                setLoading(false);
                return;
            }

            const data = await db.getEnterpriseConfig();
            setConfig(data);
        } catch (e) {
            console.error("Failed to load config", e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, t]);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    if (!loading && currentUser && currentUser.role !== UserRole.ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a5 5 0 110 10A5 5 0 0112 7z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('common.access_denied') || "Access Denied"}</h2>
                <p className="text-[var(--text-tertiary)] max-w-md">
                    {t('ent.no_permission') || "You do not have permission to view this page. Only administrators can manage enterprise settings."}
                </p>
            </div>
        );
    }

    if (loading || !config) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;

    const TABS = [
        { id: 'ZALO', label: t('ent.tab_zalo') },
        { id: 'FACEBOOK', label: t('ent.tab_social') },
        { id: 'EMAIL', label: t('ent.tab_email') },
        { id: 'SSO', label: t('ent.tab_sso') },
        { id: 'DOMAINS', label: t('ent.tab_domain') },
        { id: 'AUDIT', label: t('ent.tab_audit') },
    ];

    const handleTabWheel = (e: React.WheelEvent) => {
        if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
    };

    return (
        <div className="space-y-6 pb-20 relative animate-enter">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${
                    toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'
                }`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm gap-4 w-full overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--text-tertiary)]">{t('ent.tenant_label')}:</span>
                    <span
                        title={config.tenantId}
                        className="font-mono font-bold text-xs2 bg-[var(--glass-surface-hover)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--glass-border)] cursor-default"
                    >
                        {config.tenantId?.slice(0, 8)}…
                    </span>
                    <button
                        type="button"
                        title={config.tenantId}
                        onClick={() => { copyToClipboard(config.tenantId ?? ''); notify(t('common.copied'), 'success'); }}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                </div>

                {/* Mobile Dropdown */}
                <div className="w-full lg:hidden">
                    <Dropdown 
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as string)}
                        options={TABS.map(tab => ({ value: tab.id, label: tab.label }))}
                        className="w-full"
                    />
                </div>

                {/* Desktop Tabs */}
                <div className="hidden lg:flex w-full lg:w-auto lg:max-w-3xl bg-[var(--glass-surface-hover)] p-1 rounded-xl overflow-x-auto no-scrollbar min-w-0" onWheel={handleTabWheel}>
                    {TABS.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-[var(--bg-surface)] shadow text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'ZALO' && <ZaloPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'FACEBOOK' && <FacebookPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'EMAIL' && <EmailPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'SSO' && <SSOPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'DOMAINS' && <DomainPanel config={config} onRefresh={loadConfig} notify={notify} />}
                {activeTab === 'AUDIT' && <AuditPanel />}
            </div>
        </div>
    );
};
