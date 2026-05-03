import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatVnd } from '../utils/format';

interface Props {
  price: number | null;
  accent: string;
}

const DOWN_OPTIONS = [20, 30, 50, 70];
const TERM_OPTIONS = [10, 15, 20, 25];
const RATE_DEFAULT = 10.5; // % / năm — default tham khảo VCB/BIDV

// Standard mortgage payment formula. Returns monthly payment for a fully
// amortizing loan of `principal` at annual `rateAnnual`% over `years`.
function monthlyPayment(principal: number, rateAnnual: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = rateAnnual / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export const PaymentCalculator: React.FC<Props> = ({ price, accent }) => {
  const [downPct, setDownPct] = useState<number>(30);
  const [termYears, setTermYears] = useState<number>(20);
  const [rateText, setRateText] = useState<string>(String(RATE_DEFAULT));

  const rate = useMemo(() => {
    const n = parseFloat(rateText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : RATE_DEFAULT;
  }, [rateText]);

  if (!price || price <= 0) return null;

  const downAmount = (price * downPct) / 100;
  const loan = price - downAmount;
  const monthly = monthlyPayment(loan, rate, termYears);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tính khoản vay</Text>
      <Text style={styles.hint}>Ước tính khoản trả góp hàng tháng (lãi suất tham khảo).</Text>

      <Text style={styles.label}>Trả trước</Text>
      <View style={styles.chipRow}>
        {DOWN_OPTIONS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setDownPct(p)}
            style={[styles.chip, downPct === p && { borderColor: accent, backgroundColor: `${accent}15` }]}
          >
            <Text style={[styles.chipText, downPct === p && { color: accent }]}>{p}%</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Thời hạn vay</Text>
      <View style={styles.chipRow}>
        {TERM_OPTIONS.map((y) => (
          <Pressable
            key={y}
            onPress={() => setTermYears(y)}
            style={[styles.chip, termYears === y && { borderColor: accent, backgroundColor: `${accent}15` }]}
          >
            <Text style={[styles.chipText, termYears === y && { color: accent }]}>{y} năm</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Lãi suất (% / năm)</Text>
      <TextInput
        style={styles.input}
        value={rateText}
        onChangeText={setRateText}
        keyboardType="decimal-pad"
        placeholder={String(RATE_DEFAULT)}
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.summaryBox}>
        <Row label="Trả trước" value={formatVnd(downAmount)} />
        <Row label="Khoản vay" value={formatVnd(loan)} />
        <View style={styles.divider} />
        <Row
          label="Trả hàng tháng"
          value={formatVnd(monthly)}
          highlight
          accent={accent}
        />
      </View>
      <Text style={styles.disclaimer}>
        * Đây chỉ là ước tính tham khảo. Lãi suất thực tế phụ thuộc vào ngân hàng và hồ sơ tín dụng.
      </Text>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; highlight?: boolean; accent?: string }> = ({
  label,
  value,
  highlight,
  accent,
}) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, highlight && styles.rowLabelHi]}>{label}</Text>
    <Text style={[styles.rowValue, highlight && { color: accent || colors.brand, fontSize: typography.lg }]}>
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
  title: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  hint: { fontSize: typography.sm, color: colors.textTertiary, marginBottom: spacing.md },
  label: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  chipText: { fontSize: typography.sm, fontWeight: '700', color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.base,
    color: colors.textPrimary,
    backgroundColor: colors.bgBase,
  },
  summaryBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: { fontSize: typography.sm, color: colors.textSecondary },
  rowLabelHi: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  rowValue: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  disclaimer: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
