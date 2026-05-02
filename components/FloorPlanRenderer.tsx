/**
 * FloorPlanRenderer — interactive Sa bàn viewer.
 *
 * Responsibilities:
 *  - Fetch sanitized SVG content from the server and inject inline (so we can
 *    style + bind events on individual <path data-code="…"> elements).
 *  - Color each mapped element by its listing's status (AVAILABLE / SOLD / …).
 *  - Click on a mapped element → open the standard ListingDetail flow via the
 *    `onSelectListing(listingId)` callback (parent decides what to render).
 *  - Pinch-zoom (two-finger touch) and pan (drag) on mobile + desktop, plus
 *    wheel-zoom on desktop. Implemented purely with CSS transform + pointer
 *    events — no extra library needed.
 *  - Poll `/floor-plans/:id/statuses` every 30s while mounted to refresh fills
 *    without re-fetching the SVG markup.
 *
 * Security note: SVG markup is sanitized server-side AND served with a strict
 * CSP header (script-src 'none'). We still set the inner HTML inside an
 * isolated container; we never execute remote SVG code.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { floorPlanApi, FloorPlanDetail, FloorPlanListingDetail } from '../services/api/floorPlanApi';

export interface FloorPlanRendererProps {
  projectId: string;
  planId: string;
  /** Called when the user clicks a path bound to a mapped listing. */
  onSelectListing?: (listingId: string, code: string) => void;
  /** Optional override of the polling interval (ms). Default 30000. */
  pollIntervalMs?: number;
  /** Compact / fullscreen height. Default '70vh'. */
  height?: string;
  /** Translation function (project page passes its own t()). */
  t?: (k: string) => string;
}

// status → fill colors per Task #26 spec.
//   AVAILABLE = green, BOOKING = yellow, SOLD = red, OPENING = purple,
//   INACTIVE = gray. HOLD/RENTED keep amber/violet (consistent with the
//   listing status pills in Projects.tsx).
const STATUS_FILL: Record<string, string> = {
  AVAILABLE: '#10b981', // emerald-500 (green)
  BOOKING:   '#eab308', // yellow-500
  HOLD:      '#f59e0b', // amber-500
  SOLD:      '#ef4444', // red-500
  RENTED:    '#a855f7', // violet-500
  OPENING:   '#9333ea', // purple-600
  INACTIVE:  '#94a3b8', // slate-400 (gray)
};
const STATUS_STROKE: Record<string, string> = {
  AVAILABLE: '#047857',
  BOOKING:   '#a16207',
  HOLD:      '#b45309',
  SOLD:      '#b91c1c',
  RENTED:    '#7e22ce',
  OPENING:   '#6b21a8',
  INACTIVE:  '#475569',
};
const UNMAPPED_FILL = '#e2e8f0';
const UNMAPPED_STROKE = '#94a3b8';

