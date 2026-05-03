import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { PublicListing } from '../api/types';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatVnd } from '../utils/format';

interface Props {
  listings: PublicListing[];
  onSelect: (item: PublicListing) => void;
}

// Default region centred on Ho Chi Minh City (the bulk of inventory). When
// listings carry coordinates we recompute a region that fits them all.
const DEFAULT_REGION = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

export const ListingsMap: React.FC<Props> = ({ listings, onSelect }) => {
  const mapRef = useRef<MapView | null>(null);

  const pinned = useMemo(
    () => listings.filter((l) => l.coordinates && Number.isFinite(l.coordinates.lat) && Number.isFinite(l.coordinates.lng)),
    [listings],
  );

  // Re-fit the map whenever the result set changes — `initialRegion` only
  // applies on first mount, so without this the map stays zoomed on the
  // previous filter when the user changes chips while in Map mode.
  useEffect(() => {
    if (pinned.length === 0 || !mapRef.current) return;
    const coords = pinned.map((l) => ({ latitude: l.coordinates!.lat, longitude: l.coordinates!.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, [pinned]);

  const region = useMemo(() => {
    if (pinned.length === 0) return DEFAULT_REGION;
    const lats = pinned.map((l) => l.coordinates!.lat);
    const lngs = pinned.map((l) => l.coordinates!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.4, 0.05);
    const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.05);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [pinned]);

  if (pinned.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>Không có toạ độ để hiển thị trên bản đồ</Text>
        <Text style={styles.emptySub}>
          Các sản phẩm trong kết quả này chưa có toạ độ địa lý. Hãy chuyển về chế độ Danh sách hoặc thử lọc khác.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
      >
        {pinned.map((l) => (
          <Marker
            key={l.id}
            coordinate={{ latitude: l.coordinates!.lat, longitude: l.coordinates!.lng }}
            title={l.title}
            description={l.price ? formatVnd(l.price) : undefined}
            onCalloutPress={() => onSelect(l)}
          >
            <Pressable
              onPress={() => onSelect(l)}
              style={({ pressed }) => [styles.pin, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.pinText} numberOfLines={1}>
                {l.price ? compactPrice(l.price) : '—'}
              </Text>
            </Pressable>
          </Marker>
        ))}
      </MapView>
    </View>
  );
};

function compactPrice(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} tr`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMuted },
  pin: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'white',
    minWidth: 60,
    alignItems: 'center',
  },
  pinText: { color: 'white', fontWeight: '800', fontSize: typography.xs },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  emptySub: { fontSize: typography.sm, color: colors.textTertiary, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
});
