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
const MOUSE_Y_THRESHOLD      = 20;                  // px from top — used by mousemove leading detector
const MOUSE_MOVE_Y_UP        = -3;                  // movementY < this = moving upward

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

    // Signal 1a: mousemove leading detector — fires BEFORE the cursor exits the
    // viewport. Zone is the top 60px (generous enough to catch fast swipes).
    // movementY < -1 filters micro-jitter without missing real upward intent.
    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY < 60 && e.movementY < -1) fire();
    };
    document.addEventListener('mousemove', onMouseMove);

    // Signal 1b: mouseleave — fires once the cursor has actually left the document.
    // Use 150px threshold (top ~15-20% of typical viewport) to catch fast swipes:
    // a rapid flick to the back button can leave the viewport with the last reported
    // clientY as high as 80-120px before the mouseleave event fires.
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 150) fire();
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

    // Signal 5: Browser back button via popstate — "intercept & restore" pattern.
    //
    // On mount we push a sentinel entry (same URL).  When user clicks Back:
    //   1. Browser pops sentinel, URL stays the same → custom router does nothing.
    //   2. popstate fires synchronously.
    //   3. If popup hasn't fired yet: IMMEDIATELY re-push sentinel before React
    //      renders (keeps user on the page) then call fire().
    //   4. If popup already fired (user dismissed): do NOT re-push — let the next
    //      back press navigate normally so the user isn't trapped.
    //
    // "Immediately" is the key: the re-push is synchronous inside the event
    // handler, which means it runs before the app's custom router (also a
    // popstate listener) reads window.location, so the URL is always /marketplace
    // for the duration of the popup.
    try { window.history.pushState({ __exitIntentSentinel: true }, '', window.location.pathname + window.location.search); } catch {}
    const onPopState = () => {
      if (!firedRef.current && !isSuppressed()) {
        // Intercept: restore sentinel so user stays on this page while popup shows
        try { window.history.pushState({ __exitIntentSentinel: true }, '', window.location.pathname + window.location.search); } catch {}
      }
      // fire() is a no-op when firedRef.current === true or isSuppressed()
      fire();
    };
    window.addEventListener('popstate', onPopState);

    // Signal 6: pagehide — actual page unload / tab close / back on non-SPA
    const onPageHide = () => fire();
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
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
  const [email,      setEmail]      = useState('');
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
          email:  email.trim() || undefined,
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
        /*
          Floating card — bottom-right corner, fixed 320 px wide.
          Never full-width, never a sheet. Fits in any viewport ≥ 300 px tall.
          Slides up from below on entry; no backdrop so page stays readable.
        */
        <motion.div
          className="fixed z-[200] bottom-4 right-4 w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 40px 0 rgba(99,102,241,0.25), 0 2px 12px 0 rgba(0,0,0,0.12)' }}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        >
          {/* ── Gradient header ── */}
          <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-4 pt-4 pb-5">
            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35 transition-colors"
              aria-label="Đóng"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Title row */}
            <div className="flex items-center gap-2.5 mb-1 pr-8">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h2 className="text-sm font-extrabold text-white leading-snug">{headline}</h2>
            </div>
            <p className="text-xs text-indigo-100 leading-snug line-clamp-2 pl-[1.875rem]">{subtext}</p>
          </div>

          {/* ── White body ── */}
          <div className="bg-white px-4 pt-3 pb-4">

            {/* 2 compact benefit rows */}
            <div className="flex flex-col gap-1.5 mb-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <IcoZap /><span>Tư vấn trong 30 phút, định giá miễn phí</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <IcoShield /><span>Thông tin bảo mật, không spam</span>
              </div>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-2">
                {/* Name — optional */}
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Họ tên (không bắt buộc)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                  style={{ fontSize: '16px' }}
                />

                {/* Phone */}
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="Số điện thoại *"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                  style={{ fontSize: '16px' }}
                />

                {/* Email — optional, enables confirmation email */}
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (để nhận xác nhận)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                  style={{ fontSize: '16px' }}
                />

                {error && (
                  <p className="text-xs text-red-500 font-medium">{error}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !phone.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <><IcoSpinner />Đang gửi...</> : <><IcoSend />Nhận tư vấn ngay</>}
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Không cảm ơn
                </button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">Đã nhận được thông tin!</p>
                <p className="text-xs text-slate-500">Chuyên gia SGS LAND sẽ liên hệ sớm nhất.</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
