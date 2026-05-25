/**
 * ExitIntentPopup.tsx
 *
 * Giữ chân khách truy cập trước khi họ rời trang marketplace.
 *
 * Signals phát hiện ý định thoát:
 *   1a. mousemove leading detector — top 60px zone, movementY < -3
 *   1b. mouseleave backup — clientY < 150px
 *   2.  Rapid upward scroll velocity
 *   3.  visibilitychange (chuyển tab — mobile + desktop)
 *   4.  Timer 45s sau lần đầu vào trang
 *   5.  Browser back button (popstate sentinel pattern)
 *   6.  pagehide (tab close / hard navigation)
 *   IMPERATIVE: trigger(url) — called directly from in-app back buttons
 *               via the forwarded ref; no pushState monkey-patching needed.
 *
 * Chống spam:
 *   - Không hiện nếu đã dismiss trong 7 ngày qua
 *   - Không hiện nếu đã submit trong 24 giờ qua
 *   - Không hiện nếu đã có lead session (LEAD_KEY trong localStorage)
 *   - Mỗi page load chỉ kích hoạt 1 lần
 */

import React, {
  useEffect, useLayoutEffect, useRef, useState, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
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

// ── Context types ─────────────────────────────────────────────────────────────

export type ExitIntentContext =
  | { type: 'listing'; title?: string | null; location?: string | null; price?: number | null }
  | { type: 'search';  query?: string; location?: string; propertyType?: string }
  | { type: 'generic' };

/** Imperative handle exposed via forwardRef — call trigger() from back buttons. */
export interface ExitIntentHandle {
  /**
   * Try to intercept an in-app navigation.
   * @param pendingUrl  The URL to navigate to after the user dismisses/submits.
   * @returns           true if the popup was shown (navigation blocked),
   *                    false if suppressed / already fired (caller should navigate normally).
   */
  trigger: (pendingUrl: string) => boolean;
}

interface Props {
  context?:  ExitIntentContext;
  delayMs?:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * When URL contains ?exit_intent_debug=1, clear all suppression keys so the
 * popup can fire again immediately. Useful during development / QA without
 * needing to open DevTools.
 */
function clearSuppressionIfDebug(): void {
  try {
    if (new URLSearchParams(window.location.search).get('exit_intent_debug') === '1') {
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.removeItem(SUBMITTED_KEY);
      localStorage.removeItem(LEAD_KEY);
      console.log('[ExitIntent] debug mode: suppression keys cleared');
    }
  } catch {}
}

function isSuppressed(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL_MS) return true;
    const submitted = localStorage.getItem(SUBMITTED_KEY);
    if (submitted && Date.now() - Number(submitted) < SUBMIT_TTL_MS)  return true;
    const lead = localStorage.getItem(LEAD_KEY);
    if (lead) return true;
  } catch {}
  return false;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000_000) {
    const val = Math.round((price / 1_000_000_000) * 10) / 10;
    return `${val.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  }
  if (price >= 1_000_000) return `${Math.round(price / 1_000_000).toLocaleString('vi-VN')} triệu`;
  return price.toLocaleString('vi-VN');
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IcoZap = () => (
  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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

// ── usePassiveExitSignals hook ────────────────────────────────────────────────
/**
 * Registers passive exit-intent signals (mouse, scroll, visibility, idle, popstate).
 * Calls `fire()` when any signal triggers.
 * Does NOT include Signal 7 (pushState intercept) — that is handled imperatively
 * via the ExitIntentHandle.trigger() ref method in the component.
 */
function usePassiveExitSignals(
  fire: () => void,
  firedRef: React.MutableRefObject<boolean>,
  delayMs: number,
) {
  // Push the sentinel BEFORE the first browser paint (useLayoutEffect runs
  // synchronously after React commits to the DOM, before the browser renders
  // any pixels). This eliminates the race condition where a user presses the
  // back button (or swipes back on iOS) before useEffect has had a chance to
  // run — without this, the sentinel would not exist yet and the URL would
  // change, causing App.tsx to navigate away before the popup could appear.
  useLayoutEffect(() => {
    try {
      window.history.pushState(
        { __exitIntentSentinel: true },
        '',
        window.location.pathname + window.location.search,
      );
    } catch {}
  }, []); // mount only — re-arming is handled in the popstate handler below

  useEffect(() => {
    // Signal 5: Browser back button — sentinel pattern.
    // The initial sentinel was pushed synchronously in useLayoutEffect above.
    // Here we only define the re-arm helper and the popstate handler.
    const sentinelPush = () => {
      try {
        window.history.pushState(
          { __exitIntentSentinel: true },
          '',
          window.location.pathname + window.location.search,
        );
      } catch {}
    };

    const onPopState = () => {
      if (isSuppressed()) {
        // User already dismissed/submitted — let the next back-click navigate
        // naturally by NOT re-arming the sentinel and NOT showing the popup.
        return;
      }
      if (!firedRef.current) sentinelPush(); // re-arm while popup hasn't shown yet
      fire();
    };
    window.addEventListener('popstate', onPopState);

    // Other passive signals only make sense when not suppressed
    if (isSuppressed()) {
      return () => window.removeEventListener('popstate', onPopState);
    }

    // Signal 1a: mousemove leading detector
    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY < 60 && e.movementY < -1) fire();
    };
    document.addEventListener('mousemove', onMouseMove);

    // Signal 1b: mouseleave backup
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

    // Signal 3: Tab visibility change
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Signal 4: Idle timer
    const idleTimer = setTimeout(fire, delayMs);

    // Signal 6: pagehide (tab close / hard navigation)
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
  }, [fire, firedRef, delayMs]);
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

export const ExitIntentPopup = forwardRef<ExitIntentHandle, Props>(
  ({ context = { type: 'generic' }, delayMs = IDLE_TRIGGER_MS }, ref) => {
    // Whether the popup has already been triggered this session
    const firedRef      = useRef(false);
    // Ref-mirror of visible state so trigger() can read it synchronously
    const visibleRef    = useRef(false);
    // URL to navigate to after the user dismisses/submits (set by trigger())
    const pendingNavRef = useRef<string | null>(null);

    const [visible,    setVisible]    = useState(false);
    const [name,       setName]       = useState('');
    const [phone,      setPhone]      = useState('');
    const [email,      setEmail]      = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success,    setSuccess]    = useState(false);
    const [error,      setError]      = useState('');
    const nameRef = useRef<HTMLInputElement>(null);

    // On mount: clear suppression keys if ?exit_intent_debug=1 is in the URL
    useEffect(() => { clearSuppressionIfDebug(); }, []);

    // Keep visibleRef in sync with the visible state
    useEffect(() => { visibleRef.current = visible; }, [visible]);

    // Core fire() — marks as fired and shows the popup
    const fire = useCallback(() => {
      if (firedRef.current || isSuppressed()) return;
      firedRef.current = true;
      visibleRef.current = true;
      setVisible(true);
    }, []);

    // Passive signals (mouse, scroll, idle, popstate, pagehide)
    usePassiveExitSignals(fire, firedRef, delayMs);

    // Imperative handle — called by back-button click handlers in page components.
    // Three cases:
    //   1. Suppressed (dismissed/submitted recently): return false → caller navigates.
    //   2. Popup already visible (passive signal fired just before click): store
    //      pending URL so dismiss/submit will still navigate; return true to block
    //      the concurrent click-triggered navigation.
    //   3. Fresh (not fired yet): fire popup, store pending URL, return true.
    useImperativeHandle(ref, () => ({
      trigger: (pendingUrl: string): boolean => {
        if (isSuppressed()) return false;
        if (firedRef.current) {
          // Popup is already visible (passive signal fired before click landed).
          // Override pendingNav so dismiss will navigate to the right place.
          if (visibleRef.current) {
            pendingNavRef.current = pendingUrl;
            return true; // block the click-triggered navigation
          }
          // Popup was already shown AND dismissed — let navigation proceed.
          return false;
        }
        pendingNavRef.current = pendingUrl;
        fire();
        return true;
      },
    }), [fire]);

    useEffect(() => {
      if (visible) setTimeout(() => nameRef.current?.focus(), 350);
    }, [visible]);

    // Execute any pending navigation stored by trigger() or Signal 5
    const releaseNavigation = useCallback(() => {
      const url = pendingNavRef.current;
      pendingNavRef.current = null;
      if (url) {
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }, []);

    const handleDismiss = useCallback(() => {
      setVisible(false);
      try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
      releaseNavigation();
    }, [releaseNavigation]);

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
        setTimeout(() => { setVisible(false); releaseNavigation(); }, 3000);
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
          <motion.div
            className="bg-white border border-slate-200 shadow-lg rounded-2xl w-[360px] fixed bottom-4 right-4 z-[200] overflow-hidden"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* ── Clean top bar ── */}
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-2.5 pr-4">
                <svg className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <div>
                  <p className="font-semibold text-slate-800 text-[15px] leading-snug">{headline}</p>
                  <p className="text-slate-500 text-sm mt-0.5 leading-snug">{subtext}</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
                aria-label="Đóng"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Body ── */}
            <div className="px-5 pt-3 pb-4">
              <div className="flex flex-col gap-1.5 mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Tư vấn trong 30 phút, định giá miễn phí</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Thông tin bảo mật, không spam</span>
                </div>
              </div>

              {!success ? (
                <form onSubmit={handleSubmit} className="space-y-2">
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Họ tên (không bắt buộc)"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                    style={{ fontSize: '16px' }}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                    placeholder="Số điện thoại *"
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                    style={{ fontSize: '16px' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email (để nhận xác nhận)"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400"
                    style={{ fontSize: '16px' }}
                  />

                  {error && (
                    <p className="text-xs text-red-500 font-medium">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !phone.trim()}
                    className="w-full py-2.5 rounded-lg font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <><IcoSpinner />Đang gửi...</> : <><IcoSend />Nhận tư vấn ngay</>}
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
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
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  },
);

ExitIntentPopup.displayName = 'ExitIntentPopup';