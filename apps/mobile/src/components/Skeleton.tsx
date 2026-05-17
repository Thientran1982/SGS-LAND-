import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/tokens';
interface Props {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}
export const Skeleton: React.FC<Props> = ({ width = '100%', height = 16, borderRadius = radius.sm, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};
export const ListingCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    <Skeleton height={180} borderRadius={radius.md} />
    <View style={{ height: 12 }} />
    <Skeleton width="70%" height={18} />
    <View style={{ height: 8 }} />
    <Skeleton width="50%" height={14} />
    <View style={{ height: 8 }} />
    <Skeleton width="40%" height={14} />
  </View>
);
const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgMuted,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
});