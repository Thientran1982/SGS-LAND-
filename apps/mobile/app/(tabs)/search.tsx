import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listingsApi } from '../../src/api/listings';
import type { CursorListings, ListingFilters, PublicListing } from '../../src/api/types';
import { ListingCard } from '../../src/components/ListingCard';
import { ListingCardSkeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { loadFavorites, toggleFavorite } from '../../src/storage/favorites';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { slugify } from '../../src/utils/format';

const PROPERTY_TYPES = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'APARTMENT', label: 'Căn hộ' },
  { value: 'VILLA', label: 'Biệt thự' },
  { value: 'TOWNHOUSE', label: 'Nhà phố' },
  { value: 'LAND', label: 'Đất nền' },
  { value: 'PROJECT', label: 'Dự án' },
];

const TRANSACTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SALE', label: 'Bán' },
  { value: 'RENT', label: 'Cho thuê' },
];

const PRICE_RANGES = [
  { value: 'ALL', label: 'Mọi mức giá' },
  { value: 'UNDER_2', label: 'Dưới 2 tỷ', max: 2_000_000_000 },
  { value: '2_5',     label: '2 - 5 tỷ',   min: 2_000_000_000, max: 5_000_000_000 },
  { value: '5_10',    label: '5 - 10 tỷ',  min: 5_000_000_000, max: 10_000_000_000 },
  { value: 'OVER_10', label: 'Trên 10 tỷ', min: 10_000_000_000 },
];

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}
const Chip: React.FC<ChipProps> = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active && styles.chipActive]}
    android_ripple={{ color: colors.brandSoft }}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export default function SearchScreen() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('ALL');
  const [transaction, setTransaction] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [priceRange, setPriceRange] = useState('ALL');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFavorites().then(setFavorites);
  }, []);

  // Debounce text input — server caches by exact `search` string so we don't
  // want to thrash the LRU on each keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const locationsQuery = useQuery({
    queryKey: ['listings', 'locations'],
    queryFn: ({ signal }) => listingsApi.locations(signal),
    staleTime: 10 * 60_000,
  });

  const filters: ListingFilters = useMemo(() => {
    const f: ListingFilters = {};
    if (type !== 'ALL') f.type = type;
    if (transaction !== 'ALL') f.transaction = transaction;
    if (location !== 'ALL') f.location = location;
    if (debounced) f.search = debounced;
    const range = PRICE_RANGES.find((r) => r.value === priceRange);
    if (range?.min) f.priceMin = range.min;
    if (range?.max) f.priceMax = range.max;
    return f;
  }, [type, transaction, location, debounced, priceRange]);

  const query = useInfiniteQuery({
    queryKey: ['listings', 'search', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listingsApi.listCursor({ pageSize: 20, cursor: pageParam, filters, signal }),
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

  const locationOptions = useMemo(
    () => [{ value: 'ALL', label: 'Tất cả khu vực' }, ...(locationsQuery.data || []).map((l) => ({ value: l, label: l }))],
    [locationsQuery.data],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên, dự án, khu vực..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {search.length > 0 ? (
            <Pressable hitSlop={10} onPress={() => setSearch('')}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {PROPERTY_TYPES.map((opt) => (
            <Chip key={opt.value} label={opt.label} active={type === opt.value} onPress={() => setType(opt.value)} />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {TRANSACTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={transaction === opt.value}
              onPress={() => setTransaction(opt.value)}
            />
          ))}
          {PRICE_RANGES.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={priceRange === opt.value}
              onPress={() => setPriceRange(opt.value)}
            />
          ))}
        </ScrollView>

        {locationOptions.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {locationOptions.slice(0, 30).map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={location === opt.value}
                onPress={() => setLocation(opt.value)}
              />
            ))}
          </ScrollView>
        ) : null}

        {total > 0 ? (
          <Text style={styles.resultCount}>
            {total.toLocaleString('vi-VN')} kết quả
          </Text>
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={styles.listPad}>
          {[0, 1].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      ) : query.isError ? (
        <EmptyState icon="⚠️" title="Không tải được kết quả" subtitle="Vui lòng thử lại sau." />
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
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔎"
              title="Không có kết quả phù hợp"
              subtitle="Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác."
            />
          }
          keyboardDismissMode="on-drag"
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    backgroundColor: colors.bgSurface,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearText: { color: colors.textTertiary, fontSize: 16, paddingHorizontal: 4 },
  chipRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand,
  },
  resultCount: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    fontSize: typography.xs,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  listPad: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
