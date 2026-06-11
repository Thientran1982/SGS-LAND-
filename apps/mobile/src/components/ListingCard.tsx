import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';
import { formatArea, formatUnitPrice, formatVnd, propertyTypeLabel, statusLabel, transactionLabel } from '../utils/format';
import type { PublicListing } from '../api/types';
interface Props {
  item: PublicListing;
  onPress: (item: PublicListing) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
}
const STATUS_BG: Record<string, string> = {
  AVAILABLE: '#ECFDF5',
  BOOKING: '#E0F2FE',
  OPENING: '#E8EEF5',
};
const STATUS_FG: Record<string, string> = {
  AVAILABLE: 'var(--sgs-verified)',
  BOOKING: '#0369A1',
  OPENING: 'var(--sgs-primary-deep)',
};
const PLACEHOLDER = 'https://placehold.co/800x600?text=No+Image';

const ListingCardImpl: React.FC<Props> = ({ item, onPress, onToggleFavorite, isFavorite }) => {
  const cover = item.images?.[0] || PLACEHOLDER;
  const unit = formatUnitPrice(item.price, item.area);
  const statusBg = STATUS_BG[item.status] || colors.bgMuted;
  const statusFg = STATUS_FG[item.status] || colors.textSecondary;
  const handleFav = () => {
    if (!onToggleFavorite) return;
    Haptics.selectionAsync().catch(() => {});
    onToggleFavorite(item.id);
  };
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item)}
      android_ripple={{ color: colors.brandSoft }}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: cover }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          placeholder={{ uri: PLACEHOLDER }}
        />
        <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusFg }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
        {item.isVerified ? (
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>✓ Đã xác thực</Text>
          </View>
        ) : null}
        {onToggleFavorite ? (
          <Pressable
            onPress={handleFav}
            hitSlop={10}
            style={styles.favBtn}
            accessibilityLabel={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          >
            <Text style={[styles.favIcon, isFavorite && styles.favIconOn]}>
              {isFavorite ? '♥' : '♡'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatVnd(item.price)}</Text>
          {unit ? <Text style={styles.unitPrice}>{unit}</Text> : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            📍 {item.location || 'Đang cập nhật'}
          </Text>
        </View>
        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{propertyTypeLabel(item.type)}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{transactionLabel(item.transaction)}</Text>
          </View>
          {item.area ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{formatArea(item.area)}</Text>
            </View>
          ) : null}
          {item.bedrooms ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.bedrooms} PN</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};
export const ListingCard = memo(ListingCardImpl);
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: colors.bgMuted,
  },
  image: {
    width: '100%',
    height: 200,
  },
  statusPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  verifiedPill: {
    position: 'absolute',
    top: spacing.md,
    left: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#ECFDF5',
  },
  verifiedText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.verified,
  },
  favBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favIcon: {
    fontSize: 22,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  favIconOn: {
    color: '#F43F5E',
  },
  body: {
    padding: spacing.md,
  },
  title: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  price: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.brand,
    marginRight: spacing.sm,
  },
  unitPrice: {
    fontSize: typography.sm,
    color: colors.textTertiary,
  },
  metaRow: {
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});