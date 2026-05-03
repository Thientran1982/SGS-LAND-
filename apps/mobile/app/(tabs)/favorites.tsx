import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { listingsApi } from '../../src/api/listings';
import { ApiError } from '../../src/api/client';
import type { PublicListing } from '../../src/api/types';
import { ListingCard } from '../../src/components/ListingCard';
import { EmptyState } from '../../src/components/EmptyState';
import { loadFavorites, removeFavorite, toggleFavorite } from '../../src/storage/favorites';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { slugify } from '../../src/utils/format';

export default function FavoritesScreen() {
  const router = useRouter();
  const [favIds, setFavIds] = useState<string[]>([]);

  // Refresh on focus — favorites can change from any other screen.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadFavorites().then((set) => {
        if (!cancelled) setFavIds(Array.from(set));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Hydrate listing payloads in parallel; cached by detail key so revisiting
  // costs nothing if the user already opened the listing.
  const queries = useQueries({
    queries: favIds.map((id) => ({
      queryKey: ['listings', 'detail', id],
      queryFn: ({ signal }: { signal?: AbortSignal }) => listingsApi.detail(id, signal),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const items: PublicListing[] = queries
    .map((q) => q.data)
    .filter((x): x is PublicListing => !!x);

  const isLoading = queries.length > 0 && queries.some((q) => q.isLoading);

  // Reconcile stale favorites: if the server returns 404 (listing deleted/unavailable),
  // drop the ID from AsyncStorage so the user doesn't have phantom favorites that
  // can never be cleared. Runs whenever query results change.
  useEffect(() => {
    const stale: string[] = [];
    queries.forEach((q, idx) => {
      const id = favIds[idx];
      if (!id || q.isLoading || q.isFetching) return;
      if (q.isError && q.error instanceof ApiError && q.error.status === 404) {
        stale.push(id);
      }
    });
    if (stale.length > 0) {
      (async () => {
        for (const id of stale) {
          await removeFavorite(id);
        }
        setFavIds((prev) => prev.filter((x) => !stale.includes(x)));
      })();
    }
  }, [queries, favIds]);

  const handleOpen = useCallback(
    (item: PublicListing) => {
      const slug = slugify(item.title || item.code || item.location || 'bat-dong-san') || 'bat-dong-san';
      router.push(`/bds/${slug}-${item.id}`);
    },
    [router],
  );

  const handleToggleFav = useCallback(async (id: string) => {
    const next = await toggleFavorite(id);
    setFavIds(Array.from(next));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Yêu thích</Text>
        <Text style={styles.subtitle}>
          {favIds.length > 0 ? `${favIds.length} sản phẩm đã lưu` : 'Lưu sản phẩm để xem lại sau'}
        </Text>
      </View>

      {favIds.length === 0 ? (
        <EmptyState
          icon="♡"
          title="Chưa có yêu thích nào"
          subtitle="Nhấn vào biểu tượng trái tim trên một sản phẩm để lưu vào danh sách yêu thích của bạn."
        />
      ) : isLoading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.subtitle}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <ListingCard
              item={item}
              onPress={handleOpen}
              onToggleFavorite={handleToggleFav}
              isFavorite
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: typography.xxl, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: typography.sm, color: colors.textTertiary, marginTop: 2 },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
