// Design tokens mirroring the web app palette (dark-first marketplace).
// Web uses CSS vars (--bg-surface, --glass-border, --text-primary) — here we
// expose plain hex values consumable by React Native StyleSheet. Keep names
// aligned with the web tokens so future white-label theming can map 1:1.
export const colors = {
  // Brand
  brand: 'var(--sgs-primary)',          // indigo-600 — primary CTA
  brandDark: 'var(--sgs-primary-deep)',
  brandSoft: '#E8EEF5',
  // Backgrounds
  bgBase: '#FFFFFF',
  bgSurface: '#FFFFFF',
  bgMuted: 'var(--sgs-bg)',         // slate-50
  bgDark: 'var(--sgs-text)',          // slate-900 — splash/dark accents
  // Text
  textPrimary: 'var(--sgs-text)',
  textSecondary: 'var(--sgs-text-muted)',   // slate-600
  textTertiary: 'var(--sgs-text-muted)',    // slate-500
  textMuted: 'var(--sgs-on-dark-muted)',       // slate-400
  textInverse: '#FFFFFF',
  // Borders / dividers
  border: 'var(--sgs-border)',          // slate-200
  borderStrong: '#CBD5E1',    // slate-300
  // Status
  success: 'var(--sgs-verified)',
  warning: '#F59E0B',
  danger: '#EF4444',
  verified: 'var(--sgs-verified)',
  // Listing status pills (mirror web STATUS_CONFIG)
  statusAvailable: 'var(--sgs-verified)',
  statusBooking: '#0EA5E9',
  statusOpening: 'var(--sgs-primary)',
  statusSold: 'var(--sgs-on-dark-muted)',
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
    shadowColor: 'var(--sgs-text)',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};