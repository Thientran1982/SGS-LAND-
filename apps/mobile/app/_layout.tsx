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
import { loadSentry, loadTrackingTransparency } from '../src/lib/optionalNativeModules';

/**
 * Crash + performance monitoring (Sprint 7 — #57).
 *
 * The Sentry SDK is loaded via `loadSentry()` which dynamic-imports the
 * native module if present and returns null otherwise — so dev / Expo Go
 * builds without the package keep working. Init is also a no-op when no
 * `EXPO_PUBLIC_SENTRY_DSN` is set, ensuring no telemetry leaks in dev.
 */
async function initSentry(): Promise<void> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await loadSentry();
  if (!Sentry) return;
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    // Tag releases by app version so the dashboard groups crashes per build.
    release: `sgsland-mobile@${process.env.EXPO_PUBLIC_APP_VERSION || '0.1.0'}`,
    environment: __DEV__ ? 'development' : 'production',
  });
}

/**
 * App Tracking Transparency prompt (Sprint 7 — #57).
 *
 * Apple requires the prompt before any analytics SDK can read the IDFA.
 * Triggered once on first launch; analytics is gated on the result. When
 * the native module isn't installed we silently skip — analytics ID stays
 * unavailable, which is the safer default for privacy.
 */
async function maybeRequestTracking(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const att = await loadTrackingTransparency();
  if (!att) return;
  try {
    await att.requestTrackingPermissionsAsync();
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
