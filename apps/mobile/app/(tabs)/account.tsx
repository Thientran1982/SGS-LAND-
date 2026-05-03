import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import {
  getCachedPushPreference,
  getDeviceId,
  setCachedPushPreference,
} from '../../src/storage/device';
import { ensurePushRegistration } from '../../src/notifications/registerPushToken';
import { pushApi } from '../../src/api/push';
import { useAuth } from '../../src/auth/AuthContext';
import { buyerAuthApi } from '../../src/api/buyerAuth';
import { buyerApi } from '../../src/api/buyer';
import { ApiError } from '../../src/api/client';

const HOTLINE = '+84971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const ZALO_URL = 'https://zalo.me/0971132378';
const WEBSITE = 'https://sgsland.vn';

function formatPhoneDisplay(p: string): string {
  // 0987654321 → 0987 654 321
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.length === 11) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return p;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

const STAGE_LABEL: Record<string, string> = {
  NEW: 'Mới gửi',
  CONTACTED: 'Đã liên hệ',
  QUALIFIED: 'Đã tư vấn',
  WON: 'Thành công',
  LOST: 'Không thành',
  NURTURING: 'Đang chăm sóc',
};

interface RowProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}
const Row: React.FC<RowProps> = ({ icon, title, subtitle, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    android_ripple={{ color: colors.brandSoft }}
  >
    <Text style={styles.rowIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>
);

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Hydrate push preference from cache; default ON if never decided.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedPushPreference();
      if (cancelled) return;
      setPushEnabled(cached !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Buyer-only data: leads + saved searches ─────────────────────────────
  const leadsQuery = useQuery({
    queryKey: ['buyer', 'leads', user?.id],
    queryFn: () => buyerApi.listLeads(20),
    enabled: !!user,
    staleTime: 30_000,
  });
  const searchesQuery = useQuery({
    queryKey: ['buyer', 'searches', user?.id],
    queryFn: () => buyerApi.listSearches(),
    enabled: !!user,
    staleTime: 30_000,
  });

  // Refetch on focus so a new lead submitted from the listing detail shows up.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        leadsQuery.refetch();
        searchesQuery.refetch();
      }
    }, [user]),  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      const prev = pushEnabled;
      setPushEnabled(next);
      await setCachedPushPreference(next);
      try {
        if (next) {
          const r = await ensurePushRegistration({ forcePromptIfUndecided: true });
          if (!r.ok) {
            setPushEnabled(false);
            await setCachedPushPreference(false);
            if (r.reason === 'permission-denied') {
              Alert.alert(
                'Cần cấp quyền thông báo',
                'Vui lòng bật thông báo trong Cài đặt để nhận tin BĐS mới.',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
                ],
              );
            } else if (r.reason === 'no-device') {
              Alert.alert('Không hỗ trợ', 'Thông báo đẩy chỉ hoạt động trên thiết bị thật.');
            }
          } else {
            try {
              const deviceId = await getDeviceId();
              await pushApi.setPreference(deviceId, true);
            } catch {
              /* best-effort */
            }
          }
        } else {
          try {
            const deviceId = await getDeviceId();
            await pushApi.setPreference(deviceId, false);
          } catch {
            /* best-effort */
          }
        }
      } catch {
        setPushEnabled(prev);
        await setCachedPushPreference(prev);
      } finally {
        setPushBusy(false);
      }
    },
    [pushBusy, pushEnabled],
  );

  const handleSignOut = useCallback(async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          queryClient.removeQueries({ queryKey: ['buyer'] });
          queryClient.removeQueries({ queryKey: ['favorites'] });
        },
      },
    ]);
  }, [signOut, queryClient]);

  const leads = leadsQuery.data?.leads || [];
  const searches = searchesQuery.data?.searches || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Hero / login state ─────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user ? '👤' : '👋'}</Text>
          </View>
          {user ? (
            <>
              <Text style={styles.heroTitle}>{user.displayName || formatPhoneDisplay(user.phone)}</Text>
              <Text style={styles.heroSub}>
                {user.displayName ? formatPhoneDisplay(user.phone) : 'Chào mừng quay lại với SGS Land'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>Khách</Text>
              <Text style={styles.heroSub}>
                Đăng nhập để đồng bộ yêu thích, theo dõi yêu cầu tư vấn và nhận thông báo.
              </Text>
              <Pressable
                style={[styles.loginBtn, styles.loginBtnActive]}
                onPress={() => setLoginOpen(true)}
                disabled={authLoading}
              >
                <Text style={[styles.loginBtnText, styles.loginBtnTextActive]}>
                  {authLoading ? 'Đang tải…' : 'Đăng nhập bằng số điện thoại'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ── My searches ────────────────────────────────────────── */}
        {user ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tìm kiếm đã lưu</Text>
            <View style={styles.card}>
              {searchesQuery.isLoading ? (
                <View style={styles.cardLoading}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : searches.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Chưa có tìm kiếm nào</Text>
                  <Text style={styles.emptySub}>
                    Lưu bộ lọc trên màn hình Tìm kiếm để nhận thông báo khi có tin BĐS mới phù hợp.
                  </Text>
                  <Pressable onPress={() => router.push('/(tabs)/search')} style={styles.emptyCta}>
                    <Text style={styles.emptyCtaText}>Đi tới Tìm kiếm</Text>
                  </Pressable>
                </View>
              ) : (
                searches.slice(0, 5).map((s, idx) => (
                  <View key={s.id}>
                    {idx > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.row}>
                      <Text style={styles.rowIcon}>🔎</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {s.label}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {s.notificationsEnabled ? '🔔 Thông báo bật' : 'Thông báo tắt'}
                          {s.lastNotifiedAt ? ` • ${formatRelative(s.lastNotifiedAt)}` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* ── My leads ───────────────────────────────────────────── */}
        {user ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Yêu cầu tư vấn của tôi</Text>
            <View style={styles.card}>
              {leadsQuery.isLoading ? (
                <View style={styles.cardLoading}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : leads.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Chưa có yêu cầu nào</Text>
                  <Text style={styles.emptySub}>
                    Khi bạn nhấn "Quan tâm" trên một sản phẩm, yêu cầu sẽ hiển thị tại đây.
                  </Text>
                </View>
              ) : (
                leads.slice(0, 8).map((lead, idx) => (
                  <Pressable
                    key={lead.id}
                    onPress={() => {
                      if (lead.listingId) router.push(`/bds/${lead.listingId}`);
                    }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    {idx > 0 ? <View style={styles.divider} /> : null}
                    <Text style={styles.rowIcon}>📨</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {lead.listingTitle || lead.listingCode || 'Yêu cầu tư vấn'}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {STAGE_LABEL[lead.stage || 'NEW'] || lead.stage || 'Mới gửi'}
                        {lead.tenantName ? ` • ${lead.tenantName}` : ''}
                        {' • '}{formatRelative(lead.createdAt)}
                      </Text>
                    </View>
                    {lead.listingId ? <Text style={styles.chevron}>›</Text> : null}
                  </Pressable>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* ── Contact ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Liên hệ SGS Land</Text>
          <View style={styles.card}>
            <Row icon="📞" title="Gọi hotline" subtitle={HOTLINE_DISPLAY} onPress={() => Linking.openURL(`tel:${HOTLINE}`)} />
            <View style={styles.divider} />
            <Row icon="💬" title="Chat Zalo" subtitle="Tư vấn trực tiếp 24/7" onPress={() => Linking.openURL(ZALO_URL)} />
            <View style={styles.divider} />
            <Row icon="🌐" title="Website" subtitle="sgsland.vn" onPress={() => Linking.openURL(WEBSITE)} />
          </View>
        </View>

        {/* ── Notifications ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Thông báo</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Tin BĐS mới khớp tìm kiếm</Text>
                <Text style={styles.rowSub}>
                  Nhận thông báo đẩy khi có bất động sản mới phù hợp với tìm kiếm đã lưu.
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                disabled={pushBusy}
                trackColor={{ false: colors.border, true: colors.brandSoft }}
                thumbColor={pushEnabled ? colors.brand : colors.bgSurface}
              />
            </View>
          </View>
        </View>

        {/* ── Account actions ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Về ứng dụng</Text>
          <View style={styles.card}>
            <Row icon="ℹ️" title="Phiên bản" subtitle="0.2.0 (Phase 1 — Buyer)" />
            {user ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={handleSignOut}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowIcon}>🚪</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Đăng xuất</Text>
                  </View>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <LoginSheet visible={loginOpen} onClose={() => setLoginOpen(false)} />
    </SafeAreaView>
  );
}

// ─── Login modal ────────────────────────────────────────────────────────────

const PHONE_RE = /^(0|\+84)\d{9,10}$/;

const LoginSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Reset on close.
  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => {
        setStep('phone');
        setPhone('');
        setCode('');
        setError(null);
        setSubmitting(false);
        setResendCooldown(0);
        setDevCode(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Resend cooldown timer (60s).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const phoneOk = useMemo(() => PHONE_RE.test(phone.replace(/\s+/g, '')), [phone]);
  const codeOk = useMemo(() => /^\d{4,8}$/.test(code.trim()), [code]);

  const handleRequest = useCallback(async () => {
    if (!phoneOk || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await buyerAuthApi.requestOtp(phone.replace(/\s+/g, ''));
      setStep('otp');
      setResendCooldown(60);
      if (r.devCode) setDevCode(r.devCode);
      Haptics.selectionAsync().catch(() => {});
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không gửi được OTP';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [phone, phoneOk, submitting]);

  const handleVerify = useCallback(async () => {
    if (!codeOk || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await buyerAuthApi.verifyOtp(phone.replace(/\s+/g, ''), code.trim());
      await signIn(r.token, r.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err instanceof ApiError ? err.message : 'OTP không đúng';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [phone, code, codeOk, submitting, signIn, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{step === 'phone' ? 'Đăng nhập' : 'Nhập mã OTP'}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView contentContainerStyle={styles.modalBody}>
            {step === 'phone' ? (
              <>
                <Text style={styles.modalHint}>
                  Nhập số điện thoại để nhận mã OTP qua tin nhắn. Bằng cách tiếp tục, bạn đồng ý với
                  Điều khoản sử dụng của SGS Land.
                </Text>
                <Text style={styles.fieldLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    setError(null);
                  }}
                  placeholder="0971 132 378"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={handleRequest}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  onPress={handleRequest}
                  disabled={!phoneOk || submitting}
                  style={[styles.submitBtn, (!phoneOk || submitting) && { opacity: 0.5 }]}
                >
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitText}>Gửi mã OTP</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalHint}>
                  Mã OTP đã được gửi đến <Text style={{ fontWeight: '700' }}>{formatPhoneDisplay(phone)}</Text>.
                  {' '}Mã có hiệu lực trong 5 phút.
                </Text>
                {devCode ? (
                  <View style={styles.devBanner}>
                    <Text style={styles.devBannerText}>DEV: mã OTP = {devCode}</Text>
                  </View>
                ) : null}
                <Text style={styles.fieldLabel}>Mã OTP (6 chữ số)</Text>
                <TextInput
                  style={[styles.input, styles.inputOtp]}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t.replace(/\D/g, ''));
                    setError(null);
                  }}
                  placeholder="••••••"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  onPress={handleVerify}
                  disabled={!codeOk || submitting}
                  style={[styles.submitBtn, (!codeOk || submitting) && { opacity: 0.5 }]}
                >
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitText}>Xác nhận</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleRequest}
                  disabled={resendCooldown > 0 || submitting}
                  style={styles.resendBtn}
                >
                  <Text style={[styles.resendText, (resendCooldown > 0 || submitting) && { opacity: 0.5 }]}>
                    {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setStep('phone')} style={styles.resendBtn}>
                  <Text style={styles.resendText}>Đổi số điện thoại</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { paddingBottom: spacing.xxxl },
  hero: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 36 },
  heroTitle: { fontSize: typography.xl, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  heroSub: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
    maxWidth: 320,
  },
  loginBtn: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    opacity: 0.7,
  },
  loginBtnActive: { backgroundColor: colors.brand, opacity: 1 },
  loginBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: typography.sm },
  loginBtnTextActive: { color: 'white' },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionLabel: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardLoading: { padding: spacing.lg, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.bgMuted },
  rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  rowTitle: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: typography.sm, color: colors.textTertiary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, fontWeight: '400' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 28 + spacing.md,
  },
  emptyBox: { padding: spacing.lg, alignItems: 'flex-start' },
  emptyTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: typography.sm, color: colors.textTertiary, lineHeight: 20 },
  emptyCta: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
  },
  emptyCtaText: { color: colors.brand, fontWeight: '700', fontSize: typography.sm },

  // Modal
  modalRoot: { flex: 1, backgroundColor: colors.bgBase },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  modalTitle: { flex: 1, fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary },
  modalClose: { padding: spacing.xs },
  modalCloseText: { fontSize: 20, color: colors.textSecondary },
  modalBody: { padding: spacing.lg },
  modalHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  inputOtp: {
    fontSize: typography.xxl,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
  errorText: { color: '#DC2626', fontSize: typography.sm, marginTop: spacing.sm },
  submitBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitText: { color: 'white', fontWeight: '800', fontSize: typography.base },
  resendBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  resendText: { color: colors.brand, fontWeight: '700', fontSize: typography.sm },
  devBanner: {
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  devBannerText: { color: '#92400E', fontSize: typography.sm, fontWeight: '700', textAlign: 'center' },
});
