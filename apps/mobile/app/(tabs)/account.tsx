import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import {
  getCachedPushPreference,
  getDeviceId,
  setCachedPushPreference,
} from '../../src/storage/device';
import { ensurePushRegistration } from '../../src/notifications/registerPushToken';
import { pushApi } from '../../src/api/push';

const HOTLINE = '+84971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const ZALO_URL = 'https://zalo.me/0971132378';
const WEBSITE = 'https://sgsland.vn';

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
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);

  // Hydrate from cache on mount; default to ON if never decided.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedPushPreference();
      if (cancelled) return;
      setPushEnabled(cached !== false); // null or true → ON
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      const prev = pushEnabled;
      // Optimistic flip — we'll revert on failure.
      setPushEnabled(next);
      await setCachedPushPreference(next);
      try {
        if (next) {
          // Turning ON: request permission + (re-)register the token.
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
            // Sync server-side preference.
            try {
              const deviceId = await getDeviceId();
              await pushApi.setPreference(deviceId, true);
            } catch {
              /* best-effort */
            }
          }
        } else {
          // Turning OFF: keep the token, just flip the server preference.
          try {
            const deviceId = await getDeviceId();
            await pushApi.setPreference(deviceId, false);
          } catch {
            /* best-effort — local cache is the source of truth on next launch */
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.heroTitle}>Khách</Text>
          <Text style={styles.heroSub}>Đăng nhập để lưu yêu thích, đặt lịch xem nhà và nhận thông báo</Text>
          <Pressable style={styles.loginBtn} disabled>
            <Text style={styles.loginBtnText}>Đăng nhập (sắp ra mắt)</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Liên hệ SGS Land</Text>
          <View style={styles.card}>
            <Row
              icon="📞"
              title="Gọi hotline"
              subtitle={HOTLINE_DISPLAY}
              onPress={() => Linking.openURL(`tel:${HOTLINE}`)}
            />
            <View style={styles.divider} />
            <Row
              icon="💬"
              title="Chat Zalo"
              subtitle="Tư vấn trực tiếp 24/7"
              onPress={() => Linking.openURL(ZALO_URL)}
            />
            <View style={styles.divider} />
            <Row
              icon="🌐"
              title="Website"
              subtitle="sgsland.vn"
              onPress={() => Linking.openURL(WEBSITE)}
            />
          </View>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Về ứng dụng</Text>
          <View style={styles.card}>
            <Row icon="ℹ️" title="Phiên bản" subtitle="0.1.0 (Phase 1 — Buyer)" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  loginBtnText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
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
});
