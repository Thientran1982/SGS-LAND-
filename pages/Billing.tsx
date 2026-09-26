import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, PLANS } from '../services/dbApi';
import { billingApi } from '../services/api/billingApi';
import { useTranslation } from '../services/i18n';
import { PlanTier, Subscription, Invoice, UsageMetrics, Plan } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ROUTES } from '../config/routes';
import { SeoHead } from '../components/SeoHead';
import {
    SettingsPage,
    SettingsHeader,
    SettingsCard,
    StatTile,
    StatGrid,
    UsageMeter,
    TrendBars,
    StatusBadge,
    EmptyState,
    TrendPoint,
} from '../components/settings/SettingsUI';

const ICONS = {
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    DOWNLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>,
    CREDIT_CARD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    ALERT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
    RECEIPT: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14h6m-6-4h6m-9 11V5a2 2 0 012-2h8a2 2 0 012 2v16l-3-2-2 2-2-2-2 2-2-2-3 2z" /></svg>,
};

/** Plan order used to suggest the next tier when usage is over the limit. */
const TIER_ORDER: PlanTier[] = [PlanTier.INDIVIDUAL, PlanTier.TEAM, PlanTier.ENTERPRISE];

/** Plans and checkout are priced in USD on the server (see billing routes). */
const PLAN_CURRENCY = 'USD';

