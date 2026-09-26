import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { EnterpriseConfig, AuditLog, User } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { copyToClipboard } from '../utils/clipboard';
import { ThemeCustomizer } from '../components/ThemeCustomizer';
import { UserActivityPanel } from '../components/UserActivityPanel';
import BrandingPanel from '../components/enterprise/BrandingPanel';
import { autoPostingApi, AutoPostingSettings } from '../services/api/autoPostingApi';
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
    Segment,
} from '../components/settings/SettingsUI';

// -----------------------------------------------------------------------------
// CONSTANTS & SHARED STYLES
// -----------------------------------------------------------------------------
const CONSTANTS = {
    TOAST_DURATION: 3000,
    MASK: '••••••••••••••••',
};

type Notify = (m: string, t: 'success' | 'error') => void;

const FIELD_LABEL = 'mb-1.5 flex flex-wrap items-baseline gap-1 text-xs font-semibold text-[var(--text-secondary)]';
const FIELD_HINT = 'mt-1 text-xs text-[var(--text-tertiary)]';
const INPUT = 'ui-input h-11 w-full';
const INPUT_MONO = 'ui-input h-11 w-full font-mono';
const BTN_PRIMARY = 'ui-button ui-button-primary ui-button-md inline-flex min-h-[40px] items-center justify-center gap-2';
const BTN_SECONDARY = 'ui-button ui-button-secondary ui-button-md inline-flex min-h-[40px] items-center justify-center gap-2';
const BTN_DANGER = 'ui-button ui-button-danger ui-button-md inline-flex min-h-[40px] items-center justify-center gap-2';
const BTN_GHOST_SM = 'ui-button ui-button-ghost ui-button-sm inline-flex min-h-[40px] items-center justify-center gap-1.5';
const ICON_BTN = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-[var(--ui-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]';
const INNER_BOX = 'rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 sm:p-4';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const ICONS = {
    BUILDING: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    COPY: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    CLOSE: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CHECK: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    ALERT: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
    INFO: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    OK: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    LOCK: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    EYE: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    EYE_OFF: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
    GLOBE: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
    PAGE: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
};

const Spinner: React.FC = () => (
    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
);

// -----------------------------------------------------------------------------
// SMALL BUILDING BLOCKS
// -----------------------------------------------------------------------------

/** Inline callout (warning / success / info) with a tinted border in the tone colour. */
const Notice: React.FC<{ tone: 'warning' | 'success' | 'info' | 'danger'; title?: React.ReactNode; children?: React.ReactNode }> = ({ tone, title, children }) => (
    <div
        role={tone === 'warning' || tone === 'danger' ? 'alert' : 'status'}
        className="flex items-start gap-3 rounded-xl border bg-[var(--glass-surface)] p-3 text-sm sm:p-4"
        style={{ borderColor: TONE_COLOR[tone] }}
    >
        <span className="mt-0.5 shrink-0" style={{ color: TONE_COLOR[tone] }}>
            {tone === 'success' ? ICONS.OK : tone === 'info' ? ICONS.INFO : ICONS.ALERT}
        </span>
        <div className="min-w-0 text-[var(--text-secondary)]">
            {title && <p className="font-semibold text-[var(--text-primary)]">{title}</p>}
            {children && <div className={cx('text-xs leading-relaxed', title ? 'mt-0.5' : null)}>{children}</div>}
        </div>
    </div>
);

/** Password-style input with a show/hide button. */
const SecretInput: React.FC<{
    id: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    showLabel: string;
    hideLabel: string;
}> = ({ id, value, onChange, placeholder, showLabel, hideLabel }) => {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <input
                id={id}
                type={visible ? 'text' : 'password'}
                className={cx(INPUT_MONO, 'pr-12')}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                autoComplete="off"
            />
            <button
                type="button"
                onClick={() => setVisible(v => !v)}
                aria-label={visible ? hideLabel : showLabel}
                aria-pressed={visible}
                className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
            >
                {visible ? ICONS.EYE_OFF : ICONS.EYE}
            </button>
        </div>
    );
};

/** Read-only value with a copy button (webhook URL, redirect URI...). */
const CopyField: React.FC<{ label: string; value: string; onCopy: () => void; copyLabel: string }> = ({ label, value, onCopy, copyLabel }) => (
    <div>
        <div className={FIELD_LABEL}>{label}</div>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] py-1 pl-3 pr-1">
            <code className="min-w-0 flex-1 break-all py-1.5 font-mono text-xs text-[var(--text-secondary)]">{value}</code>
            <button type="button" onClick={onCopy} className={BTN_GHOST_SM} aria-label={`${copyLabel}: ${label}`}>
                {ICONS.COPY}
                <span className="hidden sm:inline">{copyLabel}</span>
            </button>
        </div>
    </div>
);

/** Labelled on/off switch built on a native checkbox (keeps keyboard + form semantics). */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; stateLabel?: string; id: string }> = ({ checked, onChange, label, stateLabel, id }) => (
    <label htmlFor={id} className="inline-flex min-h-[40px] cursor-pointer items-center gap-2.5">
        {stateLabel && <StatusBadge tone={checked ? 'success' : 'neutral'}>{stateLabel}</StatusBadge>}
        <span className="relative inline-flex items-center">
            <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
            <span className="h-6 w-11 rounded-full bg-[var(--glass-surface-hover)] ring-1 ring-[var(--glass-border)] transition-colors peer-checked:bg-[var(--sgs-primary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ui-focus)]" aria-hidden="true" />
            <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" aria-hidden="true" />
        </span>
    </label>
);

/** One setup requirement. `state` null = status not known yet (shown as '—', never as missing). */
interface CheckItem { key: string; label: React.ReactNode; state: boolean | null; detail?: React.ReactNode }

