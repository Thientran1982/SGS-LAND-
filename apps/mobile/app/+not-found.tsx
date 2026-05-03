import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { colors, spacing, typography } from '../src/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔎</Text>
        <Text style={styles.title}>Không tìm thấy trang</Text>
        <Text style={styles.subtitle}>Đường dẫn này không tồn tại hoặc đã bị gỡ.</Text>
        <Link href="/" style={styles.link}>
          ← Về trang chính
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  icon: { fontSize: 64, marginBottom: spacing.lg },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.sm, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.xl },
  link: { fontSize: typography.base, color: colors.brand, fontWeight: '600' },
});
