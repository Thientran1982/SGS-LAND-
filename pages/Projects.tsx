import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { Project, ProjectAccess, UserRole, ContractType, ContractStatus, Listing } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ListingForm } from '../components/ListingForm';
import { ContractModal } from '../components/ContractModal';
import LazyImage from '../components/LazyImage';
import {
    exportListingsToExcel,
    parseListingsFromExcel,
    downloadImportTemplate,
    type ImportResult,
} from '../utils/listingExcel';

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
const IC = {
    PLUS: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    SHIELD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
    BLDG: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    SEARCH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
    LIST: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>,
    HOME: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
    LOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
    CHECK_ALL: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    DOWNLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>,
    UPLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>,
    TEMPLATE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    CONTRACT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
};

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-sky-100 text-sky-700 border-sky-200',
    ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
    SUSPENDED: 'bg-rose-100 text-rose-700 border-rose-200',
    BOOKING: 'bg-violet-100 text-violet-700 border-violet-200',
};

const ACCESS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    REVOKED: 'bg-rose-100 text-rose-700',
    EXPIRED: 'bg-slate-100 text-slate-500',
};

function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN');
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Form Modal
// ─────────────────────────────────────────────────────────────────────────────
interface ProjectFormProps {
    project?: Project | null;
    onSave: (data: any) => Promise<void>;
    onClose: () => void;
    t: (k: string) => string;
}

// Chấp nhận link Google Drive / Docs / Sheets / Slides / Forms (kể cả tên miền a/<email>/...)
const GDRIVE_HOST_RE = /^https:\/\/(?:drive|docs)\.google\.com\//i;
const isValidDriveUrl = (url: string): boolean => {
    const s = url.trim();
    if (!s) return true; // optional
    try {
        const u = new URL(s);
        if (u.protocol !== 'https:') return false;
        return GDRIVE_HOST_RE.test(s);
    } catch {
        return false;
    }
};

