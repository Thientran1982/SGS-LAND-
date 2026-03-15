
import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';

// -----------------------------------------------------------------------------
//  CONSTANTS & TYPES
// -----------------------------------------------------------------------------
export type ThemeMode = 'light' | 'dark';

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
