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

// ── Non-HCMC province/city detection ────────────────────────────────────────
// Plain-Latin (no-diacritics) keywords that identify addresses outside HCMC.
// If any of these appear in the address, we skip the HCMC bounding box and
// do NOT append the HCMC city suffix to the geocoding query.
const NON_HCMC_PROVINCES: string[] = [
    'dong nai', 'đồng nai',
    'binh duong', 'bình dương',
    'long an',
    'ba ria', 'bà rịa', 'vung tau', 'vũng tàu',
    'tay ninh', 'tây ninh',
    'ha noi', 'hà nội', 'hanoi',
    'da nang', 'đà nẵng', 'danang',
    'hai phong', 'hải phòng',
    'can tho', 'cần thơ',
    'hue', 'huế',
    'khanh hoa', 'khánh hòa', 'nha trang',
    'binh thuan', 'bình thuận', 'phan thiet', 'phan thiết',
    'lam dong', 'lâm đồng', 'da lat', 'đà lạt',
    'dak lak', 'đắk lắk', 'buon ma thuot', 'buôn mê thuột',
    'gia lai', 'pleiku',
    'kon tum',
    'quang nam', 'quảng nam', 'hoi an', 'hội an',
    'quang ngai', 'quảng ngãi',
    'binh dinh', 'bình định', 'quy nhon', 'quy nhơn',
    'phu yen', 'phú yên',
    'ninh thuan', 'ninh thuận', 'phan rang',
    'tien giang', 'tiền giang', 'my tho', 'mỹ tho',
    'ben tre', 'bến tre',
    'vinh long', 'vĩnh long',
    'tra vinh', 'trà vinh',
    'dong thap', 'đồng tháp', 'cao lanh', 'cao lãnh',
    'an giang', 'long xuyen', 'long xuyên',
    'kien giang', 'kiên giang', 'rach gia', 'rạch giá', 'phu quoc', 'phú quốc',
    'ca mau', 'cà mau',
    'hau giang', 'hậu giang',
    'soc trang', 'sóc trăng',
    'bac lieu', 'bạc liêu',
    'quang binh', 'quảng bình',
    'quang tri', 'quảng trị',
    'thua thien', 'thừa thiên',
    'nghe an', 'nghệ an', 'vinh city', 'thành phố vinh',
    'ha tinh', 'hà tĩnh',
    'thanh hoa', 'thanh hoá', 'thanh hóa',
    'ninh binh', 'ninh bình',
    'nam dinh', 'nam định',
    'thai binh', 'thái bình',
    'hai duong', 'hải dương',
    'hung yen', 'hưng yên',
    'bac ninh', 'bắc ninh',
    'vinh phuc', 'vĩnh phúc',
    'ha nam', 'hà nam',
    'bac giang', 'bắc giang',
    'thai nguyen', 'thái nguyên',
    'phu tho', 'phú thọ', 'viet tri', 'việt trì',
    'yen bai', 'yên bái',
    'lao cai', 'lào cai', 'sa pa',
    'tuyen quang', 'tuyên quang',
    'ha giang', 'hà giang',
    'cao bang', 'cao bằng',
    'lang son', 'lạng sơn',
    'quang ninh', 'quảng ninh', 'ha long', 'hạ long',
    'bac kan', 'bắc kạn',
    'dien bien', 'điện biên',
    'lai chau', 'lai châu',
    'son la', 'sơn la',
    'hoa binh', 'hòa bình',
];

/**
 * Detect if an address belongs to a non-HCMC province/city.
 * Returns true when a known out-of-HCMC keyword is found.
 */
export function isNonHCMCAddress(address: string): boolean {
    const lower = address.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const province of NON_HCMC_PROVINCES) {
        const plain = province.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const escaped = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(lower)) {
            return true;
        }
    }
    return false;
}

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
const HCMC_SUFFIXES = [
    ', Thành phố Hồ Chí Minh, Việt Nam',
    ', Ho Chi Minh City, Vietnam',
    ', TP. HCM, Việt Nam',
    ', Vietnam',
];

const GENERIC_SUFFIXES = [
    ', Việt Nam',
    ', Vietnam',
];

