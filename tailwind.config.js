/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './*.tsx',
    './*.ts',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // Custom micro sizes (unchanged)
        '3xs': ['8px',  { lineHeight: '12px' }],
        '2xs': ['9px',  { lineHeight: '13px' }],
        'xs2': ['10px', { lineHeight: '14px' }],
        'xs3': ['11px', { lineHeight: '15px' }],
        // Override Tailwind defaults — reduce each step by ~1-4px
        'xs':   ['11px', { lineHeight: '15px' }],   // was 12px
        'sm':   ['12px', { lineHeight: '17px' }],   // was 14px
        'base': ['13px', { lineHeight: '19px' }],   // was 16px
        'lg':   ['15px', { lineHeight: '21px' }],   // was 18px
        'xl':   ['17px', { lineHeight: '23px' }],   // was 20px
        '2xl':  ['20px', { lineHeight: '27px' }],   // was 24px
        '3xl':  ['24px', { lineHeight: '30px' }],   // was 30px
        '4xl':  ['28px', { lineHeight: '34px' }],   // was 36px
        '5xl':  ['36px', { lineHeight: '42px' }],   // was 48px
        '6xl':  ['44px', { lineHeight: '50px' }],   // was 60px
      },
      colors: {
        surface: 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-elevated)',
        'app-bg': 'var(--bg-app)',
        primary: {
          DEFAULT: 'var(--primary-600)',
          600: 'var(--primary-600)',
        },
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-muted': 'var(--text-muted)',
        'status-success': 'var(--color-success)',
        'status-warning': 'var(--color-warning)',
        'status-danger': 'var(--color-danger)',
        'status-info': 'var(--color-info)',
        'glass': 'var(--glass-surface)',
        'glass-border': 'var(--glass-border)',
      },
      animation: {
        'scale-up': 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
