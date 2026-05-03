import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { colors } from '../src/theme/tokens';
import { ensurePushRegistration } from '../src/notifications/registerPushToken';
import { AuthProvider } from '../src/auth/AuthContext';

/**
 * Crash + performance monitoring (Sprint 7 — #57).
 *
 * We dynamic-import `@sentry/react-native` so the app keeps building when
 * the package isn't installed (dev environments / Expo Go). The DSN is
 * provided via `EXPO_PUBLIC_SENTRY_DSN`; without it the SDK is a no-op.
 */
async function initSentry(): Promise<void> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    // @ts-expect-error optional native dep — installed only for production builds
    const Sentry = await import('@sentry/react-native').catch(() => null);
    if (!Sentry || typeof (Sentry as any).init !== 'function') return;
    (Sentry as any).init({
      dsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
      // Tag releases by app version so the dashboard groups crashes per build.
      release: `sgsland-mobile@${process.env.EXPO_PUBLIC_APP_VERSION || '0.1.0'}`,
      environment: __DEV__ ? 'development' : 'production',
    });
  } catch {
    /* never let observability bring down the app */
  }
}

/**
 * App Tracking Transparency prompt (Sprint 7 — #57).
 *
 * Apple requires the prompt before any analytics SDK can read the IDFA.
 * We trigger it on first launch and gate analytics on the result; if the
 * native module isn't installed we just skip — analytics ID will simply
 * remain unavailable, which is the safer default.
 */
async function maybeRequestTracking(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    // @ts-expect-error optional native dep — installed only for production builds
    const att = await import('expo-tracking-transparency').catch(() => null);
    if (!att || typeof (att as any).requestTrackingPermissionsAsync !== 'function') return;
    await (att as any).requestTrackingPermissionsAsync();
  } catch {
    /* user can revisit in Settings — never block the UI on this */
  }
}

// Foreground presentation: show the banner + play a sound while the app is
// open so the user notices new-listing alerts even without backgrounding.
// `shouldShowAlert` is the SDK ≤51 field name; the newer `shouldShowBanner`
// supersedes it. We keep both behind a small typed shape so we don't have
// to fork on SDK version at runtime.
interface NotificationBehavior {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  shouldShowAlert: boolean;
}
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

/**
 * Resolve the deep-link path embedded in a notification payload.
 *
 * The server emits `data.url = "/bds/<slugId>"` for new-listing matches; we
 * also accept a bare `slugId` for forward-compatibility with other notif
 * sources.
 */
function resolveDeepLink(data: unknown): Href | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  // Generic `url` payload — accept any in-app absolute path the server
  // provides (e.g. `/bds/<slugId>`, `/messages/<id>`).
  if (typeof d.url === 'string' && d.url.startsWith('/')) return d.url as Href;
  // Messaging push (Task #55): server emits `conversationId` so we don't
  // have to URL-encode the path on the backend.
  if (typeof d.conversationId === 'string' && d.conversationId.length > 0) {
    return `/messages/${encodeURIComponent(d.conversationId)}` as Href;
  }
  // Listing-match push (Task #53).
  if (typeof d.slugId === 'string' && d.slugId.length > 0) {
    return `/bds/${encodeURIComponent(d.slugId)}` as Href;
  }
  // Booking push / VNPay return deep-link (Task #56).
  if (typeof d.bookingId === 'string' && d.bookingId.length > 0) {
    return `/bookings/${encodeURIComponent(d.bookingId)}` as Href;
  }
  return null;
}

export default function RootLayout() {
  // Stable QueryClient — created once with React state to survive Fast Refresh.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,           // 1 min — match server cache window
            gcTime: 5 * 60_000,
            retry: 2,
            refetchOnWindowFocus: false, // mobile: too noisy on backgrounding
          },
        },
      }),
  );

  // Push registration runs once on mount (best-effort, never blocks the UI)
  // and listens for taps so we can deep-link into the listing detail.
  const responseListener = useRef<Notifications.Subscription | null>(null);
  useEffect(() => {
    // Sprint 7: observability + ATT prompt. Both are fire-and-forget and
    // tolerate missing native modules (no-op in Expo Go / dev).
    void initSentry();
    void maybeRequestTracking();
    void ensurePushRegistration();

    // Cold-start: if the app was launched by tapping a notification, jump to it.
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        const path = resolveDeepLink(resp?.notification?.request?.content?.data);
        if (path) {
          // Defer one tick so the navigator is mounted.
          setTimeout(() => router.push(path), 0);
        }
      })
      .catch(() => {});

    // Warm: while the app is running, taps fire here.
    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const path = resolveDeepLink(resp?.notification?.request?.content?.data);
      if (path) router.push(path);
    });
    return () => {
      try {
        responseListener.current?.remove();
      } catch {
        /* best-effort */
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bgBase },
              animation: 'slide_from_right',
            }}
          >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="bds/[slugId]" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="messages/[id]" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="listing/[code]/book" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="bookings/index" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="bookings/[id]" options={{ headerShown: false, presentation: 'card' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
