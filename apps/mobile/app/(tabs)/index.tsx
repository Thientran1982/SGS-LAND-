import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { listingsApi } from '../../src/api/listings';
import type { CursorListings, PublicListing } from '../../src/api/types';
import { ListingCard } from '../../src/components/ListingCard';
import { ListingCardSkeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { FeaturedProjectsCarousel } from '../../src/components/FeaturedProjectsCarousel';
import { loadFavorites, toggleFavorite } from '../../src/storage/favorites';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { slugify } from '../../src/utils/format';

export default function DiscoverScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFavorites().then(setFavorites);
  }, []);

  const query = useInfiniteQuery({
    queryKey: ['listings', 'feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listingsApi.listCursor({ pageSize: 20, cursor: pageParam, signal }),
    getNextPageParam: (last: CursorListings) => (last.hasNext ? last.nextCursor || undefined : undefined),
  });

  const listings: PublicListing[] = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const handleOpen = useCallback(
    (item: PublicListing) => {
      const slug = slugify(item.title || item.code || item.location || 'bat-dong-san') || 'bat-dong-san';
      router.push(`/bds/${slug}-${item.id}`);
    },
    [router],
  );

  const handleToggleFav = useCallback(async (id: string) => {
    const next = await toggleFavorite(id);
    setFavorites(new Set(next));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PublicListing }) => (
      <ListingCard
        item={item}
        onPress={handleOpen}
        onToggleFavorite={handleToggleFav}
        isFavorite={favorites.has(item.id)}
      />
    ),
    [handleOpen, handleToggleFav, favorites],
  );

  const renderFooter = () => {
    if (query.isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.brand} />
        </View>
      );
    }
    if (!query.hasNextPage && listings.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Bạn đã xem hết {listings.length.toLocaleString('vi-VN')} sản phẩm</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.brand}>SGS Land</Text>
        <Text style={styles.subtitle}>
          {total > 0 ? `${total.toLocaleString('vi-VN')} sản phẩm đang mở bán` : 'Khám phá bất động sản chất lượng'}
        </Text>
      </View>

      {query.isLoading ? (
        <View style={styles.listPad}>
          {[0, 1, 2].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      ) : query.isError ? (
        <EmptyState
          icon="⚠️"
          title="Không tải được dữ liệu"
          subtitle="Vui lòng kiểm tra kết nối mạng và thử lại."
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPad}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={<FeaturedProjectsCarousel />}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <EmptyState title="Chưa có sản phẩm" subtitle="Hệ thống đang cập nhật. Vui lòng quay lại sau." />
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
              tintColor={colors.brand}
            />
          }
          removeClippedSubviews
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
  brand: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.textTertiary,
  },
});
