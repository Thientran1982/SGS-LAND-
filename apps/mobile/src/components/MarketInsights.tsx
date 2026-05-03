import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatVnd } from '../utils/format';
import type { PublicListing } from '../api/types';

interface Props {
  item: PublicListing;
  similar: PublicListing[] | undefined;
  accent: string;
}

// Lightweight on-device "AI insight" — derives a market summary from the
// similar-listings sample the server already returns. We deliberately keep the
// heuristic transparent (no LLM call here) so it's fast, deterministic, and
// works offline. The full AI valuation pipeline lives server-side and is wired
// in via /api/valuation/* in a follow-up sprint.
export const MarketInsights: React.FC<Props> = ({ item, similar, accent }) => {
  const stats = useMemo(() => {
    const pool = (similar || []).filter(
      (s) => s.id !== item.id && typeof s.price === 'number' && typeof s.area === 'number' && s.area! > 0,
    );
    if (pool.length < 2 || !item.price || !item.area || item.area <= 0) return null;

    const myUnit = item.price / item.area;
    const unitPrices = pool
      .map((s) => (s.price as number) / (s.area as number))
      .sort((a, b) => a - b);

    const avg = unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;
    const median = unitPrices[Math.floor(unitPrices.length / 2)];
    const min = unitPrices[0];
    const max = unitPrices[unitPrices.length - 1];

    const diffPct = ((myUnit - avg) / avg) * 100;
    let verdict: 'good' | 'fair' | 'high';
    if (diffPct <= -5) verdict = 'good';
    else if (diffPct >= 8) verdict = 'high';
    else verdict = 'fair';

    return { myUnit, avg, median, min, max, diffPct, verdict, sample: pool.length };
  }, [item, similar]);

  if (!stats) return null;

  const verdictCopy: Record<typeof stats.verdict, { icon: string; title: string; sub: string; color: string }> = {
    good: {
      icon: '✓',
      title: 'Giá hấp dẫn',
      sub: `Thấp hơn mặt bằng khu vực ~${Math.abs(stats.diffPct).toFixed(0)}% — đáng cân nhắc.`,
      color: colors.verified,
    },
    fair: {
      icon: '≈',
      title: 'Giá hợp lý',
      sub: `Sát mặt bằng khu vực (chênh ${stats.diffPct >= 0 ? '+' : ''}${stats.diffPct.toFixed(0)}%).`,
      color: accent,
    },
    high: {
      icon: '!',
      title: 'Giá cao hơn mặt bằng',
      sub: `Cao hơn ~${stats.diffPct.toFixed(0)}% — nên đàm phán hoặc xem thêm sản phẩm tương tự.`,
      color: '#F59E0B',
    },
  };
  const v = verdictCopy[stats.verdict];

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.titleIcon}>📊</Text>
        <Text style={styles.title}>Phân tích thị trường</Text>
      </View>

      <View style={[styles.verdictBox, { borderColor: v.color, backgroundColor: `${v.color}10` }]}>
        <View style={[styles.verdictIconWrap, { backgroundColor: v.color }]}>
          <Text style={styles.verdictIcon}>{v.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictTitle, { color: v.color }]}>{v.title}</Text>
          <Text style={styles.verdictSub}>{v.sub}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Cell label="Đơn giá sản phẩm" value={`${formatVnd(stats.myUnit)}/m²`} accent={accent} bold />
        <Cell label="Trung bình khu vực" value={`${formatVnd(stats.avg)}/m²`} />
        <Cell label="Mức thấp nhất" value={`${formatVnd(stats.min)}/m²`} />
        <Cell label="Mức cao nhất" value={`${formatVnd(stats.max)}/m²`} />
      </View>

      <Text style={styles.footnote}>
        Dựa trên {stats.sample} sản phẩm tương tự trong khu vực. Đây là phân tích tham khảo, không thay thế tư vấn chuyên môn.
      </Text>
    </View>
  );
};

const Cell: React.FC<{ label: string; value: string; bold?: boolean; accent?: string }> = ({
  label,
  value,
  bold,
  accent,
}) => (
  <View style={styles.cell}>
    <Text style={styles.cellLabel}>{label}</Text>
    <Text style={[styles.cellValue, bold && { color: accent || colors.brand, fontSize: typography.base }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 8,
    borderBottomColor: colors.bgMuted,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  titleIcon: { fontSize: 18 },
  title: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary },
  verdictBox: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  verdictIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictIcon: { color: 'white', fontWeight: '800', fontSize: 18 },
  verdictTitle: { fontSize: typography.base, fontWeight: '800', marginBottom: 2 },
  verdictSub: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: spacing.sm, paddingRight: spacing.md },
  cellLabel: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cellValue: { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
  footnote: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
