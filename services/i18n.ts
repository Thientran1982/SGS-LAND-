
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { DICTIONARY } from '../config/locales';

export type Language = 'en' | 'vn';

// Helper type to get keys from the VN dictionary (assuming VN is master)
type TranslationKey = keyof typeof DICTIONARY['vn'];

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    // Enhanced typing for key
    t: (key: string, params?: Record<string, string | number>) => string;
    formatDate: (date: string) => string;
    formatTime: (date: string) => string;
    formatDateTime: (date: string) => string;
    formatCurrency: (amount: number, currency?: string) => string;
    formatCompactNumber: (amount: number) => string;
    loading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Synchronous Initialization
    const [language, setLanguageState] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sgs_lang');
            return (saved === 'en' || saved === 'vn') ? saved : 'vn';
        }
        return 'vn';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('sgs_lang', lang);
            document.documentElement.lang = lang === 'vn' ? 'vi' : 'en';
        }
    };

    /**
     * Core Translation Function
     * Optimized for performance (O(1) lookup)
     */
    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        // Defensive check: Ensure dictionary exists and language key exists
        const dict = DICTIONARY || {};
        const currentDict = dict[language] || dict['vn'] || {};
        
        let text = (currentDict as Record<string, string>)[key];

        // Fallback to the other language if missing
        if (!text) {
            const fallbackLang = language === 'en' ? 'vn' : 'en';
            const fallbackDict = dict[fallbackLang] || {};
            text = (fallbackDict as Record<string, string>)[key];
        }

        if (!text) return key; // Return key if translation missing entirely

        if (params) {
            return text.replace(/{(\w+)}/g, (_: string, k: string) => {
                return params[k] !== undefined ? String(params[k]) : `{${k}}`;
            });
        }

        return text;
    }, [language]);

    // --- FORMATTERS ---
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';

    const formatDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString(locale);
        } catch { return dateStr; }
    }, [locale]);

    const formatDateTime = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleString(locale);
        } catch { return dateStr; }
    }, [locale]);

    const formatCurrency = useCallback((amount: number, currencyCode?: string) => {
        try {
            const currency = currencyCode || (language === 'vn' ? 'VND' : 'USD');
            if (currency === 'VND') {
                // Manual format: dot as thousands separator, no locale dependency
                return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
            }
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 2
            }).format(amount);
        } catch { return String(amount); }
    }, [language]);

    const formatCompactNumber = useCallback((amount: number) => {
        if (!amount) return '0';
        try {
            if (language === 'vn') {
                if (amount >= 1_000_000_000) {
                    // Manual: 1 decimal max, comma as decimal separator (VN convention)
                    const val = Math.round((amount / 1_000_000_000) * 10) / 10;
                    return `${val.toString().replace('.', ',')} ${t('format.billion')}`;
                }
                if (amount >= 1_000_000) {
                    const val = Math.round((amount / 1_000_000) * 10) / 10;
                    return `${val.toString().replace('.', ',')} ${t('format.million')}`;
                }
            }
            return new Intl.NumberFormat('en-US', { 
                notation: "compact", 
                compactDisplay: "short" 
            }).format(amount);
        } catch {
            return String(amount);
        }
    }, [language, t]);

    const formatTime = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return t('time.just_now');
            if (diffMins < 60) return t('time.minutes_ago', { val: diffMins });
            if (diffMins < 1440) return t('time.hours_ago', { val: Math.floor(diffMins / 60) });
            return t('time.days_ago', { val: Math.floor(diffMins / 1440) });
        } catch { return dateStr; }
    }, [t]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        formatDate,
        formatTime,
        formatDateTime,
        formatCurrency,
        formatCompactNumber,
        loading: false
    }), [language, t, formatDate, formatTime, formatDateTime, formatCurrency, formatCompactNumber]);

    return React.createElement(I18nContext.Provider, { value }, children);
};

const noop = () => '';

// Stable fallback returned during Vite HMR module-reload transitions.
// In those brief moments a new I18nContext identity is created before the
// provider re-mounts, so useContext returns undefined.
//
// Lưu ý quan trọng: KHÔNG được trả về noopStr cho `t` — vì khi đó toàn bộ
// label trong sidebar sẽ render ra key thô (vd "menu.projects" thay vì
// "Dự Án"). Thay vào đó, tra cứu trực tiếp từ DICTIONARY đã import (sync,
// không phụ thuộc Provider) + đọc ngôn ngữ đã lưu trong localStorage để
// vẫn hiển thị đúng ngữ trong giai đoạn re-mount.
const getStoredLang = (): Language => {
    try {
        const saved = window.localStorage.getItem('sgs_lang');
        return (saved === 'en' || saved === 'vn') ? saved : 'vn';
    } catch {
        return 'vn';
    }
};

const fallbackT = (key: string, params?: Record<string, string | number>): string => {
    const dict = DICTIONARY || {};
    const lang = getStoredLang();
    const currentDict = (dict as any)[lang] || (dict as any)['vn'] || {};
    let text = currentDict[key];
    if (!text) {
        const fallbackLang = lang === 'en' ? 'vn' : 'en';
        text = ((dict as any)[fallbackLang] || {})[key];
    }
    if (!text) return key;
    if (params) {
        return text.replace(/\{(\w+)\}/g, (_: string, k: string) =>
            params[k] !== undefined ? String(params[k]) : `{${k}}`
        );
    }
    return text;
};

const FALLBACK_CONTEXT: I18nContextType = {
    language: 'vn',
    setLanguage: noop as any,
    t: fallbackT,
    formatDate: (s: string) => s,
    formatTime: (s: string) => s,
    formatDateTime: (s: string) => s,
    formatCurrency: () => '0',
    formatCompactNumber: () => '0',
    loading: true,
};

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        // Only happens transiently during HMR — return safe defaults instead of crashing.
        if (process.env.NODE_ENV === 'development') {
            return FALLBACK_CONTEXT;
        }
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
};
