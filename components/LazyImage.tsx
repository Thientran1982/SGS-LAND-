import React, { useState, useRef, useEffect, memo } from 'react';
import { NO_IMAGE_URL } from '../utils/constants';

interface LazyImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: string;
  /** Width hint — helps browser avoid layout shift */
  width?: number;
  /** Height hint */
  height?: number;
  /** Extra wrapper class (e.g. rounded corners) */
  wrapperClassName?: string;
  /** Root margin for IntersectionObserver — how early to start loading */
  rootMargin?: string;
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
  wrapperClassName,
  rootMargin = '200px',
}: LazyImageProps) => {
  const [loaded, setLoaded]       = useState(false);
  const [error,  setError]        = useState(false);
  const [visible, setVisible]     = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  // Observe when image is near the viewport
  useEffect(() => {
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
  }, [rootMargin]);

  const resolvedSrc = visible ? (error ? fallback : (src || fallback)) : undefined;

  return (
    <div ref={containerRef} className={wrapperClassName || 'relative w-full h-full'}>
      {/* Skeleton shimmer — shown until image loads */}
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[var(--glass-surface)] via-[var(--glass-surface-hover)] to-[var(--glass-surface)] bg-[length:200%_100%] animate-[shimmer_1.4s_ease-in-out_infinite] rounded-[inherit]"
        />
      )}

      {resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
        />
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
export default LazyImage;
