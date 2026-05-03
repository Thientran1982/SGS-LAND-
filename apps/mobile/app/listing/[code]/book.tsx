/**
 * Buyer "Đặt cọc giữ chỗ" screen (Task #56).
 *
 * Flow:
 *   1. Buyer lands here with `?listingId=<uuid>` (set by the BĐS detail
 *      "Đặt cọc giữ chỗ" CTA). Optional `?unitId` and `?title`.
 *   2. We POST /api/bookings → server returns { booking, paymentUrl }.
 *   3. We open `paymentUrl` via `WebBrowser.openAuthSessionAsync` with our
 *      `sgsland://bookings/<id>` deep-link as the return scheme. The system
 *      browser auto-closes when VNPay redirects back to our return URL
 *      (which our server 302s to the deep-link).
 *   4. We refetch the booking and either route to the detail screen or show
 *      the result inline. The IPN may not have landed yet — the detail
 *      screen polls for ~30s before falling back to "đang xử lý".
 *
 * The route filename uses `[code]` to mirror `/listing/<slugId>/book` URLs
 * for future web-style links, but the actual lookup uses the explicit
 * `?listingId=` query param so we never have to re-extract a UUID.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '../../../src/theme/tokens';
import { useAuth } from '../../../src/auth/AuthContext';
import { bookingsApi, formatVnd } from '../../../src/api/bookings';
import { ApiError } from '../../../src/api/client';

const PRESET_AMOUNTS = [5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000];
const DEFAULT_AMOUNT = 50_000_000;

export default function BookListingScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    listingId?: string;
    unitId?: string;
    title?: string;
  }>();
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT);
  const [email, setEmail] = useState<string>('');
  const [agreed, setAgreed] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const listingId = useMemo(() => {
    const raw = (params.listingId || params.code || '').toString();
    // Accept either a bare UUID or a `<slug>-<uuid>` slugId.
    const m = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0].toLowerCase() : null;
  }, [params.code, params.listingId]);

  const title = (params.title as string) || 'Sản phẩm bất động sản';

  const createMut = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        listingId: listingId!,
        unitId: params.unitId ? String(params.unitId) : null,
        depositAmount: amount,
        email: email.trim() || null,
      }),
  });

  const handlePay = async () => {
    setErrMsg(null);
    if (!user) {
      Alert.alert(
        'Cần đăng nhập',
        'Quý khách vui lòng đăng nhập để đặt cọc giữ chỗ.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => router.replace('/(tabs)/account') },
        ],
      );
      return;
    }
    if (!listingId) {
      setErrMsg('Không xác định được sản phẩm. Vui lòng quay lại trang chi tiết.');
      return;
    }
    if (!agreed) {
      setErrMsg('Vui lòng đồng ý điều khoản trước khi thanh toán.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrMsg('Email không hợp lệ.');
      return;
    }

    try {
      const { booking, paymentUrl } = await createMut.mutateAsync();
      // Hand the URL to the system browser. `openAuthSessionAsync` returns
      // when our `sgsland://` redirect fires — at which point we route to
      // the booking detail (which polls for the IPN result).
      const result = await WebBrowser.openAuthSessionAsync(paymentUrl, 'sgsland://');
      // result.type ∈ 'cancel' | 'dismiss' | 'success' | 'locked'.
      // On 'success' we get the redirect URL with our `?status=` param;
      // forward that to the detail screen so the buyer sees an immediate
      // provisional result (the screen still polls for the authoritative
      // IPN state).
      let provisionalStatus: string | null = null;
      // expo-web-browser's `WebBrowserAuthSessionResult` only declares `url`
      // on the `success` variant, but the runtime shape is uniform. Narrow
      // with an in-place type guard so we avoid `as any`.
      const isSuccessWithUrl = (
        r: WebBrowser.WebBrowserAuthSessionResult,
      ): r is WebBrowser.WebBrowserRedirectResult =>
        r.type === 'success' && typeof (r as { url?: unknown }).url === 'string';
      if (isSuccessWithUrl(result)) {
        const m = result.url.match(/[?&]status=([^&#]+)/);
        if (m) provisionalStatus = decodeURIComponent(m[1]);
      }
      router.replace(
        provisionalStatus
          ? `/bookings/${booking.id}?status=${encodeURIComponent(provisionalStatus)}`
          : `/bookings/${booking.id}`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as { error?: unknown } | null | undefined;
        const msg = payload && typeof payload.error === 'string' ? payload.error : err.message;
        setErrMsg(msg);
      } else {
        setErrMsg('Không thể tạo đơn đặt cọc. Vui lòng thử lại.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹  Quay lại</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Đặt cọc giữ chỗ</Text>
        <View style={{ width: 64 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SẢN PHẨM</Text>
            <Text style={styles.cardTitle} numberOfLines={3}>{title}</Text>
            {params.unitId ? (
              // Unit pre-selected from the listing detail (e.g. project floor
              // plan with multiple inventory units). When dự án có nhiều
              // căn/lô, the upstream screen passes ?unitId=… so the deposit
              // is tagged to the exact unit. A future iteration can replace
              // this read-only line with an in-screen picker.
              <Text style={styles.subValue}>Đơn vị: {String(params.unitId)}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>SỐ TIỀN ĐẶT CỌC</Text>
            <Text style={styles.amountDisplay}>{formatVnd(amount)}</Text>
            <View style={styles.presetRow}>
              {PRESET_AMOUNTS.map((p) => {
                const active = p === amount;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setAmount(p)}
                    style={[styles.preset, active && styles.presetActive]}
                  >
                    <Text style={[styles.presetTxt, active && styles.presetTxtActive]}>
                      {(p / 1_000_000).toLocaleString('vi-VN')}M
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              Khoản cọc giữ chỗ sẽ được khấu trừ vào giá trị hợp đồng. Liên hệ
              chuyên viên để biết chính sách hoàn cọc của từng dự án.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>EMAIL NHẬN BIÊN NHẬN (TUỲ CHỌN)</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.termsRow}>
              <Switch
                value={agreed}
                onValueChange={setAgreed}
                trackColor={{ true: colors.brand, false: colors.border }}
              />
              <Text style={styles.termsTxt}>
                Tôi đồng ý với{' '}
                <Text style={styles.termsLink}>điều khoản đặt cọc giữ chỗ</Text>
                {' '}của SGS Land và chính sách hoàn cọc của chủ đầu tư.
              </Text>
            </View>
          </View>

          {errMsg ? (
            <View style={styles.errBox}>
              <Text style={styles.errTxt}>{errMsg}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handlePay}
            disabled={createMut.isPending}
            style={({ pressed }) => [
              styles.payBtn,
              (pressed || createMut.isPending) && styles.payBtnPressed,
            ]}
          >
            {createMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnTxt}>Thanh toán qua VNPay · {formatVnd(amount)}</Text>
            )}
          </Pressable>
          <Text style={styles.footHint}>
            Thanh toán bảo mật qua cổng VNPay. SGS Land không lưu thông tin thẻ.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
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
  cardTitle: { fontSize: typography.base, color: colors.textPrimary, fontWeight: '700' },
  subValue: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 4 },
  amountDisplay: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.brand,
    marginBottom: spacing.md,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  presetActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  presetTxt: { fontSize: typography.sm, fontWeight: '700', color: colors.textSecondary },
  presetTxtActive: { color: colors.brand },
  hint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.bgBase,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  termsRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  termsTxt: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: { color: colors.brand, fontWeight: '700' },
  errBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errTxt: { color: '#991B1B', fontSize: typography.sm, fontWeight: '600' },
  payBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnPressed: { opacity: 0.85 },
  payBtnTxt: { color: '#fff', fontWeight: '800', fontSize: typography.base },
  footHint: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: typography.xs,
    marginTop: spacing.md,
  },
});
