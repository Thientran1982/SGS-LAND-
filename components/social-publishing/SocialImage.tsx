import React, { useEffect, useState } from 'react';

/**
 * Listing/project images can be stored as relative upload paths or as URLs
 * produced by a local backend. The browser preview must resolve both through
 * the current origin instead of trying to load the backend's localhost host.
 */
export function normalizeSocialImageUrl(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('data:image/') || raw.startsWith('blob:')) return raw;

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : undefined);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    // Publication previews may contain the provider-safe absolute URL that
    // the API generated from an app-owned upload path. Keep those uploads on
    // the current authenticated origin so local/preview CRMs do not request
    // the production public host.
    if (localHosts.has(parsed.hostname) || parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return raw.startsWith('/') ? raw : null;
  }
}

interface SocialImageProps {
  src: unknown;
  alt: string;
  className: string;
  fallbackText?: string;
}

export function SocialImage({
  src,
  alt,
  className,
  fallbackText = 'Ảnh không khả dụng',
}: SocialImageProps) {
  const imageUrl = normalizeSocialImageUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !imageUrl || failedUrl === imageUrl;

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt || fallbackText}
        className={`${className} flex items-center justify-center bg-[var(--glass-surface)] px-2 text-center text-[10px] leading-4 text-[var(--text-tertiary)]`}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`block max-w-full ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
