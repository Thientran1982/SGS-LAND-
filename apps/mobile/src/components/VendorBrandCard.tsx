import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { ListingBranding } from '../api/types';
interface Props {
  branding: ListingBranding | null | undefined;
  fallbackContact?: { name?: string | null; phone?: string | null };
  accent: string;
}
// Vendor brand card — surfaces the white-label tenant identity (logo +
// displayName + contact channels) directly on the listing detail. When no
// custom branding is configured, falls back to the listing's own contact
// info so the card always renders.
export const VendorBrandCard: React.FC<Props> = ({ branding, fallbackContact, accent }) => {
  const name = branding?.displayName || fallbackContact?.name || 'SGSLand';
  const logo = branding?.logoUrl || null;
  const hotline = branding?.hotline || fallbackContact?.phone || null;
  const hotlineDisplay = branding?.hotlineDisplay || hotline;
  const zalo = branding?.zalo || (hotline ? `https://zalo.me/${hotline.replace(/^\+?84/, '0').replace(/\D/g, '')}` : null);
  const messenger = branding?.messenger || null;
  const initial = name.trim().charAt(0).toUpperCase() || 'S';
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đơn vị phân phối</Text>
      <View style={styles.row}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <View style={[styles.logoFallback, { backgroundColor: `${accent}20`, borderColor: accent }]}>
            <Text style={[styles.logoInitial, { color: accent }]}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.tagline}>Đối tác chính thức của SGSLand</Text>
        </View>
      </View>
      {(hotline || zalo || messenger) ? (
        <View style={styles.channels}>
          {hotline ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${hotline}`)}
              style={[styles.channelBtn, { borderColor: accent }]}
              android_ripple={{ color: `${accent}30` }}
            >
              <Text style={styles.channelIcon}>📞</Text>
              <Text style={[styles.channelText, { color: accent }]} numberOfLines={1}>
                {hotlineDisplay}
              </Text>
            </Pressable>
          ) : null}
          {zalo ? (
            <Pressable
              onPress={() => Linking.openURL(zalo)}
              style={[styles.channelBtn, { borderColor: colors.border }]}
              android_ripple={{ color: colors.brandSoft }}
            >
              <Text style={styles.channelIcon}>💬</Text>
              <Text style={styles.channelText}>Zalo</Text>
            </Pressable>
          ) : null}
          {messenger ? (
            <Pressable
              onPress={() => Linking.openURL(messenger)}
              style={[styles.channelBtn, { borderColor: colors.border }]}
              android_ripple={{ color: colors.brandSoft }}
            >
              <Text style={styles.channelIcon}>📨</Text>
              <Text style={styles.channelText}>Messenger</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 8,
    borderBottomColor: colors.bgMuted,
  },
  title: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
  },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoInitial: { fontSize: 26, fontWeight: '800' },
  name: { fontSize: typography.base, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  tagline: { fontSize: typography.xs, color: colors.textTertiary },
  channels: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgBase,
  },
  channelIcon: { fontSize: 14 },
  channelText: { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
});