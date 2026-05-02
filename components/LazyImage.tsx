import React, { useState, useRef, useEffect, memo } from 'react';
import { NO_IMAGE_URL } from '../utils/constants';
import { optimizedImageUrl } from '../utils/imageUrl';

interface LazyImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: string;
  /** Pixel width đích để server resize (`?w=N`). Mặc định 256 — phù hợp
   *  thumbnail 40-128 CSS px ở 2x DPR. Ảnh ngoài /uploads/ giữ nguyên. */
  width?: number;
  /** Height hint */
  height?: number;
  /** Extra wrapper class (e.g. rounded corners) */
  wrapperClassName?: string;
  /** Root margin for IntersectionObserver — how early to start loading */
  rootMargin?: string;
  /** Đặt true cho ảnh hero/above-the-fold để bỏ lazy + tăng fetchpriority. */
  eager?: boolean;
}

/**
 * LazyImage — optimised for inventory lists with 100k+ entries.
 *
 * Features:
 *  • IntersectionObserver: image src only set when element is near viewport
 *  • Skeleton shimmer shown while loading (prevents layout shift)
 *  • decoding="async" — unblocks main thread during decode
 *  • loading="lazy" — browser-native hint (belt-and-suspenders)
 *  • onError fallback to NO_IMAGE_URL
 *  • Smooth fade-in on load to avoid flash
 */
const LazyImage = memo(({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallback = NO_IMAGE_URL,
  width = 256,
  wrapperClassName,
  rootMargin = '200px',
  eager = false,
}: LazyImageProps) => {
  const [loaded, setLoaded]       = useState(false);
  const [error,  setError]        = useState(false);
  const [visible, setVisible]     = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  // Observe when image is near the viewport (bỏ qua nếu eager=true).
  useEffect(() => {
    if (eager) { setVisible(true); return; }
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, eager]);

  const rawSrc = error ? fallback : (src || fallback);
  const resolvedSrc = visible ? optimizedImageUrl(rawSrc, width) : undefined;

  // CRITICAL: the wrapper MUST always be `position: relative` so the
  // `absolute inset-0` skeleton below is contained within this 44×44-ish
  // image cell. Previously, callers passing `wrapperClassName="w-full h-full"`
  // would silently drop the default `relative` class — the skeleton then
  // escaped up the DOM to the nearest positioned ancestor (the listings
  // panel overlay, `position: fixed inset-0`) and rendered as a FULL-VIEWPORT
  // shimmer covering the panel content. With 48 listings × 1 LazyImage each,
  // 48 full-viewport shimmer overlays stacked on top of the table — exactly
  // the recurring "trắng trang" / "bảng trắng" bug for Masteri Cosmo Central
  // (48 units). Verified via paint-time `document.elementFromPoint` probe
  // in pages/Projects.tsx ProjectListingsPanel.visibility diagnostic.
  return (
    <div
      ref={containerRef}
      className={wrapperClassName ? `relative ${wrapperClassName}` : 'relative w-full h-full'}
    >
      {/* Skeleton shimmer — shown until image loads.
          Now safely contained because the wrapper is guaranteed `relative`. */}
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[var(--glass-surface)] via-[var(--glass-surface-hover)] to-[var(--glass-surface)] bg-[length:200%_100%] animate-[shimmer_1.4s_ease-in-out_infinite] rounded-[inherit] pointer-events-none"
        />
      )}

      {resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...(eager ? { fetchPriority: 'high' as any } : {})}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
        />
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
export default LazyImage;
