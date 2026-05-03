/**
 * Buyer "Đơn cọc của tôi" — list screen (Task #56).
 *
 * Lives outside the tab bar; reachable from the Account tab + from the
 * notification deep-link `sgsland://bookings`.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { useAuth } from '../../src/auth/AuthContext';
import {
  bookingsApi,
  formatVnd,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_COLOR,
  type Booking,
} from '../../src/api/bookings';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!d.getTime()) return '';
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const BookingCard: React.FC<{ booking: Booking }> = ({ booking }) => {
  const color = BOOKING_STATUS_COLOR[booking.status];
  return (
    <Pressable
      onPress={() => router.push(`/bookings/${booking.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {booking.listingTitle || 'Đơn đặt cọc'}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
          <Text style={[styles.statusTxt, { color }]}>
            {BOOKING_STATUS_LABEL[booking.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.amount}>{formatVnd(booking.depositAmount)}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaTxt}>Mã: {booking.vnpayTxnRef}</Text>
        <Text style={styles.metaTxt}>{formatDate(booking.createdAt)}</Text>
      </View>
    </Pressable>
  );
};

export default function BookingsListScreen() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['bookings', 'me', user?.id],
    queryFn: () => bookingsApi.listMine(50),
    enabled: !!user,
    staleTime: 15_000,
  });

  const onRefresh = useCallback(() => {
    query.refetch();
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹  Quay lại</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Đơn cọc của tôi</Text>
        <View style={{ width: 64 }} />
      </View>

      {!user ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Cần đăng nhập</Text>
          <Text style={styles.emptyDesc}>
            Vui lòng đăng nhập để xem các đơn đặt cọc của quý khách.
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)/account')}
            style={styles.cta}
          >
            <Text style={styles.ctaTxt}>Đăng nhập ngay</Text>
          </Pressable>
        </View>
      ) : query.isPending ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={query.data?.bookings ?? []}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={query.isFetching && !query.isPending} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Chưa có đơn cọc nào</Text>
              <Text style={styles.emptyDesc}>
                Các đơn đặt cọc giữ chỗ sẽ hiện ở đây sau khi quý khách thực hiện thanh toán.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backTxt: { color: colors.brand, fontWeight: '700', fontSize: typography.base },
  headerTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { flex: 1, fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  statusTxt: { fontSize: typography.xs, fontWeight: '800' },
  amount: { fontSize: typography.lg, fontWeight: '800', color: colors.brand, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaTxt: { fontSize: typography.xs, color: colors.textTertiary },
  empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  emptyDesc: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: typography.base },
});
