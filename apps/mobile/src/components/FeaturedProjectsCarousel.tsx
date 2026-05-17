/**
 * "Dự án nổi bật" horizontal carousel for the Discover tab (Sprint 7 — #57).
 *
 * - Loads via TanStack Query so it shares cache across tab switches.
 * - Skeleton placeholders while loading; renders nothing on empty/error so
 *   the listings feed below stays the focal point.
 * - Tapping a card opens the existing public mini-site at `/p/<code>` in a
 *   system browser tab (Custom Tabs / SFSafariViewController) so we don't
 *   pull a webview dependency into the mobile bundle just for this surface.
 */
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, type PublicProjectSummary } from '../api/projects';
import { colors, radius, spacing, typography } from '../theme/tokens';
// Mini-site lives on the existing web property at /p/<code>; opening it via
// `expo-web-browser` (Custom Tabs / SFSafariViewController) gives buyers the
// same rich microsite experience as the web without dragging a webview
// dependency into the mobile bundle. When a native project-detail screen
// lands later, swap this for a `router.push` — the call site is the only
// place that needs to change.
const PROJECT_MICROSITE_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://sgsland.vn').replace(/\/+$/, '');
const CARD_WIDTH = 240;
const CARD_HEIGHT = 168;
export function FeaturedProjectsCarousel() {
  const query = useQuery({
    queryKey: ['projects', 'featured'],
    queryFn: ({ signal }) => projectsApi.featured({ limit: 8, signal }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
  // Hide the whole block on error or when there are no featured projects so
  // the Discover feed isn't crowded with an empty state for a marketing band.
  if (query.isError) return null;
  if (!query.isLoading && (query.data?.projects.length ?? 0) === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dự án nổi bật</Text>
      </View>
      {query.isLoading ? (
        <View style={[styles.row, styles.loadingRow]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={query.data?.projects ?? []}
          keyExtractor={(p: PublicProjectSummary) => p.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => {
                const url = `${PROJECT_MICROSITE_BASE}/p/${encodeURIComponent(item.code)}`;
                // Fire-and-forget: any open error is non-fatal — the carousel
                // already shows the buyer all the info they need at a glance.
                WebBrowser.openBrowserAsync(url).catch(() => undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Mở dự án ${item.name}`}
            >
              <View style={styles.cover}>
                {item.coverImage ? (
                  <Image source={{ uri: item.coverImage }} style={styles.coverImg} resizeMode="cover" />
                ) : (
                  <View style={styles.coverFallback}>
                    <Text style={styles.coverFallbackText}>SGS</Text>
                  </View>
                )}
              </View>
              <View style={styles.body}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                {item.location ? (
                  <Text style={styles.cardLoc} numberOfLines={1}>📍 {item.location}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgBase,
  },
  headerRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  row: {
    paddingHorizontal: spacing.md,
  },
  loadingRow: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.85 },
  cover: { width: '100%', height: CARD_HEIGHT * 0.62, backgroundColor: colors.bgMuted },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  coverFallbackText: { color: colors.brand, fontWeight: '800', fontSize: typography.lg },
  body: { padding: spacing.sm },
  cardTitle: { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
  cardLoc: { fontSize: typography.xs, color: colors.textTertiary, marginTop: 2 },
});