/** Setup checklist with a done/total progress bar. */
const Checklist: React.FC<{ items: CheckItem[]; ariaLabel: string }> = ({ items, ariaLabel }) => {
    const { t } = useTranslation();
    const known = items.filter(i => i.state !== null);
    const done = items.filter(i => i.state === true).length;
    const total = items.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const complete = done === total && total > 0;
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-[var(--text-secondary)]">{t('ent.v2_checklist_progress')}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {known.length === 0 ? '—' : t('ent.v2_checklist_count', { done, total })}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: complete ? TONE_COLOR.success : TONE_COLOR.brand }} />
            </div>
            <ul className="mt-3 space-y-2" aria-label={ariaLabel}>
                {items.map(item => {
                    const tone: Tone = item.state === null ? 'neutral' : item.state ? 'success' : 'warning';
                    return (
                        <li key={item.key} className="flex items-start gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2.5">
                            <span
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                                style={{ background: item.state === null ? 'var(--glass-surface-hover)' : TONE_COLOR[tone] }}
                                aria-hidden="true"
                            >
                                {item.state === true ? ICONS.CHECK : item.state === false ? <span className="text-[11px] font-bold leading-none">!</span> : <span className="text-[11px] leading-none text-[var(--text-tertiary)]">—</span>}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
                                {item.detail && <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{item.detail}</div>}
                            </div>
                            <span className="shrink-0">
                                <StatusBadge tone={tone}>
                                    {item.state === null ? '—' : item.state ? t('ent.v2_check_ok') : t('ent.v2_check_missing')}
                                </StatusBadge>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

/** Centered confirmation dialog rendered in a portal. */
const ConfirmDialog: React.FC<{
    title: React.ReactNode;
    body?: React.ReactNode;
    cancelLabel: string;
    confirmLabel: string;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    cancelDisabled?: boolean;
}> = ({ title, body, cancelLabel, confirmLabel, busy, onCancel, onConfirm, cancelDisabled }) => createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-labelledby="ent-confirm-title" className="w-full max-w-sm rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-enter">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--glass-surface)]" style={{ color: TONE_COLOR.danger }}>{ICONS.ALERT}</span>
            <h3 id="ent-confirm-title" className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
            {body && <div className="mt-2 text-sm text-[var(--text-secondary)]">{body}</div>}
            <div className="mt-6 flex gap-3">
                <button type="button" onClick={onCancel} disabled={cancelDisabled} className={cx(BTN_SECONDARY, 'flex-1')}>{cancelLabel}</button>
                <button type="button" onClick={onConfirm} disabled={busy} className={cx(BTN_DANGER, 'flex-1')}>
                    {busy && <Spinner />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>,
    document.body,
);

// -----------------------------------------------------------------------------
// ZALO OA
// -----------------------------------------------------------------------------
type ZaloVerificationCheck = 'PASS' | 'FAIL' | 'NOT_RUN';
type ZaloVerificationStatus = 'READY' | 'NOT_READY';
type ZaloVerificationHistoryEntry = {
    checkedAt: string;
    status: ZaloVerificationStatus;
    reasonCode: string;
    checks: { oaId: ZaloVerificationCheck; quota: ZaloVerificationCheck };
    actorName?: string | null;
};

const CHECK_TONE: Record<ZaloVerificationCheck, Tone> = { PASS: 'success', FAIL: 'danger', NOT_RUN: 'neutral' };
const CHECK_KEY: Record<ZaloVerificationCheck, string> = { PASS: 'ent.v2_check_pass', FAIL: 'ent.v2_check_fail', NOT_RUN: 'ent.v2_check_not_run' };

const ZaloPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: Notify }) => {
    const { t, formatDate } = useTranslation();
    const [connecting, setConnecting] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [zaloStatus, setZaloStatus] = useState<{ webhookSecretConfigured: boolean; appIdConfigured: boolean; webhookUrl: string } | null>(null);
    const [form, setForm] = useState({ appId: '', oaId: '', oaName: '', appSecret: '', accessToken: '' });
    const [tokenForm, setTokenForm] = useState('');
    const [updatingToken, setUpdatingToken] = useState(false);
    const [showTokenForm, setShowTokenForm] = useState(false);
    const [probeUserId, setProbeUserId] = useState(config.zalo?.broadcastProbeUserId || '');
    const [savingProbeUser, setSavingProbeUser] = useState(false);
    const [verifyingBroadcast, setVerifyingBroadcast] = useState(false);
    const [broadcastVerification, setBroadcastVerification] = useState<{
        status: ZaloVerificationStatus;
        reason: string | null;
        checks: { oaId: ZaloVerificationCheck; quota: ZaloVerificationCheck };
        checkedAt: string;
        reasonCode?: string;
    } | null>(null);
    const [broadcastVerificationHistory, setBroadcastVerificationHistory] = useState<ZaloVerificationHistoryEntry[]>([]);
    const loadBroadcastVerificationHistory = useCallback(async () => {
        try {
            setBroadcastVerificationHistory(await db.getZaloBroadcastVerificationHistory(10));
        } catch {
            setBroadcastVerificationHistory([]);
        }
    }, []);
    useEffect(() => {
        db.getZaloStatus().then(setZaloStatus);
        loadBroadcastVerificationHistory();
    }, [loadBroadcastVerificationHistory]);
    useEffect(() => {
        setProbeUserId(config.zalo?.broadcastProbeUserId || '');
    }, [config.zalo?.broadcastProbeUserId]);
    const handleConnect = async () => {
        if (!form.appId.trim() || !form.oaId.trim() || !form.oaName.trim()) {
            notify(t('ent.zalo_form_required'), 'error');
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
            notify(t('ent.zalo_token_required'), 'error');
            return;
        }
        setUpdatingToken(true);
        try {
            await db.updateZaloToken(tokenForm.trim());
            notify(t('ent.zalo_token_updated'), 'success');
            setTokenForm('');
            setShowTokenForm(false);
            onRefresh();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setUpdatingToken(false); }
    };
    const handleSaveProbeUser = async () => {
        const value = probeUserId.trim();
        if (!value) {
            notify(t('ent.zalo_broadcast_probe_required'), 'error');
            return;
        }
        setSavingProbeUser(true);
        try {
            await db.updateZaloBroadcastProbeUser(value);
            setBroadcastVerification(null);
            notify(t('ent.zalo_broadcast_probe_saved'), 'success');
            onRefresh();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setSavingProbeUser(false);
        }
    };
    const handleVerifyBroadcast = async () => {
        setVerifyingBroadcast(true);
        try {
            const result = await db.verifyZaloBroadcastAccess();
            setBroadcastVerification({
                status: result.status,
                reason: result.reason,
                checks: result.checks,
                checkedAt: result.checkedAt,
                reasonCode: result.reasonCode,
            });
            await loadBroadcastVerificationHistory();
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setVerifyingBroadcast(false);
        }
    };
    const webhookUrl = config.zalo?.webhookUrl || zaloStatus?.webhookUrl || `${window.location.origin}/api/webhooks/zalo`;
    const accessTokenConfigured = Boolean(config.zalo?.accessTokenConfigured);
    const latestBroadcastVerification = broadcastVerification || broadcastVerificationHistory[0] || null;
    const connected = !!config.zalo?.enabled;
    const appId = (config.zalo as any)?.appId as string | undefined;

    const statusLabel = (s: ZaloVerificationStatus) => (s === 'READY' ? t('ent.v2_status_ready') : t('ent.v2_status_not_ready'));
    const readyCount = broadcastVerificationHistory.filter(e => e.status === 'READY').length;
    const historySegments: Segment[] = [
        { label: t('ent.v2_status_ready'), value: readyCount, color: TONE_COLOR.success },
        { label: t('ent.v2_status_not_ready'), value: broadcastVerificationHistory.length - readyCount, color: TONE_COLOR.warning },
    ];

    const readinessItems: CheckItem[] = [
        { key: 'oa', label: t('ent.v2_zalo_check_oa'), state: connected, detail: connected ? config.zalo?.oaName : t('ent.zalo_status_disconnected') },
        { key: 'secret', label: t('ent.v2_zalo_check_secret'), state: zaloStatus ? !!zaloStatus.webhookSecretConfigured : null, detail: 'ZALO_OA_SECRET' },
        { key: 'token', label: t('ent.zalo_oa_access_token'), state: connected ? accessTokenConfigured : false, detail: accessTokenConfigured ? t('ent.zalo_token_configured') : t('ent.zalo_token_missing') },
        { key: 'broadcast', label: t('ent.zalo_broadcast_title'), state: latestBroadcastVerification ? latestBroadcastVerification.status === 'READY' : null, detail: latestBroadcastVerification ? formatDate(latestBroadcastVerification.checkedAt) : t('ent.v2_check_not_run') },
    ];

    const readinessCard = (
        <SettingsCard title={t('ent.v2_readiness_title')} description={t('ent.v2_readiness_desc')}>
            <div className="space-y-4">
                <Checklist items={readinessItems} ariaLabel={t('ent.v2_readiness_title')} />
                <CopyField label={t('ent.zalo_webhook')} value={webhookUrl} onCopy={() => copyWebhook(webhookUrl)} copyLabel={t('common.copy')} />
                <p className={FIELD_HINT}>{connected ? t('ent.zalo_tips') : t('ent.zalo_webhook_guide')}</p>
            </div>
        </SettingsCard>
    );

    return (
        <div className="space-y-5">
            {zaloStatus && !zaloStatus.webhookSecretConfigured && (
                <Notice tone="warning" title={t('ent.zalo_secret_warning')}>{t('ent.zalo_secret_hint')}</Notice>
            )}
            {connected ? (
                <>
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <SettingsCard
                            title={t('ent.zalo_title')}
                            description={t('ent.zalo_subtitle')}
                            actions={<StatusBadge tone="success">{t('ent.zalo_status_connected')}</StatusBadge>}
                        >
                            <div className="space-y-4">
                                <div className="flex min-w-0 items-center gap-4">
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sgs-primary text-xl font-bold text-white" aria-hidden="true">Z</span>
                                    <div className="min-w-0">
                                        <h4 className="break-words text-base font-bold text-[var(--text-primary)]">{config.zalo.oaName}</h4>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">{t('ent.zalo_oa_id')}: {config.zalo.oaId}</span>
                                            {appId && (
                                                <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">{t('ent.zalo_app_id')}: {appId}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className={INNER_BOX}>
                                        <dt className="text-xs font-medium text-[var(--text-tertiary)]">{t('ent.zalo_role')}</dt>
                                        <dd className="mt-1.5 flex flex-wrap gap-1.5">
                                            <span className="ui-badge ui-badge-neutral">{t('ent.zalo_perm_msg')}</span>
                                            <span className="ui-badge ui-badge-neutral">{t('ent.zalo_perm_user')}</span>
                                        </dd>
                                    </div>
                                    <div className={INNER_BOX}>
                                        <dt className="text-xs font-medium text-[var(--text-tertiary)]">{t('ent.zalo_connected_at')}</dt>
                                        <dd className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{config.zalo.connectedAt ? formatDate(config.zalo.connectedAt) : '—'}</dd>
                                    </div>
                                </dl>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setShowTokenForm(s => !s)} aria-expanded={showTokenForm} className={BTN_SECONDARY}>
                                        {accessTokenConfigured ? t('ent.zalo_update_token') : t('ent.zalo_add_token')}
                                    </button>
                                    <button type="button" onClick={() => setConfirmDisconnect(true)} className={BTN_DANGER}>
                                        {t('ent.zalo_disconnect_btn')}
                                    </button>
                                </div>
                                {showTokenForm && (
                                    <div className={INNER_BOX}>
                                        <label htmlFor="zalo-new-token" className={FIELD_LABEL}>{t('ent.zalo_token_new_label')}</label>
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <input
                                                id="zalo-new-token"
                                                type="password"
                                                className={cx(INPUT_MONO, 'sm:flex-1')}
                                                placeholder={t('ent.zalo_token_placeholder')}
                                                value={tokenForm}
                                                onChange={e => setTokenForm(e.target.value)}
                                                autoComplete="off"
                                            />
                                            <button type="button" onClick={handleUpdateToken} disabled={updatingToken} className={cx(BTN_PRIMARY, 'shrink-0')}>
                                                {updatingToken && <Spinner />}
                                                {t('common.save')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SettingsCard>
                        {readinessCard}
                    </div>

                    <SettingsCard
                        title={t('ent.zalo_broadcast_title')}
                        description={t('ent.zalo_broadcast_description')}
                        actions={latestBroadcastVerification && (
                            <StatusBadge tone={latestBroadcastVerification.status === 'READY' ? 'success' : 'warning'}>{statusLabel(latestBroadcastVerification.status)}</StatusBadge>
                        )}
                    >
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="zalo-probe-user" className={FIELD_LABEL}>{t('ent.zalo_broadcast_probe_label')}</label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        id="zalo-probe-user"
                                        value={probeUserId}
                                        onChange={e => setProbeUserId(e.target.value)}
                                        placeholder={t('ent.zalo_broadcast_probe_placeholder')}
                                        className={cx(INPUT_MONO, 'sm:flex-1')}
                                    />
                                    <button type="button" onClick={handleSaveProbeUser} disabled={savingProbeUser || !probeUserId.trim()} className={cx(BTN_SECONDARY, 'shrink-0')}>
                                        {savingProbeUser ? t('common.processing') : t('common.save')}
                                    </button>
                                </div>
                                <p className={FIELD_HINT}>{t('ent.zalo_broadcast_probe_hint')}</p>
                            </div>
                            <button type="button" onClick={handleVerifyBroadcast} disabled={verifyingBroadcast} className={cx(BTN_PRIMARY, 'w-full sm:w-auto')}>
                                {verifyingBroadcast && <Spinner />}
                                {t('ent.zalo_broadcast_verify')}
                            </button>
                            {broadcastVerification && (
                                <Notice
                                    tone={broadcastVerification.status === 'READY' ? 'success' : 'warning'}
                                    title={broadcastVerification.status === 'READY' ? t('ent.zalo_broadcast_ready') : t('ent.zalo_broadcast_not_ready')}
                                >
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-1.5">{t('ent.zalo_broadcast_oa_check')}: <StatusBadge tone={CHECK_TONE[broadcastVerification.checks.oaId]}>{t(CHECK_KEY[broadcastVerification.checks.oaId])}</StatusBadge></span>
                                        <span className="inline-flex items-center gap-1.5">{t('ent.zalo_broadcast_quota_check')}: <StatusBadge tone={CHECK_TONE[broadcastVerification.checks.quota]}>{t(CHECK_KEY[broadcastVerification.checks.quota])}</StatusBadge></span>
                                    </div>
                                    {broadcastVerification.reason && <p className="mt-2">{broadcastVerification.reason}</p>}
                                    <p className="mt-2 text-[var(--text-tertiary)]">{formatDate(broadcastVerification.checkedAt)}</p>
                                </Notice>
                            )}
                            {broadcastVerificationHistory.length > 0 && (
                                <div className="space-y-3 border-t border-[var(--glass-border)] pt-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('ent.zalo_broadcast_history_title')}</h4>
                                        <span className="text-xs text-[var(--text-tertiary)]">{t('ent.zalo_broadcast_history_safe')}</span>
                                    </div>
                                    <DistributionBar segments={historySegments} ariaLabel={t('ent.v2_zalo_history_aria', { n: broadcastVerificationHistory.length })} />
                                    <ul className="space-y-2">
                                        {broadcastVerificationHistory.map((entry, index) => (
                                            <li key={`${entry.checkedAt}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 text-xs">
                                                <StatusBadge tone={entry.status === 'READY' ? 'success' : 'warning'}>{statusLabel(entry.status)}</StatusBadge>
                                                <span className="font-mono text-[var(--text-secondary)]">{entry.reasonCode}</span>
                                                <span className="text-[var(--text-tertiary)]">{t('ent.zalo_broadcast_oa_check')}: {t(CHECK_KEY[entry.checks.oaId])}</span>
                                                <span className="text-[var(--text-tertiary)]">{t('ent.zalo_broadcast_quota_check')}: {t(CHECK_KEY[entry.checks.quota])}</span>
                                                <span className="text-[var(--text-tertiary)] sm:ml-auto">{formatDate(entry.checkedAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </SettingsCard>

                    {confirmDisconnect && (
                        <ConfirmDialog
                            title={t('ent.zalo_disconnect_btn')}
                            body={t('ent.zalo_disconnect_confirm')}
                            cancelLabel={t('common.cancel')}
                            confirmLabel={t('ent.zalo_disconnect_btn')}
                            busy={disconnecting}
                            onCancel={() => setConfirmDisconnect(false)}
                            onConfirm={handleDisconnect}
                        />
                    )}
                </>
            ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <SettingsCard
                        title={t('ent.zalo_title')}
                        description={t('ent.zalo_guide')}
                        actions={<StatusBadge tone="neutral">{t('ent.zalo_status_disconnected')}</StatusBadge>}
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="zalo-app-id" className={FIELD_LABEL}>{t('ent.zalo_app_id')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span></label>
                                    <input id="zalo-app-id" required className={INPUT_MONO} placeholder={t('ent.zalo_app_id_placeholder')} value={form.appId} onChange={e => setForm({ ...form, appId: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="zalo-oa-id" className={FIELD_LABEL}>{t('ent.zalo_oa_id')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span></label>
                                    <input id="zalo-oa-id" required className={INPUT_MONO} placeholder={t('ent.zalo_oa_id_placeholder')} value={form.oaId} onChange={e => setForm({ ...form, oaId: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="zalo-oa-name" className={FIELD_LABEL}>{t('ent.zalo_oa_name')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span></label>
                                <input id="zalo-oa-name" required className={INPUT} placeholder={t('ent.zalo_oa_name_placeholder')} value={form.oaName} onChange={e => setForm({ ...form, oaName: e.target.value })} />
                            </div>
                            <div>
                                <label htmlFor="zalo-app-secret" className={FIELD_LABEL}>
                                    {t('ent.zalo_app_secret')} <span className="font-normal text-[var(--text-tertiary)]">{t('ent.zalo_secret_optional')}</span>
                                </label>
                                <SecretInput id="zalo-app-secret" value={form.appSecret} onChange={v => setForm({ ...form, appSecret: v })} placeholder={CONSTANTS.MASK} showLabel={t('ent.sso_show')} hideLabel={t('ent.sso_hide')} />
                            </div>
                            <div>
                                <label htmlFor="zalo-access-token" className={FIELD_LABEL}>
                                    {t('ent.zalo_oa_access_token')} <span className="font-normal text-[var(--text-tertiary)]">{t('ent.zalo_token_optional')}</span>
                                </label>
                                <SecretInput id="zalo-access-token" value={form.accessToken} onChange={v => setForm({ ...form, accessToken: v })} placeholder={CONSTANTS.MASK} showLabel={t('ent.sso_show')} hideLabel={t('ent.sso_hide')} />
                                <p className={FIELD_HINT}>
                                    {t('ent.zalo_token_guide_prefix')}{' '}
                                    <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="font-medium text-[var(--ui-info)] underline">{t('ent.v2_zalo_dev_console')}</a>{' '}
                                    {t('ent.zalo_token_guide_suffix')}
                                </p>
                            </div>
                            <button type="button" onClick={handleConnect} disabled={connecting} className={cx(BTN_PRIMARY, 'w-full')}>
                                {connecting && <Spinner />}
                                {t('ent.zalo_connect_btn')}
                            </button>
                        </div>
                    </SettingsCard>
                    {readinessCard}
                </div>
            )}
        </div>
    );
});

// -----------------------------------------------------------------------------
// FACEBOOK PAGES
// -----------------------------------------------------------------------------
const FacebookPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: Notify }) => {
    const { t, formatDate } = useTranslation();
    const emptyForm = { name: '', pageId: '', pageUrl: '', accessToken: '' };
    const [form, setForm] = useState(emptyForm);
    const [connecting, setConnecting] = useState(false);
    const [confirmPageId, setConfirmPageId] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [fbStatus, setFbStatus] = useState<{ appSecretConfigured: boolean; verifyTokenConfigured: boolean; webhookUrl: string } | null>(null);
    useEffect(() => {
        db.getFacebookStatus().then(setFbStatus).catch(() => {});
    }, []);
    const handleConnect = async () => {
        if (!form.name.trim() || !form.pageId.trim()) {
            notify(t('ent.facebook_form_required'), 'error');
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
    const pages = config.facebookPages || [];
    const withToken = pages.filter(p => !!p.accessToken);
    const verified = withToken.filter(p => p.verificationStatus === 'VERIFIED').length;
    const segments: Segment[] = [
        { label: t('ent.facebook_publish_verified'), value: verified, color: TONE_COLOR.success },
        { label: t('ent.facebook_publish_not_verified'), value: withToken.length - verified, color: TONE_COLOR.warning },
        { label: t('ent.v2_fb_no_token'), value: pages.length - withToken.length, color: TONE_COLOR.neutral },
    ];
    const envItems: CheckItem[] = [
        { key: 'secret', label: t('ent.v2_fb_check_secret'), state: fbStatus ? !!fbStatus.appSecretConfigured : null, detail: t('ent.facebook_env_app_secret') },
        { key: 'verify', label: t('ent.v2_fb_check_verify'), state: fbStatus ? !!fbStatus.verifyTokenConfigured : null, detail: t('ent.facebook_env_verify_token') },
    ];
    const copyWebhook = async (url: string) => {
        await copyToClipboard(url);
        notify(t('common.copied'), 'success');
    };

    return (
        <div className="space-y-5">
            {secretsMissing && (
                <Notice tone="warning" title={t('ent.facebook_secret_warning')}>{t('ent.facebook_secret_hint')}</Notice>
            )}
            {fbStatus && fbStatus.appSecretConfigured && fbStatus.verifyTokenConfigured && (
                <Notice tone="success" title={t('ent.facebook_webhook_active')} />
            )}

            <SettingsCard title={t('ent.facebook_title')} description={t('ent.facebook_subtitle')}>
                <div className="space-y-4">
                    <StatGrid cols={3}>
                        <StatTile label={t('ent.v2_fb_stat_pages')} value={pages.length} tone="brand" />
                        <StatTile label={t('ent.v2_fb_stat_token')} value={withToken.length} />
                        <StatTile label={t('ent.v2_fb_stat_verified')} value={verified} tone={verified > 0 ? 'success' : 'neutral'} />
                    </StatGrid>
                    <DistributionBar segments={segments} ariaLabel={t('ent.v2_fb_share_aria')} emptyText={t('ent.facebook_empty')} />
                </div>
            </SettingsCard>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <SettingsCard title={t('ent.v2_fb_connect_title')} description={<>{t('ent.facebook_guide')}{' '}<a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="font-medium text-[var(--ui-info)] underline">{t('ent.facebook_dev_link')}</a>.</>}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="fb-page-name" className={FIELD_LABEL}>{t('ent.facebook_page_name')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span></label>
                                <input id="fb-page-name" required className={INPUT} placeholder={t('ent.facebook_page_name_placeholder')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label htmlFor="fb-page-id" className={FIELD_LABEL}>{t('ent.facebook_page_id')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span></label>
                                <input id="fb-page-id" required className={INPUT_MONO} placeholder={t('ent.facebook_page_id_placeholder')} value={form.pageId} onChange={e => setForm({ ...form, pageId: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="fb-page-url" className={FIELD_LABEL}>{t('ent.facebook_page_url')}</label>
                            <input id="fb-page-url" type="url" className={INPUT} placeholder={t('ent.facebook_page_url_placeholder')} value={form.pageUrl} onChange={e => setForm({ ...form, pageUrl: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="fb-page-token" className={FIELD_LABEL}>
                                {t('ent.facebook_access_token')} <span className="font-normal text-[var(--text-tertiary)]">{t('ent.facebook_token_optional')}</span>
                            </label>
                            <SecretInput id="fb-page-token" value={form.accessToken} onChange={v => setForm({ ...form, accessToken: v })} placeholder={t('ent.facebook_token_placeholder')} showLabel={t('ent.sso_show')} hideLabel={t('ent.sso_hide')} />
                        </div>
                        <button type="button" onClick={handleConnect} disabled={connecting} className={cx(BTN_PRIMARY, 'w-full')}>
                            {connecting && <Spinner />}
                            {t('ent.facebook_connect_btn')}
                        </button>
                    </div>
                </SettingsCard>

                <SettingsCard title={t('ent.v2_env_title')} description={t('ent.facebook_secret_hint')}>
                    <div className="space-y-4">
                        <Checklist items={envItems} ariaLabel={t('ent.v2_env_title')} />
                        {fbStatus?.webhookUrl && (
                            <CopyField label={t('ent.zalo_webhook')} value={fbStatus.webhookUrl} onCopy={() => copyWebhook(fbStatus.webhookUrl)} copyLabel={t('common.copy')} />
                        )}
                    </div>
                </SettingsCard>
            </div>

            <SettingsCard title={t('ent.v2_fb_pages_title')} actions={<StatusBadge tone={pages.length ? 'info' : 'neutral'}>{pages.length}</StatusBadge>}>
                {pages.length === 0 ? (
                    <EmptyState icon={ICONS.PAGE} title={t('ent.facebook_empty')} />
                ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {pages.map(page => (
                            <li key={page.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 sm:p-4">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-lg font-bold text-[#1877F2]" aria-hidden="true">f</span>
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{page.name}</div>
                                        <div className="truncate font-mono text-xs text-[var(--text-tertiary)]">{t('ent.facebook_page_id_label')} {page.id}</div>
                                        {page.pageUrl && (
                                            <a href={page.pageUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-[var(--ui-info)] hover:underline">{page.pageUrl}</a>
                                        )}
                                        {page.connectedAt && (
                                            <div className="text-xs text-[var(--text-tertiary)]">{t('ent.facebook_connected_at')}: {formatDate(page.connectedAt)}</div>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {page.accessToken ? (
                                                <>
                                                    <StatusBadge tone="success">{t('ent.token_configured')}</StatusBadge>
                                                    <StatusBadge tone={page.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                                                        {page.verificationStatus === 'VERIFIED' ? t('ent.facebook_publish_verified') : t('ent.facebook_publish_not_verified')}
                                                    </StatusBadge>
                                                </>
                                            ) : (
                                                <StatusBadge tone="neutral">{t('ent.v2_fb_no_token')}</StatusBadge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setConfirmPageId(page.id)} className={ICON_BTN} aria-label={t('ent.v2_fb_remove_aria', { name: page.name })}>
                                    {ICONS.CLOSE}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </SettingsCard>

            {confirmPageId && (
                <ConfirmDialog
                    title={t('ent.facebook_disconnect_confirm')}
                    body={<p className="rounded-lg bg-[var(--glass-surface)] px-3 py-2 font-mono text-xs">{t('ent.facebook_page_id_label')} {confirmPageId}</p>}
                    cancelLabel={t('common.cancel')}
                    confirmLabel={t('ent.disconnect_confirm')}
                    busy={disconnecting}
                    cancelDisabled={disconnecting}
                    onCancel={() => setConfirmPageId(null)}
                    onConfirm={handleDisconnect}
                />
            )}
        </div>
    );
});

// -----------------------------------------------------------------------------
// AUTO POSTING (draft generation)
// -----------------------------------------------------------------------------
const toMinutes = (hhmm: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return null;
    const v = Number(m[1]) * 60 + Number(m[2]);
    return v >= 0 && v <= 24 * 60 ? v : null;
};

/** 24h track showing the configured run window (wraps past midnight when end < start). */
const TimeWindowBar: React.FC<{ start: string; end: string; ariaLabel: string }> = ({ start, end, ariaLabel }) => {
    const s = toMinutes(start);
    const e = toMinutes(end);
    if (s == null || e == null) return null;
    const day = 24 * 60;
    const pieces = s <= e ? [[s, e]] : [[s, day], [0, e]];
    return (
        <div role="img" aria-label={ariaLabel} className="mt-3">
            <div className="relative h-3 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                {pieces.map(([a, b]) => (
                    <span key={`${a}-${b}`} className="absolute inset-y-0 rounded-full" style={{ left: `${(a / day) * 100}%`, width: `${Math.max(0.5, ((b - a) / day) * 100)}%`, background: TONE_COLOR.brand }} />
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--text-tertiary)]" aria-hidden="true">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>
        </div>
    );
};

const AUTO_PLATFORMS: Array<[string, string]> = [
    ['FACEBOOK_PAGE', 'ent.v2_auto_platform_facebook'],
    ['ZALO_BROADCAST', 'ent.v2_auto_platform_zalo'],
];

const AutoPostingPanel = memo(({ notify }: { notify: Notify }) => {
    const { t } = useTranslation();
    const tRef = useRef(t);
    tRef.current = t;
    const [settings, setSettings] = useState<AutoPostingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [start, setStart] = useState('08:00');
    const [end, setEnd] = useState('11:00');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const value = await autoPostingApi.getSettings();
            setSettings(value);
            setStart(value.timeWindows?.[0]?.start || '08:00');
            setEnd(value.timeWindows?.[0]?.end || '11:00');
            setError('');
        } catch (e: any) {
            setError(e?.message || tRef.current('ent.v2_auto_load_error'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const togglePlatform = (platform: string) => {
        setSettings(current => {
            if (!current) return current;
            const platforms = current.platforms.includes(platform)
                ? current.platforms.filter(item => item !== platform)
                : [...current.platforms, platform];
            return { ...current, platforms: platforms.length ? platforms : ['FACEBOOK_PAGE'] };
        });
    };

    const save = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const saved = await autoPostingApi.updateSettings({
                enabled: settings.enabled,
                postsPerDay: settings.postsPerDay,
                recycleAfterDays: settings.recycleAfterDays,
                timeWindows: [{ start, end }],
                platforms: settings.platforms,
            });
            setSettings(saved);
            notify(t('ent.v2_auto_saved'), 'success');
        } catch (e: any) {
            notify(e?.message || t('ent.v2_auto_save_error'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <SettingsCard><p className="animate-pulse text-sm text-[var(--text-secondary)]" role="status">{t('ent.v2_auto_loading')}</p></SettingsCard>;
    }
    if (!settings) {
        return <Notice tone="danger" title={error || t('ent.v2_auto_empty')} />;
    }

    return (
        <SettingsCard
            title={t('ent.v2_auto_title')}
            description={t('ent.v2_auto_desc')}
            actions={
                <Toggle
                    id="auto-posting-enabled"
                    checked={settings.enabled}
                    onChange={v => setSettings({ ...settings, enabled: v })}
                    label={t('ent.v2_auto_enable')}
                    stateLabel={settings.enabled ? t('common.active') : t('common.disabled')}
                />
            }
        >
            <div className="space-y-5">
                <p className="text-xs text-[var(--text-tertiary)]">{t('ent.v2_auto_enable_hint')}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="auto-posts-per-day" className={FIELD_LABEL}>{t('ent.v2_auto_posts_per_day')}</label>
                        <input id="auto-posts-per-day" type="number" min={1} max={50} value={settings.postsPerDay} onChange={event => setSettings({ ...settings, postsPerDay: Number(event.target.value) })} className={INPUT} />
                    </div>
                    <div>
                        <label htmlFor="auto-recycle" className={FIELD_LABEL}>{t('ent.v2_auto_recycle')}</label>
                        <input id="auto-recycle" type="number" min={0} value={settings.recycleAfterDays} onChange={event => setSettings({ ...settings, recycleAfterDays: Number(event.target.value) })} className={INPUT} />
                    </div>
                </div>
                <fieldset>
                    <legend className={FIELD_LABEL}>{t('ent.v2_auto_window')}</legend>
                    <div className="flex flex-wrap items-center gap-3">
                        <input type="time" value={start} onChange={event => setStart(event.target.value)} className="ui-input h-11 w-32" aria-label={t('ent.v2_auto_window_start')} />
                        <span className="text-sm text-[var(--text-tertiary)]">{t('ent.v2_auto_window_to')}</span>
                        <input type="time" value={end} onChange={event => setEnd(event.target.value)} className="ui-input h-11 w-32" aria-label={t('ent.v2_auto_window_end')} />
                    </div>
                    <TimeWindowBar start={start} end={end} ariaLabel={t('ent.v2_auto_window_aria', { start, end })} />
                    <p className={FIELD_HINT}>{t('ent.v2_auto_window_hint')}</p>
                </fieldset>
                <fieldset>
                    <legend className={FIELD_LABEL}>{t('ent.v2_auto_platforms')}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {AUTO_PLATFORMS.map(([platform, labelKey]) => {
                            const on = settings.platforms.includes(platform);
                            return (
                                <label key={platform} className={cx('flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors', on ? 'border-[var(--sgs-primary)] bg-[var(--glass-surface)]' : 'border-[var(--glass-border)] hover:border-[var(--ui-border-strong)]')}>
                                    <input type="checkbox" checked={on} onChange={() => togglePlatform(platform)} className="h-4 w-4 accent-[var(--sgs-primary)]" />
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">{t(labelKey)}</span>
                                </label>
                            );
                        })}
                    </div>
                    <p className={FIELD_HINT}>{t('ent.v2_auto_platforms_hint')}</p>
                </fieldset>
                {error && <Notice tone="danger" title={error} />}
                <div className="flex justify-end border-t border-[var(--glass-border)] pt-4">
                    <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, 'w-full sm:w-auto')}>
                        {saving && <Spinner />}
                        {saving ? t('ent.v2_auto_saving') : t('ent.email_save')}
                    </button>
                </div>
            </div>
        </SettingsCard>
    );
});

// -----------------------------------------------------------------------------
// EMAIL (SMTP)
// -----------------------------------------------------------------------------
const EmailPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: Notify }) => {
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
        try { await db.testSmtpConnection(); notify(t('enterprise.smtp_success'), 'success'); }
        catch (e: any) { notify(e.message || t('enterprise.smtp_fail'), 'error'); }
        finally { setTesting(false); }
    };
    const handleSendTestEmail = async () => {
        setSendingTest(true);
        try { await db.sendTestEmail(); notify(t('enterprise.email_sent'), 'success'); }
        catch (e: any) { notify(e.message || t('enterprise.email_fail'), 'error'); }
        finally { setSendingTest(false); }
    };
    const setupItems: CheckItem[] = [
        { key: 'host', label: t('ent.email_host'), state: !!form.host && !!form.port, detail: form.host ? `${form.host}:${form.port || '—'}` : undefined },
        { key: 'user', label: t('ent.email_user'), state: !!form.user, detail: form.user || undefined },
        { key: 'from', label: t('ent.email_from_address'), state: !!form.fromAddress, detail: form.fromAddress ? `${form.fromName || ''} <${form.fromAddress}>`.trim() : undefined },
    ];
    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <SettingsCard
                title={t('ent.email_title')}
                description={t('ent.email_subtitle')}
                actions={
                    <Toggle
                        id="smtp-enabled"
                        checked={form.enabled}
                        onChange={v => setForm({ ...form, enabled: v })}
                        label={t('ent.email_title')}
                        stateLabel={form.enabled ? t('common.active') : t('common.disabled')}
                    />
                }
            >
                <div className="space-y-5">
                    <fieldset disabled={!form.enabled} className={cx('space-y-4 transition-opacity', !form.enabled && 'opacity-60')}>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="smtp-host" className={FIELD_LABEL}>{t('ent.email_host')}</label>
                                <input id="smtp-host" className={INPUT} value={form.host} onChange={e => setForm({ ...form, host: e.target.value.trim() })} placeholder={t('ent.email_smtp_placeholder')} />
                            </div>
                            <div>
                                <label htmlFor="smtp-port" className={FIELD_LABEL}>{t('ent.email_port')}</label>
                                <input
                                    id="smtp-port"
                                    type="number" min={1} max={65535}
                                    className={INPUT}
                                    value={isNaN(form.port) || form.port === 0 ? '' : form.port}
                                    onChange={e => { const v = parseInt(e.target.value); setForm({ ...form, port: isNaN(v) ? 0 : v }); }}
                                    onBlur={() => { if (!form.port) setForm({ ...form, port: 587 }); }}
                                    placeholder="587"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="smtp-user" className={FIELD_LABEL}>{t('ent.email_user')}</label>
                                <input id="smtp-user" className={INPUT} value={form.user} onChange={e => setForm({ ...form, user: e.target.value.trim() })} placeholder={t('ent.email_user_placeholder')} autoComplete="off" />
                            </div>
                            <div>
                                <label htmlFor="smtp-pass" className={FIELD_LABEL}>{t('ent.email_pass')}</label>
                                <input id="smtp-pass" type="password" className={INPUT} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={CONSTANTS.MASK} autoComplete="new-password" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="smtp-from-name" className={FIELD_LABEL}>{t('ent.email_from_name')}</label>
                                <input id="smtp-from-name" className={INPUT} value={form.fromName || ''} onChange={e => setForm({ ...form, fromName: e.target.value })} placeholder={t('ent.email_from_name_placeholder')} />
                            </div>
                            <div>
                                <label htmlFor="smtp-from-address" className={FIELD_LABEL}>{t('ent.email_from_address')}</label>
                                <input id="smtp-from-address" type="email" className={INPUT} value={form.fromAddress || ''} onChange={e => setForm({ ...form, fromAddress: e.target.value.trim() })} placeholder={t('ent.email_from_addr_placeholder')} />
                            </div>
                        </div>
                        <label htmlFor="smtp-secure" className={cx(INNER_BOX, 'flex min-h-[44px] cursor-pointer items-start gap-3')}>
                            <input type="checkbox" id="smtp-secure" checked={!!form.secure} onChange={e => setForm({ ...form, secure: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sgs-primary)]" />
                            <span className="text-sm text-[var(--text-secondary)]">
                                <span className="font-semibold text-[var(--text-primary)]">{t('ent.email_ssl_label')}</span> — {t('ent.email_ssl_hint')}
                            </span>
                        </label>
                    </fieldset>
                    <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                        {form.enabled && (
                            <>
                                <button type="button" onClick={handleTestConnection} disabled={testing || !form.host} className={BTN_SECONDARY}>
                                    {testing && <Spinner />}
                                    {testing ? t('ent.email_testing') : t('ent.email_test_conn')}
                                </button>
                                <button type="button" onClick={handleSendTestEmail} disabled={sendingTest || !form.host} className={BTN_SECONDARY}>
                                    {sendingTest && <Spinner />}
                                    {sendingTest ? t('ent.email_sending') : t('ent.email_send_test')}
                                </button>
                            </>
                        )}
                        <button type="button" onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
                            {saving ? t('auth.processing') : t('ent.email_save')}
                        </button>
                    </div>
                </div>
            </SettingsCard>
            <SettingsCard title={t('ent.v2_setup_title')} description={t('ent.v2_email_setup_desc')}>
                <Checklist items={setupItems} ariaLabel={t('ent.v2_setup_title')} />
            </SettingsCard>
        </div>
    );
});

// -----------------------------------------------------------------------------
// SSO
// -----------------------------------------------------------------------------
const SSOPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: Notify }) => {
    const { t } = useTranslation();
    const [sso, setSso] = useState(config.sso);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState<{ success: boolean; message?: string; error?: string; metadata?: any } | null>(null);
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    useEffect(() => { setSso(config.sso); }, [config.sso]);
    const handleSave = async () => {
        if (sso.enabled && (!sso.issuerUrl || !sso.clientId)) {
            notify(t('ent.sso_save_error'), 'error');
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
            if (result.success) notify(t('enterprise.oidc_success'), 'success');
        } catch (e: any) {
            setVerifyResult({ success: false, error: e.message });
            notify(e.message || t('enterprise.sso_fail'), 'error');
        } finally { setVerifying(false); }
    };
    const copyRedirect = async () => {
        await copyToClipboard(redirectUri);
        notify(t('common.copied'), 'success');
    };
    const setupItems: CheckItem[] = [
        { key: 'issuer', label: t('ent.sso_issuer'), state: !!sso.issuerUrl, detail: sso.issuerUrl || undefined },
        { key: 'client', label: t('ent.sso_client_id'), state: !!sso.clientId },
        ...(sso.provider === 'OIDC' ? [{ key: 'verify', label: t('ent.sso_verify_btn'), state: verifyResult ? verifyResult.success : null } as CheckItem] : []),
    ];
    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <SettingsCard
                title={t('ent.sso_title')}
                description={t('ent.sso_subtitle')}
                actions={
                    <Toggle
                        id="sso-enabled"
                        checked={sso.enabled}
                        onChange={v => setSso({ ...sso, enabled: v })}
                        label={t('ent.sso_title')}
                        stateLabel={sso.enabled ? t('common.active') : t('common.disabled')}
                    />
                }
            >
                <div className="space-y-5">
                    <fieldset disabled={!sso.enabled} className={cx('space-y-4 transition-opacity', !sso.enabled && 'opacity-60')}>
                        <div>
                            <div className={FIELD_LABEL} id="sso-provider-label">{t('ent.sso_provider')}</div>
                            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="sso-provider-label">
                                {(['OIDC', 'SAML'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setSso({ ...sso, provider: p })}
                                        aria-pressed={sso.provider === p}
                                        className={cx(
                                            'min-h-[44px] rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]',
                                            sso.provider === p ? 'border-[var(--sgs-primary)] bg-[var(--glass-surface)] text-[var(--sgs-primary)] ring-1 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--ui-border-strong)]',
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="sso-issuer" className={FIELD_LABEL}>
                                {t('ent.sso_issuer')} {sso.provider === 'OIDC' && <span className="font-normal text-[var(--text-tertiary)]">{t('ent.sso_discovery_suffix')}</span>}
                            </label>
                            <input
                                id="sso-issuer"
                                placeholder={sso.provider === 'SAML' ? t('ent.v2_sso_issuer_placeholder_saml') : t('ent.v2_sso_issuer_placeholder_oidc')}
                                className={INPUT_MONO}
                                value={sso.issuerUrl || ''}
                                onChange={e => setSso({ ...sso, issuerUrl: e.target.value.trim() })}
                            />
                            {sso.provider === 'OIDC' && sso.issuerUrl && (
                                <p className={cx(FIELD_HINT, 'break-all font-mono')}>{t('ent.sso_discovery_prefix')} {sso.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="sso-client-id" className={FIELD_LABEL}>{t('ent.sso_client_id')}</label>
                                <input id="sso-client-id" className={INPUT_MONO} value={sso.clientId || ''} onChange={e => setSso({ ...sso, clientId: e.target.value.trim() })} placeholder={t('ent.sso_client_id_placeholder')} />
                            </div>
                            <div>
                                <label htmlFor="sso-client-secret" className={FIELD_LABEL}>{t('ent.sso_client_secret')}</label>
                                <SecretInput id="sso-client-secret" value={sso.clientSecret || ''} onChange={v => setSso({ ...sso, clientSecret: v })} placeholder={CONSTANTS.MASK} showLabel={t('ent.sso_show')} hideLabel={t('ent.sso_hide')} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="sso-login-url" className={FIELD_LABEL}>
                                {t('ent.sso_login_url')} <span className="font-normal text-[var(--text-tertiary)]">{t('ent.sso_login_url_optional')}</span>
                            </label>
                            <input id="sso-login-url" type="url" placeholder={t('ent.sso_login_url_placeholder')} className={INPUT_MONO} value={sso.loginUrl || ''} onChange={e => setSso({ ...sso, loginUrl: e.target.value.trim() })} />
                        </div>
                    </fieldset>
                    <div>
                        <CopyField label={t('ent.redirect_uri')} value={redirectUri} onCopy={copyRedirect} copyLabel={t('common.copy')} />
                        <p className={FIELD_HINT}>{t('ent.sso_redirect_hint')}</p>
                    </div>
                    {verifyResult && (
                        verifyResult.success ? (
                            <Notice tone="success" title={t('ent.sso_verify_valid')}>
                                {verifyResult.metadata && (
                                    <dl className="mt-1 space-y-1 break-all font-mono">
                                        <div><dt className="inline font-semibold">{t('ent.sso_meta_issuer')}</dt> <dd className="inline">{verifyResult.metadata.issuer}</dd></div>
                                        <div><dt className="inline font-semibold">{t('ent.sso_meta_auth_endpoint')}</dt> <dd className="inline">{verifyResult.metadata.authorizationEndpoint}</dd></div>
                                        <div><dt className="inline font-semibold">{t('ent.sso_meta_token_endpoint')}</dt> <dd className="inline">{verifyResult.metadata.tokenEndpoint}</dd></div>
                                    </dl>
                                )}
                            </Notice>
                        ) : (
                            <Notice tone="danger" title={t('enterprise.sso_fail')}>{verifyResult.error}</Notice>
                        )
                    )}
                    <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] pt-4 sm:flex-row sm:justify-end">
                        {sso.enabled && sso.provider === 'OIDC' && (
                            <button type="button" onClick={handleVerify} disabled={verifying || !sso.issuerUrl || !sso.clientId} className={BTN_SECONDARY}>
                                {verifying && <Spinner />}
                                {verifying ? t('ent.sso_verifying') : t('ent.sso_verify_btn')}
                            </button>
                        )}
                        <button type="button" onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
                            {saving ? t('auth.processing') : t('ent.sso_save')}
                        </button>
                    </div>
                </div>
            </SettingsCard>
            <SettingsCard title={t('ent.v2_setup_title')} description={t('ent.v2_sso_setup_desc')}>
                <Checklist items={setupItems} ariaLabel={t('ent.v2_setup_title')} />
            </SettingsCard>
        </div>
    );
});

// -----------------------------------------------------------------------------
// DOMAINS
// -----------------------------------------------------------------------------
const DomainPanel = memo(({ config, onRefresh, notify }: { config: EnterpriseConfig, onRefresh: () => void, notify: Notify }) => {
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
    const domains = config.domains || [];
    const verifiedCount = domains.filter(d => d.verified).length;
    const pendingCount = domains.length - verifiedCount;
    return (
        <div className="space-y-5">
            <SettingsCard title={t('ent.domain_title')} description={t('ent.domain_subtitle')}>
                <div className="space-y-4">
                    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); handleAdd(); }}>
                        <label htmlFor="domain-new" className="sr-only">{t('ent.domain_add')}</label>
                        <input id="domain-new" className={cx(INPUT, 'sm:flex-1')} placeholder={t('ent.domain_placeholder')} value={newDomain} onChange={e => setNewDomain(e.target.value)} />
                        <button type="submit" className={cx(BTN_PRIMARY, 'shrink-0')}>{t('ent.domain_add')}</button>
                    </form>
                    {domains.length > 0 && (
                        <>
                            <StatGrid cols={3}>
                                <StatTile label={t('ent.v2_domain_total')} value={domains.length} tone="brand" />
                                <StatTile label={t('ent.domain_verified')} value={verifiedCount} tone={verifiedCount ? 'success' : 'neutral'} />
                                <StatTile label={t('ent.domain_pending')} value={pendingCount} tone={pendingCount ? 'warning' : 'neutral'} />
                            </StatGrid>
                            <DistributionBar
                                ariaLabel={t('ent.v2_domain_share_aria')}
                                segments={[
                                    { label: t('ent.domain_verified'), value: verifiedCount, color: TONE_COLOR.success },
                                    { label: t('ent.domain_pending'), value: pendingCount, color: TONE_COLOR.warning },
                                ]}
                            />
                        </>
                    )}
                </div>
            </SettingsCard>
            <SettingsCard title={t('ent.v2_domain_list_title')}>
                {domains.length === 0 ? (
                    <EmptyState icon={ICONS.GLOBE} title={t('ent.domain_empty')} description={t('ent.domain_subtitle')} />
                ) : (
                    <ul className="space-y-3">
                        {domains.map(d => (
                            <li key={d.domain} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 sm:p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="break-all text-sm font-semibold text-[var(--text-primary)]">{d.domain}</h4>
                                        <div className="mt-1.5">
                                            <StatusBadge tone={d.verified ? 'success' : 'warning'}>{d.verified ? t('ent.domain_verified') : t('ent.domain_pending')}</StatusBadge>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => handleRemove(d.domain)} className={ICON_BTN} aria-label={t('ent.v2_domain_remove_aria', { name: d.domain })}>
                                        {ICONS.CLOSE}
                                    </button>
                                </div>
                                {!d.verified && (
                                    <div className="mt-3">
                                        <div className={FIELD_LABEL}>{t('ent.domain_dns_config')}</div>
                                        <div className="flex flex-col gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] p-2 sm:flex-row sm:items-center sm:justify-between">
                                            <code className="break-all px-1 font-mono text-xs text-[var(--text-secondary)]">TXT @ {d.verificationTxtRecord}</code>
                                            <button type="button" onClick={() => handleVerify(d.domain)} disabled={verifying === d.domain} className={cx(BTN_SECONDARY, 'shrink-0')}>
                                                {verifying === d.domain && <Spinner />}
                                                {verifying === d.domain ? t('ent.domain_checking') : t('ent.domain_verify')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </SettingsCard>
        </div>
    );
});

// -----------------------------------------------------------------------------
// AUDIT LOG
// -----------------------------------------------------------------------------
const ACTION_COLORS: Record<string, string> = {
    // Auth
    LOGIN: 'bg-blue-50 text-blue-700 border-blue-100',
    LOGIN_FAILED: 'bg-rose-50 text-rose-700 border-rose-100',
    PASSWORD_RESET_REQUEST: 'bg-amber-50 text-amber-700 border-amber-100',
    PASSWORD_RESET_COMPLETE: 'bg-teal-50 text-teal-700 border-teal-100',
    // Generic CRUD (used by lead, listing, contract, proposal routes)
    CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    UPDATE: 'bg-amber-50 text-amber-700 border-amber-100',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-100',
    MERGE: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]',
    UPDATE_STATUS: 'bg-sky-50 text-sky-700 border-sky-100',
    AML_REVIEW: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]',
    // User management
    USER_CREATED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    USER_INVITED: 'bg-[var(--sgs-primary)]/10 text-sgs-primary border-[var(--sgs-primary)]',
    USER_REINVITED: 'bg-sky-50 text-sky-700 border-sky-100',
    USER_UPDATED: 'bg-amber-50 text-amber-700 border-amber-100',
    USER_DELETED: 'bg-rose-50 text-rose-700 border-rose-100',
    // Enterprise config
    ENTERPRISE_CONFIG_UPDATED: 'bg-slate-100 text-slate-600 border-slate-200',
    EMAIL_CONFIG_UPDATED: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    SSO_CONFIG_UPDATED: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]',
    DOMAIN_ADDED: 'bg-[var(--sgs-primary)]/10 text-sgs-primary border-[var(--sgs-primary)]',
    DOMAIN_REMOVED: 'bg-rose-50 text-rose-700 border-rose-100',
    DOMAIN_VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ZALO_OA_CONNECTED: 'bg-sky-50 text-sky-700 border-sky-100',
    ZALO_OA_DISCONNECTED: 'bg-orange-50 text-orange-700 border-orange-100',
    FACEBOOK_PAGE_CONNECTED: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]',
    FACEBOOK_PAGE_DISCONNECTED: 'bg-pink-50 text-pink-700 border-pink-100',
};
const PAGE_SIZE = 20;
const AUDIT_MIX_TOP = 4;

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
        { value: '', label: t('ent.audit_entity_all') },
        { value: 'auth', label: t('ent.audit_entity_auth') },
        { value: 'USER', label: t('ent.audit_entity_user') },
        { value: 'enterprise_config', label: t('ent.audit_entity_config') },
        { value: 'LEAD', label: t('ent.audit_entity_lead') },
        { value: 'LISTING', label: t('ent.audit_entity_listing') },
        { value: 'CONTRACT', label: t('ent.audit_entity_contract') },
        { value: 'PROPOSAL', label: t('ent.audit_entity_proposal') },
    ];
    // Action mix of the rows on the current page (top actions + the rest grouped).
    const actionMix = useMemo<Segment[]>(() => {
        const counts = new Map<string, number>();
        logs.forEach(l => counts.set(l.action, (counts.get(l.action) || 0) + 1));
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, AUDIT_MIX_TOP).map(([label, value]) => ({ label, value }));
        const rest = sorted.slice(AUDIT_MIX_TOP).reduce((s, [, v]) => s + v, 0);
        return rest > 0 ? [...top, { label: t('ent.v2_audit_other'), value: rest }] : top;
    }, [logs, t]);

    return (
        <SettingsCard
            title={t('ent.audit_title')}
            description={t('ent.audit_subtitle')}
            actions={<StatusBadge tone="info">{t('ent.audit_records', { count: total })}</StatusBadge>}
            bodyClassName="!p-0"
        >
            <div className="flex flex-col gap-3 border-b border-[var(--glass-border)] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
                <Dropdown
                    value={filterEntity}
                    onChange={(val) => handleFilterChange(filterAction, val as string)}
                    options={ENTITY_OPTIONS}
                    className="w-full sm:w-52"
                />
                <label htmlFor="audit-action-filter" className="sr-only">{t('ent.audit_action')}</label>
                <input
                    id="audit-action-filter"
                    value={filterAction}
                    onChange={e => handleFilterChange(e.target.value.toUpperCase(), filterEntity)}
                    placeholder={t('ent.audit_action_placeholder')}
                    className="ui-input h-11 w-full font-mono text-xs sm:w-60"
                />
                {(filterAction || filterEntity) && (
                    <button type="button" onClick={() => handleFilterChange('', '')} className={BTN_GHOST_SM}>
                        {t('ent.audit_clear_filter')}
                    </button>
                )}
            </div>

            {!loading && !error && logs.length > 0 && (
                <div className="border-b border-[var(--glass-border)] p-4 sm:px-5">
                    <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{t('ent.v2_audit_mix_title')}</div>
                    <DistributionBar segments={actionMix} ariaLabel={t('ent.v2_audit_mix_title')} />
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-surface)] text-[var(--text-tertiary)]">
                        <tr>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold sm:px-5">{t('ent.audit_time')}</th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t('ent.audit_actor')}</th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t('ent.audit_action')}</th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t('ent.audit_details')}</th>
                            <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold sm:px-5">{t('table.ip_address')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {loading && (
                            <tr><td colSpan={5} className="animate-pulse p-10 text-center text-[var(--text-secondary)]">{t('common.loading')}</td></tr>
                        )}
                        {!loading && error && (
                            <tr><td colSpan={5} className="p-10 text-center" style={{ color: TONE_COLOR.danger }}>{error}</td></tr>
                        )}
                        {!loading && !error && logs.length === 0 && (
                            <tr><td colSpan={5} className="p-10 text-center text-[var(--text-tertiary)]">{t('common.no_data')}</td></tr>
                        )}
                        {!loading && logs.map(log => (
                            <tr key={log.id} className="transition-colors hover:bg-[var(--glass-surface)]">
                                <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)] sm:px-5">{formatDateTime(log.timestamp)}</td>
                                <td className="max-w-[140px] truncate whitespace-nowrap px-4 py-3 font-semibold text-[var(--text-primary)]" title={log.actorName || log.actorId}>{log.actorName || log.actorId}</td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <span className={cx('rounded-lg border px-2 py-1 font-mono text-[11px] font-semibold', ACTION_COLORS[log.action] || 'border-[var(--glass-border)] bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]')}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-secondary)]" title={log.details}>{log.details || '—'}</td>
                                <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)] sm:px-5">{log.ipAddress || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <nav className="flex flex-col gap-3 border-t border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label={t('ent.audit_page', { page, total: totalPages })}>
                    <span className="text-xs text-[var(--text-secondary)]">{t('ent.audit_page', { page, total: totalPages })}</span>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={BTN_GHOST_SM}>
                            {t('ent.audit_prev')}
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const pageNum = start + i;
                            return pageNum <= totalPages ? (
                                <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setPage(pageNum)}
                                    aria-current={pageNum === page ? 'page' : undefined}
                                    className={cx(
                                        'h-10 min-w-[40px] rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]',
                                        pageNum === page ? 'border-[var(--sgs-primary)] bg-sgs-primary text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
                                    )}
                                >
                                    {pageNum}
                                </button>
                            ) : null;
                        })}
                        <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={BTN_GHOST_SM}>
                            {t('ent.audit_next')}
                        </button>
                    </div>
                </nav>
            )}
        </SettingsCard>
    );
});

// -----------------------------------------------------------------------------
// SUB-NAVIGATION
// -----------------------------------------------------------------------------
type TabId = 'THEME' | 'BRANDING' | 'ACTIVITY' | 'ZALO' | 'FACEBOOK' | 'AUTO_POSTING' | 'EMAIL' | 'SSO' | 'DOMAINS' | 'AUDIT';
interface TabGroup { id: string; labelKey: string; tabs: Array<{ id: TabId; labelKey: string }> }

const TAB_GROUPS: TabGroup[] = [
    { id: 'brand', labelKey: 'ent.v2_group_brand', tabs: [
        { id: 'THEME', labelKey: 'ent.v2_tab_theme' },
        { id: 'BRANDING', labelKey: 'ent.v2_tab_branding' },
    ] },
    { id: 'channels', labelKey: 'ent.v2_group_channels', tabs: [
        { id: 'ZALO', labelKey: 'ent.tab_zalo' },
        { id: 'FACEBOOK', labelKey: 'ent.tab_social' },
        { id: 'AUTO_POSTING', labelKey: 'ent.v2_tab_auto_posting' },
        { id: 'EMAIL', labelKey: 'ent.tab_email' },
    ] },
    { id: 'security', labelKey: 'ent.v2_group_security', tabs: [
        { id: 'SSO', labelKey: 'ent.tab_sso' },
        { id: 'DOMAINS', labelKey: 'ent.tab_domain' },
    ] },
    { id: 'logs', labelKey: 'ent.v2_group_logs', tabs: [
        { id: 'ACTIVITY', labelKey: 'ent.v2_tab_activity' },
        { id: 'AUDIT', labelKey: 'ent.tab_audit' },
    ] },
];

/** Vertical grouped list on lg+, horizontally scrollable pills below (active pill kept in view). */
const SubNav: React.FC<{ active: TabId; onChange: (id: TabId) => void }> = ({ active, onChange }) => {
    const { t } = useTranslation();
    const scrollerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        const btn = el.querySelector<HTMLElement>('[aria-current="page"]');
        if (!btn) return;
        const target = btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2;
        el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }, [active]);
    return (
        <nav aria-label={t('ent.v2_nav_label')} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div
                ref={scrollerRef}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:rounded-2xl lg:border lg:border-[var(--glass-border)] lg:bg-[var(--bg-surface)] lg:p-3"
            >
                {TAB_GROUPS.map(group => (
                    <div key={group.id} className="contents lg:block">
                        <div className="hidden px-2 pb-1 text-xs font-semibold text-[var(--text-tertiary)] lg:block">{t(group.labelKey)}</div>
                        {group.tabs.map(tab => {
                            const isActive = tab.id === active;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onChange(tab.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cx(
                                        'min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]',
                                        'lg:flex lg:w-full lg:items-center lg:rounded-xl lg:border-0 lg:px-3 lg:text-left',
                                        isActive
                                            ? 'border-[var(--sgs-primary)] bg-sgs-primary text-white lg:bg-[var(--glass-surface-hover)] lg:font-semibold lg:text-[var(--sgs-primary)] lg:shadow-[inset_3px_0_0_var(--sgs-primary)]'
                                            : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--ui-border-strong)] hover:text-[var(--text-primary)] lg:bg-transparent lg:hover:bg-[var(--glass-surface)]',
                                    )}
                                >
                                    {t(tab.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </nav>
    );
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export const EnterpriseSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>(() => {
        const requestedTab = new URLSearchParams(window.location.search).get('tab');
        return requestedTab === 'FACEBOOK' || requestedTab === 'AUTO_POSTING' ? requestedTab : 'ZALO';
    });
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

            if (!['SUPER_ADMIN', 'ADMIN'].includes(me?.role ?? '')) {
                setLoading(false);
                return;
            }
            const data = await db.getEnterpriseConfig();
            setConfig(data);
        } catch (e) {
            console.error('Failed to load config', e);
            notify(t('common.error'), 'error');
        } finally {
            setLoading(false);
        }
    }, [notify, t]);
    useEffect(() => { loadConfig(); }, [loadConfig]);

    const seo = <SeoHead title={t('ent.v2_seo_title')} description={t('ent.v2_seo_description')} canonicalPath="/enterprise-settings" />;

    if (!loading && currentUser && !['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role)) {
        return (
            <>
                {seo}
                <SettingsPage width="narrow">
                    <SettingsCard>
                        <EmptyState icon={ICONS.LOCK} title={t('common.access_denied')} description={t('ent.no_permission')} />
                    </SettingsCard>
                </SettingsPage>
            </>
        );
    }
    if (loading || !config) {
        return (
            <>
                {seo}
                <SettingsPage>
                    <p className="animate-pulse p-10 text-center text-sm text-[var(--text-secondary)]" role="status">{t('common.loading')}</p>
                </SettingsPage>
            </>
        );
    }

    const copyTenant = () => { copyToClipboard(config.tenantId ?? ''); notify(t('common.copied'), 'success'); };

    return (
        <>
            {seo}
            <SettingsPage>
                <SettingsHeader
                    icon={ICONS.BUILDING}
                    title={t('ent.v2_title')}
                    description={t('ent.v2_description')}
                    meta={
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] py-0.5 pl-2 pr-0.5 text-xs text-[var(--text-tertiary)]">
                            <span>{t('ent.tenant_label')}:</span>
                            <span className="font-mono font-semibold text-[var(--text-secondary)]" title={config.tenantId}>{config.tenantId ? `${config.tenantId.slice(0, 8)}…` : '—'}</span>
                            <button
                                type="button"
                                onClick={copyTenant}
                                title={config.tenantId}
                                aria-label={t('ent.v2_copy_tenant')}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                            >
                                {ICONS.COPY}
                            </button>
                        </span>
                    }
                />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <SubNav active={activeTab} onChange={setActiveTab} />
                    <div className="min-w-0 min-h-[400px]">
                        {activeTab === 'THEME' && <ThemeCustomizer notify={notify} />}
                        {activeTab === 'BRANDING' && <BrandingPanel notify={notify} />}
                        {activeTab === 'ACTIVITY' && <UserActivityPanel />}
                        {activeTab === 'ZALO' && <ZaloPanel config={config} onRefresh={loadConfig} notify={notify} />}
                        {activeTab === 'FACEBOOK' && <FacebookPanel config={config} onRefresh={loadConfig} notify={notify} />}
                        {activeTab === 'AUTO_POSTING' && <AutoPostingPanel notify={notify} />}
                        {activeTab === 'EMAIL' && <EmailPanel config={config} onRefresh={loadConfig} notify={notify} />}
                        {activeTab === 'SSO' && <SSOPanel config={config} onRefresh={loadConfig} notify={notify} />}
                        {activeTab === 'DOMAINS' && <DomainPanel config={config} onRefresh={loadConfig} notify={notify} />}
                        {activeTab === 'AUDIT' && <AuditPanel />}
                    </div>
                </div>
            </SettingsPage>
            {createPortal(
                toast ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className={`fixed bottom-6 left-4 right-4 z-[200] flex items-center gap-3 rounded-xl border px-5 py-3 text-white shadow-2xl animate-enter sm:left-auto sm:right-6 ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500' : 'bg-rose-900/90 border-rose-500'}`}
                    >
                        <span className="text-sm" aria-hidden="true">{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span className="text-sm font-bold">{toast.msg}</span>
                    </div>
                ) : null,
                document.body,
            )}
        </>
    );
};
