import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { listingsApi } from '../../src/api/listings';
import { conversationsApi } from '../../src/api/conversations';
import type { PublicListing } from '../../src/api/types';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { ListingCard } from '../../src/components/ListingCard';
import { EmptyState } from '../../src/components/EmptyState';
import { PaymentCalculator } from '../../src/components/PaymentCalculator';
import { MarketInsights } from '../../src/components/MarketInsights';
import { VendorBrandCard } from '../../src/components/VendorBrandCard';
import { loadFavorites, toggleFavorite } from '../../src/storage/favorites';
import { colors, radius, shadow, spacing, typography } from '../../src/theme/tokens';
import {
  formatArea,
  formatUnitPrice,
  formatVnd,
  isValidVnPhone,
  propertyTypeLabel,
  slugify,
  statusLabel,
  transactionLabel,
} from '../../src/utils/format';

const SCREEN_W = Dimensions.get('window').width;
const HOTLINE_FALLBACK = '+84971132378';

// `slugId` looks like "vinhomes-grand-park-<uuid>" or just "<uuid>". Server
// extracts the trailing UUID itself, so the mobile client just forwards the
// raw segment.
function extractIdSuffix(slugId: string): string {
  const m = String(slugId || '').match(/[0-9a-f-]{36}$/i);
  return m ? m[0] : slugId;
}

