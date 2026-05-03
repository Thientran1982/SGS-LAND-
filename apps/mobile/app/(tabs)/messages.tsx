import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, spacing, typography } from '../../src/theme/tokens';

// Sprint 5 placeholder. The actual buyer↔vendor messaging UI requires the
// Socket.io client + buyer auth (Sprint 3) — both are documented as follow-up
// tasks. This screen exists so the 5-tab IA from the task spec is in place
// from day one and so deep-link push notifications (Sprint 4) have a route to
// land on without crashing the app.
export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin nhắn</Text>
        <Text style={styles.subtitle}>Trao đổi trực tiếp với chuyên viên</Text>
      </View>
      <EmptyState
        icon="💬"
        title="Tính năng đang được hoàn thiện"
        subtitle="Tin nhắn realtime với chuyên viên sẽ sớm có mặt. Trong lúc chờ, vui lòng dùng nút Gọi hoặc Zalo trên trang sản phẩm để được tư vấn ngay."
      />
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
});