function ProjectFormModal({ project, onSave, onClose, t }: ProjectFormProps) {
    const p = project as any;
    const existingMeta = (p?.metadata && typeof p.metadata === 'object') ? p.metadata : {};
    const [form, setForm] = useState({
        name: p?.name || '',
        code: p?.code || '',
        description: p?.description || '',
        location: p?.location || '',
        totalUnits: (p?.total_units ?? p?.totalUnits) != null ? String(p?.total_units ?? p?.totalUnits) : '',
        status: p?.status || 'ACTIVE',
        openDate: p?.open_date || p?.openDate || '',
        handoverDate: p?.handover_date || p?.handoverDate || '',
        driveUrl: existingMeta.drive_url || existingMeta.driveUrl || '',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const driveUrlTrim = form.driveUrl.trim();
    const driveUrlValid = isValidDriveUrl(driveUrlTrim);

    const handlePasteDrive = async () => {
        try {
            const text = (await navigator.clipboard.readText()).trim();
            if (text) set('driveUrl', text);
        } catch {
            // Clipboard có thể bị chặn (quyền hoặc HTTP) — bỏ qua, người dùng vẫn paste tay được
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setErr(t('project.error_name_required')); return; }
        if (driveUrlTrim && !driveUrlValid) { setErr(t('project.error_drive_url_invalid')); return; }
        setSaving(true);
        setErr('');
        try {
            // Hợp nhất metadata cũ để không xoá field khác do hệ thống lưu trước đó
            const nextMeta: Record<string, any> = { ...existingMeta };
            if (driveUrlTrim) {
                nextMeta.drive_url = driveUrlTrim;
            } else {
                delete nextMeta.drive_url;
                delete nextMeta.driveUrl;
            }
            // Lưu ý: gửi chuỗi rỗng (đã trim) thay vì undefined cho các text
            // field, và null cho number/date đã xoá. Nếu gửi undefined thì
            // JSON.stringify sẽ drop key, server bỏ qua, DB giữ giá trị cũ —
            // khiến UI báo "cập nhật thành công" nhưng thực tế không xoá.
            await onSave({
                name: form.name.trim(),
                code: form.code.trim(),
                description: form.description.trim(),
                location: form.location.trim(),
                totalUnits: form.totalUnits.trim() === '' ? null : Number(form.totalUnits),
                status: form.status,
                openDate: form.openDate || null,
                handoverDate: form.handoverDate || null,
                metadata: nextMeta,
            });
        } catch (e: any) {
            setErr(e.message || t('common.error_generic'));
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-[16px] focus:outline-none focus:ring-2 focus:ring-indigo-500';
    const labelCls = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--glass-border)] flex flex-col max-h-[90vh]">
                {/* Header — luôn hiển thị, không scroll */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
                    <div className="flex items-center gap-2 text-indigo-600">
                        {IC.BLDG}
                        <h2 className="text-base font-bold">{project ? t('project.edit') : t('project.new')}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                </div>
                {/* Error — nằm ngoài scroll area, luôn hiển thị dưới header */}
                {err && (
                    <div className="shrink-0 px-6 pt-3" role="alert">
                        <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="overflow-y-auto no-scrollbar flex-1 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="pj-name" className={labelCls}>{t('project.name')} *</label>
                            <input id="pj-name" className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} required />
                        </div>
                        <div>
                            <label htmlFor="pj-code" className={labelCls}>{t('project.code')}</label>
                            <input id="pj-code" className={inputCls} value={form.code} onChange={e => set('code', e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="pj-units" className={labelCls}>{t('project.total_units')}</label>
                            <input id="pj-units" type="number" min="0" className={inputCls} value={form.totalUnits} onChange={e => set('totalUnits', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="pj-location" className={labelCls}>{t('project.location')}</label>
                            <input id="pj-location" className={inputCls} value={form.location} onChange={e => set('location', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="pj-desc" className={labelCls}>{t('project.description')}</label>
                            <textarea id="pj-desc" className={inputCls} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="pj-drive" className={labelCls}>{t('project.drive_url')}</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    </span>
                                    <input
                                        id="pj-drive"
                                        type="url"
                                        inputMode="url"
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder="https://drive.google.com/file/d/..."
                                        className={`${inputCls} pl-9 pr-3 ${driveUrlTrim && !driveUrlValid ? 'border-rose-400 focus:ring-rose-500' : ''}`}
                                        value={form.driveUrl}
                                        onChange={e => set('driveUrl', e.target.value)}
                                        aria-invalid={driveUrlTrim ? !driveUrlValid : undefined}
                                        aria-describedby="pj-drive-help"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePasteDrive}
                                    className="shrink-0 px-3 py-2 rounded-xl border border-[var(--glass-border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
                                    title={t('project.drive_paste')}
                                >
                                    {t('project.drive_paste')}
                                </button>
                                {/* Nút "Mở Drive" đã ẩn trong form — dùng nút ngoài header Danh mục sản phẩm để mở. */}
                            </div>
                            <p id="pj-drive-help" className={`mt-1 text-xs ${driveUrlTrim && !driveUrlValid ? 'text-rose-600' : 'text-[var(--text-secondary)]'}`}>
                                {driveUrlTrim && !driveUrlValid ? t('project.error_drive_url_invalid') : t('project.drive_url_help')}
                            </p>
                        </div>
                        <div>
                            <label className={labelCls}>{t('project.status')}</label>
                            <Dropdown
                                value={form.status}
                                onChange={v => set('status', v as string)}
                                options={['ACTIVE','BOOKING','COMPLETED','ON_HOLD','SUSPENDED'].map(s => ({ value: s, label: t('project.status_' + s) }))}
                            />
                        </div>
                        <div>
                            <label htmlFor="pj-open" className={labelCls}>{t('project.open_date')}</label>
                            <input id="pj-open" type="date" className={inputCls} value={form.openDate} onChange={e => set('openDate', e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="pj-handover" className={labelCls}>{t('project.handover_date')}</label>
                            <input id="pj-handover" type="date" className={inputCls} value={form.handoverDate} onChange={e => set('handoverDate', e.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">{t('common.cancel')}</button>
                        <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{saving ? t('common.loading') : t('common.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Access Management Panel
// ─────────────────────────────────────────────────────────────────────────────
interface AccessPanelProps {
    project: Project;
    onClose: () => void;
    t: (k: string) => string;
}

function AccessPanel({ project, onClose, t }: AccessPanelProps) {
    const [accesses, setAccesses] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [grantForm, setGrantForm] = useState({ partnerTenantId: '', expiresAt: '', note: '' });
    const [granting, setGranting] = useState(false);
    const [err, setErr] = useState('');
    const [revokeTarget, setRevokeTarget] = useState<string | null>(null); // partnerTenantId pending confirm
    const [revokeErr, setRevokeErr] = useState('');

    useEffect(() => {
        Promise.all([
            db.getProjectAccess(project.id),
            db.listTenants(),
        ]).then(([a, t]) => {
            setAccesses(a);
            setTenants(t);
        }).finally(() => setLoading(false));
    }, [project.id]);

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantForm.partnerTenantId) { setErr(t('project.error_partner_required')); return; }
        setGranting(true);
        setErr('');
        try {
            const newAccess = await db.grantProjectAccess(project.id, {
                partnerTenantId: grantForm.partnerTenantId,
                expiresAt: grantForm.expiresAt || undefined,
                note: grantForm.note || undefined,
            });
            setAccesses(prev => {
                const idx = prev.findIndex(a => a.partner_tenant_id === newAccess.partner_tenant_id);
                if (idx >= 0) { const n = [...prev]; n[idx] = newAccess; return n; }
                return [newAccess, ...prev];
            });
            setGrantForm({ partnerTenantId: '', expiresAt: '', note: '' });
        } catch (e: any) {
            setErr(e.message || t('common.error_generic'));
        } finally {
            setGranting(false);
        }
    };

    const handleRevoke = async (partnerTenantId: string) => {
        setRevokeErr('');
        try {
            await db.revokeProjectAccess(project.id, partnerTenantId);
            setAccesses(prev => prev.map(a =>
                a.partner_tenant_id === partnerTenantId ? { ...a, status: 'REVOKED' } : a
            ));
            setRevokeTarget(null);
        } catch (e: any) {
            setRevokeErr(e.message || t('common.error_generic'));
        }
    };

    // Tenants not yet ACTIVE in this project
    const activePartnerIds = new Set(accesses.filter(a => a.status === 'ACTIVE').map(a => a.partner_tenant_id));
    const availableTenants = tenants.filter(t2 => !activePartnerIds.has(t2.id));

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-[16px] focus:outline-none focus:ring-2 focus:ring-indigo-500';
    const labelCls = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl border border-[var(--glass-border)] flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600">
                            {IC.SHIELD}
                            <h2 className="text-base font-bold">{t('project.access_title')}</h2>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{project.name}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                </div>

                <div className="overflow-y-auto no-scrollbar flex-1 p-6 space-y-6">
                    {/* Grant form */}
                    <form onSubmit={handleGrant} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{t('project.grant_access')}</p>
                        {err && <p className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5" role="alert">{err}</p>}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls}>{t('project.partner_tenant')} *</label>
                                <Dropdown
                                    value={grantForm.partnerTenantId}
                                    onChange={(v) => setGrantForm(f => ({ ...f, partnerTenantId: v as string }))}
                                    placeholder={t('common.select')}
                                    options={availableTenants.map(t2 => ({ value: t2.id, label: `${t2.name} (${t2.domain})` }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="pa-expires" className={labelCls}>{t('project.expires_at')}</label>
                                <input id="pa-expires" type="date" className={inputCls} value={grantForm.expiresAt} onChange={e => setGrantForm(f => ({ ...f, expiresAt: e.target.value }))} />
                            </div>
                            <div>
                                <label htmlFor="pa-note" className={labelCls}>{t('project.note')}</label>
                                <input id="pa-note" className={inputCls} value={grantForm.note} onChange={e => setGrantForm(f => ({ ...f, note: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" disabled={granting} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                                {IC.SHIELD}
                                {granting ? t('common.loading') : t('project.grant_access')}
                            </button>
                        </div>
                    </form>

                    {/* Access list */}
                    {loading ? (
                        <p className="text-center text-sm text-[var(--text-secondary)] py-8">{t('common.loading')}</p>
                    ) : accesses.length === 0 ? (
                        <p className="text-center text-sm text-[var(--text-secondary)] py-8">{t('project.no_access')}</p>
                    ) : (
                        <div className="space-y-2">
                            {accesses.map(a => (
                                <div key={a.id} className="flex items-center justify-between gap-4 bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-xl px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{a.partner_tenant_name || a.partner_tenant_id}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">{a.partner_tenant_domain}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)]">
                                            <span>{t('project.granted_at')}: {fmtDate(a.granted_at)}</span>
                                            {a.expires_at && <span>{t('project.expires_at')}: {fmtDate(a.expires_at)}</span>}
                                            {a.note && <span className="italic">"{a.note}"</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCESS_COLOR[a.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {t('project.access_status_' + a.status)}
                                        </span>
                                        {a.status === 'ACTIVE' && revokeTarget !== a.partner_tenant_id && (
                                            <button type="button" onClick={() => { setRevokeTarget(a.partner_tenant_id); setRevokeErr(''); }}
                                                className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                                                {t('project.revoke_access')}
                                            </button>
                                        )}
                                        {revokeTarget === a.partner_tenant_id && (
                                            <div className="flex flex-col items-end gap-1">
                                                {revokeErr && <p className="text-xs text-rose-600">{revokeErr}</p>}
                                                <p className="text-xs text-[var(--text-secondary)]">{t('project.confirm_revoke')}</p>
                                                <div className="flex gap-1.5">
                                                    <button type="button" onClick={() => setRevokeTarget(null)}
                                                        className="text-xs px-2 py-1 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]">
                                                        {t('common.cancel')}
                                                    </button>
                                                    <button type="button" onClick={() => handleRevoke(a.partner_tenant_id)}
                                                        className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
                                                        {t('project.revoke_access')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Project Listings Panel  (Danh mục sản phẩm trong dự án)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_LISTING_COLOR: Record<string, string> = {
    AVAILABLE: 'bg-emerald-100 text-emerald-700',
    BOOKING:   'bg-sky-100 text-sky-700',
    OPENING:   'bg-indigo-100 text-indigo-700',
    HOLD:      'bg-amber-100 text-amber-700',
    SOLD:      'bg-slate-100 text-slate-500',
    RENTED:    'bg-violet-100 text-violet-700',
    INACTIVE:  'bg-rose-100 text-rose-500',
};

function fmtNum(v: number, maxDec = 2) {
    return v.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: maxDec });
}

function fmtPrice(p: number) {
    if (!p) return '—';
    if (p >= 1_000_000_000) return fmtNum(p / 1_000_000_000) + ' tỷ';
    if (p >= 1_000_000) return fmtNum(p / 1_000_000, 0) + ' tr';
    return fmtNum(p, 0) + ' đ';
}

function fmtUnitPrice(price: number, area: number) {
    if (!price || !area) return '—';
    const up = price / area;
    if (up >= 1_000_000_000) return fmtNum(up / 1_000_000_000) + ' tỷ/m²';
    if (up >= 1_000_000) return fmtNum(up / 1_000_000, 0) + ' tr/m²';
    return fmtNum(up, 0) + ' đ/m²';
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing Detail Panel  (Xem chi tiết sản phẩm)
// ─────────────────────────────────────────────────────────────────────────────
interface ListingDetailPanelProps {
    listing: Listing;
    canEdit: boolean;
    onEdit: () => void;
    onClose: () => void;
    t: (k: string) => string;
}

function ListingDetailPanel({ listing, canEdit, onEdit, onClose, t }: ListingDetailPanelProps) {
    const [activeImg, setActiveImg] = useState(0);
    const images = listing.images || [];
    const attrs = listing.attributes || {};

    const DetailRow = ({ label, value }: { label: string; value?: React.ReactNode }) =>
        value ? (
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">{label}</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
            </div>
        ) : null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-[var(--glass-border)] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)] shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
                            {IC.HOME}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded">{listing.code}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_LISTING_COLOR[listing.status] || 'bg-slate-100 text-slate-600'}`}>
                                    {t(`status.${listing.status}`) || listing.status}
                                </span>
                                {listing.transaction && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                                        {t(`transaction.${listing.transaction}`) || listing.transaction}
                                    </span>
                                )}
                            </div>
                            <h2 className="font-bold text-[var(--text-primary)] text-sm truncate mt-0.5">{listing.title}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={onEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                            >
                                {IC.EDIT} {t('common.edit')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors"
                        >
                            {IC.X}
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">

                    {/* Image gallery */}
                    {images.length > 0 ? (
                        <div className="space-y-2">
                            <div className="aspect-video w-full rounded-xl overflow-hidden bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                                <img
                                    src={images[activeImg]}
                                    alt={listing.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {images.map((img, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setActiveImg(i)}
                                            className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${i === activeImg ? 'border-emerald-500 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100 hover:border-[var(--glass-border)]'}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="aspect-video w-full rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                            <svg className="w-12 h-12 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span className="text-xs">{t('project.detail_no_image')}</span>
                        </div>
                    )}

                    {/* Price cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100 dark:border-emerald-800">
                            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">{t('inventory.label_price')}</p>
                            <p className="text-xl font-bold text-emerald-700">{fmtPrice(listing.price)}</p>
                        </div>
                        <div className="bg-[var(--glass-surface)] rounded-xl p-3.5 border border-[var(--glass-border)]">
                            <p className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wide mb-1">{t('inventory.label_unit_price')}</p>
                            <p className="text-base font-bold text-[var(--text-primary)]">{fmtUnitPrice(listing.price, listing.area)}</p>
                        </div>
                    </div>

                    {/* Key specs grid */}
                    <div className="bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <DetailRow label={t('inventory.label_type')} value={t(`property.${listing.type?.toUpperCase()}`) || listing.type} />
                        <DetailRow label={t('inventory.label_area')} value={listing.area ? `${listing.area} m²` : undefined} />
                        {listing.builtArea && <DetailRow label={t('inventory.label_built_area')} value={`${listing.builtArea} m²`} />}
                        {attrs.clearArea && <DetailRow label={t('inventory.label_clear_area')} value={`${attrs.clearArea} m²`} />}
                        {listing.bedrooms && <DetailRow label={t('inventory.label_bed')} value={listing.bedrooms} />}
                        {listing.bathrooms && <DetailRow label={t('inventory.label_bath')} value={listing.bathrooms} />}
                        {attrs.tower && <DetailRow label={t('inventory.label_tower')} value={attrs.tower} />}
                        {attrs.floor && <DetailRow label={t('inventory.label_floor')} value={attrs.floor} />}
                        {attrs.direction && <DetailRow label={t('inventory.label_direction')} value={t(`direction.${attrs.direction}`) || attrs.direction} />}
                        {attrs.view && <DetailRow label={t('inventory.label_view')} value={attrs.view} />}
                        {attrs.furniture && <DetailRow label={t('inventory.label_furniture')} value={t(`furniture.${attrs.furniture}`) || attrs.furniture} />}
                        {attrs.legalStatus && <DetailRow label={t('inventory.label_legal')} value={t(`legal.${attrs.legalStatus}`) || attrs.legalStatus} />}
                        {attrs.frontage && <DetailRow label={t('inventory.label_frontage')} value={`${attrs.frontage} m`} />}
                        {attrs.roadWidth && <DetailRow label={t('inventory.label_road_width')} value={`${attrs.roadWidth} m`} />}
                        {listing.location && <DetailRow label={t('inventory.label_location')} value={listing.location} />}
                        {listing.contactPhone && <DetailRow label={t('inventory.label_owner_phone')} value={listing.contactPhone} />}
                    </div>

                    {/* Description / notes */}
                    {attrs.notes && (
                        <div className="bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] p-4">
                            <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">{t('inventory.label_notes')}</p>
                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{attrs.notes}</p>
                        </div>
                    )}

                    {/* Assigned agent */}
                    {listing.assignedToName && (
                        <div className="flex items-center gap-3 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] px-4 py-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold shrink-0">
                                {listing.assignedToName[0]?.toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-tertiary)] font-semibold">{t('inventory.label_assignee')}</p>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{listing.assignedToName}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

interface ProjectListingsPanelProps {
    project: any;
    canCreate: boolean;
    isAdmin: boolean;
    onClose: () => void;
    onListingCreated?: () => void;
    t: (k: string) => string;
}

function ProjectListingsPanel({ project, canCreate, isAdmin, onClose, onListingCreated, t }: ProjectListingsPanelProps) {
    const [listings, setListings] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState('');
    // Checkbox selection
    const [selected, setSelected] = useState<Set<string>>(new Set());
    // Bulk status
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulkWorking, setBulkWorking] = useState(false);
    // Listing access modal
    const [accessListings, setAccessListings] = useState<any[] | null>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    // Row actions: 3-dot menu + edit / delete
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [contractTarget, setContractTarget] = useState<any | null>(null);
    const [panelToast, setPanelToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [detailListing, setDetailListing] = useState<Listing | null>(null);
    // Import / Export
    const importFileRef = useRef<HTMLInputElement | null>(null);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
    const [importUploading, setImportUploading] = useState(false);
    const [importDone, setImportDone] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await db.getListings(1, 500, { projectCode: project.code });
            setListings(result.data || []);
            setStats((result as any).stats || null);
        } finally {
            setLoading(false);
        }
    }, [project.code]);

    // Silent server stats sync — accurate even when > 200 listings are in a project.
    // The server COUNT query (used for stats) always covers ALL listings regardless of pageSize.
    const syncStats = useCallback(() => {
        db.getListings(1, 1, { projectCode: project.code })
            .then(result => {
                const srv = (result as any).stats;
                if (srv) setStats(srv);
            })
            .catch(() => {});
    }, [project.code]);

    useEffect(() => { load(); }, [load]);

    // Preload tenants for access panel (admin only)
    useEffect(() => {
        if (isAdmin) db.listTenants().then(setTenants).catch(() => {});
    }, [isAdmin]);

    const handleListingSubmit = async (data: any) => {
        const listing = await db.createListing({
            ...data,
            projectCode: project.code || data.projectCode,
        });
        setListings(prev => {
            const next = [listing, ...prev];
            recomputeStats(next);
            return next;
        });
        setShowCreate(false);
        onListingCreated?.();
        syncStats();
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = () => {
        exportListingsToExcel(listings, project.name);
    };

    // ── Import: step 1 — parse file ───────────────────────────────────────────
    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImporting(true);
        try {
            const result = await parseListingsFromExcel(file);
            setImportPreview(result);
        } catch (err) {
            alert('Không thể đọc file. Vui lòng dùng đúng định dạng .xlsx');
        } finally {
            setImporting(false);
        }
    };

    // ── Import: step 2 — upload to server ────────────────────────────────────
    const handleImportConfirm = async () => {
        if (!importPreview || importPreview.valid.length === 0) return;
        setImportUploading(true);
        try {
            const payload = importPreview.valid.map(r => ({
                ...r.data,
                _row: r.row,
                projectCode: project.code,
                projectId: project.id,
                currency: 'VND',
            }));
            const result = await db.bulkCreateListings(payload as Record<string, unknown>[]);
            setImportPreview(null);
            setImportDone(result);
            load();
        } catch (err: any) {
            alert(err?.message ?? 'Lỗi nhập dữ liệu');
        } finally {
            setImportUploading(false);
        }
    };

    const filtered = search
        ? listings.filter(l => l.title?.toLowerCase().includes(search.toLowerCase()) || l.code?.toLowerCase().includes(search.toLowerCase()))
        : listings;

    const isApartmentProject = listings.some(l => l.type === 'Apartment' || l.type === 'Penthouse');

    // ── Checkbox helpers ──────────────────────────────────────────────────────
    const allFilteredIds = filtered.map(l => l.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
    const someSelected = allFilteredIds.some(id => selected.has(id));

    const toggleAll = () => {
        if (allSelected) {
            setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next; });
        } else {
            setSelected(prev => new Set([...prev, ...allFilteredIds]));
        }
    };

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ── Bulk status change ────────────────────────────────────────────────────
    const handleBulkStatus = async () => {
        if (!bulkStatus || selected.size === 0) return;
        setBulkWorking(true);
        try {
            const ids = [...selected];
            await Promise.all(ids.map(id => db.updateListing(id, { status: bulkStatus })));
            setListings(prev => {
                const next = prev.map(l => selected.has(l.id) ? { ...l, status: bulkStatus } : l);
                recomputeStats(next);
                return next;
            });
            setSelected(new Set());
            setBulkStatus('');
            syncStats();
        } finally {
            setBulkWorking(false);
        }
    };

    const selectedListings = filtered.filter(l => selected.has(l.id));

    // ── 3-dot row menu ───────────────────────────────────────────────────────
    const openRowMenu = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setMenuOpenId(prev => prev === id ? null : id);
    };

    useEffect(() => {
        if (!menuOpenId) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpenId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpenId]);

    // ── Stats recompute from listings array ───────────────────────────────────
    const recomputeStats = useCallback((updatedListings: any[]) => {
        const c = { AVAILABLE: 0, HOLD: 0, BOOKING: 0, SOLD: 0, OPENING: 0, RENTED: 0, INACTIVE: 0 };
        for (const l of updatedListings) {
            const s = (l.status || '').toUpperCase() as keyof typeof c;
            if (s in c) c[s]++;
        }
        setStats((prev: any) => prev ? {
            ...prev,
            availableCount: c.AVAILABLE,
            holdCount:      c.HOLD,
            bookingCount:   c.BOOKING,
            soldCount:      c.SOLD,
            openingCount:   c.OPENING,
            rentedCount:    c.RENTED,
            inactiveCount:  c.INACTIVE,
            totalCount:     updatedListings.length,
        } : prev);
    }, []);

    // ── Row edit ──────────────────────────────────────────────────────────────
    const handleEditSubmit = async (data: any) => {
        if (!editTarget) return;
        try {
            const updated = await db.updateListing(editTarget.id, data);
            setListings(prev => {
                const next = prev.map(l => l.id === editTarget.id ? { ...l, ...updated } : l);
                recomputeStats(next);
                return next;
            });
            setEditTarget(null);
            syncStats();
        } catch (e: any) {
            const msg = e?.data?.error || e.message || t('common.error_generic');
            setPanelToast({ msg, type: 'error' });
            setTimeout(() => setPanelToast(null), 4000);
        }
    };

    // ── Row delete ────────────────────────────────────────────────────────────
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await db.deleteListing(deleteTarget.id);
            setListings(prev => {
                const next = prev.filter(l => l.id !== deleteTarget.id);
                recomputeStats(next);
                return next;
            });
            setSelected(prev => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
            setDeleteTarget(null);
            syncStats();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" role="dialog" aria-modal="true">
                <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-7xl border border-[var(--glass-border)] flex flex-col max-h-[92vh]">

                    {/* ── Header: project info + stats + actions ── */}
                    <div className="shrink-0 border-b border-[var(--glass-border)]">
                        {/* Top row */}
                        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600">
                                    {IC.LIST}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base font-bold text-[var(--text-primary)]">{project.name}</h2>
                                        {project.code && (
                                            <span className="text-xs2 font-mono bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded shrink-0">
                                                {project.code}
                                            </span>
                                        )}
                                        <span className={`text-xs2 font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[project.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {t('project.status_' + project.status)}
                                        </span>
                                    </div>
                                    {project.location && (
                                        <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{project.location}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {/* Mở Google Drive của dự án — chỉ hiện khi đã cấu hình drive_url trong form Dự án */}
                                {(() => {
                                    const meta = (project?.metadata && typeof project.metadata === 'object') ? project.metadata : {};
                                    const driveUrl: string = (meta.drive_url || meta.driveUrl || '').trim();
                                    if (!driveUrl) return null;
                                    return (
                                        <a
                                            href={driveUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-2.5 py-2 h-[36px] rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--glass-surface-hover)] transition-colors"
                                            title={t('project.drive_open')}
                                            aria-label={t('project.drive_open')}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            <span className="hidden md:inline text-xs">{t('project.drive_open')}</span>
                                        </a>
                                    );
                                })()}
                                {/* Export — always visible, disabled when empty */}
                                <button type="button" onClick={handleExport}
                                    disabled={listings.length === 0}
                                    className="flex items-center gap-1.5 px-2.5 py-2 h-[36px] rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--glass-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title={t('inventory.export_excel')}
                                    aria-label={t('inventory.export_excel')}>
                                    {IC.DOWNLOAD} <span className="hidden md:inline text-xs">{t('inventory.export_excel')}</span>
                                </button>
                                {/* Import */}
                                {canCreate && (
                                    <>
                                        <input
                                            ref={importFileRef}
                                            type="file"
                                            accept=".xlsx,.xls"
                                            className="hidden"
                                            onChange={handleImportFile}
                                        />
                                        <div className="relative group">
                                            <button type="button"
                                                onClick={() => importFileRef.current?.click()}
                                                disabled={importing}
                                                className="flex items-center gap-1.5 px-2.5 py-2 h-[36px] rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--glass-surface-hover)] disabled:opacity-60 transition-colors"
                                                title={t('inventory.import_excel')}
                                                aria-label={t('inventory.import_excel')}>
                                                {importing ? (
                                                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                                ) : IC.UPLOAD}
                                                <span className="hidden md:inline text-xs">{t('inventory.import_excel')}</span>
                                            </button>
                                        </div>
                                        <button type="button" onClick={downloadImportTemplate}
                                            className="flex items-center gap-1.5 px-2.5 py-2 h-[36px] rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--glass-surface-hover)] transition-colors"
                                            title={t('inventory.template')}
                                            aria-label={t('inventory.template')}>
                                            {IC.TEMPLATE} <span className="hidden md:inline text-xs">{t('inventory.template')}</span>
                                        </button>
                                    </>
                                )}
                                {/* Add */}
                                {canCreate && (
                                    <button type="button" onClick={() => setShowCreate(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 h-[36px] rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
                                        {IC.PLUS} <span className="hidden sm:inline">{t('project.add_listing')}</span>
                                    </button>
                                )}
                                <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                            </div>
                        </div>

                        {/* Stats pills row */}
                        {stats && (
                            <div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto no-scrollbar">
                                {([
                                    { key: 'totalCount',     label: t('project.stat_total'),    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
                                    { key: 'availableCount', label: t('project.stat_available'), cls: 'bg-emerald-100 text-emerald-700' },
                                    { key: 'openingCount',   label: t('project.stat_opening'),   cls: 'bg-indigo-100 text-indigo-700' },
                                    { key: 'bookingCount',   label: t('project.stat_booking'),   cls: 'bg-sky-100 text-sky-700' },
                                    { key: 'holdCount',      label: t('project.stat_hold'),      cls: 'bg-amber-100 text-amber-700' },
                                    { key: 'soldCount',      label: t('project.stat_sold'),      cls: 'bg-slate-100 text-slate-500' },
                                    { key: 'rentedCount',    label: t('project.stat_rented'),    cls: 'bg-violet-100 text-violet-700' },
                                    { key: 'inactiveCount',  label: t('project.stat_inactive'),  cls: 'bg-rose-50 text-rose-500 border border-rose-200' },
                                ] as const).filter(({ key }) =>
                                    key === 'totalCount'
                                        ? stats[key] != null
                                        : stats[key] != null && (stats[key] as number) > 0
                                ).map(({ key, label, cls }) => (
                                    <span key={key} className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>
                                        <span className="font-extrabold">{stats[key]}</span>
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search + bulk toolbar */}
                        <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
                            <div className="relative flex-1 min-w-[180px] max-w-sm">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">{IC.SEARCH}</span>
                                <input
                                    type="text"
                                    placeholder={t('common.search') + '...'}
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setSelected(new Set()); }}
                                    className="w-full pl-9 pr-3 py-2 h-[36px] border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Bulk actions — visible when rows selected */}
                            {selected.size > 0 && isAdmin && (
                                <>
                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl whitespace-nowrap">
                                        {selected.size} {t('project.bulk_selected_suffix')}
                                    </span>
                                    <Dropdown
                                        value={bulkStatus as string}
                                        onChange={v => setBulkStatus(v as string)}
                                        placeholder={t('project.bulk_status_placeholder')}
                                        className="h-[36px] min-w-[160px]"
                                        options={['AVAILABLE','HOLD','INACTIVE','OPENING','BOOKING'].map(s => ({
                                            value: s,
                                            label: t(`status.${s}`) || s,
                                        }))}
                                    />
                                    <button type="button" onClick={handleBulkStatus} disabled={!bulkStatus || bulkWorking}
                                        className="flex items-center gap-1.5 px-3 py-1.5 h-[36px] rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors">
                                        {IC.CHECK_ALL} {bulkWorking ? '...' : t('project.bulk_apply')}
                                    </button>
                                    <button type="button" onClick={() => setAccessListings(selectedListings)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 h-[36px] rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors">
                                        {IC.LOCK} <span className="hidden sm:inline">{t('project.bulk_access_btn')}</span>
                                    </button>
                                    <button type="button" onClick={() => setSelected(new Set())}
                                        className="text-xs text-[var(--text-tertiary)] hover:text-rose-600 px-1 py-1.5">
                                        {t('project.bulk_deselect')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Table ── */}
                    <div className="flex-1 overflow-auto min-h-0 scroll-touch thin-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-[var(--text-secondary)]">
                                <p className="font-semibold mb-1">{t('project.no_listings')}</p>
                                {canCreate && !search && (
                                    <button type="button" onClick={() => setShowCreate(true)}
                                        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                                        {IC.PLUS} {t('project.add_listing')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <table className="w-full text-sm min-w-max">
                                <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--glass-border)] z-10">
                                    <tr>
                                        {isAdmin && (
                                            <th className="px-4 py-2.5 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                                    onChange={toggleAll}
                                                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                />
                                            </th>
                                        )}
                                        <th className="px-3 py-2.5 w-14 text-left text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">{t('project.listing_col_image')}</th>
                                        {[
                                            t('project.listing_col_code'),
                                            t('project.listing_col_title'),
                                            t('project.listing_col_type'),
                                            t('project.listing_col_status'),
                                            t('project.listing_col_area'),
                                            isApartmentProject ? t('project.listing_col_clear_area') : t('project.listing_col_built_area'),
                                            ...(isApartmentProject ? [
                                                t('project.listing_col_tower'),
                                                t('project.listing_col_floor'),
                                                t('project.listing_col_view'),
                                            ] : []),
                                            t('project.listing_col_direction'),
                                            t('project.listing_col_unit_price'),
                                            t('project.listing_col_price'),
                                        ].map(h => (
                                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                        ))}
                                        {canCreate && (
                                            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">{t('project.listing_col_actions')}</th>
                                        )}
                                        {isAdmin && (
                                            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">{t('project.listing_access_col_header')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {filtered.map(l => (
                                        <tr key={l.id}
                                            onClick={() => setDetailListing(l)}
                                            className={`cursor-pointer hover:bg-[var(--glass-surface-hover)] transition-colors ${selected.has(l.id) ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                                            {isAdmin && (
                                                <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(l.id)}
                                                        onChange={() => toggleOne(l.id)}
                                                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-3 py-2">
                                                <div className="w-11 h-11 rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--glass-surface-hover)] shrink-0">
                                                    <LazyImage
                                                        src={l.images?.[0]}
                                                        wrapperClassName="w-full h-full"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="font-mono text-xs bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    {l.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 max-w-[220px]">
                                                <span className="font-semibold text-[var(--text-primary)] text-sm block truncate">{l.title}</span>
                                                {(l.type === 'Apartment' || l.type === 'Penthouse') && (l.attributes?.tower || l.attributes?.floor) && (
                                                    <span className="text-xs text-[var(--text-tertiary)] mt-0.5 block">
                                                        {[
                                                            l.attributes?.tower && `${t('inventory.label_tower')} ${l.attributes.tower}`,
                                                            l.attributes?.floor && `${t('inventory.label_floor')} ${l.attributes.floor}`
                                                        ].filter(Boolean).join(' · ')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-semibold bg-[var(--glass-surface)] text-[var(--text-secondary)] border border-[var(--glass-border)] px-2 py-0.5 rounded whitespace-nowrap">
                                                    {t(`property.${l.type?.toUpperCase()}`) || l.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_LISTING_COLOR[l.status] || 'bg-slate-100 text-slate-600'}`}>
                                                    {t(`status.${l.status}`) || l.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                {l.area ? <span>{l.area} <span className="text-[var(--text-tertiary)]">m²</span></span> : <span className="text-[var(--text-muted)]">—</span>}
                                            </td>
                                            {/* DT thông thủy (căn hộ) hoặc DT xây dựng (nhà đất) */}
                                            {isApartmentProject ? (
                                                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                    {l.attributes?.clearArea
                                                        ? <span>{l.attributes.clearArea} <span className="text-[var(--text-tertiary)]">m²</span></span>
                                                        : <span className="text-[var(--text-muted)]">—</span>}
                                                </td>
                                            ) : (
                                                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                    {l.builtArea ? <span>{l.builtArea} <span className="text-[var(--text-tertiary)]">m²</span></span> : <span className="text-[var(--text-muted)]">—</span>}
                                                </td>
                                            )}
                                            {/* Toà | Tầng | View — chỉ hiện cho dự án căn hộ/penthouse */}
                                            {isApartmentProject && (
                                                <>
                                                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                        {l.attributes?.tower
                                                            ? <span className="font-medium">{l.attributes.tower}</span>
                                                            : <span className="text-[var(--text-muted)]">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                        {l.attributes?.floor
                                                            ? <span className="font-medium">{l.attributes.floor}</span>
                                                            : <span className="text-[var(--text-muted)]">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap max-w-[120px] truncate">
                                                        {l.attributes?.view
                                                            ? <span className="font-medium">{l.attributes.view}</span>
                                                            : <span className="text-[var(--text-muted)]">—</span>}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                {l.attributes?.direction
                                                    ? <span className="font-medium">{t(`direction.${l.attributes.direction}`) || l.attributes.direction}</span>
                                                    : <span className="text-[var(--text-muted)]">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap font-mono">
                                                {fmtUnitPrice(l.price, l.area)}
                                            </td>
                                            <td className="px-4 py-2.5 font-bold text-emerald-700 whitespace-nowrap">{fmtPrice(l.price)}</td>
                                            {canCreate && (
                                                <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={e => openRowMenu(e, l.id)}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${menuOpenId === l.id ? 'bg-[var(--glass-surface-hover)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)]'}`}
                                                        title={t('common.actions')}
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                                        </svg>
                                                    </button>
                                                </td>
                                            )}
                                            {isAdmin && (
                                                <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAccessListings([l])}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-violet-600 hover:bg-violet-50 border border-violet-200 transition-colors whitespace-nowrap"
                                                    >
                                                        {IC.LOCK} {t('project.listing_access_single_btn')}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-5 py-3 border-t border-[var(--glass-border)] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                            <span>
                                <span className="font-bold text-[var(--text-secondary)]">{filtered.length}</span> {t('project.listing_count')}
                            </span>
                            {selected.size > 0 && (
                                <span className="text-emerald-600 font-semibold">
                                    · {selected.size} {t('project.bulk_selected_suffix')}
                                </span>
                            )}
                            {search && filtered.length !== listings.length && (
                                <span className="text-indigo-500">· {t('common.search')}: "{search}"</span>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl border border-[var(--glass-border)] text-sm font-semibold hover:bg-[var(--glass-surface-hover)] transition-colors">{t('common.close')}</button>
                    </div>
                </div>
            </div>

            <ListingForm
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={handleListingSubmit}
                initialData={{ projectCode: project.code, location: project.location } as any}
                isProjectUnit={true}
                t={t}
            />

            <ListingForm
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSubmit={handleEditSubmit}
                initialData={editTarget || undefined}
                isProjectUnit={true}
                t={t}
            />

            {detailListing && (
                <ListingDetailPanel
                    listing={detailListing}
                    canEdit={canCreate}
                    onEdit={() => { setEditTarget(detailListing); setDetailListing(null); }}
                    onClose={() => setDetailListing(null)}
                    t={t}
                />
            )}

            {menuOpenId && (() => {
                const menuListing = filtered.find(l => l.id === menuOpenId);
                if (!menuListing) return null;
                return createPortal(
                    <div
                        ref={menuRef}
                        onClick={e => e.stopPropagation()}
                        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 10002 }}
                        className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[160px]"
                    >
                        <button
                            type="button"
                            onClick={() => { setMenuOpenId(null); setEditTarget(menuListing); }}
                            className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2"
                        >
                            {IC.EDIT} {t('common.edit')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMenuOpenId(null); setContractTarget(menuListing); }}
                            className="w-full text-left px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                        >
                            {IC.CONTRACT} {t('detail.create_contract') || 'Hợp đồng'}
                        </button>
                        <div className="border-t border-[var(--glass-border)] my-1" />
                        <button
                            type="button"
                            onClick={() => { setMenuOpenId(null); setDeleteTarget(menuListing); }}
                            className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                            {IC.TRASH} {t('common.delete')}
                        </button>
                    </div>,
                    document.body
                );
            })()}

            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--glass-border)] p-6 max-w-sm w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 shrink-0">
                                {IC.TRASH}
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-primary)]">{t('common.delete')}</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{deleteTarget.title || deleteTarget.code}</p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{t('project.listing_delete_confirm')}</p>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl border border-[var(--glass-border)] text-sm font-semibold hover:bg-[var(--glass-surface-hover)] transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-60"
                            >
                                {deleting ? '...' : t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {accessListings && (
                <ListingAccessPanel
                    listings={accessListings}
                    tenants={tenants}
                    onClose={() => setAccessListings(null)}
                    t={t}
                />
            )}

            {/* ── Import Preview Modal ── */}
            {importPreview && createPortal(
                <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--glass-border)] p-6 max-w-lg w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0">
                                {IC.UPLOAD}
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-primary)]">Xác nhận nhập dữ liệu</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-0.5">Kiểm tra trước khi tạo sản phẩm</p>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-center">
                                <div className="text-2xl font-extrabold text-emerald-700">{importPreview.valid.length}</div>
                                <div className="text-xs text-emerald-600 font-semibold mt-0.5">Hợp lệ — sẽ được tạo</div>
                            </div>
                            <div className={`rounded-xl px-4 py-3 text-center ${importPreview.errors.length > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                <div className={`text-2xl font-extrabold ${importPreview.errors.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{importPreview.errors.length}</div>
                                <div className={`text-xs font-semibold mt-0.5 ${importPreview.errors.length > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Lỗi — sẽ bỏ qua</div>
                            </div>
                        </div>

                        {/* Error list */}
                        {importPreview.errors.length > 0 && (
                            <div className="max-h-40 overflow-y-auto thin-scrollbar rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/10 p-3 space-y-1">
                                {importPreview.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-rose-700">
                                        <span className="font-bold">Dòng {e.row}:</span> {e.error}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setImportPreview(null)}
                                disabled={importUploading}
                                className="flex-1 px-4 py-2 rounded-xl border border-[var(--glass-border)] text-sm font-semibold hover:bg-[var(--glass-surface-hover)] transition-colors"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={handleImportConfirm}
                                disabled={importUploading || importPreview.valid.length === 0}
                                className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-60"
                            >
                                {importUploading
                                    ? 'Đang nhập...'
                                    : `Nhập ${importPreview.valid.length} sản phẩm`}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Import Done Modal ── */}
            {importDone && createPortal(
                <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--glass-border)] p-6 max-w-sm w-full space-y-4">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mx-auto mb-3">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">Nhập hoàn tất</h3>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                                Đã tạo thành công <span className="font-bold text-emerald-700">{importDone.created}</span> sản phẩm
                                {importDone.errors.length > 0 && (
                                    <>, <span className="font-bold text-rose-600">{importDone.errors.length}</span> lỗi bỏ qua</>
                                )}
                            </p>
                        </div>

                        {importDone.errors.length > 0 && (
                            <div className="max-h-40 overflow-y-auto thin-scrollbar rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/10 p-3 space-y-1">
                                {importDone.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-rose-700">
                                        <span className="font-bold">Dòng {e.row}:</span> {e.error}
                                    </p>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setImportDone(null)}
                            className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Panel toast ── */}
            {panelToast && createPortal(
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[20000] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${panelToast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}
                    style={{ minWidth: 220, textAlign: 'center' }}
                >
                    {panelToast.msg}
                </div>,
                document.body
            )}

            {/* ── Contract Modal from listing row — rendered via portal so it sits above the listing panel's stacking context ── */}
            {contractTarget && createPortal(
                <ContractModal
                    initialData={{
                        listingId: contractTarget.id,
                        type: ContractType.DEPOSIT,
                        status: ContractStatus.DRAFT,
                        // ── Mã căn / loại ─────────────────────────────────────────
                        propertyUnitCode: contractTarget.code,
                        // Translate enum ('Apartment') → localised label ('Căn hộ')
                        propertyType: t(`property.${(contractTarget.type || '').toUpperCase()}`) || contractTarget.type || '',
                        // ── Địa chỉ — dùng `location` (không có field `address` riêng) ─
                        propertyAddress: contractTarget.location ?? '',
                        // ── Diện tích ─────────────────────────────────────────────
                        propertyArea: contractTarget.area ?? 0,
                        // DT xây dựng: clearArea cho căn hộ/penthouse; builtArea cho loại khác
                        propertyConstructionArea: (['Apartment', 'Penthouse'].includes(contractTarget.type)
                            ? Number(contractTarget.attributes?.clearArea ?? 0)
                            : (contractTarget.builtArea ?? 0)),
                        // ── Số tầng ───────────────────────────────────────────────
                        propertyFloorNumber: contractTarget.attributes?.floor
                            ? String(contractTarget.attributes.floor)
                            : '',
                        // ── Giá ──────────────────────────────────────────────────
                        propertyPrice: contractTarget.price ?? 0,
                    }}
                    onClose={() => setContractTarget(null)}
                    onSuccess={() => {
                        setContractTarget(null);
                        setPanelToast({ msg: 'Đã lưu hợp đồng thành công', type: 'success' });
                        setTimeout(() => setPanelToast(null), 3500);
                    }}
                />,
                document.body
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing Access Panel  (Phân quyền xem từng sản phẩm)
// ─────────────────────────────────────────────────────────────────────────────
interface ListingAccessPanelProps {
    listings: any[];      // 1 hoặc nhiều listing được chọn
    tenants: any[];
    onClose: () => void;
    t: (k: string) => string;
}

function ListingAccessPanel({ listings, tenants, onClose, t }: ListingAccessPanelProps) {
    const isBulk = listings.length > 1;
    const [accesses, setAccesses] = useState<Record<string, any[]>>({});   // listingId → access[]
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [grantForm, setGrantForm] = useState({ partnerTenantId: '', expiresAt: '', note: '' });
    const [granting, setGranting] = useState(false);
    const [err, setErr] = useState('');
    // Inline revoke confirm: key = `${listingId}::${partnerTenantId}`
    const [revokeKey, setRevokeKey] = useState<string | null>(null);

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-[16px] focus:outline-none focus:ring-2 focus:ring-violet-500';
    const labelCls = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wide';

    // Load access list for each listing
    useEffect(() => {
        listings.forEach(l => {
            setLoadingIds(prev => new Set([...prev, l.id]));
            db.getListingAccess(l.id).then(data => {
                setAccesses(prev => ({ ...prev, [l.id]: data }));
            }).catch(() => {
                setAccesses(prev => ({ ...prev, [l.id]: [] }));
            }).finally(() => {
                setLoadingIds(prev => { const next = new Set(prev); next.delete(l.id); return next; });
            });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantForm.partnerTenantId) { setErr(t('project.error_partner_required')); return; }
        setGranting(true); setErr('');
        try {
            // Grant to all selected listings
            const results = await Promise.all(
                listings.map(l => db.grantListingAccess(l.id, {
                    partnerTenantId: grantForm.partnerTenantId,
                    expiresAt: grantForm.expiresAt || undefined,
                    note: grantForm.note || undefined,
                }))
            );
            // Update local state
            listings.forEach((l, i) => {
                setAccesses(prev => {
                    const list = [...(prev[l.id] || [])];
                    const idx = list.findIndex(a => a.partner_tenant_id === grantForm.partnerTenantId);
                    if (idx >= 0) list[idx] = results[i]; else list.unshift(results[i]);
                    return { ...prev, [l.id]: list };
                });
            });
            setGrantForm({ partnerTenantId: '', expiresAt: '', note: '' });
        } catch (e: any) {
            setErr(e.message || t('common.error_generic'));
        } finally {
            setGranting(false);
        }
    };

    const handleRevoke = async (listingId: string, partnerTenantId: string) => {
        try {
            await db.revokeListingAccess(listingId, partnerTenantId);
            setAccesses(prev => ({
                ...prev,
                [listingId]: (prev[listingId] || []).map(a =>
                    a.partner_tenant_id === partnerTenantId ? { ...a, status: 'REVOKED' } : a
                ),
            }));
            setRevokeKey(null);
        } catch (e: any) {
            setErr(e.message || t('common.error_generic'));
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl border border-[var(--glass-border)] flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-violet-600">
                            {IC.LOCK}
                            <h2 className="text-base font-bold">{t('project.listing_access_title')}</h2>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {isBulk
                                ? `${listings.length} ${t('project.listing_selected_count')}`
                                : listings[0]?.title || listings[0]?.code}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                </div>

                <div className="overflow-y-auto no-scrollbar flex-1 p-6 space-y-6">
                    {/* Info box */}
                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl px-4 py-3 text-xs text-violet-700 dark:text-violet-300">
                        <strong>{t('project.listing_access_note')}:</strong> {t('project.listing_access_info')}
                    </div>

                    {/* Grant form */}
                    <form onSubmit={handleGrant} className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{t('project.listing_access_grant_title')}</p>
                        {err && <p className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5" role="alert">{err}</p>}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls}>{t('project.listing_access_partner_label')} *</label>
                                <Dropdown
                                    value={grantForm.partnerTenantId}
                                    onChange={(v) => setGrantForm(f => ({ ...f, partnerTenantId: v as string }))}
                                    placeholder={t('project.listing_access_select')}
                                    options={tenants.map(t2 => ({ value: t2.id, label: `${t2.name} (${t2.domain})` }))}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>{t('project.expires_at')}</label>
                                <input type="date" className={inputCls} value={grantForm.expiresAt} onChange={e => setGrantForm(f => ({ ...f, expiresAt: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('project.note')}</label>
                                <input className={inputCls} value={grantForm.note} onChange={e => setGrantForm(f => ({ ...f, note: e.target.value }))} placeholder={t('project.listing_access_cooperation_placeholder')} />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" disabled={granting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                                {IC.SHIELD}
                                {granting ? t('project.listing_access_granting') : isBulk ? `${t('project.listing_access_grant_btn')} (${listings.length})` : t('project.listing_access_grant_btn')}
                            </button>
                        </div>
                    </form>

                    {/* Access list per listing */}
                    {listings.map(l => {
                        const list = accesses[l.id] || [];
                        const isLoading = loadingIds.has(l.id);
                        const activeList = list.filter(a => a.status === 'ACTIVE');
                        return (
                            <div key={l.id} className="space-y-2">
                                {isBulk && (
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate border-b border-[var(--glass-border)] pb-1">
                                        {l.title || l.code}
                                        {activeList.length > 0 && (
                                            <span className="ml-2 text-violet-600">({activeList.length} {t('project.listing_access_partner_count')})</span>
                                        )}
                                    </p>
                                )}
                                {isLoading ? (
                                    <p className="text-xs text-[var(--text-tertiary)]">{t('project.listing_access_loading')}</p>
                                ) : list.length === 0 ? (
                                    <p className="text-xs text-[var(--text-tertiary)] italic">{t('project.listing_access_no_records')}</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {list.map(a => (
                                            <div key={a.id} className="flex items-center justify-between gap-3 bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{a.partner_tenant_name || a.partner_tenant_id}</p>
                                                    <div className="flex gap-3 mt-0.5 text-xs text-[var(--text-tertiary)]">
                                                        <span>{t('project.listing_access_granted_prefix')} {fmtDate(a.granted_at)}</span>
                                                        {a.expires_at && <span>{t('project.listing_access_expires_prefix')} {fmtDate(a.expires_at)}</span>}
                                                        {a.note && <span className="italic">"{a.note}"</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCESS_COLOR[a.status] || 'bg-slate-100 text-slate-500'}`}>
                                                        {t('project.access_status_' + a.status)}
                                                    </span>
                                                    {a.status === 'ACTIVE' && revokeKey !== `${l.id}::${a.partner_tenant_id}` && (
                                                        <button type="button" onClick={() => setRevokeKey(`${l.id}::${a.partner_tenant_id}`)}
                                                            className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                                                            {t('project.listing_access_revoke_btn')}
                                                        </button>
                                                    )}
                                                    {revokeKey === `${l.id}::${a.partner_tenant_id}` && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <p className="text-xs text-[var(--text-secondary)]">{t('project.listing_access_revoke_confirm')}</p>
                                                            <div className="flex gap-1.5">
                                                                <button type="button" onClick={() => setRevokeKey(null)}
                                                                    className="text-xs px-2 py-1 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]">
                                                                    {t('common.cancel')}
                                                                </button>
                                                                <button type="button" onClick={() => handleRevoke(l.id, a.partner_tenant_id)}
                                                                    className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
                                                                    {t('project.listing_access_revoke_btn')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Card
// ─────────────────────────────────────────────────────────────────────────────
interface ProjectCardProps {
    project: any;
    isAdmin: boolean;
    isPartner: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onAccess: () => void;
    onListings: () => void;
    t: (k: string) => string;
}

function ProjectCard({ project, isAdmin, isPartner, onEdit, onDelete, onAccess, onListings, t }: ProjectCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setMenuOpen(v => !v);
    };

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col">
            {/* Card body */}
            <div className="p-5 flex-1">
                {/* Top row: name + status + admin menu */}
                <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-[var(--text-primary)] truncate">{project.name}</h3>
                            {project.code && (
                                <span className="shrink-0 text-xs2 font-mono bg-[var(--glass-surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded">
                                    {project.code}
                                </span>
                            )}
                        </div>
                        {isPartner && project.developer_name && (
                            <p className="text-xs text-indigo-600 font-semibold mt-0.5 truncate">{t('project.developer')}: {project.developer_name}</p>
                        )}
                        {project.location && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate flex items-center gap-1">
                                <svg className="w-3 h-3 shrink-0 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                {project.location}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[project.status] || 'bg-slate-100 text-slate-600'}`}>
                            {t('project.status_' + project.status)}
                        </span>
                        {/* Admin 3-dot menu — only edit/access/delete */}
                        {isAdmin && (
                            <button
                                ref={btnRef}
                                type="button"
                                onClick={openMenu}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] transition-colors"
                                title={t('common.actions')}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {project.description && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2 leading-relaxed">{project.description}</p>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                    {project.total_units != null && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                            <span className="text-xs text-[var(--text-tertiary)] truncate">
                                <span className="font-semibold text-[var(--text-secondary)]">{project.total_units}</span> {t('project.total_units')}
                            </span>
                        </div>
                    )}
                    {project.listing_count != null && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-xs text-[var(--text-tertiary)] truncate">
                                <span className="font-semibold text-[var(--text-secondary)]">{project.listing_count}</span> {t('project.listing_count')}
                            </span>
                        </div>
                    )}
                    {!isPartner && project.partner_count != null && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                            <span className="text-xs text-[var(--text-tertiary)] truncate">
                                <span className="font-semibold text-[var(--text-secondary)]">{project.partner_count}</span> {t('project.partner_count')}
                            </span>
                        </div>
                    )}
                    {project.open_date && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span className="text-xs text-[var(--text-tertiary)] truncate">{t('project.open_date')}: <span className="font-semibold text-[var(--text-secondary)]">{fmtDate(project.open_date)}</span></span>
                        </div>
                    )}
                    {project.handover_date && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            <span className="text-xs text-[var(--text-tertiary)] truncate">{t('project.handover_date')}: <span className="font-semibold text-[var(--text-secondary)]">{fmtDate(project.handover_date)}</span></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Card footer — primary CTA */}
            <div className="px-5 pb-4 pt-0">
                <button
                    type="button"
                    onClick={onListings}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[var(--glass-surface)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-[var(--glass-border)] hover:border-emerald-300 text-[var(--text-secondary)] hover:text-emerald-700 text-sm font-semibold rounded-xl transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                    {t('project.view_listings')}
                    {project.listing_count > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                            {project.listing_count}
                        </span>
                    )}
                </button>
            </div>

            {/* Admin dropdown menu */}
            {menuOpen && createPortal(
                <div
                    ref={menuRef}
                    onClick={e => e.stopPropagation()}
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[180px]"
                >
                    <button onClick={() => { setMenuOpen(false); onEdit(); }}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        {t('common.edit')}
                    </button>
                    <button onClick={() => { setMenuOpen(false); onAccess(); }}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                        {t('project.tab_access')}
                    </button>
                    <div className="border-t border-[var(--glass-border)] my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(); }}
                        className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        {t('common.delete')}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function Projects() {
    const { t } = useTranslation();
    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [formTarget, setFormTarget] = useState<Project | null | 'new'>(null);
    const [accessTarget, setAccessTarget] = useState<Project | null>(null);
    const [listingsTarget, setListingsTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '');
    const isPartner = user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_AGENT';

    const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await db.getProjects(1, 100, { search: debouncedSearch || undefined, status: statusFilter || undefined });
            setProjects(result.data || result);
        } catch (e: any) {
            setError(e.message || t('common.error_generic'));
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, statusFilter, t]);

    useEffect(() => { db.getCurrentUser().then(setUser); }, []);
    useEffect(() => { if (user) load(); }, [user, load]);

    // Restore saved drag order from localStorage (only when no search/filter active)
    useEffect(() => {
        if (loading || !user?.id || projects.length === 0) return;
        if (debouncedSearch || statusFilter) return;
        try {
            const saved = localStorage.getItem(`sgs_proj_order_${user.id}`);
            if (!saved) return;
            const ids: string[] = JSON.parse(saved);
            setProjects(prev => {
                const ordered = [...prev].sort((a, b) => {
                    const ai = ids.indexOf(a.id), bi = ids.indexOf(b.id);
                    return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
                });
                return ordered;
            });
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, loading]);

    const handleSave = async (data: any) => {
        if (formTarget === 'new') {
            const created = await db.createProject(data);
            setProjects(prev => [created, ...prev]);
            showToast(t('project.create_success'));
        } else if (formTarget) {
            const updated = await db.updateProject((formTarget as Project).id, data);
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            showToast(t('project.update_success'));
        }
        setFormTarget(null);
    };

    const handleDragEnd = useCallback(() => {
        if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
            setProjects(prev => {
                const next = [...prev];
                const [moved] = next.splice(dragIdx, 1);
                next.splice(dragOverIdx, 0, moved);
                try {
                    localStorage.setItem(
                        `sgs_proj_order_${user?.id}`,
                        JSON.stringify(next.map((p: any) => p.id))
                    );
                } catch {}
                return next;
            });
        }
        setDragIdx(null);
        setDragOverIdx(null);
    }, [dragIdx, dragOverIdx, user?.id]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await db.deleteProject(deleteTarget.id);
            setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
            showToast(t('project.delete_success'));
            setDeleteTarget(null);
        } catch (e: any) {
            showToast(e.message || t('common.error_generic'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
            {/* Header — title + search + filters + create all in one bar */}
            <div className="shrink-0 px-5 py-3.5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Title block */}
                    <div className="flex-none">
                        <h1 className="text-lg font-extrabold text-[var(--text-primary)] leading-tight">
                            {isPartner ? t('project.partner_view_title') : t('project.title')}
                        </h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {isPartner ? t('project.partner_view_subtitle') : t('project.subtitle')}
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block h-8 w-px bg-[var(--glass-border)]" />

                    {/* Search */}
                    <div className="relative flex-1 min-w-[160px] max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] flex items-center">{IC.SEARCH}</span>
                        <input
                            type="text"
                            placeholder={t('common.search') + '...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 h-[38px] border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Status filter */}
                    {!isPartner && (
                        <div className="shrink-0">
                            <Dropdown
                                value={statusFilter}
                                onChange={v => setStatusFilter(v as string)}
                                options={[
                                    { value: '', label: t('project.status') },
                                    ...(['ACTIVE','BOOKING','COMPLETED','ON_HOLD','SUSPENDED'].map(s => ({ value: s, label: t('project.status_' + s) })))
                                ]}
                                className="text-sm h-[38px]"
                            />
                        </div>
                    )}

                    {/* Count badge */}
                    {!loading && projects.length > 0 && (
                        <span className="hidden sm:inline-flex shrink-0 items-center px-2.5 py-1 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] text-xs font-semibold rounded-full">
                            {projects.length}
                        </span>
                    )}

                    <div className="flex-1" />

                    {/* Create button */}
                    {isAdmin && (
                        <button type="button" onClick={() => setFormTarget('new')}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 h-[38px] rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors">
                            {IC.PLUS} <span className="hidden xs:inline">{t('project.new')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 mb-4 text-sm" role="alert">{error}</div>
                )}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-[var(--text-secondary)]">
                        <div className="text-indigo-300 mb-3">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                            </svg>
                        </div>
                        <p className="font-semibold">{t('common.no_data')}</p>
                        {isAdmin && (
                            <button type="button" onClick={() => setFormTarget('new')}
                                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
                                {IC.PLUS} {t('project.new')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {projects.map((project, idx) => (
                            <div
                                key={project.id}
                                draggable={isAdmin}
                                onDragStart={e => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDragIdx(idx);
                                }}
                                onDragOver={e => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverIdx !== idx) setDragOverIdx(idx);
                                }}
                                onDrop={e => e.preventDefault()}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
                                className={[
                                    'transition-all duration-150',
                                    isAdmin ? 'cursor-grab active:cursor-grabbing' : '',
                                    dragIdx === idx ? 'opacity-40 scale-[0.97] shadow-inner' : '',
                                    dragOverIdx === idx && dragIdx !== idx
                                        ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl scale-[1.01]'
                                        : '',
                                ].join(' ')}
                            >
                                <ProjectCard
                                    project={project}
                                    isAdmin={isAdmin}
                                    isPartner={isPartner}
                                    onEdit={() => setFormTarget(project)}
                                    onDelete={() => setDeleteTarget(project)}
                                    onAccess={() => setAccessTarget(project)}
                                    onListings={() => setListingsTarget(project)}
                                    t={t}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals — rendered via portal to document.body to escape the main isolate stacking context */}
            {formTarget !== null && createPortal(
                <ProjectFormModal
                    project={formTarget === 'new' ? null : formTarget}
                    onSave={handleSave}
                    onClose={() => setFormTarget(null)}
                    t={t}
                />,
                document.body
            )}
            {accessTarget && createPortal(
                <AccessPanel
                    project={accessTarget}
                    onClose={() => setAccessTarget(null)}
                    t={t}
                />,
                document.body
            )}
            {listingsTarget && createPortal(
                <ProjectListingsPanel
                    project={listingsTarget}
                    canCreate={isAdmin || user?.role === 'TEAM_LEAD'}
                    isAdmin={isAdmin}
                    onClose={() => setListingsTarget(null)}
                    onListingCreated={() => {
                        setProjects(prev => prev.map(p =>
                            p.id === listingsTarget.id
                                ? { ...p, listing_count: (p.listing_count || 0) + 1 }
                                : p
                        ));
                    }}
                    t={t}
                />,
                document.body
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
                    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-sm border border-[var(--glass-border)]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
                            <div className="flex items-center gap-2 text-rose-600">
                                {IC.TRASH}
                                <h2 className="text-base font-bold">{t('common.delete')}</h2>
                            </div>
                            <button type="button" onClick={() => setDeleteTarget(null)} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-[var(--text-primary)]">
                                {t('project.confirm_delete')}
                            </p>
                            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 truncate">
                                {deleteTarget.name}
                            </div>
                            <div className="flex gap-3 justify-end pt-1">
                                <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                                    className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-50">
                                    {t('common.cancel')}
                                </button>
                                <button type="button" onClick={handleDelete} disabled={deleting}
                                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2">
                                    {deleting
                                        ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>{t('common.loading')}</>
                                        : <>{IC.TRASH}{t('common.delete')}</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {toast && createPortal(
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold transition-all animate-enter ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {toast.type === 'success'
                        ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    }
                    {toast.msg}
                </div>,
                document.body
            )}
        </div>
    );
}
