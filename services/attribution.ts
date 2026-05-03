/**
 * Marketing attribution — first-click model với visitor ID persist.
 *
 * - visitorId: UUID-like, lưu localStorage 90 ngày, sống xuyên session.
 * - sessionId: random per-tab session, sống đến khi đóng tab (sessionStorage).
 * - First-click: UTM/referrer/gclid/fbclid được capture lần đầu visit và
 *   GIỮ NGUYÊN khi user click sang trang khác cùng domain. Khi user đến
 *   từ campaign mới (URL có UTM), ghi đè bộ first-click cũ.
 * - LandingPage: URL đầu tiên user vào (cũng giữ nguyên).
 * - trackPageView: POST /api/public/visitor/track (best-effort, debounced).
 *
 * KHÔNG dùng cho user đã đăng nhập — đã có usePageTracker riêng cho CRM.
 */

const LS_KEY = 'sgs_attribution_v1';
const SS_KEY = 'sgs_session_v1';
const VISITOR_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 ngày

export interface Attribution {
  visitorId: string;
  sessionId: string;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  };
  landingPage: string | null;
  firstReferrer: string | null;
  gclid: string | null;
  fbclid: string | null;
  capturedAt: number;
}

const EMPTY_UTM = {
  source: null, medium: null, campaign: null, term: null, content: null,
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Test write (Safari ITP / private mode có thể throw)
    const k = '__sgs_t__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch { return null; }
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch { return null; }
}

function genId(): string {
  // Crypto.randomUUID() có ở mọi browser modern. Fallback random nếu thiếu.
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID().replace(/-/g, '');
    }
  } catch { /* noop */ }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function readUrlAttribution(): {
  utm: Attribution['utm'];
  gclid: string | null;
  fbclid: string | null;
  hasNew: boolean;
} {
  if (typeof window === 'undefined') {
    return { utm: { ...EMPTY_UTM }, gclid: null, fbclid: null, hasNew: false };
  }
  const sp = new URLSearchParams(window.location.search);
  const utm = {
    source:   sp.get('utm_source'),
    medium:   sp.get('utm_medium'),
    campaign: sp.get('utm_campaign'),
    term:     sp.get('utm_term'),
    content:  sp.get('utm_content'),
  };
  const gclid = sp.get('gclid');
  const fbclid = sp.get('fbclid');
  const hasNew = !!(utm.source || utm.medium || utm.campaign || gclid || fbclid);
  return { utm, gclid, fbclid, hasNew };
}

function isInternalReferrer(ref: string | null): boolean {
  if (!ref || typeof window === 'undefined') return false;
  try {
    const u = new URL(ref);
    return u.host === window.location.host;
  } catch { return false; }
}

/**
 * Lấy/tạo Attribution từ localStorage. Tự động:
 *  - Refresh visitorId nếu hết hạn 90d.
 *  - Capture lần đầu (no record): UTM hiện tại + referrer + landing page.
 *  - Khi URL hiện tại có UTM/click ID MỚI → ghi đè (last touch wins cho campaign).
 *    Vẫn giữ visitorId & landingPage gốc.
 */
export function getOrCreateAttribution(): Attribution {
  const ls = safeLocalStorage();
  const ss = safeSessionStorage();
  const now = Date.now();
  const url = readUrlAttribution();

  let stored: Attribution | null = null;
  if (ls) {
    try {
      const raw = ls.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.visitorId
            && now - (parsed.capturedAt || 0) < VISITOR_TTL_MS) {
          stored = parsed as Attribution;
        }
      }
    } catch { /* corrupted — ignore */ }
  }

  // sessionId per-tab.
  let sessionId = ss?.getItem(SS_KEY) || '';
  if (!sessionId) {
    sessionId = genId().slice(0, 24);
    try { ss?.setItem(SS_KEY, sessionId); } catch { /* noop */ }
  }

  if (!stored) {
    const ref = (typeof document !== 'undefined' ? document.referrer : '') || null;
    stored = {
      visitorId: genId().slice(0, 32),
      sessionId,
      utm: { ...EMPTY_UTM, ...url.utm },
      landingPage: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : null,
      firstReferrer: isInternalReferrer(ref) ? null : (ref ? ref.slice(0, 500) : null),
      gclid: url.gclid,
      fbclid: url.fbclid,
      capturedAt: now,
    };
  } else {
    stored.sessionId = sessionId;
    // FIRST-CLICK MODEL: chỉ capture UTM/click ID khi stored attribution
    // hoàn toàn TRỐNG (chưa từng có campaign nào). Một khi đã có nguồn đầu
    // tiên thì giữ nguyên — campaign mới không ghi đè để không mất công đổ
    // cho first touchpoint. Nếu cần last-touch, tạo cột riêng sau.
    const hasStoredCampaign = !!(
      stored.utm.source || stored.utm.medium || stored.utm.campaign ||
      stored.gclid || stored.fbclid
    );
    if (url.hasNew && !hasStoredCampaign) {
      stored.utm = { ...EMPTY_UTM, ...url.utm };
      stored.gclid = url.gclid || stored.gclid;
      stored.fbclid = url.fbclid || stored.fbclid;
      stored.capturedAt = now;
      const ref = (typeof document !== 'undefined' ? document.referrer : '') || null;
      if (ref && !isInternalReferrer(ref)) {
        stored.firstReferrer = ref.slice(0, 500);
      }
    }
  }

  if (ls) {
    try { ls.setItem(LS_KEY, JSON.stringify(stored)); } catch { /* noop */ }
  }
  return stored;
}

let lastTrackedPath = '';
let trackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Gửi pageview event (debounce 800ms, dedupe theo path).
 * Best-effort — không throw, không retry.
 */
export function trackPageView(opts?: { projectCode?: string; pageLabel?: string }): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  if (trackTimer) clearTimeout(trackTimer);
  trackTimer = setTimeout(() => {
    try {
      const attr = getOrCreateAttribution();
      const body = JSON.stringify({
        visitorId: attr.visitorId,
        sessionId: attr.sessionId,
        eventType: 'pageview',
        page: window.location.href.slice(0, 500),
        pageLabel: opts?.pageLabel || document.title?.slice(0, 200) || null,
        referrer: (document.referrer || '').slice(0, 500),
        utm: attr.utm,
        gclid: attr.gclid,
        fbclid: attr.fbclid,
        projectCode: opts?.projectCode || null,
      });
      // sendBeacon để không block navigation; fallback fetch keepalive.
      const url = '/api/public/visitor/track';
      const blob = new Blob([body], { type: 'application/json' });
      const sent = !!(navigator.sendBeacon && navigator.sendBeacon(url, blob));
      if (!sent) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          credentials: 'omit',
        }).catch(() => { /* swallow */ });
      }
    } catch { /* noop */ }
  }, 800);
}

/** Reset dedupe — gọi khi route thay đổi để track view mới. */
export function resetPageViewDedup(): void {
  lastTrackedPath = '';
}

/** Build payload gắn vào lead form submit. */
export function buildLeadAttribution() {
  const a = getOrCreateAttribution();
  return {
    visitorId: a.visitorId,
    utm: a.utm,
    landingPage: a.landingPage || undefined,
    firstReferrer: a.firstReferrer || undefined,
    gclid: a.gclid || undefined,
    fbclid: a.fbclid || undefined,
  };
}
