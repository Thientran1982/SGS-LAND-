/**
 * Booking detail screen (Task #56).
 *
 * Reached either by:
 *   - explicit nav from the list screen (`/bookings/<id>`)
 *   - VNPay return deep-link (`sgsland://bookings/<id>?status=paid|failed|invalid|error`)
 *
 * The IPN may not have landed by the time the buyer's browser session
 * closes. We therefore poll the booking every 3s for the first 60s if the
 * status is still PENDING, then fall back to a manual refresh button.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import {
  bookingsApi,
  formatVnd,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_COLOR,
  type BookingStatus,
} from '../../src/api/bookings';
import { useAuth } from '../../src/auth/AuthContext';

const HOTLINE = '+84971132378';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!d.getTime()) return '—';
  return d.toLocaleString('vi-VN');
}

const STATUS_ICON: Record<BookingStatus, string> = {
  PENDING: '⏳',
  PAID: '✅',
  FAILED: '❌',
  CANCELLED: '🚫',
  REFUNDED: '↩️',
};

const STATUS_BLURB: Record<BookingStatus, string> = {
  PENDING:
    'Giao dịch đang chờ xác nhận từ VNPay. Trang sẽ tự cập nhật trong giây lát.',
  PAID:
    'Cảm ơn quý khách. Chuyên viên SGS Land sẽ liên hệ trong vòng 24 giờ để hướng dẫn các bước tiếp theo.',
  FAILED:
    'Giao dịch không thành công. Quý khách có thể thử lại hoặc liên hệ chuyên viên để được hỗ trợ.',
  CANCELLED: 'Đơn cọc đã bị huỷ.',
  REFUNDED: 'Khoản cọc đã được hoàn lại.',
};

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id: string; status?: string }>();
  const { user } = useAuth();
  const id = String(params.id || '');

  const startedAt = useRef<number>(Date.now());
  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    enabled: !!user && !!id,
    // Poll while PENDING for the first ~60s, then back off.
    refetchInterval: (q) => {
      const status = q.state.data?.booking?.status;
      if (!status || status !== 'PENDING') return false;
      const elapsed = Date.now() - startedAt.current;
      return elapsed < 60_000 ? 3_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  // If we received a `?status=paid|failed` deep-link param, give the user
  // immediate feedback even before the IPN reconciles. The actual booking
  // row is still authoritative — this is only the initial impression.
  const provisional = useMemo(() => {
    const s = String(params.status || '').toLowerCase();
    if (s === 'paid') return 'PAID';
    if (s === 'failed') return 'FAILED';
    if (s === 'invalid' || s === 'error') return 'FAILED';
    return null;
  }, [params.status]);

  const booking = query.data?.booking;
  const status: BookingStatus = booking?.status ?? (provisional as BookingStatus) ?? 'PENDING';
  const color = BOOKING_STATUS_COLOR[status];

  // "Tải biên nhận" — fetch a short-lived signed URL then hand off to the
  // system browser. Using openBrowserAsync (not openAuthSessionAsync) so the
  // receipt page persists even after the app is backgrounded for sharing.
  const receiptMut = useMutation({
    mutationFn: () => bookingsApi.receiptUrl(id),
    onSuccess: async ({ url }) => {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        /* iOS may throw if user dismisses immediately — ignore */
      }
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/bookings'))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Text style={styles.backTxt}>‹  Quay lại</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Chi tiết đơn cọc</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={query.isFetching && !query.isPending} onRefresh={() => query.refetch()} />
        }
      >
        <View style={[styles.statusCard, { borderColor: color }]}>
          <Text style={styles.statusEmoji}>{STATUS_ICON[status]}</Text>
          <Text style={[styles.statusLabel, { color }]}>
            {BOOKING_STATUS_LABEL[status]}
          </Text>
          <Text style={styles.statusBlurb}>{STATUS_BLURB[status]}</Text>
          {status === 'PENDING' && query.isFetching ? (
            <ActivityIndicator color={color} style={{ marginTop: spacing.sm }} />
          ) : null}
        </View>

        {query.isPending && !provisional ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : !booking ? (
          <View style={styles.card}>
            <Text style={styles.errTxt}>Không tìm thấy đơn cọc.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SẢN PHẨM</Text>
              <Text style={styles.cardValue}>
                {booking.listingTitle || 'Sản phẩm bất động sản'}
              </Text>
              {booking.listingCode ? (
                <Text style={styles.subValue}>Mã: {booking.listingCode}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>SỐ TIỀN ĐẶT CỌC</Text>
              <Text style={styles.amountTxt}>{formatVnd(booking.depositAmount)}</Text>
            </View>

            <View style={styles.card}>
              <Row k="Mã đơn cọc" v={booking.id} mono />
              <Row k="Mã giao dịch" v={booking.vnpayTxnRef} mono />
              {booking.vnpayBankCode ? <Row k="Ngân hàng" v={booking.vnpayBankCode} /> : null}
              {booking.vnpayResponseCode ? (
                <Row k="Mã phản hồi" v={booking.vnpayResponseCode} mono />
              ) : null}
              <Row k="Tạo lúc" v={formatDateTime(booking.createdAt)} />
              {booking.paidAt ? (
                <Row k="Thanh toán lúc" v={formatDateTime(booking.paidAt)} />
              ) : null}
              {booking.buyerEmail ? <Row k="Email" v={booking.buyerEmail} /> : null}
            </View>

            {booking.status === 'PAID' ? (
              <Pressable
                onPress={() => receiptMut.mutate()}
                disabled={receiptMut.isPending}
                style={({ pressed }) => [
                  styles.receiptBtn,
                  (pressed || receiptMut.isPending) && { opacity: 0.85 },
                ]}
              >
                {receiptMut.isPending ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Text style={styles.receiptBtnTxt}>📄 Tải biên nhận</Text>
                )}
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => Linking.openURL(`tel:${HOTLINE}`)}
              style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.callBtnTxt}>Gọi chuyên viên · 0971 132 378</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row: React.FC<{ k: string; v: string; mono?: boolean }> = ({ k, v, mono }) => (
  <View style={styles.row}>
    <Text style={styles.rowK}>{k}</Text>
    <Text style={[styles.rowV, mono && styles.mono]} numberOfLines={2} selectable>
      {v}
    </Text>
  </View>
);

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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  statusCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  statusEmoji: { fontSize: 56, marginBottom: spacing.sm },
  statusLabel: { fontSize: typography.xl, fontWeight: '800', marginBottom: spacing.sm },
  statusBlurb: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  cardValue: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  subValue: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 4 },
  amountTxt: { fontSize: typography.xxl, fontWeight: '800', color: colors.brand },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowK: { color: colors.textTertiary, fontSize: typography.sm, flexShrink: 0 },
  rowV: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '600', flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'Courier', fontSize: typography.xs },
  receiptBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand,
  },
  receiptBtnTxt: { color: colors.brand, fontWeight: '800', fontSize: typography.base },
  callBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  callBtnTxt: { color: '#fff', fontWeight: '800', fontSize: typography.base },
  errTxt: { color: '#991B1B', textAlign: 'center', fontWeight: '700' },
});
