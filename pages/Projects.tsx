import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { Project, ProjectAccess, UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { ListingForm } from '../components/ListingForm';

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
};

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-sky-100 text-sky-700 border-sky-200',
    ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
    SUSPENDED: 'bg-rose-100 text-rose-700 border-rose-200',
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

function ProjectFormModal({ project, onSave, onClose, t }: ProjectFormProps) {
    const p = project as any;
    const [form, setForm] = useState({
        name: p?.name || '',
        code: p?.code || '',
        description: p?.description || '',
        location: p?.location || '',
        totalUnits: (p?.total_units ?? p?.totalUnits) != null ? String(p?.total_units ?? p?.totalUnits) : '',
        status: p?.status || 'ACTIVE',
        openDate: p?.open_date || p?.openDate || '',
        handoverDate: p?.handover_date || p?.handoverDate || '',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setErr(t('project.error_name_required')); return; }
        setSaving(true);
        setErr('');
        try {
            await onSave({
                name: form.name.trim(),
                code: form.code.trim() || undefined,
                description: form.description.trim() || undefined,
                location: form.location.trim() || undefined,
                totalUnits: form.totalUnits ? Number(form.totalUnits) : undefined,
                status: form.status,
                openDate: form.openDate || undefined,
                handoverDate: form.handoverDate || undefined,
            });
        } catch (e: any) {
            setErr(e.message || t('common.error_generic'));
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
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
                        <div>
                            <label className={labelCls}>{t('project.status')}</label>
                            <Dropdown
                                value={form.status}
                                onChange={v => set('status', v as string)}
                                options={['ACTIVE','COMPLETED','ON_HOLD','SUSPENDED'].map(s => ({ value: s, label: t('project.status_' + s) }))}
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

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
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
                                <label htmlFor="pa-tenant" className={labelCls}>{t('project.partner_tenant')} *</label>
                                <select id="pa-tenant" className={inputCls} value={grantForm.partnerTenantId} onChange={e => setGrantForm(f => ({ ...f, partnerTenantId: e.target.value }))}>
                                    <option value="">{t('common.select')}</option>
                                    {availableTenants.map(t2 => <option key={t2.id} value={t2.id}>{t2.name} ({t2.domain})</option>)}
                                </select>
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

function fmtPrice(p: number) {
    if (!p) return '—';
    if (p >= 1_000_000_000) return (p / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
    if (p >= 1_000_000) return (p / 1_000_000).toFixed(0) + ' tr';
    return p.toLocaleString('vi-VN');
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
        setListings(prev => [listing, ...prev]);
        if (stats) setStats((s: any) => ({ ...s, availableCount: (s.availableCount || 0) + 1, totalCount: (s.totalCount || 0) + 1 }));
        setShowCreate(false);
        onListingCreated?.();
    };

    const filtered = search
        ? listings.filter(l => l.title?.toLowerCase().includes(search.toLowerCase()) || l.code?.toLowerCase().includes(search.toLowerCase()))
        : listings;

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
            setListings(prev => prev.map(l => selected.has(l.id) ? { ...l, status: bulkStatus } : l));
            setSelected(new Set());
            setBulkStatus('');
        } finally {
            setBulkWorking(false);
        }
    };

    const selectedListings = filtered.filter(l => selected.has(l.id));

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
                <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-5xl border border-[var(--glass-border)] flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-600">
                                {IC.LIST}
                                <h2 className="text-base font-bold">{t('project.listings_title')}</h2>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{project.name}{project.code ? ` · ${project.code}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {canCreate && (
                                <button type="button" onClick={() => setShowCreate(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
                                    {IC.PLUS} {t('project.add_listing')}
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)]" aria-label={t('common.close')}>{IC.X}</button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    {stats && (
                        <div className="flex flex-wrap gap-3 px-6 py-3 bg-[var(--bg-app)] border-b border-[var(--glass-border)] shrink-0">
                            {[
                                { key: 'totalCount',     label: t('project.stat_total'),     cls: 'bg-slate-100 text-slate-700' },
                                { key: 'availableCount', label: t('project.stat_available'),  cls: 'bg-emerald-100 text-emerald-700' },
                                { key: 'bookingCount',   label: t('project.stat_booking'),    cls: 'bg-sky-100 text-sky-700' },
                                { key: 'holdCount',      label: t('project.stat_hold'),       cls: 'bg-amber-100 text-amber-700' },
                                { key: 'soldCount',      label: t('project.stat_sold'),       cls: 'bg-slate-100 text-slate-500' },
                            ].map(({ key, label, cls }) => stats[key] != null && (
                                <span key={key} className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>
                                    {label}: {stats[key]}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Search + Bulk action bar */}
                    <div className="px-6 py-3 border-b border-[var(--glass-border)] shrink-0 flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">{IC.SEARCH}</span>
                            <input
                                type="text"
                                placeholder={t('common.search') + '...'}
                                value={search}
                                onChange={e => { setSearch(e.target.value); setSelected(new Set()); }}
                                className="w-full pl-9 pr-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Bulk actions — visible when rows selected */}
                        {selected.size > 0 && isAdmin && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--glass-border)] px-3 py-2 rounded-xl">
                                    {selected.size} {t('project.bulk_selected_suffix')}
                                </span>
                                <select
                                    value={bulkStatus}
                                    onChange={e => setBulkStatus(e.target.value)}
                                    className="border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">{t('project.bulk_status_placeholder')}</option>
                                    {['AVAILABLE','HOLD','INACTIVE','OPENING','BOOKING'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={handleBulkStatus} disabled={!bulkStatus || bulkWorking}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors">
                                    {IC.CHECK_ALL} {bulkWorking ? '...' : t('project.bulk_apply')}
                                </button>
                                <button type="button" onClick={() => setAccessListings(selectedListings)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors">
                                    {IC.LOCK} {t('project.bulk_access_btn')}
                                </button>
                                <button type="button" onClick={() => setSelected(new Set())}
                                    className="text-xs text-[var(--text-secondary)] hover:text-rose-600 px-2 py-2">
                                    {t('project.bulk_deselect')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
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
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--glass-border)]">
                                    <tr>
                                        {isAdmin && (
                                            <th className="px-4 py-3 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                                    onChange={toggleAll}
                                                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                />
                                            </th>
                                        )}
                                        {[
                                            t('project.listing_col_code'),
                                            t('project.listing_col_title'),
                                            t('project.listing_col_type'),
                                            t('project.listing_col_status'),
                                            t('project.listing_col_area'),
                                            t('project.listing_col_price'),
                                        ].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                        ))}
                                        {isAdmin && (
                                            <th className="px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap">{t('project.listing_access_col_header')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {filtered.map(l => (
                                        <tr key={l.id}
                                            className={`hover:bg-[var(--glass-surface-hover)] transition-colors ${selected.has(l.id) ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                                            {isAdmin && (
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(l.id)}
                                                        onChange={() => toggleOne(l.id)}
                                                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">{l.code}</td>
                                            <td className="px-4 py-3 font-semibold text-[var(--text-primary)] max-w-[200px] truncate">{l.title}</td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{l.type}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_LISTING_COLOR[l.status] || 'bg-slate-100 text-slate-600'}`}>
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{l.area ? `${l.area} m²` : '—'}</td>
                                            <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">{fmtPrice(l.price)}</td>
                                            {isAdmin && (
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAccessListings([l])}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-violet-600 hover:bg-violet-50 border border-violet-200 transition-colors"
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

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-[var(--glass-border)] flex items-center justify-between shrink-0 text-xs text-[var(--text-secondary)]">
                        <span>{filtered.length} {t('project.listing_count')}{selected.size > 0 ? ` · ${selected.size} ${t('project.bulk_selected_suffix')}` : ''}</span>
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-sm font-semibold hover:bg-[var(--glass-surface-hover)]">{t('common.close')}</button>
                    </div>
                </div>
            </div>

            <ListingForm
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={handleListingSubmit}
                initialData={{ projectCode: project.code, location: project.location } as any}
                t={t}
            />

            {accessListings && (
                <ListingAccessPanel
                    listings={accessListings}
                    tenants={tenants}
                    onClose={() => setAccessListings(null)}
                    t={t}
                />
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

    const inputCls = 'w-full border border-[var(--glass-border)] rounded-xl px-3 py-2 bg-[var(--bg-app)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';
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
                                <select className={inputCls} value={grantForm.partnerTenantId} onChange={e => setGrantForm(f => ({ ...f, partnerTenantId: e.target.value }))}>
                                    <option value="">{t('project.listing_access_select')}</option>
                                    {tenants.map(t2 => <option key={t2.id} value={t2.id}>{t2.name} ({t2.domain})</option>)}
                                </select>
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
        <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[var(--text-primary)] truncate">{project.name}</h3>
                        {project.code && <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">{project.code}</span>}
                    </div>
                    {isPartner && project.developer_name && (
                        <p className="text-xs text-indigo-600 font-semibold mt-0.5">{t('project.developer')}: {project.developer_name}</p>
                    )}
                    {project.location && <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{project.location}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_COLOR[project.status] || 'bg-slate-100 text-slate-600'}`}>
                        {t('project.status_' + project.status)}
                    </span>
                    {/* 3-dot menu */}
                    <button
                        ref={btnRef}
                        type="button"
                        onClick={openMenu}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-colors"
                        title={t('common.actions') || 'Thao tác'}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                    </button>
                </div>
            </div>

            {project.description && (
                <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{project.description}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
                {project.total_units != null && <span>{project.total_units} {t('project.total_units')}</span>}
                {project.listing_count != null && <span>{project.listing_count} {t('project.listing_count')}</span>}
                {!isPartner && project.partner_count != null && <span>{project.partner_count} {t('project.partner_count')}</span>}
                {project.open_date && <span>{t('project.open_date')}: {fmtDate(project.open_date)}</span>}
                {project.handover_date && <span>{t('project.handover_date')}: {fmtDate(project.handover_date)}</span>}
            </div>

            {/* Portal dropdown menu */}
            {menuOpen && createPortal(
                <div
                    ref={menuRef}
                    onClick={e => e.stopPropagation()}
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-xl py-1 min-w-[180px]"
                >
                    <button onClick={() => { setMenuOpen(false); onListings(); }}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                        {t('project.view_listings')}
                    </button>
                    {isAdmin && (
                        <>
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
                        </>
                    )}
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

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === 'ADMIN';
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
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
                            {isPartner ? t('project.partner_view_title') : t('project.title')}
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                            {isPartner ? t('project.partner_view_subtitle') : t('project.subtitle')}
                        </p>
                    </div>
                    {isAdmin && (
                        <button type="button" onClick={() => setFormTarget('new')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors">
                            {IC.PLUS} {t('project.new')}
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex gap-3 mt-4 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">{IC.SEARCH}</span>
                        <input
                            type="text"
                            placeholder={t('common.search') + '...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    {!isPartner && (
                        <Dropdown
                            value={statusFilter}
                            onChange={v => setStatusFilter(v as string)}
                            options={[
                                { value: '', label: t('project.status') },
                                ...(['ACTIVE','COMPLETED','ON_HOLD','SUSPENDED'].map(s => ({ value: s, label: t('project.status_' + s) })))
                            ]}
                            className="min-w-[180px]"
                        />
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
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isAdmin={isAdmin}
                                isPartner={isPartner}
                                onEdit={() => setFormTarget(project)}
                                onDelete={() => setDeleteTarget(project)}
                                onAccess={() => setAccessTarget(project)}
                                onListings={() => setListingsTarget(project)}
                                t={t}
                            />
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
