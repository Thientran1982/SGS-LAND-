
/**
 *  TEXT UTILITIES FOR MULTILINGUAL SAAS
 * -----------------------------------------------------------------------------
 *  Performance-optimized string manipulation for search, normalization, and formatting.
 *  Refactored to be configuration-driven for Internationalization (i18n).
 * 
 *  Optimizations:
 *  1. Pre-compiled Regex for hot paths.
 *  2. Heuristic Currency Parsing (Auto-detects decimal separators).
 *  3. Strict Null Safety.
 * -----------------------------------------------------------------------------
 */

// -----------------------------------------------------------------------------
// 1. CONSTANTS & REGEX CACHE
// -----------------------------------------------------------------------------

// Regex for removing combining diacritical marks (pre-compiled)
const REGEX_DIACRITICS = /[\u0300-\u036f]/g;
const REGEX_NON_DIGIT_PLUS = /[^0-9+]/g;
const REGEX_NON_WORD = /[^\w\-]+/g;
const REGEX_MULTIPLE_DASH = /\-\-+/g;
const REGEX_TRIM_DASH = /^-+|-+$/g;

// Currency suffixes configuration (Injectable for i18n)
export interface CurrencyConfig {
    multipliers: Record<string, number>;
}

const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
    multipliers: {
        'b': 1_000_000_000,
        'bn': 1_000_000_000,
        'tỷ': 1_000_000_000,
        'ty': 1_000_000_000,
        'm': 1_000_000,
        'tr': 1_000_000,
        'triệu': 1_000_000,
        'k': 1_000,
        'nghìn': 1_000
    }
};

// -----------------------------------------------------------------------------
// 2. TEXT NORMALIZATION
// -----------------------------------------------------------------------------

/**
 * Removes Vietnamese tones and diacritics using Unicode Normalization Form D (NFD).
 * Performance: Uses pre-compiled regex.
 */
export const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    // Custom replacements for specific Vietnamese chars that NFD might miss or handle weirdly in some browsers
    return str
        .normalize('NFD')
        .replace(REGEX_DIACRITICS, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

/**
 * Normalizes string for search indexing (lowercase + remove tones + trim).
 */
export const normalizeForSearch = (str: string): string => {
    if (!str) return '';
    return removeVietnameseTones(str).toLowerCase().trim();
};

/**
 * Normalizes phone numbers to a standard format (removes non-digits).
 * Retains '+' for international codes if present at start.
 */
export const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(REGEX_NON_DIGIT_PLUS, '');
};

/**
 * Fuzzy matcher for search functionality.
 * Supports distinct logic for Phone vs Text searching.
 */
export const smartMatch = (target: string, query: string, type: 'TEXT' | 'PHONE' = 'TEXT'): boolean => {
    if (!query) return true;
    if (!target) return false;

    if (type === 'PHONE') {
        const cleanTarget = normalizePhone(target);
        const cleanQuery = normalizePhone(query);
        return cleanTarget.includes(cleanQuery);
    }

    // 1. Exact match attempt (case-insensitive) - Faster check first
    if (target.toLowerCase().includes(query.toLowerCase())) return true;
    
    // 2. Normalized match (accent-insensitive)
    const cleanTarget = normalizeForSearch(target);
    const cleanQuery = normalizeForSearch(query);
    return cleanTarget.includes(cleanQuery);
};

// -----------------------------------------------------------------------------
// 3. FINANCIAL PARSING & FORMATTING (HEURISTIC)
// -----------------------------------------------------------------------------

/**
 * Parses human-friendly currency strings into raw numbers.
 */
export const parseCurrencyString = (raw: string, config: CurrencyConfig = DEFAULT_CURRENCY_CONFIG): number => {
    if (!raw) return 0;
    
    let cleanStr = raw.toString().toLowerCase().trim();
    
    const sortedMultipliers = Object.keys(config.multipliers).sort((a, b) => b.length - a.length);
    let multiplier = 1;

    for (const suffix of sortedMultipliers) {
        if (cleanStr.includes(suffix)) {
            multiplier = config.multipliers[suffix];
            cleanStr = cleanStr.replace(suffix, '').trim();
            break; 
        }
    }

    const dotCount = (cleanStr.match(/\./g) || []).length;
    const commaCount = (cleanStr.match(/,/g) || []).length;
    let normalizedNumStr = cleanStr;

    if (dotCount > 0 && commaCount > 0) {
        const lastDotIndex = cleanStr.lastIndexOf('.');
        const lastCommaIndex = cleanStr.lastIndexOf(',');
        if (lastDotIndex > lastCommaIndex) {
            normalizedNumStr = cleanStr.replace(/,/g, '');
        } else {
            normalizedNumStr = cleanStr.replace(/\./g, '').replace(',', '.');
        }
    } else if (dotCount > 1) {
        normalizedNumStr = cleanStr.replace(/\./g, '');
    } else if (commaCount > 1) {
        normalizedNumStr = cleanStr.replace(/,/g, '');
    } else if (commaCount === 1) {
        normalizedNumStr = cleanStr.replace(',', '.');
    }

    const match = normalizedNumStr.match(/[\d.]+/);
    if (!match) return 0;

    const numPart = parseFloat(match[0]);
    if (isNaN(numPart)) return 0;

    return numPart * multiplier;
};

/**
 * Smartly formats large numbers into Tỷ/Triệu (Billion/Million) for Vietnamese market
 * or compact notation for English.
 */
const fmtDecimalDot = (n: number, maxFractions: number): string => {
    const rounded = parseFloat(n.toFixed(maxFractions));
    const [intPart, decPart] = rounded.toString().split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${intFormatted}.${decPart}` : intFormatted;
};

export const formatSmartPrice = (price: number, t?: (key: string) => string): string => {
    if (!price) return '0';
    const billionLabel = t ? t('format.billion') : 'Tỷ';
    const millionLabel = t ? t('format.million') : 'Tr';
    
    if (price >= 1_000_000_000) {
        return `${fmtDecimalDot(price / 1_000_000_000, 3)} ${billionLabel}`;
    }
    if (price >= 1_000_000) {
        return `${fmtDecimalDot(price / 1_000_000, 2)} ${millionLabel}`;
    }
    return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Calculates and formats Unit Price (Price per m2)
 * FIX APPLIED: Clamp decimals to 1 digit to prevent '123,456.79'.
 * Logic: Prioritize Million/m2 for readability.
 */
export const formatUnitPrice = (price: number, area: number, t?: (key: string) => string): string => {
    if (!price || !area) return '';
    const unit = price / area;
    const billionLabel = t ? t('format.billion') : 'Tỷ';
    const millionLabel = t ? t('format.million') : 'Tr';
    
    // Billion/m2 (Rare, but for prime land)
    if (unit >= 1_000_000_000) {
        return `${fmtDecimalDot(unit / 1_000_000_000, 1)} ${billionLabel}/m²`;
    }
    // Million/m2 (Standard)
    if (unit >= 1_000_000) {
        return `${fmtDecimalDot(unit / 1_000_000, 1)} ${millionLabel}/m²`;
    }
    // Standard VND (For cheap rent)
    return `${Math.round(unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ/m²`;
};

// -----------------------------------------------------------------------------
// 4. URL UTILS
// -----------------------------------------------------------------------------

/**
 * Creates a URL-friendly slug from a string.
 */
export const slugify = (text: string): string => {
    return normalizeForSearch(text)
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(REGEX_NON_WORD, '')    // Remove all non-word chars
        .replace(REGEX_MULTIPLE_DASH, '-') // Replace multiple - with single -
        .replace(REGEX_TRIM_DASH, '');  // Trim - from start/end
};