/**
 * Build all geocode query variants for a Vietnamese address.
 *
 * For HCMC addresses: appends HCMC city qualifiers so Nominatim finds the
 * correct district even for short street-only queries.
 *
 * For non-HCMC addresses (Đồng Nai, Hà Nội, etc.): only appends ", Vietnam"
 * so we do NOT force Nominatim to look inside HCMC.
 *
 * Deduplicates if the original and normalized are identical.
 */
export function buildVNGeoQueries(address: string): string[] {
    const orig = address.trim();
    const norm = normalizeVNAddress(orig);
    const hasChanged = norm.toLowerCase() !== orig.toLowerCase();

    const variants = hasChanged ? [orig, norm] : [orig];
    const suffixes = isNonHCMCAddress(orig) ? GENERIC_SUFFIXES : HCMC_SUFFIXES;
    const queries: string[] = [];

    for (const variant of variants) {
        for (const suffix of suffixes) {
            queries.push(`${variant}${suffix}`);
        }
    }

    return queries;
}

// ── District centre coordinates ──────────────────────────────────────────────
// When geocoding fails entirely, fall back to the centre of the identified
// district rather than a random hash (which can land in the Sài Gòn River).
// Keys are lower-case plain-Latin district names matching HCMC_DISTRICTS above.
export const HCMC_DISTRICT_CENTERS: Record<string, [number, number]> = {
    'quan 1':     [10.7757, 106.7009],
    'quan 2':     [10.7970, 106.7519],
    'quan 3':     [10.7806, 106.6857],
    'quan 4':     [10.7579, 106.7043],
    'quan 5':     [10.7552, 106.6622],
    'quan 6':     [10.7480, 106.6364],
    'quan 7':     [10.7323, 106.7199],
    'quan 8':     [10.7233, 106.6624],
    'quan 9':     [10.8485, 106.7622],
    'quan 10':    [10.7749, 106.6681],
    'quan 11':    [10.7617, 106.6461],
    'quan 12':    [10.8631, 106.6610],
    'binh thanh': [10.8069, 106.7107],
    'tan binh':   [10.8024, 106.6527],
    'tan phu':    [10.7903, 106.6282],
    'go vap':     [10.8387, 106.6806],
    'phu nhuan':  [10.7990, 106.6776],
    'binh tan':   [10.7639, 106.6040],
    'binh chanh': [10.6742, 106.6130],
    'hoc mon':    [10.8914, 106.5924],
    'cu chi':     [11.0028, 106.4999],
    'nha be':     [10.6891, 106.7501],
    'can gio':    [10.4036, 106.9560],
    'thu duc':    [10.8485, 106.7622],
};

