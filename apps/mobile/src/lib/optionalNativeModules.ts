/**
 * Optional native module loaders (Sprint 7 — #57).
 *
 * Sentry and ATT are real native dependencies but we don't want them in the
 * mobile package.json — that would force every dev to install pods/native
 * code just to run the JS bundle in Expo Go. Instead they're installed only
 * for production EAS builds. These loaders centralize the dynamic import
 * + missing-module handling so the app bootstrap stays clean and the
 * `@ts-expect-error` annotation lives in exactly one place per module.
 *
 * Each loader:
 *   - returns `null` when the package isn't installed (no throw),
 *   - returns `null` if the loaded module doesn't expose the expected entry,
 *   - swallows any other init error so observability never crashes the app.
 */

export interface SentryLike {
  init: (options: Record<string, unknown>) => void;
}

export async function loadSentry(): Promise<SentryLike | null> {
  try {
    // @ts-expect-error optional native dep — only present in production EAS builds
    const mod = await import('@sentry/react-native').catch(() => null);
    if (!mod || typeof (mod as { init?: unknown }).init !== 'function') return null;
    return mod as unknown as SentryLike;
  } catch {
    return null;
  }
}

export interface TrackingTransparencyLike {
  requestTrackingPermissionsAsync: () => Promise<{ status: string }>;
}

export async function loadTrackingTransparency(): Promise<TrackingTransparencyLike | null> {
  try {
    // @ts-expect-error optional native dep — only present in production EAS builds
    const mod = await import('expo-tracking-transparency').catch(() => null);
    if (!mod || typeof (mod as { requestTrackingPermissionsAsync?: unknown }).requestTrackingPermissionsAsync !== 'function') {
      return null;
    }
    return mod as unknown as TrackingTransparencyLike;
  } catch {
    return null;
  }
}
