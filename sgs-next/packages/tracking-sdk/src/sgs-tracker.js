/**
 * SGS LAND visitor tracking + consent beacon.
 *
 * IMPORTANT (Nghi dinh 13/2023/ND-CP + Luat 91/2025/QH15): this script must
 * NEVER send BEHAVIORAL or ADVERTISING events before the visitor has given
 * an explicit opt-in through the two-layer consent banner. ESSENTIAL is the
 * only category assumed granted (site operation), and it is not tracked by
 * this file at all — only behavioral analytics/recommendation events live
 * here, gated behind consent.
 *
 * Usage (no build step — plain ES module):
 *   <script type="module">
 *     import { SgsTracker } from '/vendor/sgs-tracker.js';
 *     const tracker = new SgsTracker({ apiBaseUrl: 'https://api.sgsland.vn', tenantId: '...' });
 *     await tracker.init();
 *     tracker.trackPageView();
 *   </script>
 */

const STORAGE_KEY = 'sgs_visitor_key';
const CONSENT_CACHE_KEY = 'sgs_consent_cache';

function generateVisitorKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readVisitorKey() {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = generateVisitorKey();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // localStorage unavailable (privacy mode, etc.) — fall back to an
    // in-memory key; behavior degrades to "no persistence across reloads"
    // rather than throwing.
    return generateVisitorKey();
  }
}

export class SgsTracker {
  /**
   * @param {{ apiBaseUrl: string, tenantId: string }} config
   */
  constructor(config) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.tenantId = config.tenantId;
    this.visitorKey = readVisitorKey();
    this.consent = { ESSENTIAL: true, BEHAVIORAL: false, ADVERTISING: false };
    this._pageEnteredAt = Date.now();
    this._maxScrollDepthPct = 0;
  }

  _headers() {
    return { 'Content-Type': 'application/json', 'x-tenant-id': this.tenantId };
  }

  async _post(path, body) {
    try {
      const res = await fetch(`${this.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        keepalive: true,
      });
      return await res.json();
    } catch (err) {
      // Never let a tracking failure break the host page.
      console.warn('[sgs-tracker] request failed', path, err);
      return null;
    }
  }

  /** Loads current consent state from the API and caches it locally. */
  async init() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/tracking/consent/${this.visitorKey}`, {
        headers: this._headers(),
      });
      if (res.ok) {
        this.consent = await res.json();
        window.sessionStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(this.consent));
      }
    } catch (err) {
      console.warn('[sgs-tracker] failed to load consent state', err);
    }
    this._trackScrollDepth();
    return this.consent;
  }

  /** Call from the consent banner's Accept/Reject buttons. */
  async setConsent(category, granted) {
    this.consent[category] = granted;
    return this._post('/tracking/consent', {
      visitorKey: this.visitorKey,
      category,
      granted,
    });
  }

  get hasBehavioralConsent() {
    return this.consent.BEHAVIORAL === true;
  }

  /** Generic event — silently a no-op if BEHAVIORAL consent isn't granted. */
  async trackEvent(type, payload = {}) {
    if (!this.hasBehavioralConsent) return { tracked: false, reason: 'behavioral_consent_not_granted' };
    return this._post('/tracking/events', { visitorKey: this.visitorKey, type, ...payload });
  }

  trackPageView(source) {
    return this.trackEvent('PAGE_VIEW', { source });
  }

  trackPropertyView(propertyId, source) {
    return this.trackEvent('PROPERTY_VIEW', { propertyId, source });
  }

  trackFilterApplied(metadata) {
    return this.trackEvent('FILTER_APPLIED', { metadata });
  }

  trackAiValuationUsed(metadata) {
    return this.trackEvent('AI_VALUATION_USED', { metadata });
  }

  /** Fired once per page unload with accumulated dwell time + scroll depth. */
  trackPageExit(propertyId) {
    const durationSeconds = Math.round((Date.now() - this._pageEnteredAt) / 1000);
    const body = JSON.stringify({
      visitorKey: this.visitorKey,
      type: propertyId ? 'PROPERTY_VIEW' : 'PAGE_VIEW',
      propertyId,
      durationSeconds,
      scrollDepthPct: this._maxScrollDepthPct,
    });
    if (!this.hasBehavioralConsent) return;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${this.apiBaseUrl}/tracking/events`, new Blob([body], { type: 'application/json' }));
    } else {
      this._post('/tracking/events', JSON.parse(body));
    }
  }

  /** Identity resolution — call when the visitor submits a contact form / hotline / Zalo / AI valuation. */
  identify({ customerName, customerPhone, customerEmail, propertyId, source }) {
    return this._post('/tracking/identify', {
      visitorKey: this.visitorKey,
      customerName,
      customerPhone,
      customerEmail,
      propertyId,
      source,
    });
  }

  /** Data-subject erasure/access request (72h SLA). */
  requestErasure({ email, phone, notes }) {
    return this._post('/tracking/erasure-requests', {
      visitorKey: this.visitorKey,
      email,
      phone,
      notes,
    });
  }

  _trackScrollDepth() {
    window.addEventListener(
      'scroll',
      () => {
        const doc = document.documentElement;
        const scrolled = doc.scrollTop + doc.clientHeight;
        const pct = Math.min(100, Math.round((scrolled / doc.scrollHeight) * 100));
        if (pct > this._maxScrollDepthPct) this._maxScrollDepthPct = pct;
      },
      { passive: true },
    );
  }
}