/* ---- Invoice normalisation: the API returns planId/createdAt/UPPERCASE status next to the typed fields. ---- */
const invoiceDateIso = (inv: Invoice): string | null => {
    const anyInv = inv as any;
    return inv.created || anyInv.createdAt || null;
};
const invoiceIsPaid = (inv: Invoice): boolean => inv.status === 'paid' || ((inv as any).status as string) === 'PAID';
const invoiceAmount = (inv: Invoice): number | null => {
    const n = Number((inv as any).amount);
    return (inv as any).amount == null || !Number.isFinite(n) ? null : n;
};
const invoiceCurrency = (inv: Invoice): string => String(inv.currency || PLAN_CURRENCY).toUpperCase();
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const Billing: React.FC = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageMetrics | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    const [upgradeConfirmPlan, setUpgradeConfirmPlan] = useState<PlanTier | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDate, formatCurrency, language } = useTranslation();
    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [sub, use, inv] = await Promise.all([
                    db.getSubscription(),
                    db.getUsageMetrics(),
                    db.getInvoices()
                ]);
                setSubscription(sub);
                setUsage(use);
                setInvoices(inv || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);
    const handleUpgrade = async () => {
        if (!upgradeConfirmPlan) return;
        const plan = upgradeConfirmPlan;
        setProcessingPlan(plan);
        setUpgradeConfirmPlan(null);
        try {
            // Free tier downgrade keeps the legacy direct path (admin-only).
            if (plan === PlanTier.INDIVIDUAL) {
                await db.upgradeSubscription(plan);
                const sub = await db.getSubscription();
                setSubscription(sub);
                notify(t('billing.upgrade_success'), 'success');
                return;
            }
            // Paid tiers go through the checkout flow so the payment gateway can
            // collect funds before the plan is activated.
            const session = await billingApi.createCheckout(plan as 'TEAM' | 'ENTERPRISE');
            const target = `/${ROUTES.CHECKOUT}?session=${session.sessionId}`;
            window.history.pushState(null, '', target);
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setProcessingPlan(null);
        }
    };
    const handleDownloadInvoice = (invoice: Invoice) => {
        notify(t('billing.downloading'), 'success');
        const anyInv = invoice as any;
        const planLabel = PLANS[anyInv.planId as PlanTier]?.name || anyInv.planId || t('common.no_value');
        const isPaid = invoiceIsPaid(invoice);
        const iso = invoiceDateIso(invoice);
        const dateStr = iso ? new Date(iso).toLocaleDateString() : '';
        const amount = invoiceAmount(invoice);
        const rows = [
            [t('billing.csv_title')],
            [''],
            [t('billing.csv_id'), invoice.id],
            [t('billing.csv_date'), dateStr],
            [t('billing.csv_plan'), planLabel],
            [t('billing.csv_status'), isPaid ? t('billing.status_paid') : t('billing.status_unpaid')],
            [t('billing.csv_amount'), amount == null ? t('common.no_value') : formatCurrency(amount, invoiceCurrency(invoice))],
        ];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sgs-invoice-${invoice.id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const planLabel = (plan: Plan | undefined, fallback?: string) =>
        plan ? t(`billing.plan_${plan.name.toLowerCase()}`) : (fallback || t('common.no_value'));

    const currentPlan = PLANS[subscription?.planId as PlanTier] || PLANS.INDIVIDUAL;

    // Usage rows: a metric the API did not return stays '—' instead of a fake zero.
    const usageRows = useMemo(() => {
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        return [
            { key: 'seats', label: t('billing.seats'), used: num(usage?.seatsUsed), limit: currentPlan.limits.seats },
            { key: 'emails', label: t('billing.emails'), used: num(usage?.emailsSent), limit: currentPlan.limits.emailsPerMonth },
            { key: 'ai', label: t('billing.ai_requests'), used: num(usage?.aiRequests), limit: currentPlan.limits.aiRequestsPerMonth },
        ];
    }, [usage, currentPlan, t]);
    const isOverLimit = usageRows.some(r => r.used != null && r.used > r.limit);

    // Suggest the smallest higher tier whose limits cover current usage (else the top tier).
    const suggestedPlan: Plan | null = useMemo(() => {
        const higher = TIER_ORDER.slice(TIER_ORDER.indexOf(currentPlan.id) + 1).map(id => PLANS[id]);
        if (!higher.length) return null;
        const fits = (p: Plan) =>
            (usage?.seatsUsed ?? 0) <= p.limits.seats &&
            (usage?.emailsSent ?? 0) <= p.limits.emailsPerMonth &&
            (usage?.aiRequests ?? 0) <= p.limits.aiRequestsPerMonth;
        return higher.find(fits) || higher[higher.length - 1];
    }, [currentPlan, usage]);

    // Invoice aggregates, restricted to the dominant currency so totals never mix units.
    const invoiceStats = useMemo(() => {
        const counts = new Map<string, number>();
        invoices.forEach(inv => counts.set(invoiceCurrency(inv), (counts.get(invoiceCurrency(inv)) || 0) + 1));
        const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || PLAN_CURRENCY;
        let paidCount = 0, unpaidCount = 0, paidAmount = 0, unpaidAmount = 0;
        const byMonth = new Map<string, number>();
        const dates: Date[] = [];
        for (const inv of invoices) {
            const paid = invoiceIsPaid(inv);
            if (paid) paidCount++; else unpaidCount++;
            const amount = invoiceAmount(inv);
            if (amount == null || invoiceCurrency(inv) !== currency) continue;
            if (paid) paidAmount += amount; else unpaidAmount += amount;
            const iso = invoiceDateIso(inv);
            const d = iso ? new Date(iso) : null;
            if (!d || Number.isNaN(d.getTime())) continue;
            dates.push(d);
            if (paid) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + amount);
        }
        // Continuous month range between the first and last loaded invoice (max 12 months).
        const points: TrendPoint[] = [];
        if (dates.length) {
            const times = dates.map(d => d.getTime());
            const first = new Date(Math.min(...times));
            const last = new Date(Math.max(...times));
            const locale = language === 'vn' ? 'vi-VN' : 'en-US';
            const end = new Date(last.getFullYear(), last.getMonth(), 1);
            let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
            const minStart = new Date(end.getFullYear(), end.getMonth() - 11, 1);
            if (cursor < minStart) cursor = minStart;
            while (cursor <= end) {
                points.push({
                    label: cursor.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
                    value: byMonth.get(monthKey(cursor)) ?? 0,
                });
                cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            }
        }
        return { currency, paidCount, unpaidCount, paidAmount, unpaidAmount, points, hasPayments: byMonth.size > 0 };
    }, [invoices, language]);

    const renewDate = subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : t('common.no_value');
    const seo = <SeoHead title={t('billing.v2_seo_title')} description={t('billing.v2_seo_description')} canonicalPath="/billing" />;

    if (loading) {
        return (
            <>
                {seo}
                <SettingsPage>
                    <div className="p-10 text-center text-sm text-[var(--text-secondary)] animate-pulse" role="status">{t('common.loading')}</div>
                </SettingsPage>
            </>
        );
    }

    const paymentChip = subscription?.paymentMethod && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2" aria-label={t('billing.v2_payment_method')}>
            <span className="text-[var(--text-secondary)]">{ICONS.CREDIT_CARD}</span>
            <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-secondary)]">{subscription.paymentMethod.brand}</div>
                <div className="font-mono text-sm font-bold text-[var(--text-primary)]">•••• {subscription.paymentMethod.last4}</div>
            </div>
            <button type="button" className="ui-button ui-button-ghost ui-button-sm min-h-[40px]">{t('billing.update_card')}</button>
        </div>
    );

    return (
        <>
            {seo}
            <SettingsPage>
                <SettingsHeader
                    icon={ICONS.CREDIT_CARD}
                    title={t('billing.title')}
                    description={t('billing.subtitle')}
                    meta={<StatusBadge tone="brand">{planLabel(currentPlan)}</StatusBadge>}
                    actions={paymentChip || undefined}
                />

                {/* Current usage */}
                <SettingsCard
                    title={t('billing.current_usage')}
                    description={t('billing.v2_usage_desc')}
                    actions={
                        <span className="text-xs text-[var(--text-secondary)]">
                            {t('billing.renews')}: <span className="font-semibold tabular-nums text-[var(--text-primary)]">{renewDate}</span>
                        </span>
                    }
                >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {usageRows.map(row => row.used == null ? (
                            <div key={row.key}>
                                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                                    <span className="font-medium text-[var(--text-secondary)]">{row.label}</span>
                                    <span className="font-semibold text-[var(--text-tertiary)]">{t('common.no_value')} / {row.limit.toLocaleString()}</span>
                                </div>
                                <div className="h-2 rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true" />
                            </div>
                        ) : (
                            <UsageMeter
                                key={row.key}
                                label={row.label}
                                used={row.used}
                                limit={row.limit}
                                overLabel={n => t('billing.v2_over', { n })}
                            />
                        ))}
                    </div>

                    {isOverLimit && (
                        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--ui-danger)] bg-[var(--glass-surface)] p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 text-[var(--ui-danger)]">{ICONS.ALERT}</span>
                                <div>
                                    <div className="text-sm font-semibold text-[var(--ui-danger)]">{t('billing.v2_over_title', { plan: planLabel(currentPlan) })}</div>
                                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                        {suggestedPlan ? t('billing.v2_over_desc') : t('billing.v2_over_desc_top')}
                                    </p>
                                </div>
                            </div>
                            {suggestedPlan && (
                                <button
                                    type="button"
                                    className="ui-button ui-button-primary ui-button-md min-h-[40px] shrink-0"
                                    disabled={processingPlan === suggestedPlan.id}
                                    onClick={() => setUpgradeConfirmPlan(suggestedPlan.id)}
                                >
                                    {t('billing.v2_upgrade_to', { plan: planLabel(suggestedPlan) })}
                                </button>
                            )}
                        </div>
                    )}
                </SettingsCard>

                {/* Plans */}
                <SettingsCard title={t('billing.v2_plans_title')} description={t('billing.v2_plans_desc')}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {(Object.values(PLANS) as Plan[]).map((plan) => {
                            const isCurrent = plan.id === subscription?.planId;
                            return (
                                <div
                                    key={plan.id}
                                    className={`flex flex-col rounded-xl border p-5 ${isCurrent ? 'border-[var(--sgs-primary)] bg-[var(--glass-surface)] ring-1 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)] bg-[var(--bg-surface)]'}`}
                                    aria-current={isCurrent ? 'true' : undefined}
                                >
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                        <h4 className={`font-bold ${isCurrent ? 'text-sgs-primary' : 'text-[var(--text-primary)]'}`}>{planLabel(plan)}</h4>
                                        {isCurrent && <StatusBadge tone="brand">{t('billing.current_plan')}</StatusBadge>}
                                    </div>
                                    <div className="text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
                                        {formatCurrency(plan.price, PLAN_CURRENCY)}
                                        <span className="ml-1 text-sm font-medium text-[var(--text-secondary)]">{t('billing.per_month')}</span>
                                    </div>
                                    <div className="mb-4 mt-1 text-xs text-[var(--text-tertiary)]">{t('billing.billed_annually')}</div>
                                    <ul className="mb-5 flex-1 space-y-2.5">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                                <span className="mt-0.5 shrink-0 text-sgs-primary">{ICONS.CHECK}</span>
                                                {t(f)}
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        disabled={isCurrent || processingPlan === plan.id}
                                        onClick={() => !isCurrent && setUpgradeConfirmPlan(plan.id)}
                                        className={`ui-button ui-button-md min-h-[40px] w-full disabled:cursor-not-allowed disabled:opacity-60 ${isCurrent ? 'ui-button-secondary' : 'ui-button-primary'}`}
                                    >
                                        {processingPlan === plan.id ? '…' : isCurrent ? t('billing.current_plan') : t('billing.upgrade_btn')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </SettingsCard>

                {/* Invoices */}
                <SettingsCard title={t('billing.invoice_history')} description={invoices.length > 0 ? t('billing.v2_invoice_desc') : undefined}>
                    {invoices.length === 0 ? (
                        <EmptyState icon={ICONS.RECEIPT} title={t('billing.empty_invoices')} />
                    ) : (
                        <div className="space-y-5">
                            <StatGrid cols={4}>
                                <StatTile label={t('billing.v2_invoices_total')} value={invoices.length.toLocaleString()} />
                                <StatTile
                                    label={t('billing.status_paid')}
                                    value={invoiceStats.paidCount.toLocaleString()}
                                    tone="success"
                                    hint={formatCurrency(invoiceStats.paidAmount, invoiceStats.currency)}
                                />
                                <StatTile
                                    label={t('billing.status_unpaid')}
                                    value={invoiceStats.unpaidCount.toLocaleString()}
                                    tone={invoiceStats.unpaidCount > 0 ? 'warning' : 'neutral'}
                                    hint={formatCurrency(invoiceStats.unpaidAmount, invoiceStats.currency)}
                                />
                                <StatTile
                                    label={t('billing.v2_paid_amount')}
                                    value={formatCurrency(invoiceStats.paidAmount, invoiceStats.currency)}
                                    tone="brand"
                                />
                            </StatGrid>

                            <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                <div className="mb-3 text-xs font-medium text-[var(--text-secondary)]">{t('billing.v2_trend_title')}</div>
                                <TrendBars
                                    points={invoiceStats.hasPayments ? invoiceStats.points : []}
                                    ariaLabel={t('billing.v2_trend_aria', { n: invoiceStats.points.length })}
                                    formatValue={n => formatCurrency(n, invoiceStats.currency)}
                                    emptyText={t('billing.v2_trend_empty')}
                                />
                            </div>

                            {/* Mobile: stacked rows */}
                            <ul className="divide-y divide-[var(--glass-border)] sm:hidden">
                                {invoices.map(inv => (
                                    <InvoiceMobileRow key={inv.id} inv={inv} onDownload={handleDownloadInvoice} />
                                ))}
                            </ul>

                            {/* Tablet/desktop: table */}
                            <div className="hidden overflow-x-auto sm:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--glass-border)] text-left text-xs font-medium text-[var(--text-secondary)]">
                                            <th scope="col" className="pb-3 pr-4">{t('billing.inv_id')}</th>
                                            <th scope="col" className="pb-3 pr-4">{t('billing.inv_plan')}</th>
                                            <th scope="col" className="pb-3 pr-4">{t('billing.inv_date')}</th>
                                            <th scope="col" className="pb-3 pr-4 text-right">{t('billing.inv_amount')}</th>
                                            <th scope="col" className="pb-3 pr-4">{t('billing.inv_status')}</th>
                                            <th scope="col" className="pb-3"><span className="sr-only">{t('billing.download_csv')}</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map(inv => (
                                            <InvoiceTableRow key={inv.id} inv={inv} onDownload={handleDownloadInvoice} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </SettingsCard>

                <ConfirmModal
                    isOpen={!!upgradeConfirmPlan}
                    title={t('billing.confirm_upgrade_title')}
                    message={t('billing.confirm_upgrade', { plan: upgradeConfirmPlan ? t(`billing.plan_${(PLANS[upgradeConfirmPlan]?.name || upgradeConfirmPlan).toLowerCase()}`) : '' })}
                    confirmLabel={t('common.confirm')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={handleUpgrade}
                    onCancel={() => setUpgradeConfirmPlan(null)}
                    variant="info"
                />
            </SettingsPage>
            {createPortal(
                toast ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}
                    >
                        <span className="text-sm">{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span className="font-bold text-sm">{toast.msg}</span>
                    </div>
                ) : null,
                document.body
            )}
        </>
    );
};

/* ---------------- Invoice rows ---------------- */

/** Shared display values for one invoice (plan label, date, amount, status). */
const useInvoiceView = (inv: Invoice) => {
    const { t, formatDate, formatCurrency } = useTranslation();
    const anyInv = inv as any;
    const plan = PLANS[anyInv.planId as PlanTier];
    const iso = invoiceDateIso(inv);
    const amount = invoiceAmount(inv);
    const isPaid = invoiceIsPaid(inv);
    return {
        t,
        planLabel: plan ? t(`billing.plan_${plan.name.toLowerCase()}`) : (anyInv.planId || t('common.no_value')),
        dateStr: iso ? formatDate(iso) || t('common.no_value') : t('common.no_value'),
        amountStr: amount == null ? t('common.no_value') : formatCurrency(amount, invoiceCurrency(inv)),
        status: <StatusBadge tone={isPaid ? 'success' : 'warning'}>{isPaid ? t('billing.status_paid') : t('billing.status_unpaid')}</StatusBadge>,
        shortId: `${inv.id.slice(0, 8)}…`,
    };
};

const DownloadButton: React.FC<{ inv: Invoice; label: string; ariaLabel: string; onDownload: (inv: Invoice) => void }> = ({ inv, label, ariaLabel, onDownload }) => (
    <button
        type="button"
        onClick={() => onDownload(inv)}
        aria-label={ariaLabel}
        className="ui-button ui-button-ghost ui-button-sm inline-flex min-h-[40px] items-center gap-1.5"
    >
        {ICONS.DOWNLOAD} {label}
    </button>
);

const InvoiceTableRow: React.FC<{ inv: Invoice; onDownload: (inv: Invoice) => void }> = ({ inv, onDownload }) => {
    const v = useInvoiceView(inv);
    return (
        <tr className="border-b border-[var(--glass-border)] transition-colors last:border-0 hover:bg-[var(--glass-surface)]">
            <td className="py-2 pr-4 font-mono text-xs text-[var(--text-tertiary)]" title={inv.id}>{v.shortId}</td>
            <td className="py-2 pr-4 font-medium text-[var(--text-secondary)]">{v.planLabel}</td>
            <td className="py-2 pr-4 tabular-nums text-[var(--text-tertiary)]">{v.dateStr}</td>
            <td className="py-2 pr-4 text-right font-bold tabular-nums text-[var(--text-primary)]">{v.amountStr}</td>
            <td className="py-2 pr-4">{v.status}</td>
            <td className="py-2 text-right">
                <DownloadButton inv={inv} onDownload={onDownload} label={v.t('billing.download_csv')} ariaLabel={v.t('billing.v2_download_aria', { id: v.shortId })} />
            </td>
        </tr>
    );
};

const InvoiceMobileRow: React.FC<{ inv: Invoice; onDownload: (inv: Invoice) => void }> = ({ inv, onDownload }) => {
    const v = useInvoiceView(inv);
    return (
        <li className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{v.planLabel}</span>
                    {v.status}
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    <span className="tabular-nums">{v.dateStr}</span> · <span className="font-mono">{v.shortId}</span>
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums text-[var(--text-primary)]">{v.amountStr}</div>
            </div>
            <DownloadButton inv={inv} onDownload={onDownload} label={v.t('billing.download_csv')} ariaLabel={v.t('billing.v2_download_aria', { id: v.shortId })} />
        </li>
    );
};

export default Billing;
