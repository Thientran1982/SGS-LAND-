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
        // Custom micro sizes
        '3xs': ['7px',  { lineHeight: '11px' }],
        '2xs': ['8px',  { lineHeight: '12px' }],
        'xs2': ['9px',  { lineHeight: '13px' }],
        'xs3': ['10px', { lineHeight: '14px' }],
        // Compact scale — each step 1-2px smaller than previous sprint
        'xs':   ['10px', { lineHeight: '14px' }],   // was 11px
        'sm':   ['11px', { lineHeight: '16px' }],   // was 12px
        'base': ['12px', { lineHeight: '18px' }],   // was 13px
        'lg':   ['14px', { lineHeight: '20px' }],   // was 15px
        'xl':   ['16px', { lineHeight: '22px' }],   // was 17px
        '2xl':  ['19px', { lineHeight: '26px' }],   // was 20px
        '3xl':  ['22px', { lineHeight: '28px' }],   // was 24px
        '4xl':  ['26px', { lineHeight: '32px' }],   // was 28px
        '5xl':  ['32px', { lineHeight: '38px' }],   // was 36px
        '6xl':  ['40px', { lineHeight: '46px' }],   // was 44px
      },
      colors: {
        surface:          'var(--bg-surface)',
        'surface-elevated': 'var(--bg-elevated)',
        'app-bg':         'var(--bg-app)',
        sidebar:          'var(--bg-sidebar)',
        input:            'var(--bg-input)',
        primary: {
          DEFAULT: 'var(--primary-600)',
          600:     'var(--primary-600)',
          hover:   'var(--primary-hover)',
          subtle:  'var(--primary-subtle)',
        },
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary':  'var(--text-tertiary)',
        'text-muted':     'var(--text-muted)',
        'text-inverse':   'var(--text-inverse)',
        'status-success': 'var(--color-success)',
        'status-warning': 'var(--color-warning)',
        'status-danger':  'var(--color-danger)',
        'status-info':    'var(--color-info)',
        'glass':          'var(--glass-surface)',
        'glass-border':   'var(--glass-border)',
        'border-default': 'var(--border-default)',
        'border-strong':  'var(--border-strong)',
      },
      boxShadow: {
        'token-sm': 'var(--shadow-sm)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
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
