/**
 * ExitIntentPopup.tsx
 *
 * Giữ chân khách truy cập trước khi họ rời trang marketplace.
 *
 * Signals phát hiện ý định thoát:
 *   1. mouseleave trên document khi clientY < 10px (chuột lên thanh tab/nút đóng)
 *   2. Cuộn nhanh lên (scroll velocity > ngưỡng) — dấu hiệu "đã xong"
 *   3. visibilitychange (chuyển tab — mobile + desktop)
 *   4. Timer 45s sau lần đầu vào trang (cho người dùng đã đọc lâu mà chưa hành động)
 *
 * Chống spam:
 *   - Không hiện nếu đã dismiss trong 7 ngày qua
 *   - Không hiện nếu đã submit trong 24 giờ qua
 *   - Không hiện nếu đã có lead session (LEAD_KEY trong localStorage)
 *   - Mỗi page load chỉ kích hoạt 1 lần
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

// ── Constants ────────────────────────────────────────────────────────────────

const DISMISSED_KEY  = 'sgs_exit_intent_dismissed_at';
const SUBMITTED_KEY  = 'sgs_exit_intent_submitted_at';
const LEAD_KEY       = 'sgs_livechat_lead';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
const SUBMIT_TTL_MS  = 24 * 60 * 60 * 1000;        // 24 hours
const IDLE_TRIGGER_MS        = 45_000;              // 45 s on page
const SCROLL_VEL_THRESHOLD   = 12;                  // px/frame upward
const MOUSE_Y_THRESHOLD      = 10;                  // px from top of viewport

// ── Context types ─────────────────────────────────────────────────────────────

export type ExitIntentContext =
  | { type: 'listing'; title?: string | null; location?: string | null; price?: number | null }
  | { type: 'search';  query?: string; location?: string; propertyType?: string }
  | { type: 'generic' };

interface Props {
  context?:  ExitIntentContext;
  delayMs?:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSuppressed(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL_MS) return true;
    const submitted = localStorage.getItem(SUBMITTED_KEY);
    if (submitted && Date.now() - Number(submitted) < SUBMIT_TTL_MS)  return true;
    if (localStorage.getItem(LEAD_KEY)) return true;
  } catch {}
  return false;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)} tỷ`;
  if (price >= 1_000_000)     return `${(price / 1_000_000).toFixed(0)} triệu`;
  return price.toLocaleString('vi-VN');
}

// ── Inline SVG icons (no external dep needed) ─────────────────────────────────

const IcoZap = () => (
  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const IcoTrendingUp = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M23 6l-9.5 9.5-5-5L1 18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 6h6v6" />
  </svg>
);

const IcoShield = () => (
  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
  </svg>
);

const IcoSend = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);

const IcoSpinner = () => (
  <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── useExitIntent hook ────────────────────────────────────────────────────────

function useExitIntent(delayMs = IDLE_TRIGGER_MS): boolean {
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);

  const fire = useCallback(() => {
    if (firedRef.current || isSuppressed()) return;
    firedRef.current = true;
    setTriggered(true);
  }, []);

  useEffect(() => {
    if (isSuppressed()) return;

    // Signal 1: Mouseleave to browser chrome
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY < MOUSE_Y_THRESHOLD) fire();
    };
    document.addEventListener('mouseleave', onMouseLeave);

    // Signal 2: Rapid upward scroll velocity
    let lastScrollY    = window.scrollY;
    let lastScrollTime = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dt  = now - lastScrollTime;
      if (dt < 16) return;
      const dy  = window.scrollY - lastScrollY;
      const vel = dy / dt;
      lastScrollY    = window.scrollY;
      lastScrollTime = now;
      if (vel < -SCROLL_VEL_THRESHOLD / 16 && window.scrollY < 300) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Signal 3: Tab visibility change (mobile-friendly)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Signal 4: Idle timer
    const idleTimer = setTimeout(fire, delayMs);

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(idleTimer);
    };
  }, [fire, delayMs]);

  return triggered;
}

// ── BenefitRow ────────────────────────────────────────────────────────────────

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-600">
      {icon}
      <span className="leading-snug">{text}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const ExitIntentPopup: React.FC<Props> = ({ context = { type: 'generic' }, delayMs }) => {
  const triggered = useExitIntent(delayMs);
  const [visible,    setVisible]    = useState(false);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (triggered && !isSuppressed()) setVisible(true);
  }, [triggered]);

  useEffect(() => {
    if (visible) setTimeout(() => nameRef.current?.focus(), 350);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.trim().length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let notes = 'Từ Exit Intent Popup';
      if (context.type === 'listing' && context.title) {
        notes = `Quan tâm: ${context.title}${context.location ? ` — ${context.location}` : ''}${context.price ? ` — ${formatPrice(context.price)}` : ''}`;
      } else if (context.type === 'search') {
        const parts = [context.query, context.location, context.propertyType].filter(Boolean);
        if (parts.length) notes = `Tìm kiếm: ${parts.join(', ')}`;
      }

      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:   name.trim() || 'Khách hàng',
          phone:  phone.trim(),
          source: 'EXIT_INTENT',
          notes,
        }),
      });
      if (!res.ok) throw new Error('Server error');

      const data = await res.json();
      if (data?.id) {
        fetch('/api/followup/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId:    data.id,
            leadName:  name.trim() || 'Khách hàng',
            leadPhone: phone.trim(),
            source:    'EXIT_INTENT',
          }),
        }).catch(() => {});
      }

      try { localStorage.setItem(SUBMITTED_KEY, String(Date.now())); } catch {}
      setSuccess(true);
      setTimeout(() => setVisible(false), 3000);
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const { headline, subtext } = (() => {
    if (context.type === 'listing' && context.title) {
      return {
        headline: 'Khoan đã! Căn này đang được nhiều người hỏi',
        subtext:  context.title + (context.price ? ` · ${formatPrice(context.price)}` : ''),
      };
    }
    if (context.type === 'search' && (context.query || context.location)) {
      const desc = [context.query, context.location].filter(Boolean).join(' tại ');
      return {
        headline: 'Chưa tìm được gì ưng ý?',
        subtext:  `Để lại số điện thoại — chuyên gia sẽ tìm BĐS ${desc} phù hợp nhất cho bạn`,
      };
    }
    return {
      headline: 'Chờ một chút!',
      subtext:  'Để lại thông tin — đội tư vấn SGS LAND sẽ gửi cho bạn những BĐS hot nhất hôm nay',
    };
  })();

  if (!visible) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDismiss}
          />

          {/* Panel */}
          <motion.div
            className="fixed z-[201] left-0 right-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md md:px-4"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/*
              White card — max-height + overflow-y-auto so content is always reachable.
              NO overflow-hidden on the outer card (would clip bottom corners on mobile).
              Gradient header scopes its own overflow-hidden for top-corner clipping.
              Safe-area padding prevents home-bar overlap on notched iPhones.
            */}
            <div
              className="bg-white rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-y-auto"
              style={{
                maxHeight: 'min(90dvh, 640px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Gradient header — overflow-hidden scoped here for corner clipping */}
              <div className="overflow-hidden rounded-t-[28px] md:rounded-t-[28px]">
                <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 pt-6 pb-10">
                  {/* Dismiss */}
                  <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                    aria-label="Đóng"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Header icon */}
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>

                  <h2 className="text-xl font-extrabold text-white leading-tight mb-1.5">{headline}</h2>
                  <p className="text-sm text-indigo-100 leading-snug line-clamp-2">{subtext}</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pt-5 pb-6 -mt-6 relative">
                {/* Benefits */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 space-y-3">
                  <BenefitRow icon={<IcoZap />}        text="Nhận danh sách BĐS phù hợp trong vòng 30 phút" />
                  <BenefitRow icon={<IcoTrendingUp />}  text="Tư vấn giá thị trường & định giá miễn phí" />
                  <BenefitRow icon={<IcoShield />}      text="Thông tin bảo mật tuyệt đối, không spam" />
                </div>

                {!success ? (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                      ref={nameRef}
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Họ tên của bạn (không bắt buộc)"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                      style={{ fontSize: '16px' }}
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                      placeholder="Số điện thoại *"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                      style={{ fontSize: '16px' }}
                    />

                    {error && (
                      <p className="text-xs text-red-500 font-medium px-1">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !phone.trim()}
                      className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <IcoSpinner />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <IcoSend />
                          Nhận tư vấn miễn phí ngay
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Không cảm ơn, tôi tự tìm được
                    </button>
                  </form>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1.5">Đã nhận được thông tin!</h3>
                    <p className="text-sm text-slate-500">
                      Chuyên gia SGS LAND sẽ liên hệ với bạn trong thời gian sớm nhất. Cảm ơn bạn!
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
