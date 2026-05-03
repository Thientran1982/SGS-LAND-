import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { colors } from '../src/theme/tokens';
import { ensurePushRegistration } from '../src/notifications/registerPushToken';

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
  if (typeof d.url === 'string' && d.url.startsWith('/')) return d.url as Href;
  if (typeof d.slugId === 'string' && d.slugId.length > 0) {
    return `/bds/${encodeURIComponent(d.slugId)}` as Href;
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
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