function fmtArea(a: number | null | undefined): string {
  if (a == null || !isFinite(a) || a <= 0) return '—';
  return `${a.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m²`;
}
function fmtPriceShort(p: number | null | undefined): string {
  if (p == null || !isFinite(p) || p <= 0) return '—';
  if (p >= 1_000_000_000) return `${(p / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (p >= 1_000_000) return `${(p / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return p.toLocaleString('vi-VN');
}

const tDefault = (k: string) => k;

export const FloorPlanRenderer: React.FC<FloorPlanRendererProps> = ({
  projectId,
  planId,
  onSelectListing,
  pollIntervalMs = 30_000,
  height = '70vh',
  t = tDefault,
}) => {
  const [detail, setDetail] = useState<FloorPlanDetail | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{
    code: string;
    listingId: string | null;
    status: string | null;
    area: number | null;
    price: number | null;
    title: string | null;
  } | null>(null);

  // Pan/zoom transform state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ── Initial load (detail JSON + SVG markup in parallel) ─────────────────
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setSvgMarkup('');
    Promise.all([
      floorPlanApi.get(projectId, planId),
      fetch(floorPlanApi.svgUrl(projectId, planId), { credentials: 'include' }).then(async (r) => {
        if (!r.ok) throw new Error(`SVG ${r.status}`);
        return r.text();
      }),
    ])
      .then(([d, svg]) => {
        if (aborted) return;
        setDetail(d);
        setSvgMarkup(svg);
      })
      .catch((e) => {
        if (aborted) return;
        setError(e?.message || t('floorplan.load_error'));
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [projectId, planId, t]);

  // ── 30s poll (statuses only) ────────────────────────────────────────────
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const r = await floorPlanApi.pollStatuses(projectId, planId);
        if (cancelled) return;
        setDetail((prev) => (prev ? { ...prev, statuses: r.statuses } : prev));
      } catch (e) {
        // Network blip — silent.
      }
    }, Math.max(5000, pollIntervalMs));
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [detail?.plan?.id, projectId, planId, pollIntervalMs]);

  // ── Color paths whenever detail or markup changes ───────────────────────
  useEffect(() => {
    if (!svgHostRef.current || !detail) return;
    const root = svgHostRef.current.querySelector('svg');
    if (!root) return;

    // Make sure SVG fills the wrapper
    root.removeAttribute('width');
    root.removeAttribute('height');
    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    if (!root.getAttribute('preserveAspectRatio')) {
      root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    const els = root.querySelectorAll<SVGElement>('[data-code]');
    els.forEach((el) => {
      const rawCode = el.getAttribute('data-code') || '';
      const code = rawCode.trim().toUpperCase();
      const listingId = detail.mapping[code] || null;
      const status = listingId ? detail.statuses[listingId] : null;

      const fill = status && STATUS_FILL[status] ? STATUS_FILL[status] : UNMAPPED_FILL;
      const stroke = status && STATUS_STROKE[status] ? STATUS_STROKE[status] : UNMAPPED_STROKE;

      el.setAttribute('fill', fill);
      el.setAttribute('fill-opacity', listingId ? '0.7' : '0.35');
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', '1');
      // `el` is an SVGElement (from querySelectorAll<SVGElement>); .style
      // is typed as CSSStyleDeclaration in lib.dom.d.ts.
      el.style.cursor = listingId ? 'pointer' : 'not-allowed';
      el.style.transition = 'fill-opacity 120ms ease';

      // Tooltip via <title> child (only set once)
      if (!el.querySelector('title')) {
        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        titleEl.textContent = status
          ? `${code} — ${status}`
          : `${code} — ${t('floorplan.no_listing') || 'chưa có listing'}`;
        el.appendChild(titleEl);
      } else {
        const titleEl = el.querySelector('title')!;
        titleEl.textContent = status
          ? `${code} — ${status}`
          : `${code} — ${t('floorplan.no_listing') || 'chưa có listing'}`;
      }
    });
  }, [svgMarkup, detail, t]);

  // ── Event delegation: hover + click on bound paths ──────────────────────
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host || !detail) return;

    function findCodeEl(target: EventTarget | null): SVGElement | null {
      let node = target as Element | null;
      while (node && node !== host) {
        if (node instanceof SVGElement && node.hasAttribute('data-code')) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const handleClick = (e: MouseEvent) => {
      const el = findCodeEl(e.target);
      if (!el) return;
      const code = (el.getAttribute('data-code') || '').trim().toUpperCase();
      const listingId = detail.mapping[code];
      if (!listingId) return; // unmapped — ignore
      e.stopPropagation();
      onSelectListing?.(listingId, code);
    };

    const handleMove = (e: MouseEvent) => {
      const el = findCodeEl(e.target);
      if (!el) {
        setHovered(null);
        return;
      }
      const code = (el.getAttribute('data-code') || '').trim().toUpperCase();
      const listingId = detail.mapping[code] || null;
      const status = listingId ? detail.statuses[listingId] : null;
      const lDetail: FloorPlanListingDetail | undefined = listingId
        ? detail.listings?.[listingId]
        : undefined;
      setHovered({
        code,
        listingId,
        status,
        area: lDetail?.area ?? null,
        price: lDetail?.price ?? null,
        title: lDetail?.title ?? null,
      });
    };

    const handleLeave = () => setHovered(null);

    host.addEventListener('click', handleClick);
    host.addEventListener('mousemove', handleMove);
    host.addEventListener('mouseleave', handleLeave);
    return () => {
      host.removeEventListener('click', handleClick);
      host.removeEventListener('mousemove', handleMove);
      host.removeEventListener('mouseleave', handleLeave);
    };
  }, [detail, onSelectListing]);

  // ── Pan + zoom (wheel + pointer + pinch) ────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const next = Math.min(8, Math.max(0.5, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      setScale(next);
    },
    [scale],
  );

  // Pointer-based pan + 2-pointer pinch
  const ptrState = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    panStart: { x: number; y: number; tx: number; ty: number } | null;
    pinchStart: { dist: number; scale: number } | null;
  }>({ pointers: new Map(), panStart: null, pinchStart: null });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    ptrState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrState.current.pointers.size === 1) {
      ptrState.current.panStart = { x: e.clientX, y: e.clientY, tx, ty };
    } else if (ptrState.current.pointers.size === 2) {
      const pts = Array.from(ptrState.current.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      ptrState.current.pinchStart = { dist, scale };
      ptrState.current.panStart = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = ptrState.current.pointers;
    if (!ps.has(e.pointerId)) return;
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ps.size === 2 && ptrState.current.pinchStart) {
      const pts = Array.from(ps.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / Math.max(1, ptrState.current.pinchStart.dist);
      const next = Math.min(8, Math.max(0.5, ptrState.current.pinchStart.scale * ratio));
      setScale(next);
    } else if (ps.size === 1 && ptrState.current.panStart) {
      const dx = e.clientX - ptrState.current.panStart.x;
      const dy = e.clientY - ptrState.current.panStart.y;
      setTx(ptrState.current.panStart.tx + dx);
      setTy(ptrState.current.panStart.ty + dy);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    ptrState.current.pointers.delete(e.pointerId);
    if (ptrState.current.pointers.size < 2) ptrState.current.pinchStart = null;
    if (ptrState.current.pointers.size === 0) ptrState.current.panStart = null;
  };

  const resetView = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  // Stats summary (for legend / counts)
  const summary = useMemo(() => {
    if (!detail) return null;
    const counts: Record<string, number> = { AVAILABLE: 0, BOOKING: 0, HOLD: 0, SOLD: 0, RENTED: 0, OPENING: 0, INACTIVE: 0 };
    let mapped = 0;
    for (const code of detail.codes) {
      const lid = detail.mapping[code];
      if (lid) {
        mapped += 1;
        const s = detail.statuses[lid];
        if (s && counts[s] !== undefined) counts[s] += 1;
      }
    }
    return { total: detail.codes.length, mapped, unmapped: detail.codes.length - mapped, counts };
  }, [detail]);

  return (
    <div className="w-full flex flex-col" style={{ minHeight: height }}>
      {/* Top bar: legend + zoom controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(STATUS_FILL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <span className="inline-block w-3 h-3 rounded-sm border border-black/10" style={{ background: v }} />
              {t(`status.${k}`) || k}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
              {summary.mapped}/{summary.total} {t('floorplan.mapped_short') || 'gắn listing'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(8, s * 1.2))}
            className="w-7 h-7 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
            aria-label={t('floorplan.zoom_in') || 'Phóng to'}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}
            className="w-7 h-7 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
            aria-label={t('floorplan.zoom_out') || 'Thu nhỏ'}
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="text-[11px] font-semibold px-2 h-7 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
          >
            {t('floorplan.reset_view') || 'Đặt lại'}
          </button>
        </div>
      </div>

      {/* SVG canvas */}
      <div
        ref={wrapperRef}
        className="relative flex-1 overflow-hidden bg-[var(--bg-app)]"
        style={{ touchAction: 'none', minHeight: 320 }}
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
            <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin mr-2" />
            {t('common.loading')}
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-rose-600 px-4 text-center">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div
            ref={svgHostRef}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
            className="w-full h-full origin-center select-none"
            style={{
              transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
              transformOrigin: '50% 50%',
              transition: ptrState.current.pointers.size > 0 ? 'none' : 'transform 80ms ease-out',
            }}
          />
        )}

        {/* Hover badge — code + status + area + price (Task #26 spec) */}
        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-2 rounded-lg bg-black/85 text-white text-xs font-semibold shadow-lg max-w-[260px]">
            <div className="flex items-center gap-2">
              <span className="font-mono">{hovered.code}</span>
              {hovered.status && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: STATUS_FILL[hovered.status] || '#64748b',
                    color: '#fff',
                  }}
                >
                  {t(`status.${hovered.status}`) || hovered.status}
                </span>
              )}
            </div>
            {hovered.listingId ? (
              <div className="mt-1 flex items-center gap-3 text-[11px] opacity-90">
                <span>{t('floorplan.area') || 'DT'}: <span className="font-bold">{fmtArea(hovered.area)}</span></span>
                <span>{t('floorplan.price') || 'Giá'}: <span className="font-bold">{fmtPriceShort(hovered.price)}</span></span>
              </div>
            ) : (
              <div className="mt-1 text-[11px] opacity-80">
                {t('floorplan.no_listing') || 'chưa có listing'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloorPlanRenderer;
