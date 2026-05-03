// Design tokens mirroring the web app palette (dark-first marketplace).
// Web uses CSS vars (--bg-surface, --glass-border, --text-primary) — here we
// expose plain hex values consumable by React Native StyleSheet. Keep names
// aligned with the web tokens so future white-label theming can map 1:1.

export const colors = {
  // Brand
  brand: '#4F46E5',          // indigo-600 — primary CTA
  brandDark: '#4338CA',
  brandSoft: '#EEF2FF',

  // Backgrounds
  bgBase: '#FFFFFF',
  bgSurface: '#FFFFFF',
  bgMuted: '#F8FAFC',         // slate-50
  bgDark: '#0F172A',          // slate-900 — splash/dark accents

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',   // slate-600
  textTertiary: '#64748B',    // slate-500
  textMuted: '#94A3B8',       // slate-400
  textInverse: '#FFFFFF',

  // Borders / dividers
  border: '#E2E8F0',          // slate-200
  borderStrong: '#CBD5E1',    // slate-300

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  verified: '#10B981',

  // Listing status pills (mirror web STATUS_CONFIG)
  statusAvailable: '#10B981',
  statusBooking: '#0EA5E9',
  statusOpening: '#6366F1',
  statusSold: '#94A3B8',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  // RN font sizes; React Native does not honor `rem` so use absolute pt.
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 32,
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
