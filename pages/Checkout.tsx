import React, { useEffect, useState } from 'react';
import { ROUTES } from '../config/routes';
import { billingApi, CheckoutSessionDTO } from '../services/api/billingApi';

const ICONS = {
    LOCK: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
    ),
    CHECK: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
    ),
    BACK: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
    ),
};

const PLAN_FEATURES: Record<string, string[]> = {
    TEAM: [
        'Định giá AI 500 lượt/tháng (gấp 10×)',
        'Hỗ trợ 5 người dùng + chia sẻ dữ liệu',
        '2.000 email tự động/tháng',
        'Báo cáo PDF có thương hiệu',
        'Ưu tiên xử lý — phản hồi nhanh hơn',
    ],
    ENTERPRISE: [
        'Định giá AI không giới hạn',
        'Người dùng & email không giới hạn',
        'Dữ liệu comps nội bộ độc quyền',
        'SSO, audit log, SLA 99.9%',
        'Hỗ trợ 24/7 qua điện thoại + Zalo',
    ],
};

function navigateTo(path: string) {
    const target = path.startsWith('/') ? path : `/${path}`;
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

function getQuery(name: string): string | null {
    try {
        return new URLSearchParams(window.location.search).get(name);
    } catch { return null; }
}

export const Checkout: React.FC = () => {
    const [session, setSession] = useState<CheckoutSessionDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Mock card form (UI only — payment is simulated server-side)
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
    const [cardExpiry, setCardExpiry] = useState('12/29');
    const [cardCvc, setCardCvc] = useState('123');

    useEffect(() => {
        const sessionId = getQuery('session');
        const stripeSessionId = getQuery('stripe_session_id');
        const planParam = getQuery('plan') as 'TEAM' | 'ENTERPRISE' | null;

        const load = async () => {
            try {
                // Returning from Stripe Checkout — reconcile then load
                if (stripeSessionId) {
                    try { await billingApi.syncStripe(stripeSessionId); } catch { /* ignore */ }
                }

                if (sessionId) {
                    const s = await billingApi.getCheckout(sessionId);
                    setSession(s);
                } else if (planParam === 'TEAM' || planParam === 'ENTERPRISE') {
                    const s = await billingApi.createCheckout(planParam);
                    // For real Stripe sessions, redirect to the hosted checkout page
                    if (s.provider === 'stripe' && s.providerCheckoutUrl) {
                        window.location.href = s.providerCheckoutUrl;
                        return;
                    }
                    window.history.replaceState(null, '', `/${ROUTES.CHECKOUT}?session=${s.sessionId}`);
                    setSession(s);
                } else {
                    setError('Thiếu thông tin gói. Vui lòng quay lại trang định giá.');
                }
            } catch (e: any) {
                setError(e?.message || 'Không tải được phiên thanh toán.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleConfirm = async () => {
        if (!session) return;
        if (!cardName.trim()) {
            setError('Vui lòng nhập tên chủ thẻ.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const result = await billingApi.confirmCheckout(session.sessionId);
            setSession({ ...session, status: result.status, paidAt: result.paidAt });
            setDone(true);
            setTimeout(() => navigateTo(ROUTES.BILLING), 1800);
        } catch (e: any) {
            setError(e?.message || 'Thanh toán thất bại. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (session) {
            try { await billingApi.cancelCheckout(session.sessionId); } catch { /* ignore */ }
        }
        navigateTo(ROUTES.BILLING);
    };

    if (loading) {
        return (
            <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">
                Đang tải phiên thanh toán…
            </div>
        );
    }

    if (!session) {
        return (
            <div className="p-6 max-w-xl mx-auto">
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm text-center">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Không tìm thấy phiên thanh toán</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-5">{error || 'Vui lòng tạo lại từ trang định giá hoặc trang Billing.'}</p>
                    <button
                        onClick={() => navigateTo(ROUTES.BILLING)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-indigo-600 transition-colors"
                    >
                        {ICONS.BACK} Quay lại Billing
                    </button>
                </div>
            </div>
        );
    }

    const features = PLAN_FEATURES[session.planId] || [];
    const isPaid = session.status === 'PAID' || done;
    const isExpired = session.status === 'EXPIRED';
    const isCancelled = session.status === 'CANCELLED';

    return (
        <div className="p-4 sm:p-6 pb-20 animate-enter">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigateTo(ROUTES.BILLING)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-indigo-600 mb-4"
                >
                    {ICONS.BACK} Quay lại Billing
                </button>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Order summary */}
                    <div className="md:col-span-2 bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                        <div className="text-xs2 uppercase tracking-wider font-bold text-[var(--text-tertiary)] mb-2">Đơn nâng cấp</div>
                        <div className="text-2xl font-extrabold text-[var(--text-primary)] mb-1">Gói {session.planName}</div>
                        <div className="text-3xl font-extrabold text-indigo-600 mb-1">
                            ${session.amount}
                            <span className="text-sm font-medium text-[var(--text-secondary)]"> / tháng</span>
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mb-5">Hủy bất cứ lúc nào · Không phí ẩn</div>

                        <ul className="space-y-2.5">
                            {features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                                    <span className="text-emerald-500 mt-0.5">{ICONS.CHECK}</span>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <div className="mt-5 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between text-sm">
                            <span className="text-[var(--text-tertiary)]">Tổng thanh toán hôm nay</span>
                            <span className="font-extrabold text-[var(--text-primary)]">${session.amount}.00</span>
                        </div>
                    </div>

                    {/* Payment panel */}
                    <div className="md:col-span-3 bg-[var(--bg-surface)] p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                        {isPaid ? (
                            <div className="py-10 text-center">
                                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
                                    {ICONS.CHECK}
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Thanh toán thành công</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-5">
                                    Gói {session.planName} đã kích hoạt. Quota AI mới có hiệu lực ngay.
                                </p>
                                <button
                                    onClick={() => navigateTo(ROUTES.BILLING)}
                                    className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-indigo-600"
                                >
                                    Xem chi tiết Billing
                                </button>
                            </div>
                        ) : isExpired || isCancelled ? (
                            <div className="py-10 text-center">
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                                    {isExpired ? 'Phiên đã hết hạn' : 'Phiên đã hủy'}
                                </h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-5">
                                    Vui lòng tạo lại phiên thanh toán mới.
                                </p>
                                <button
                                    onClick={() => navigateTo(`${ROUTES.CHECKOUT}?plan=${session.planId}`)}
                                    className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-indigo-600"
                                >
                                    Tạo phiên mới
                                </button>
                            </div>
                        ) : session.provider === 'stripe' ? (
                            <div className="py-10 text-center">
                                <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4">
                                    {ICONS.LOCK}
                                </div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Thanh toán an toàn qua Stripe</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-5">
                                    Bạn sẽ được chuyển sang trang thanh toán bảo mật của Stripe để hoàn tất giao dịch.
                                </p>
                                {session.providerCheckoutUrl ? (
                                    <a
                                        href={session.providerCheckoutUrl}
                                        className="inline-flex px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-extrabold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                                    >
                                        Tiếp tục đến Stripe →
                                    </a>
                                ) : (
                                    <p className="text-xs text-rose-600">Không tìm thấy link thanh toán Stripe. Vui lòng tạo lại phiên.</p>
                                )}
                                <button
                                    onClick={handleCancel}
                                    className="block mx-auto mt-3 text-xs font-bold text-[var(--text-secondary)] hover:text-rose-600"
                                >
                                    Hủy phiên này
                                </button>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Thông tin thanh toán</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mb-5 flex items-center gap-1.5">
                                    {ICONS.LOCK} Mã hoá end-to-end · Phiên thanh toán an toàn
                                </p>

                                {session.provider === 'mock' && (
                                    <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                        Cổng thanh toán đang ở chế độ thử nghiệm. Mọi thẻ hợp lệ về định dạng đều được chấp nhận
                                        và quota sẽ được nâng cấp ngay sau khi xác nhận.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Tên chủ thẻ</label>
                                        <input
                                            value={cardName}
                                            onChange={(e) => setCardName(e.target.value)}
                                            placeholder="NGUYEN VAN A"
                                            className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Số thẻ</label>
                                        <input
                                            value={cardNumber}
                                            onChange={(e) => setCardNumber(e.target.value)}
                                            placeholder="4242 4242 4242 4242"
                                            className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Hết hạn</label>
                                            <input
                                                value={cardExpiry}
                                                onChange={(e) => setCardExpiry(e.target.value)}
                                                placeholder="MM/YY"
                                                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">CVC</label>
                                            <input
                                                value={cardCvc}
                                                onChange={(e) => setCardCvc(e.target.value)}
                                                placeholder="123"
                                                className="w-full px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mt-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                                        {error}
                                    </div>
                                )}

                                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={handleConfirm}
                                        disabled={submitting}
                                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-extrabold hover:bg-emerald-600 active:scale-[0.99] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Đang xử lý…' : `Xác nhận thanh toán $${session.amount}`}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={submitting}
                                        className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                                    >
                                        Hủy
                                    </button>
                                </div>

                                <p className="mt-3 text-xs text-[var(--text-tertiary)] text-center">
                                    Bằng việc xác nhận, bạn đồng ý với điều khoản dịch vụ và chính sách hoàn tiền 30 ngày.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
