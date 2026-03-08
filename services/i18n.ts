
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
        
        // @ts-ignore
        let text = currentDict[key];

        // Fallback to the other language if missing
        if (!text) {
            const fallbackLang = language === 'en' ? 'vn' : 'en';
            const fallbackDict = dict[fallbackLang] || {};
            // @ts-ignore
            text = fallbackDict[key];
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
            // Default to VND if in VN mode, otherwise USD
            const currency = currencyCode || (language === 'vn' ? 'VND' : 'USD');
            
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                // VND usually doesn't use decimals, USD does
                maximumFractionDigits: currency === 'VND' ? 0 : 2 
            }).format(amount);
        } catch { return String(amount); }
    }, [locale, language]);

    const formatCompactNumber = useCallback((amount: number) => {
        if (!amount) return '0';
        try {
            // Specialized VN formatting for Billion (Tỷ) and Million (Triệu)
            // Uses dictionary keys instead of hardcoded strings
            if (language === 'vn') {
                if (amount >= 1_000_000_000) {
                    return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${t('format.billion')}`;
                }
                if (amount >= 1_000_000) {
                    return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${t('format.million')}`;
                }
            }
            
            // Standard compact notation for English or smaller numbers
            return new Intl.NumberFormat(locale, { 
                notation: "compact", 
                compactDisplay: "short" 
            }).format(amount);
        } catch {
            return String(amount);
        }
    }, [locale, language, t]);

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

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
};