export default function ListingDetailScreen() {
  const { slugId } = useLocalSearchParams<{ slugId: string }>();
  const router = useRouter();
  const id = extractIdSuffix(String(slugId || ''));

  const [imgIdx, setImgIdx] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [chatOpening, setChatOpening] = useState(false);
  const { user: buyerUser } = useAuth();

  // Load favorite state for this listing on mount.
  useEffect(() => {
    if (!id) return;
    loadFavorites().then((s) => setIsFav(s.has(id)));
  }, [id]);

  const detailQuery = useQuery({
    queryKey: ['listings', 'detail', id],
    queryFn: ({ signal }) => listingsApi.detail(String(slugId), signal),
    enabled: !!id,
  });

  const similarQuery = useQuery({
    queryKey: ['listings', 'similar', id],
    queryFn: ({ signal }) => listingsApi.similar(String(slugId), signal),
    enabled: !!detailQuery.data,
  });

  const item = detailQuery.data;

  // Branding-aware accent color (white-label support — task #28 piggyback).
  const accent = item?.branding?.primaryColor || colors.brand;
  const hotline = item?.branding?.hotline || item?.contactPhone || HOTLINE_FALLBACK;
  const hotlineDisplay = item?.branding?.hotlineDisplay || hotline;
  const zalo = item?.branding?.zalo || `https://zalo.me/${hotline.replace(/^\+?84/, '0').replace(/\D/g, '')}`;

  const handleShare = useCallback(async () => {
    if (!item) return;
    const slug = slugify(item.title || item.code || item.location || 'bat-dong-san') || 'bat-dong-san';
    const url = `https://sgsland.vn/bds/${slug}-${item.id}`;
    try {
      await Share.share({ message: `${item.title}\n${formatVnd(item.price)} • ${item.location || ''}\n${url}`, url });
    } catch {
      /* user cancelled */
    }
  }, [item]);

  const handleToggleFav = useCallback(async () => {
    if (!id) return;
    Haptics.selectionAsync().catch(() => {});
    const next = await toggleFavorite(id);
    setIsFav(next.has(id));
  }, [id]);

  const handleSimilarOpen = useCallback(
    (other: PublicListing) => {
      const slug = slugify(other.title || other.code || other.location || 'bat-dong-san') || 'bat-dong-san';
      router.push(`/bds/${slug}-${other.id}`);
    },
    [router],
  );

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={accent} />
      </SafeAreaView>
    );
  }
  if (detailQuery.isError || !item) {
    const status = detailQuery.error instanceof ApiError ? detailQuery.error.status : 0;
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <View style={styles.errorHeader}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Quay lại</Text>
          </Pressable>
        </View>
        <EmptyState
          icon={status === 404 ? '🔎' : '⚠️'}
          title={status === 404 ? 'Không tìm thấy sản phẩm' : 'Không tải được sản phẩm'}
          subtitle={
            status === 404
              ? 'Sản phẩm này có thể đã được gỡ hoặc tạm ẩn. Vui lòng liên hệ hotline để được tư vấn.'
              : 'Vui lòng kiểm tra kết nối mạng và thử lại.'
          }
        />
      </SafeAreaView>
    );
  }

  const cover = item.images?.[imgIdx] || item.images?.[0];
  const unit = formatUnitPrice(item.price, item.area);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero gallery ─────────────────────────────────────────── */}
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setImgIdx(idx);
            }}
          >
            {(item.images?.length ? item.images : [cover]).map((img, i) => (
              <Image
                key={`${img}-${i}`}
                source={{ uri: img || 'https://placehold.co/800x600?text=No+Image' }}
                style={{ width: SCREEN_W, height: 280 }}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>

          {item.images && item.images.length > 1 ? (
            <View style={styles.dots}>
              {item.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
              ))}
            </View>
          ) : null}

          <SafeAreaView edges={['top']} style={styles.heroBar} pointerEvents="box-none">
            <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
              <Text style={styles.iconBtnText}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleShare} style={styles.iconBtn} hitSlop={8}>
              <Text style={styles.iconBtnText}>↗</Text>
            </Pressable>
            <Pressable onPress={handleToggleFav} style={styles.iconBtn} hitSlop={8}>
              <Text style={[styles.iconBtnText, isFav && { color: '#F43F5E' }]}>{isFav ? '♥' : '♡'}</Text>
            </Pressable>
          </SafeAreaView>
        </View>

        {/* ── Title + price ───────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
            </View>
            {item.isVerified ? (
              <View style={[styles.statusPill, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.statusText, { color: colors.verified }]}>✓ Đã xác thực</Text>
              </View>
            ) : null}
            {item.code ? <Text style={styles.codeText}>Mã: {item.code}</Text> : null}
          </View>

          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: accent }]}>{formatVnd(item.price)}</Text>
            {unit ? <Text style={styles.unitPrice}>{unit}</Text> : null}
          </View>

          {item.location ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Quick specs ─────────────────────────────────────────── */}
        <View style={styles.specGrid}>
          <SpecCell label="Loại" value={propertyTypeLabel(item.type)} />
          <SpecCell label="Hình thức" value={transactionLabel(item.transaction)} />
          <SpecCell label="Diện tích" value={formatArea(item.area)} />
          {item.bedrooms != null ? <SpecCell label="Phòng ngủ" value={`${item.bedrooms}`} /> : null}
          {item.bathrooms != null ? <SpecCell label="Phòng tắm" value={`${item.bathrooms}`} /> : null}
          {item.floors != null ? <SpecCell label="Số tầng" value={`${item.floors}`} /> : null}
          {item.direction ? <SpecCell label="Hướng" value={item.direction} /> : null}
          {item.legalStatus ? <SpecCell label="Pháp lý" value={item.legalStatus} /> : null}
        </View>

        {/* ── Description ─────────────────────────────────────────── */}
        {item.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.descText}>{item.description.trim()}</Text>
          </View>
        ) : null}

        {/* ── AI market insights ─────────────────────────────────── */}
        <MarketInsights item={item} similar={similarQuery.data} accent={accent} />

        {/* ── Financial calculator ───────────────────────────────── */}
        <PaymentCalculator price={item.price} accent={accent} />

        {/* ── Vendor brand card ──────────────────────────────────── */}
        <VendorBrandCard
          branding={item.branding}
          fallbackContact={{ name: item.contactName, phone: item.contactPhone }}
          accent={accent}
        />

        {/* ── Similar ─────────────────────────────────────────────── */}
        {similarQuery.data && similarQuery.data.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sản phẩm tương tự</Text>
            {similarQuery.data.slice(0, 6).map((s) => (
              <ListingCard key={s.id} item={s} onPress={handleSimilarOpen} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Bottom CTA bar (Zalo / Gọi / Nhắn tin / Quan tâm) ──── */}
      <SafeAreaView edges={['bottom']} style={styles.ctaBarWrap}>
        <View style={styles.ctaBar}>
          <Pressable
            style={[styles.ctaBtn, styles.ctaSecondary]}
            onPress={() => Linking.openURL(zalo)}
            android_ripple={{ color: colors.brandSoft }}
          >
            <Text style={styles.ctaSecondaryText}>💬 Zalo</Text>
          </Pressable>
          <Pressable
            style={[styles.ctaBtn, styles.ctaSecondary]}
            onPress={() => Linking.openURL(`tel:${hotline}`)}
            android_ripple={{ color: colors.brandSoft }}
          >
            <Text style={styles.ctaSecondaryText} numberOfLines={1}>📞 Gọi</Text>
          </Pressable>
          <Pressable
            style={[styles.ctaBtn, styles.ctaSecondary, chatOpening && { opacity: 0.6 }]}
            disabled={chatOpening}
            onPress={async () => {
              if (!item) return;
              if (!buyerUser) {
                Alert.alert(
                  'Cần đăng nhập',
                  'Vui lòng đăng nhập để nhắn tin với chuyên viên tư vấn.',
                  [
                    { text: 'Để sau', style: 'cancel' },
                    { text: 'Đăng nhập', onPress: () => router.push('/account') },
                  ],
                );
                return;
              }
              try {
                setChatOpening(true);
                Haptics.selectionAsync().catch(() => {});
                const r = await conversationsApi.openForListing(item.id);
                router.push({
                  pathname: '/messages/[id]',
                  params: { id: r.conversation.id, title: item.title.slice(0, 80) },
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Không thể mở hội thoại';
                Alert.alert('Lỗi', msg);
              } finally {
                setChatOpening(false);
              }
            }}
            android_ripple={{ color: colors.brandSoft }}
          >
            {chatOpening ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.ctaSecondaryText} numberOfLines={1}>✉️ Nhắn</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.ctaBtn, styles.ctaPrimary, { backgroundColor: accent }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setLeadModalOpen(true);
            }}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            <Text style={styles.ctaPrimaryText}>★ Quan tâm</Text>
          </Pressable>
        </View>
        <Text style={styles.ctaHotlineHint} numberOfLines={1}>
          Hotline: {hotlineDisplay}
        </Text>
      </SafeAreaView>

      {/* ── Lead form modal ─────────────────────────────────────── */}
      <LeadFormModal
        visible={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        listing={item}
        accent={accent}
      />
    </View>
  );
}

// ─── Spec cell ────────────────────────────────────────────────────────────
const SpecCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.specCell}>
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

// ─── Lead form modal ─────────────────────────────────────────────────────
interface LeadFormModalProps {
  visible: boolean;
  onClose: () => void;
  listing: PublicListing;
  accent: string;
}

const LeadFormModal: React.FC<LeadFormModalProps> = ({ visible, onClose, listing, accent }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      listingsApi.submitLead(listing.id, {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSubmitted(true);
    },
    onError: (err) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err instanceof Error ? err.message : 'Không thể gửi yêu cầu';
      Alert.alert('Gửi không thành công', msg);
    },
  });

  const canSubmit = useMemo(() => name.trim().length >= 2 && isValidVnPhone(phone), [name, phone]);

  // Reset form whenever the modal closes so reopening starts fresh.
  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => {
        setName('');
        setPhone('');
        setNotes('');
        setSubmitted(false);
        mutation.reset();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Yêu cầu tư vấn</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Sản phẩm bạn đang quan tâm</Text>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {listing.title}
              </Text>
              <Text style={[styles.summaryPrice, { color: accent }]}>{formatVnd(listing.price)}</Text>
            </View>

            {submitted ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Đã gửi yêu cầu</Text>
                <Text style={styles.successText}>
                  Chuyên viên sẽ liên hệ với bạn trong vòng 30 phút. Cảm ơn bạn đã quan tâm!
                </Text>
                <Pressable onPress={onClose} style={[styles.submitBtn, { backgroundColor: accent, marginTop: spacing.lg }]}>
                  <Text style={styles.submitText}>Đóng</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.formHint}>
                  Để lại thông tin, chuyên viên sẽ liên hệ trong vòng 30 phút.
                </Text>

                <Text style={styles.fieldLabel}>Họ và tên *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                <Text style={styles.fieldLabel}>Số điện thoại *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0971 132 378"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />

                <Text style={styles.fieldLabel}>Ghi chú (tuỳ chọn)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Tôi muốn xem nhà vào cuối tuần..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                <Pressable
                  onPress={() => mutation.mutate()}
                  disabled={!canSubmit || mutation.isPending}
                  style={[
                    styles.submitBtn,
                    { backgroundColor: accent },
                    (!canSubmit || mutation.isPending) && { opacity: 0.5 },
                  ]}
                >
                  {mutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitText}>Gửi yêu cầu tư vấn</Text>
                  )}
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
  center: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorHeader: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  backBtn: { padding: spacing.sm },
  backBtnText: { color: colors.brand, fontSize: typography.base, fontWeight: '600' },

  heroWrap: { position: 'relative', backgroundColor: colors.bgDark },
  heroBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 20, color: colors.textPrimary },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: 'white', width: 18 },

  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 8,
    borderBottomColor: colors.bgMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.brand,
  },
  codeText: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    marginLeft: 'auto',
  },
  title: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  price: { fontSize: typography.display, fontWeight: '800' },
  unitPrice: { fontSize: typography.sm, color: colors.textTertiary, fontWeight: '600' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 14 },
  metaText: { fontSize: typography.sm, color: colors.textSecondary, flex: 1 },

  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 8,
    borderBottomColor: colors.bgMuted,
  },
  specCell: {
    width: '50%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  specLabel: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  specValue: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },

  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  descText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  ctaBarWrap: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.card,
  },
  ctaBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 6,
    gap: spacing.sm,
  },
  ctaBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondary: {
    backgroundColor: colors.bgMuted,
    minWidth: 84,
  },
  ctaSecondaryText: { color: colors.textPrimary, fontWeight: '700', fontSize: typography.base },
  ctaPrimary: { flex: 1 },
  ctaPrimaryText: { color: 'white', fontWeight: '800', fontSize: typography.base },
  ctaHotlineHint: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: typography.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Lead modal
  modalRoot: { flex: 1, backgroundColor: colors.bgBase },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  modalTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMuted,
  },
  modalCloseText: { fontSize: 16, color: colors.textPrimary, fontWeight: '700' },
  modalBody: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  summaryCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  summaryTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  summaryPrice: { fontSize: typography.lg, fontWeight: '800' },

  formHint: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.base,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtn: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: 'white', fontWeight: '800', fontSize: typography.base },

  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  successIcon: { fontSize: 48, marginBottom: spacing.md },
  successTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  successText: { fontSize: typography.sm, color: colors.textTertiary, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
});
