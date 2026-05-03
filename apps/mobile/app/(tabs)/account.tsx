import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

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
