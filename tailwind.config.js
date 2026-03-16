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
        '3xs': ['8px', { lineHeight: '12px' }],
        '2xs': ['9px', { lineHeight: '13px' }],
        'xs2': ['10px', { lineHeight: '14px' }],
        'xs3': ['11px', { lineHeight: '15px' }],
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
