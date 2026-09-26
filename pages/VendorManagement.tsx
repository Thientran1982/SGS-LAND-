import { uiConfirm } from '../utils/uiDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/dbApi';
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
  DonutChart,
  TrendBars,
  StatusBadge,
  EmptyState,
  TONE_COLOR,
  type Tone,
  type Segment,
  type TrendPoint,
} from '../components/settings/SettingsUI';

interface VendorAdmin {
  id: string;
  email: string;
  name: string;
  status: string;
  emailVerified: boolean;
}
interface VendorSubscription {
  planId: string;
  status: string;
  trialEndsAt: string | null;
}
interface Vendor {
  id: string;
  name: string;
  domain: string;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  admin: VendorAdmin | null;
  subscription: VendorSubscription;
}

const VENDOR_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
type VendorStatus = typeof VENDOR_STATUSES[number];

const STATUS_TONE: Record<VendorStatus, Tone> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'neutral',
};

const TREND_MONTHS = 6;

/* ---------------- Icons ---------------- */

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const BuildingIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

/* ---------------- Small helpers ---------------- */

function VendorStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status as VendorStatus] ?? 'neutral';
  const label = t(`vendor.status_${status}`);
  return <StatusBadge tone={tone}>{label.startsWith('vendor.status_') ? status : label}</StatusBadge>;
}

function EmailVerifiedHint({ verified }: { verified: boolean }) {
  const { t } = useTranslation();
  return verified ? (
    <span className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: TONE_COLOR.success }}>
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      {t('vendor.v2_email_verified')}
    </span>
  ) : (
    <span className="mt-1 inline-block text-xs" style={{ color: TONE_COLOR.warning }}>{t('vendor.v2_email_unverified')}</span>
  );
}

/* ---------------- Modals ---------------- */

const ModalShell: React.FC<{ titleId: string; title: React.ReactNode; subtitle: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ titleId, title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="border-b border-[var(--glass-border)] px-5 py-4">
          <h3 id={titleId} className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
};

