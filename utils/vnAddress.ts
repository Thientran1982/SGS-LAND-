/**
 * Vietnamese address normalization utilities.
 *
 * When users type addresses without diacritics (không dấu), Nominatim can
 * struggle to match them against OSM data stored with proper Vietnamese Unicode.
 * This module restores diacritics for the most common HCMC administrative terms
 * (districts, wards, address-type prefixes) so geocoding queries are more accurate.
 *
 * Usage:
 *   normalizeVNAddress("nguyen huu canh, binh thanh")
 *   // → "nguyen huu canh, Bình Thạnh"
 *
 *   buildVNGeoQueries("nguyen huu canh, binh thanh")
 *   // → 8 queries: original × 4 city variants + normalized × 4 city variants
 */

// ── HCMC Districts / Quận / Huyện ──────────────────────────────────────────
const HCMC_DISTRICTS: Record<string, string> = {
    'binh thanh':   'Bình Thạnh',
    'binh duong':   'Bình Dương',
    'binh tan':     'Bình Tân',
    'binh chanh':   'Bình Chánh',
    'thu duc':      'Thủ Đức',
    'tan binh':     'Tân Bình',
    'tan phu':      'Tân Phú',
    'go vap':       'Gò Vấp',
    'phu nhuan':    'Phú Nhuận',
    'hoc mon':      'Hóc Môn',
    'cu chi':       'Củ Chi',
    'nha be':       'Nhà Bè',
    'can gio':      'Cần Giờ',
    'quan 1':       'Quận 1',
    'quan 2':       'Quận 2',
    'quan 3':       'Quận 3',
    'quan 4':       'Quận 4',
    'quan 5':       'Quận 5',
    'quan 6':       'Quận 6',
    'quan 7':       'Quận 7',
    'quan 8':       'Quận 8',
    'quan 9':       'Quận 9',
    'quan 10':      'Quận 10',
    'quan 11':      'Quận 11',
    'quan 12':      'Quận 12',
};

// ── Administrative term prefixes ────────────────────────────────────────────
const ADMIN_TERMS: Record<string, string> = {
    '\\bduong\\b':   'Đường',
    '\\bphuong\\b':  'Phường',
    '\\bquan\\b':    'Quận',
    '\\bhuyen\\b':   'Huyện',
    '\\bxa\\b':      'Xã',
    '\\bhem\\b':     'Hẻm',
    '\\bngo\\b':     'Ngõ',
    '\\bap\\b':      'Ấp',
    '\\bthi tran\\b': 'Thị Trấn',
    '\\bthi xa\\b':  'Thị Xã',
};

/**
 * Restore diacritics for known HCMC district names and Vietnamese
 * administrative terms in an address string typed without diacritics.
 *
 * Only replaces tokens that match EXACTLY (word-boundary aware) so
 * unrecognised street names are left as-is for Nominatim to handle via
 * its own Unicode normalization.
 */
export function normalizeVNAddress(address: string): string {
    let result = address;

    // 1. Restore district names (multi-word, longest-match-first)
    for (const [plain, diacritic] of Object.entries(HCMC_DISTRICTS)) {
        const escaped = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`(?<![\\w\u00C0-\u024F])${escaped}(?![\\w\u00C0-\u024F])`, 'gi'), diacritic);
    }

    // 2. Restore admin-term prefixes
    for (const [pattern, diacritic] of Object.entries(ADMIN_TERMS)) {
        result = result.replace(new RegExp(pattern, 'gi'), diacritic);
    }

    return result;
}

// ── Geocode query builder ───────────────────────────────────────────────────
const CITY_SUFFIXES = [
    ', Thành phố Hồ Chí Minh, Việt Nam',
    ', Ho Chi Minh City, Vietnam',
    ', TP. HCM, Việt Nam',
    ', Vietnam',
];

/**
 * Build all geocode query variants for a Vietnamese address.
 * Returns original queries first (Nominatim handles non-diacritical inputs
 * reasonably well), then normalized queries with diacritics restored for
 * district/admin terms.
 *
 * Deduplicates if the original and normalized are identical.
 */
export function buildVNGeoQueries(address: string): string[] {
    const orig = address.trim();
    const norm = normalizeVNAddress(orig);
    const hasChanged = norm.toLowerCase() !== orig.toLowerCase();

    const variants = hasChanged ? [orig, norm] : [orig];
    const queries: string[] = [];

    for (const variant of variants) {
        for (const suffix of CITY_SUFFIXES) {
            queries.push(`${variant}${suffix}`);
        }
    }

    return queries;
}
