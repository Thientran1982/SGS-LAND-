import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { socket, useSocket } from './websocket';
import {
  CustomThemeConfig,
  CUSTOM_THEME_STORAGE_KEY,
  applyCustomTheme,
  getGlobalCachedTheme,
  tenantThemeKey,
} from './themeConfig';
// -----------------------------------------------------------------------------
//  TYPES
// -----------------------------------------------------------------------------
export type ThemeMode = 'light' | 'dark';
export interface ChartTheme {
    colors: typeof DESIGN_TOKENS['light'];
    palette: string[];
    styles: {
        barRadius: [number, number, number, number];
        strokeWidth: number;
        dotSize: number;
    };
}
// -----------------------------------------------------------------------------
//  INTERNAL CONSTANTS (not exported — keeps this file Fast Refresh compatible)
// -----------------------------------------------------------------------------
const CONSTANTS = {
    STORAGE_KEY: 'sgs_theme',
    DEFAULT_THEME: 'light' as ThemeMode,
    MEDIA_QUERY: '(prefers-color-scheme: dark)',
};
const DESIGN_TOKENS = {
    light: {
        primary: 'var(--sgs-primary)',
        secondary: 'var(--ui-accent)',
        tertiary: 'var(--ui-text-secondary)',
        success: 'var(--sgs-verified)',
        warning: 'var(--ui-warning)',
        info: 'var(--ui-info)',
        danger: 'var(--ui-danger)',
        grid: 'var(--sgs-border)',
        text: 'var(--ui-text-secondary)',
        background: 'var(--ui-surface)',
        tooltipBg: 'var(--ui-surface)',
        barGradientStart: 'var(--sgs-primary)',
        barGradientEnd: 'var(--sgs-primary-deep)',
    },
    dark: {
        primary: 'var(--sgs-primary)',
        secondary: 'var(--ui-accent)',
        tertiary: 'var(--ui-text-secondary)',
        success: 'var(--ui-success)',
        warning: 'var(--ui-warning)',
        info: 'var(--ui-info)',
        danger: 'var(--ui-danger)',
        grid: 'var(--ui-border)',
        text: 'var(--ui-text-secondary)',
        background: 'var(--ui-surface)',
        tooltipBg: 'var(--ui-surface-raised)',
        barGradientStart: 'var(--sgs-primary)',
        barGradientEnd: 'var(--sgs-primary)',
    },
};
const CHART_PALETTE = ['var(--ui-brand)', 'var(--ui-accent)', 'var(--ui-text-secondary)', 'var(--ui-success)', 'var(--ui-warning)', 'var(--ui-info)', 'var(--ui-danger)'];
// -----------------------------------------------------------------------------
//  INTERNAL — fetch tenant theme (not exported)
// -----------------------------------------------------------------------------
async function fetchTenantTheme(): Promise<CustomThemeConfig | null> {
    const cached = getGlobalCachedTheme();
    if (cached) applyCustomTheme(cached);
    const res = await fetch('/api/enterprise/theme', { credentials: 'include' });
    if (!res.ok) return cached;
    const data = await res.json();
    if (data && data.primaryColor) {
        applyCustomTheme(data);
        try {
            const key = tenantThemeKey((data as any)._tenantId);
            localStorage.setItem(key, JSON.stringify(data));
            if (key !== CUSTOM_THEME_STORAGE_KEY) {
                localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(data));
            }
        } catch (_) {}
        return data as CustomThemeConfig;
    }
    return cached;
}
// -----------------------------------------------------------------------------
//  CONTEXT
// -----------------------------------------------------------------------------
interface ThemeContextType {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    chartTheme: ChartTheme;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
// -----------------------------------------------------------------------------
//  PROVIDER
// -----------------------------------------------------------------------------
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY) as ThemeMode;
            if (saved === 'dark' || saved === 'light') return saved;
            if (window.matchMedia(CONSTANTS.MEDIA_QUERY).matches) return 'dark';
        }
        return CONSTANTS.DEFAULT_THEME;
    });
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }
        localStorage.setItem(CONSTANTS.STORAGE_KEY, theme);
    }, [theme]);
    useEffect(() => {
        const mq = window.matchMedia(CONSTANTS.MEDIA_QUERY);
        const handleOsChange = (e: MediaQueryListEvent) => {
            const newTheme: ThemeMode = e.matches ? 'dark' : 'light';
            setThemeState(newTheme);
            try { localStorage.setItem(CONSTANTS.STORAGE_KEY, newTheme); } catch (_) {}
        };
        mq.addEventListener('change', handleOsChange);
        return () => mq.removeEventListener('change', handleOsChange);
    }, []);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CONSTANTS.STORAGE_KEY && e.newValue) {
                const next = e.newValue as ThemeMode;
                if (next === 'dark' || next === 'light') setThemeState(next);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);
    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
    }, []);
    const chartTheme: ChartTheme = useMemo(() => ({
        colors: DESIGN_TOKENS[theme] ?? DESIGN_TOKENS.light,
        palette: CHART_PALETTE,
        styles: { barRadius: [6, 6, 6, 6], strokeWidth: 3, dotSize: 4 },
    }), [theme]);
    const value = useMemo(
        () => ({ theme, toggleTheme, setTheme: setThemeState, chartTheme }),
        [theme, toggleTheme, chartTheme],
    );
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
// -----------------------------------------------------------------------------
//  HOOKS
// -----------------------------------------------------------------------------
export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
};
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