
import React, { useState, useEffect } from 'react';
import { db, PLANS } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { PlanTier, Subscription, Invoice, UsageMetrics, Plan } from '../types';

const ICONS = {
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    DOWNLOAD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>,
    CREDIT_CARD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    STAR: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
};

export const Billing: React.FC = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageMetrics | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const { t, formatDate, formatCurrency } = useTranslation();

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
                // Ensure invoices array is never undefined
                setInvoices(inv || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const notify = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleUpgrade = async (planId: PlanTier) => {
        if (!confirm(t('billing.confirm_upgrade', { plan: planId }))) return;
        setProcessingPlan(planId);
        try {
            await db.upgradeSubscription(planId);
            const sub = await db.getSubscription();
            setSubscription(sub);
            notify(t('billing.upgrade_success'), 'success');
        } catch (e: any) {
            notify(e.message, 'error');
        } finally {
            setProcessingPlan(null);
        }
    };

    const handleDownloadInvoice = (invoice: Invoice) => {
        notify(t('billing.downloading'), 'success');
        const planLabel = PLANS[(invoice as any).planId as PlanTier]?.name || (invoice as any).planId || 'N/A';
        const rows = [
            ['Hóa đơn SGS Land'],
            [''],
            ['Mã hóa đơn', invoice.id],
            ['Ngày phát hành', invoice.created ? new Date(invoice.created).toLocaleDateString('vi-VN') : (invoice as any).createdAt ? new Date((invoice as any).createdAt).toLocaleDateString('vi-VN') : ''],
            ['Gói cước', planLabel],
            ['Trạng thái', invoice.status === 'PAID' || invoice.status === 'paid' ? 'Đã thanh toán' : invoice.status],
            ['Số tiền', `$${(invoice as any).amount ?? invoice.amount ?? 0}`],
        ];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sgs-invoice-${invoice.id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;

    const currentPlan = PLANS[subscription?.planId as PlanTier] || PLANS.INDIVIDUAL;

    return (
        <div className="space-y-6 pb-20 animate-enter relative">
            {toast && <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('billing.title')}</h2>
                    <p className="text-sm text-slate-500">{t('billing.subtitle')}</p>
                </div>
                {subscription?.paymentMethod && (
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <div className="p-1.5 bg-white rounded-full shadow-sm text-slate-600">{ICONS.CREDIT_CARD}</div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{subscription.paymentMethod.brand}</div>
                            <div className="text-sm font-mono font-bold text-slate-700">•••• {subscription.paymentMethod.last4}</div>
                        </div>
                        <button className="text-xs font-bold text-indigo-600 hover:underline ml-2">{t('billing.update_card')}</button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Usage */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        {t('billing.current_usage')}
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                            {t(`billing.plan_${currentPlan.name.toLowerCase()}`)}
                        </span>
                    </h3>
                    
                    <div className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-slate-500">{t('billing.seats')}</span>
                                <span className="font-bold text-slate-800">{usage?.seatsUsed} / {currentPlan.limits.seats}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (usage!.seatsUsed / currentPlan.limits.seats) * 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-slate-500">{t('billing.emails')}</span>
                                <span className="font-bold text-slate-800">{usage?.emailsSent} / {currentPlan.limits.emailsPerMonth}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (usage!.emailsSent / currentPlan.limits.emailsPerMonth) * 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-slate-500">{t('billing.ai_requests')}</span>
                                <span className="font-bold text-slate-800">{usage?.aiRequests} / {currentPlan.limits.aiRequestsPerMonth}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (usage!.aiRequests / currentPlan.limits.aiRequestsPerMonth) * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                        {t('billing.exp')}: <span className="font-mono text-slate-600">{formatDate(subscription?.currentPeriodEnd || '')}</span>
                    </div>
                </div>

                {/* Plans */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.values(PLANS) as Plan[]).map((plan) => {
                        const isCurrent = plan.id === subscription?.planId;
                        return (
                            <div key={plan.id} className={`p-6 rounded-[24px] border flex flex-col transition-all ${isCurrent ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:shadow-lg hover:-translate-y-1'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className={`font-bold ${isCurrent ? 'text-indigo-700' : 'text-slate-800'}`}>
                                        {t(`billing.plan_${plan.name.toLowerCase()}`)}
                                    </h4>
                                    {isCurrent && <div className="text-indigo-600 bg-white p-1 rounded-full shadow-sm">{ICONS.CHECK}</div>}
                                </div>
                                <div className="text-2xl font-extrabold text-slate-900 mb-1">
                                    ${plan.price}
                                    <span className="text-sm font-medium text-slate-400">{t('billing.per_month')}</span>
                                </div>
                                <div className="text-xs text-slate-400 mb-6">{t('billing.billed_annually')}</div>
                                
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                            <span className="text-indigo-500 mt-0.5">{ICONS.CHECK}</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    disabled={isCurrent || processingPlan === plan.id}
                                    onClick={() => !isCurrent && handleUpgrade(plan.id)}
                                    className={`w-full py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${isCurrent ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-900 text-white hover:bg-indigo-600 cursor-pointer'}`}
                                >
                                    {processingPlan === plan.id ? '...' : isCurrent ? t('billing.current_plan') : t('billing.upgrade_btn')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Invoice History */}
            {invoices.length > 0 && (
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">{t('billing.date')} — Lịch sử hóa đơn</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="pb-3 pr-4">Mã HĐ</th>
                                    <th className="pb-3 pr-4">Gói cước</th>
                                    <th className="pb-3 pr-4">Ngày</th>
                                    <th className="pb-3 pr-4">Số tiền</th>
                                    <th className="pb-3 pr-4">Trạng thái</th>
                                    <th className="pb-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => {
                                    const anyInv = inv as any;
                                    const planLabel = PLANS[anyInv.planId as PlanTier]?.name || anyInv.planId || '—';
                                    const dateStr = inv.created
                                        ? new Date(inv.created).toLocaleDateString('vi-VN')
                                        : anyInv.createdAt
                                        ? new Date(anyInv.createdAt).toLocaleDateString('vi-VN')
                                        : '—';
                                    const isPaid = inv.status === 'paid' || (anyInv.status as string) === 'PAID';
                                    return (
                                        <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">{inv.id.slice(0, 8)}…</td>
                                            <td className="py-3 pr-4 font-medium text-slate-700">{planLabel}</td>
                                            <td className="py-3 pr-4 text-slate-500">{dateStr}</td>
                                            <td className="py-3 pr-4 font-bold text-slate-800">${anyInv.amount ?? 0}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                    {isPaid ? 'Đã thanh toán' : inv.status}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                <button
                                                    onClick={() => handleDownloadInvoice(inv)}
                                                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                >
                                                    {ICONS.DOWNLOAD} CSV
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;