// ── Non-HCMC province / major district centres ───────────────────────────────
// Used as fallback when Nominatim is unavailable and the address is outside HCMC.
// Keys are lower-case plain-Latin (no diacritics), longest-match first.
export const NON_HCMC_PLACE_CENTERS: { key: string; coords: [number, number]; label: string }[] = [
    // Đồng Nai districts (most-specific first)
    { key: 'nhon trach',   coords: [10.7116, 106.9165], label: 'Nhơn Trạch, Đồng Nai' },
    { key: 'long thanh',   coords: [10.7851, 106.9565], label: 'Long Thành, Đồng Nai' },
    { key: 'bien hoa',     coords: [10.9575, 106.8432], label: 'Biên Hòa, Đồng Nai' },
    { key: 'trang bom',    coords: [10.9523, 107.0118], label: 'Trảng Bom, Đồng Nai' },
    { key: 'xuan loc',     coords: [10.9396, 107.2352], label: 'Xuân Lộc, Đồng Nai' },
    { key: 'dinh quan',    coords: [11.1665, 107.3715], label: 'Định Quán, Đồng Nai' },
    { key: 'dong nai',     coords: [10.9455, 106.8243], label: 'Đồng Nai' },
    // Bình Dương
    { key: 'thu dau mot',  coords: [10.9805, 106.6475], label: 'Thủ Dầu Một, Bình Dương' },
    { key: 'di an',        coords: [10.8985, 106.7755], label: 'Dĩ An, Bình Dương' },
    { key: 'thuan an',     coords: [10.8765, 106.7216], label: 'Thuận An, Bình Dương' },
    { key: 'ben cat',      coords: [11.0760, 106.5959], label: 'Bến Cát, Bình Dương' },
    { key: 'binh duong',   coords: [11.1601, 106.6624], label: 'Bình Dương' },
    // Long An
    { key: 'ben luc',      coords: [10.6410, 106.4860], label: 'Bến Lức, Long An' },
    { key: 'can giuoc',    coords: [10.5700, 106.5830], label: 'Cần Giuộc, Long An' },
    { key: 'duc hoa',      coords: [10.7355, 106.4041], label: 'Đức Hòa, Long An' },
    { key: 'long an',      coords: [10.5388, 106.4103], label: 'Long An' },
    // Vũng Tàu / Bà Rịa
    { key: 'vung tau',     coords: [10.4113, 107.1361], label: 'Vũng Tàu' },
    { key: 'ba ria',       coords: [10.4990, 107.1673], label: 'Bà Rịa' },
    // Tây Ninh
    { key: 'tay ninh',     coords: [11.3101, 106.0985], label: 'Tây Ninh' },
    // Hà Nội
    { key: 'ha noi',       coords: [21.0285, 105.8542], label: 'Hà Nội' },
    { key: 'hanoi',        coords: [21.0285, 105.8542], label: 'Hà Nội' },
    // Đà Nẵng
    { key: 'da nang',      coords: [16.0471, 108.2068], label: 'Đà Nẵng' },
    { key: 'danang',       coords: [16.0471, 108.2068], label: 'Đà Nẵng' },
    // Nha Trang / Khánh Hòa
    { key: 'nha trang',    coords: [12.2388, 109.1967], label: 'Nha Trang' },
    { key: 'khanh hoa',    coords: [12.2388, 109.1967], label: 'Khánh Hòa' },
    // Đà Lạt / Lâm Đồng
    { key: 'da lat',       coords: [11.9404, 108.4583], label: 'Đà Lạt' },
    { key: 'lam dong',     coords: [11.9404, 108.4583], label: 'Lâm Đồng' },
    // Bình Thuận / Phan Thiết
    { key: 'phan thiet',   coords: [10.9289, 108.1021], label: 'Phan Thiết' },
    { key: 'binh thuan',   coords: [11.1655, 108.0073], label: 'Bình Thuận' },
    // Cần Thơ
    { key: 'can tho',      coords: [10.0452, 105.7469], label: 'Cần Thơ' },
    // Phú Quốc
    { key: 'phu quoc',     coords: [10.2899, 103.9840], label: 'Phú Quốc' },
    // Hội An
    { key: 'hoi an',       coords: [15.8801, 108.3380], label: 'Hội An' },
    // Hải Phòng
    { key: 'hai phong',    coords: [20.8449, 106.6881], label: 'Hải Phòng' },
];

/**
 * Scan an address for a known non-HCMC province / district name and return
 * its approximate centre coordinates.  Returns null when nothing matches.
 * Longer keys are tried first so "nhon trach" wins over "dong nai".
 */
export function getProvinceFallback(address: string): { coords: [number, number]; label: string } | null {
    const lower = address.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // NON_HCMC_PLACE_CENTERS already ordered longest-specific-first
    for (const entry of NON_HCMC_PLACE_CENTERS) {
        const escaped = entry.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(lower)) {
            return { coords: entry.coords, label: entry.label };
        }
    }
    return null;
}

/**
 * Scan an address string for a known HCMC district name (with or without
 * diacritics) and return its centre coordinates.
 *
 * Returns null when no district is recognised — caller should use HCMC centre
 * or another fallback, but NOT a random hash.
 */
export function getDistrictFallback(address: string): { coords: [number, number]; district: string } | null {
    const lower = address.toLowerCase()
        // strip diacritics for matching (basic NFD approach)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Try longest keys first so "quan 10" matches before "quan 1"
    const keys = Object.keys(HCMC_DISTRICT_CENTERS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(lower)) {
            return {
                coords: HCMC_DISTRICT_CENTERS[key],
                district: HCMC_DISTRICTS[key] || key,
            };
        }
    }
    return null;
}