function RejectModal({
  vendor,
  onConfirm,
  onClose,
}: {
  vendor: Vendor;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError(t('vendor.v2_reject_reason_required')); return; }
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || t('vendor.v2_error_generic'));
      setLoading(false);
    }
  };
  return (
    <ModalShell
      titleId="vendor-reject-title"
      title={t('vendor.v2_reject_title')}
      subtitle={<>{t('vendor.v2_workspace')}: <strong className="text-[var(--text-primary)]">{vendor.name}</strong>{vendor.admin?.email ? ` — ${vendor.admin.email}` : ''}</>}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label htmlFor="vendor-reject-reason" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
            {t('vendor.v2_reject_reason_label')} <span style={{ color: TONE_COLOR.danger }} aria-hidden="true">*</span>
          </label>
          <textarea
            id="vendor-reject-reason"
            className="ui-input w-full resize-none"
            rows={4}
            required
            aria-invalid={!!error}
            aria-describedby={error ? 'vendor-reject-error' : undefined}
            placeholder={t('vendor.v2_reject_reason_placeholder')}
            value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}
          />
          {error && <p id="vendor-reject-error" role="alert" className="mt-1 text-xs" style={{ color: TONE_COLOR.danger }}>{error}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ui-button ui-button-secondary ui-button-md min-h-[40px]">
            {t('vendor.v2_cancel')}
          </button>
          <button type="submit" disabled={loading} className="ui-button ui-button-danger ui-button-md min-h-[40px] disabled:opacity-60">
            {loading ? t('vendor.v2_processing') : t('vendor.v2_reject_confirm')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function SuspendModal({
  vendor,
  onConfirm,
  onClose,
}: {
  vendor: Vendor;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Default reason is stored server-side, not shown in the UI.
      await onConfirm(reason.trim() || 'Suspended by platform admin');
      onClose();
    } catch {
      setLoading(false);
    }
  };
  return (
    <ModalShell
      titleId="vendor-suspend-title"
      title={t('vendor.v2_suspend_title')}
      subtitle={<strong className="text-[var(--text-primary)]">{vendor.name}</strong>}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label htmlFor="vendor-suspend-reason" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
            {t('vendor.v2_suspend_reason_label')}
          </label>
          <textarea
            id="vendor-suspend-reason"
            className="ui-input w-full resize-none"
            rows={3}
            placeholder={t('vendor.v2_suspend_reason_placeholder')}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ui-button ui-button-secondary ui-button-md min-h-[40px]">{t('vendor.v2_cancel')}</button>
          <button type="submit" disabled={loading} className="ui-button ui-button-primary ui-button-md min-h-[40px] disabled:opacity-60">
            {loading ? t('vendor.v2_processing') : t('vendor.v2_suspend')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------- Row actions ---------------- */

function VendorActions({
  vendor,
  busy,
  onApprove,
  onReject,
  onSuspend,
}: {
  vendor: Vendor;
  busy: boolean;
  onApprove: (v: Vendor) => void;
  onReject: (v: Vendor) => void;
  onSuspend: (v: Vendor) => void;
}) {
  const { t } = useTranslation();
  const btn = 'ui-button ui-button-sm min-h-[40px] whitespace-nowrap disabled:opacity-60';
  const busyLabel = t('vendor.v2_processing');
  switch (vendor.approvalStatus) {
    case 'PENDING_APPROVAL':
      return (
        <>
          <button type="button" onClick={() => onApprove(vendor)} disabled={busy} className={`${btn} ui-button-primary`}>
            {busy ? busyLabel : t('vendor.v2_approve')}
          </button>
          <button type="button" onClick={() => onReject(vendor)} disabled={busy} className={`${btn} ui-button-danger`}>
            {t('vendor.v2_reject')}
          </button>
        </>
      );
    case 'APPROVED':
      return (
        <button type="button" onClick={() => onSuspend(vendor)} disabled={busy} className={`${btn} ui-button-secondary`}>
          {t('vendor.v2_suspend')}
        </button>
      );
    case 'REJECTED':
    case 'SUSPENDED':
      return (
        <button type="button" onClick={() => onApprove(vendor)} disabled={busy} className={`${btn} ui-button-secondary`}>
          {busy ? busyLabel : t('vendor.v2_reactivate')}
        </button>
      );
    default:
      return null;
  }
}

/* ---------------- Page ---------------- */

export default function VendorManagement() {
  const { t, language, formatDate } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const statusOptions = [
    { value: '', label: t('vendor.status_all') },
    ...VENDOR_STATUSES.map(s => ({ value: s, label: t(`vendor.status_${s}`) })),
  ];
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Vendor | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await db.getVendors({ status: filterStatus || undefined, search: search || undefined, page, limit: 20 });
      setVendors(data.vendors || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e: any) {
      setError(e.message || t('vendor.v2_error_load'));
    } finally {
      setLoading(false);
    }
    // t is stable per language; excluded so switching language does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, search, page]);
  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };
  const handleApprove = async (vendor: Vendor) => {
    if (!(await uiConfirm(t('vendor.v2_approve_confirm', { name: vendor.name, email: vendor.admin?.email ?? '—' })))) return;
    setActionLoading(vendor.id);
    try {
      await db.approveVendor(vendor.id);
      showSuccess(t('vendor.v2_approved_msg', { name: vendor.name }));
      fetchVendors();
    } catch (e: any) {
      setError(e.message || t('vendor.v2_error_approve'));
    } finally {
      setActionLoading(null);
    }
  };
  const handleReject = async (vendor: Vendor, reason: string) => {
    setActionLoading(vendor.id);
    try {
      await db.rejectVendor(vendor.id, reason);
      showSuccess(t('vendor.v2_rejected_msg', { name: vendor.name }));
      fetchVendors();
    } finally {
      setActionLoading(null);
    }
  };
  const handleSuspend = async (vendor: Vendor, reason: string) => {
    setActionLoading(vendor.id);
    try {
      await db.suspendVendor(vendor.id, reason);
      showSuccess(t('vendor.v2_suspended_msg', { name: vendor.name }));
      fetchVendors();
    } finally {
      setActionLoading(null);
    }
  };

  const applyStatusFilter = (s: string) => { setFilterStatus(s); setPage(1); };

  /* ---- Derived data (only from the vendors loaded on this page) ---- */
  const statusCounts = useMemo(() => vendors.reduce<Record<string, number>>((acc, v) => {
    acc[v.approvalStatus] = (acc[v.approvalStatus] || 0) + 1;
    return acc;
  }, {}), [vendors]);

  const statusSegments: Segment[] = VENDOR_STATUSES.map(s => ({
    label: t(`vendor.status_${s}`),
    value: statusCounts[s] || 0,
    color: TONE_COLOR[STATUS_TONE[s]],
  }));

  // Plan ids (INDIVIDUAL/TEAM/ENTERPRISE) shown with the billing plan names.
  const planLabel = useCallback((id?: string | null) => {
    if (!id) return '—';
    const key = `billing.plan_${id.toLowerCase()}`;
    const label = t(key);
    return label && label !== key ? label : id;
  }, [t]);

  const planSegments: Segment[] = useMemo(() => {
    const noPlan = t('vendor.v2_no_plan');
    const map = new Map<string, number>();
    for (const v of vendors) {
      const key = v.subscription?.planId ? planLabel(v.subscription.planId) : noPlan;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [vendors, t, planLabel]);

  const registrationPoints: TrendPoint[] = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
        value: 0,
      });
    }
    for (const v of vendors) {
      const d = new Date(v.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (b) b.value += 1;
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }, [vendors, locale]);
  const registrationsInWindow = registrationPoints.reduce((s, p) => s + (p.value ?? 0), 0);

  const hasData = !loading && vendors.length > 0;
  const hasFilters = !!filterStatus || !!search;

  // A status tile shows '—' when the active filter hides that status (its count is not loaded).
  const tileValue = (s: VendorStatus) => {
    if (loading) return '—';
    if (filterStatus && filterStatus !== s) return '—';
    return (statusCounts[s] || 0).toLocaleString(locale);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const actionProps = {
    onApprove: handleApprove,
    onReject: (v: Vendor) => setRejectTarget(v),
    onSuspend: (v: Vendor) => setSuspendTarget(v),
  };

  return (
    <SettingsPage>
      <SeoHead
        title={t('vendor.v2_seo_title')}
        description={t('vendor.v2_seo_description')}
        canonicalPath="/vendors"
      />

      <SettingsHeader
        icon={<BuildingIcon />}
        title={t('vendor.v2_title')}
        description={t('vendor.v2_subtitle')}
        meta={!loading && <span className="ui-badge ui-badge-neutral">{t('vendor.v2_total_badge', { n: total.toLocaleString(locale) })}</span>}
        actions={
          <button type="button" onClick={fetchVendors} disabled={loading} className="ui-button ui-button-secondary ui-button-md min-h-[40px] gap-2 disabled:opacity-60">
            <span className={loading ? 'animate-spin' : undefined}><RefreshIcon /></span>
            {t('vendor.v2_refresh')}
          </button>
        }
      />

      {/* Status tiles double as the status filter */}
      <StatGrid cols={4}>
        {VENDOR_STATUSES.map(s => (
          <StatTile
            key={s}
            label={t(`vendor.status_${s}`)}
            value={tileValue(s)}
            tone={STATUS_TONE[s]}
            hint={filterStatus === s ? t('vendor.v2_tile_filtering') : t('vendor.v2_tile_hint')}
            active={filterStatus === s}
            onClick={() => applyStatusFilter(filterStatus === s ? '' : s)}
            visual={<span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[STATUS_TONE[s]] }} aria-hidden="true" />}
          />
        ))}
      </StatGrid>

      {/* Overview charts */}
      {hasData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SettingsCard title={t('vendor.v2_chart_status')} description={t('vendor.v2_chart_scope', { n: vendors.length, total })}>
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <DonutChart
                segments={statusSegments}
                ariaLabel={`${t('vendor.v2_chart_status')}: ${statusSegments.map(s => `${s.label} ${s.value}`).join(', ')}`}
                centerValue={vendors.length.toLocaleString(locale)}
                centerLabel={t('vendor.v2_vendors_unit')}
              />
              <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs" aria-hidden="true">
                {statusSegments.map(s => (
                  <li key={s.label} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--text-primary)]">
                      {s.value}
                      <span className="font-normal text-[var(--text-tertiary)]"> · {Math.round((s.value / vendors.length) * 100)}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </SettingsCard>

          <SettingsCard title={t('vendor.v2_chart_plans')} description={t('vendor.v2_chart_scope', { n: vendors.length, total })}>
            <DistributionBar
              segments={planSegments}
              ariaLabel={t('vendor.v2_chart_plans')}
              emptyText={t('vendor.v2_chart_empty')}
              formatValue={n => n.toLocaleString(locale)}
            />
          </SettingsCard>

          <SettingsCard
            title={t('vendor.v2_chart_registrations')}
            description={t('vendor.v2_chart_registrations_desc', { months: TREND_MONTHS, n: registrationsInWindow })}
          >
            <TrendBars
              points={registrationPoints}
              ariaLabel={`${t('vendor.v2_chart_registrations')}: ${registrationPoints.map(p => `${p.label} ${p.value}`).join(', ')}`}
              emptyText={t('vendor.v2_chart_empty')}
              formatValue={n => n.toLocaleString(locale)}
            />
          </SettingsCard>
        </div>
      )}

      {/* Messages */}
      {successMsg && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3 text-sm font-medium" style={{ color: TONE_COLOR.success }}>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="min-w-0 break-words">{successMsg}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3 text-sm font-medium" style={{ color: TONE_COLOR.danger }}>
          {error}
        </div>
      )}

      {/* Vendor list */}
      <SettingsCard
        title={t('vendor.v2_list_title')}
        description={!loading ? t('vendor.v2_list_desc', { n: vendors.length, total }) : undefined}
        bodyClassName="p-0"
      >
        <div className="flex flex-col gap-3 border-b border-[var(--glass-border)] p-4 sm:flex-row sm:p-5">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('vendor.v2_search_placeholder')}
              aria-label={t('vendor.v2_search_label')}
              className="ui-input min-h-[44px] w-full pl-10"
            />
          </div>
          <Dropdown
            value={filterStatus}
            onChange={(v: string) => applyStatusFilter(v)}
            options={statusOptions.map(o =>
              o.value === '' ? { ...o, label: `${o.label} (${total})` } : o
            )}
            placeholder={t('vendor.v2_filter_label')}
            className="sm:w-56"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--text-tertiary)]" role="status">
            <svg className="mr-3 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t('vendor.v2_loading')}
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={<BuildingIcon className="h-6 w-6" />}
            title={t('vendor.v2_empty_title')}
            description={hasFilters ? t('vendor.v2_empty_filtered') : undefined}
            action={hasFilters ? (
              <button type="button" onClick={() => { setSearch(''); applyStatusFilter(''); }} className="ui-button ui-button-secondary ui-button-sm min-h-[40px]">
                {t('vendor.v2_clear_filters')}
              </button>
            ) : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-app)]">
                  <tr className="text-left text-xs font-semibold text-[var(--text-secondary)]">
                    <th scope="col" className="px-5 py-3">{t('vendor.v2_col_company')}</th>
                    <th scope="col" className="px-5 py-3">{t('vendor.v2_col_admin')}</th>
                    <th scope="col" className="px-5 py-3">{t('vendor.v2_col_plan')}</th>
                    <th scope="col" className="px-5 py-3">{t('vendor.v2_col_status')}</th>
                    <th scope="col" className="px-5 py-3">{t('vendor.v2_col_created')}</th>
                    <th scope="col" className="px-5 py-3 text-right">{t('vendor.v2_col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {vendors.map(vendor => (
                    <tr key={vendor.id} className="align-top transition-colors hover:bg-[var(--glass-surface)]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--text-primary)]">{vendor.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{vendor.domain}</p>
                      </td>
                      <td className="px-5 py-4">
                        {vendor.admin ? (
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)]">{vendor.admin.name}</p>
                            <p className="break-all text-xs text-[var(--text-secondary)]">{vendor.admin.email}</p>
                            <EmailVerifiedHint verified={vendor.admin.emailVerified} />
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[var(--text-primary)]">{planLabel(vendor.subscription?.planId)}</p>
                        {vendor.subscription?.trialEndsAt && (
                          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                            {t('vendor.v2_trial_until', { date: formatDate(vendor.subscription.trialEndsAt) })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <VendorStatusBadge status={vendor.approvalStatus} />
                        {vendor.rejectionReason && (
                          <p className="mt-1 max-w-[180px] truncate text-xs text-[var(--text-tertiary)]" title={vendor.rejectionReason}>
                            {vendor.rejectionReason}
                          </p>
                        )}
                        {vendor.approvedBy && vendor.approvalStatus === 'APPROVED' && (
                          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t('vendor.v2_approved_by', { name: vendor.approvedBy })}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-[var(--text-secondary)]">{formatDate(vendor.createdAt)}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{formatTime(vendor.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <VendorActions vendor={vendor} busy={actionLoading === vendor.id} {...actionProps} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <ul className="divide-y divide-[var(--glass-border)] md:hidden">
              {vendors.map(vendor => (
                <li key={vendor.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-[var(--text-primary)]">{vendor.name}</p>
                      <p className="break-all text-xs text-[var(--text-tertiary)]">{vendor.domain}</p>
                    </div>
                    <VendorStatusBadge status={vendor.approvalStatus} />
                  </div>
                  {vendor.rejectionReason && (
                    <p className="break-words text-xs text-[var(--text-tertiary)]">{vendor.rejectionReason}</p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-[var(--glass-surface)] p-3 text-xs">
                    <div className="col-span-2 min-w-0">
                      <dt className="text-[var(--text-tertiary)]">{t('vendor.v2_col_admin')}</dt>
                      <dd className="text-[var(--text-primary)]">
                        {vendor.admin ? (
                          <>
                            <span className="font-medium">{vendor.admin.name}</span>
                            <span className="block break-all text-[var(--text-secondary)]">{vendor.admin.email}</span>
                            <EmailVerifiedHint verified={vendor.admin.emailVerified} />
                          </>
                        ) : '—'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--text-tertiary)]">{t('vendor.v2_col_plan')}</dt>
                      <dd className="font-medium text-[var(--text-primary)]">{planLabel(vendor.subscription?.planId)}</dd>
                      {vendor.subscription?.trialEndsAt && (
                        <dd className="text-[var(--text-tertiary)]">{t('vendor.v2_trial_until', { date: formatDate(vendor.subscription.trialEndsAt) })}</dd>
                      )}
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--text-tertiary)]">{t('vendor.v2_col_created')}</dt>
                      <dd className="text-[var(--text-primary)]">{formatDate(vendor.createdAt)} · {formatTime(vendor.createdAt)}</dd>
                    </div>
                    {vendor.approvedBy && vendor.approvalStatus === 'APPROVED' && (
                      <div className="col-span-2 text-[var(--text-tertiary)]">{t('vendor.v2_approved_by', { name: vendor.approvedBy })}</div>
                    )}
                  </dl>
                  <div className="flex flex-wrap gap-2 [&>button]:flex-1">
                    <VendorActions vendor={vendor} busy={actionLoading === vendor.id} {...actionProps} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-2 border-t border-[var(--glass-border)] px-4 py-3 sm:justify-center sm:px-5" aria-label={t('vendor.v2_pagination')}>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="ui-button ui-button-secondary ui-button-sm min-h-[40px] disabled:opacity-40"
            >
              {t('vendor.v2_prev')}
            </button>
            <span className="text-sm tabular-nums text-[var(--text-secondary)]" aria-live="polite">{t('vendor.v2_page_of', { page, pages: totalPages })}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ui-button ui-button-secondary ui-button-sm min-h-[40px] disabled:opacity-40"
            >
              {t('vendor.v2_next')}
            </button>
          </nav>
        )}
      </SettingsCard>

      {rejectTarget && (
        <RejectModal
          vendor={rejectTarget}
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {suspendTarget && (
        <SuspendModal
          vendor={suspendTarget}
          onConfirm={(reason) => handleSuspend(suspendTarget, reason)}
          onClose={() => setSuspendTarget(null)}
        />
      )}
    </SettingsPage>
  );
}
