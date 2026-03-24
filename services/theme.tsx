
import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { socket, useSocket } from './websocket';

// -----------------------------------------------------------------------------
//  CONSTANTS & TYPES
// -----------------------------------------------------------------------------
export type ThemeMode = 'light' | 'dark';

export interface CustomThemeConfig {
  primaryColor: string;
  fontFamily: string;
  fontScale: 'compact' | 'default' | 'large';
  bgApp: string;
  bgSidebar: string;
  bgSurface: string;
}

export const CUSTOM_THEME_STORAGE_KEY = 'sgs_custom_theme';

export const FONT_FAMILIES: { value: string; label: string; url?: string }[] = [
  { value: 'Inter', label: 'Inter (Mặc định)' },
  { value: 'Be Vietnam Pro', label: 'Be Vietnam Pro', url: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap' },
  { value: 'Roboto', label: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
  { value: 'Open Sans', label: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap' },
];

export const FONT_SCALE_OPTIONS: { value: CustomThemeConfig['fontScale']; label: string; size: string }[] = [
  { value: 'compact', label: 'Nhỏ gọn', size: '13px' },
  { value: 'default', label: 'Mặc định', size: '15px' },
  { value: 'large', label: 'Rộng rãi', size: '17px' },
];

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  primaryColor: '#4F46E5',
  fontFamily: 'Inter',
  fontScale: 'default',
  bgApp: '',
  bgSidebar: '',
  bgSurface: '',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

function darkenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, rgb.r - amount);
  const g = Math.max(0, rgb.g - amount);
  const b = Math.max(0, rgb.b - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, rgb.r + amount);
  const g = Math.min(255, rgb.g + amount);
  const b = Math.min(255, rgb.b + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

let _loadedFontUrls = new Set<string>();

function loadGoogleFont(fontFamily: string) {
  const font = FONT_FAMILIES.find(f => f.value === fontFamily);
  if (!font?.url || _loadedFontUrls.has(font.url)) return;
  _loadedFontUrls.add(font.url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = font.url;
  document.head.appendChild(link);
}

const STYLE_TAG_ID = 'sgs-custom-theme-bg';

function applyBgColors(bgApp: string, bgSidebar: string, bgSurface: string) {
  let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  const hasBg = bgApp || bgSidebar || bgSurface;
  if (!hasBg) {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_TAG_ID;
    document.head.appendChild(styleEl);
  }
  const HEX_RE = /^#[a-fA-F0-9]{6}$/;
  const rules: string[] = [];
  if (bgApp && HEX_RE.test(bgApp)) rules.push(`--bg-app: ${bgApp};`);
  if (bgSidebar && HEX_RE.test(bgSidebar)) rules.push(`--bg-sidebar: ${bgSidebar};`);
  if (bgSurface && HEX_RE.test(bgSurface)) rules.push(`--bg-surface: ${bgSurface};`);
  styleEl.textContent = `:root.light { ${rules.join(' ')} }`;
}

export function applyCustomTheme(config: Partial<CustomThemeConfig>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (config.primaryColor && /^#[a-fA-F0-9]{6}$/.test(config.primaryColor)) {
    const primary = config.primaryColor;
    const hover = darkenHex(primary, 28);
    const subtle = lightenHex(primary, 170);
    root.style.setProperty('--primary-600', primary);
    root.style.setProperty('--primary-hover', hover);
    root.style.setProperty('--primary-subtle', subtle);
  }

  if (config.fontFamily !== undefined) {
    if (config.fontFamily && config.fontFamily !== 'Inter') {
      loadGoogleFont(config.fontFamily);
      root.style.setProperty('--custom-font', `'${config.fontFamily}', sans-serif`);
    } else {
      root.style.removeProperty('--custom-font');
    }
  }

  if (config.fontScale !== undefined) {
    const scale = FONT_SCALE_OPTIONS.find(s => s.value === config.fontScale);
    if (scale && scale.value !== 'default') {
      root.style.setProperty('--custom-font-size', scale.size);
    } else {
      root.style.removeProperty('--custom-font-size');
    }
  }

  if (config.bgApp !== undefined || config.bgSidebar !== undefined || config.bgSurface !== undefined) {
    applyBgColors(config.bgApp ?? '', config.bgSidebar ?? '', config.bgSurface ?? '');
  }
}

export function clearCustomTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--primary-600');
  root.style.removeProperty('--primary-hover');
  root.style.removeProperty('--primary-subtle');
  root.style.removeProperty('--custom-font');
  root.style.removeProperty('--custom-font-size');
  const styleEl = document.getElementById(STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
  try { localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY); } catch (_) {}
}

async function fetchTenantTheme(): Promise<CustomThemeConfig | null> {
  const cached = (() => {
    try { const r = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  })();
  if (cached) applyCustomTheme(cached);

  const res = await fetch('/api/enterprise/theme', { credentials: 'include' });
  if (!res.ok) return cached;
  const data = await res.json();
  if (data && data.primaryColor) {
    applyCustomTheme(data);
    try { localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    return data as CustomThemeConfig;
  }
  return cached;
}

export function useThemeConfig() {
  const queryClient = useQueryClient();

  useSocket();

  useQuery<CustomThemeConfig | null>({
    queryKey: ['tenant-theme'],
    queryFn: fetchTenantTheme,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    function handleThemeUpdated(data: CustomThemeConfig) {
      applyCustomTheme(data);
      try { localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
      queryClient.setQueryData(['tenant-theme'], data);
    }
    socket.on('theme_updated', handleThemeUpdated);
    return () => { socket.off('theme_updated', handleThemeUpdated); };
  }, [queryClient]);
}

const CONSTANTS = {
    STORAGE_KEY: 'sgs_theme',
    DEFAULT_THEME: 'light' as ThemeMode,
    MEDIA_QUERY: '(prefers-color-scheme: dark)'
};

const DESIGN_TOKENS = {
    light: {
        primary: '#4F46E5', // Indigo 600
        secondary: '#8B5CF6', // Violet 500
        tertiary: '#EC4899', // Pink 500
        success: '#10B981', // Emerald 500
        warning: '#F59E0B', // Amber 500
        info: '#3B82F6',    // Blue 500
        danger: '#F43F5E',  // Rose 500
        grid: '#E2E8F0',    // Slate 200
        text: '#64748B',    // Slate 500
        background: '#FFFFFF', // White
        tooltipBg: 'rgba(255, 255, 255, 0.98)',
        barGradientStart: '#4F46E5',
        barGradientEnd: '#4338CA'
    },
    dark: {
        primary: '#6366F1', // Indigo 500
        secondary: '#A78BFA', // Violet 400
        tertiary: '#F472B6', // Pink 400
        success: '#34D399', // Emerald 400
        warning: '#FBBF24', // Amber 400
        info: '#60A5FA',    // Blue 400
        danger: '#FB7185',  // Rose 400
        grid: '#334155',    // Slate 700
        text: '#94A3B8',    // Slate 400
        background: '#0F172A', // Slate 900
        tooltipBg: 'rgba(15, 23, 42, 0.95)',
        barGradientStart: '#6366F1',
        barGradientEnd: '#4F46E5'
    }
};

const CHART_PALETTE = ['#4F46E5', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

export interface ChartTheme {
    colors: typeof DESIGN_TOKENS['light'];
    palette: string[];
    styles: {
        barRadius: [number, number, number, number];
        strokeWidth: number;
        dotSize: number;
    };
}

interface ThemeContextType {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    chartTheme: ChartTheme;
}

// -----------------------------------------------------------------------------
//  CONTEXT & PROVIDER
// -----------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Lazy initializer to prevent FOUC (Flash of Unstyled Content) and minimize layout thrashing
    const [theme, setThemeState] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem(CONSTANTS.STORAGE_KEY) as ThemeMode;
            if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
            
            // Check system preference if no saved preference
            if (window.matchMedia(CONSTANTS.MEDIA_QUERY).matches) return 'dark';
        }
        return CONSTANTS.DEFAULT_THEME;
    });

    // 2. Apply theme class to HTML element efficiently
    useEffect(() => {
        const root = window.document.documentElement;
        // Efficient classList toggle
        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }
        localStorage.setItem(CONSTANTS.STORAGE_KEY, theme);
    }, [theme]);

    // 3. Listen for cross-tab changes (Storage Event)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CONSTANTS.STORAGE_KEY && e.newValue) {
                const newTheme = e.newValue as ThemeMode;
                if (newTheme === 'dark' || newTheme === 'light') {
                    setThemeState(newTheme);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    }, []);

    // 4. Memoize Chart Theme to prevent re-renders in heavy chart components
    const chartTheme: ChartTheme = useMemo(() => ({
        colors: DESIGN_TOKENS[theme] || DESIGN_TOKENS.light, // Fallback to light to prevent undefined 'primary'
        palette: CHART_PALETTE,
        styles: {
            barRadius: [6, 6, 6, 6],
            strokeWidth: 3,
            dotSize: 4
        }
    }), [theme]);

    const value = useMemo(() => ({
        theme,
        toggleTheme,
        setTheme: setThemeState,
        chartTheme
    }), [theme, toggleTheme, chartTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// -----------------------------------------------------------------------------
//  HOOK
// -----------------------------------------------------------------------------

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
