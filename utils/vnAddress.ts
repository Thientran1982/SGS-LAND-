/**
 * Vietnamese address normalization utilities.
 *
 * Provides:
 *  - HCMC district normalisation (with/without diacritics)
 *  - Non-HCMC province detection
 *  - Geocode query builder for Nominatim
 *  - Fallback coordinate lookup: HCMC wards/districts + 63 provinces + ~700 districts
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
    '\\bduong\\b':    'Đường',
    '\\bphuong\\b':   'Phường',
    '\\bquan\\b':     'Quận',
    '\\bhuyen\\b':    'Huyện',
    '\\bxa\\b':       'Xã',
    '\\bhem\\b':      'Hẻm',
    '\\bngo\\b':      'Ngõ',
    '\\bap\\b':       'Ấp',
    '\\bthi tran\\b': 'Thị Trấn',
    '\\bthi xa\\b':   'Thị Xã',
};

// ── Non-HCMC province/city detection ────────────────────────────────────────
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
    'binh phuoc', 'bình phước',
    'dak nong', 'đắk nông',
];

export function isNonHCMCAddress(address: string): boolean {
    const lower = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Explicit HCMC markers always win — even if the address string contains a
    // province name as part of a street/ward name (e.g. "Đường Nguyễn Bình Dương").
    // Uses pre-built array to avoid object allocation on every call.
    if (_HCMC_MARKERS_LOWER.some(m => lower.includes(m))) return false;

    // Only scan the last two comma-delimited segments.  Province/city names appear at
    // the END of Vietnamese addresses; names embedded in street names (e.g. "Đường
    // Nguyễn Bình Dương, Quận 7") must NOT trigger a non-HCMC match.
    const segments = lower.split(',').map(s => s.trim()).filter(Boolean);
    const tail = segments.slice(-2).join(',');

    // Use pre-compiled regexes — avoids creating new RegExp objects in a hot loop.
    for (const re of _NON_HCMC_PROVINCE_COMPILED) {
        if (re.test(tail)) return true;
    }
    return false;
}

export function normalizeVNAddress(address: string): string {
    let result = address;
    for (const [plain, diacritic] of Object.entries(HCMC_DISTRICTS)) {
        const escaped = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`(?<![\\w\u00C0-\u024F])${escaped}(?![\\w\u00C0-\u024F])`, 'gi'), diacritic);
    }
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
const GENERIC_SUFFIXES = [', Việt Nam', ', Vietnam'];

export function buildVNGeoQueries(address: string): string[] {
    const orig = address.trim();
    const norm = normalizeVNAddress(orig);
    const hasChanged = norm.toLowerCase() !== orig.toLowerCase();
    const variants = hasChanged ? [orig, norm] : [orig];
    const suffixes = isNonHCMCAddress(orig) ? GENERIC_SUFFIXES : HCMC_SUFFIXES;
    const queries: string[] = [];
    for (const variant of variants) for (const suffix of suffixes) queries.push(`${variant}${suffix}`);
    return queries;
}

// ── HCMC district & key ward centres ─────────────────────────────────────────
export const HCMC_DISTRICT_CENTERS: Record<string, [number, number]> = {
    // Quận số
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
    // Quận tên
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
    // Key phường TP.Thủ Đức (cũ Q2/Q9/Thủ Đức)
    'thao dien':        [10.8076, 106.7458],
    'an phu':           [10.7994, 106.7608],
    'thu thiem':        [10.7889, 106.7241],
    'binh an':          [10.7980, 106.7712],
    'binh khanh':       [10.7823, 106.7553],
    'an khanh':         [10.7877, 106.7649],
    'cat lai':          [10.7685, 106.7877],
    'phu huu':          [10.8376, 106.7905],
    'long binh':        [10.8531, 106.8096],
    'long truong':      [10.8392, 106.8220],
    'truong thanh':     [10.8305, 106.8370],
    'tang nhon phu a':  [10.8407, 106.7780],
    'tang nhon phu b':  [10.8357, 106.7714],
    'phuoc long a':     [10.8265, 106.7659],
    'phuoc long b':     [10.8195, 106.7584],
    'hiep phu':         [10.8434, 106.7856],
    'vinh phu':         [10.8553, 106.7624],
    'long phuoc':       [10.8463, 106.8326],
    'long thanh my':    [10.8521, 106.8046],
    'truong tho':       [10.8643, 106.7542],
    'linh dong':        [10.8543, 106.7460],
    'linh tay':         [10.8588, 106.7357],
    'linh xuan':        [10.8712, 106.7620],
    'linh trung':       [10.8756, 106.7740],
    'linh chieu':       [10.8835, 106.7628],
    'tam binh':         [10.8680, 106.7412],
    'tam phu':          [10.8623, 106.7295],
    'hoa binh':         [10.8503, 106.7305],
    'binh tho':         [10.8450, 106.7330],
    // Key phường Quận 7
    'tan phong':        [10.7279, 106.7082],
    'phu my':           [10.7225, 106.7330],
    'binh thuan':       [10.7391, 106.7246],
    'phu thuan':        [10.7448, 106.7166],
    'tan hung':         [10.7368, 106.7072],
    'tan quy':          [10.7263, 106.6982],
    'tan phu q7':       [10.7162, 106.7170],
    'hung gia':         [10.7326, 106.7241],
    'tan kieng':        [10.7191, 106.7317],
    'phu thuan q7':     [10.7444, 106.7225],
};

// ── Toàn bộ tỉnh/thành + huyện/quận Việt Nam ─────────────────────────────────
// Thứ tự: huyện cụ thể nhất trước, tỉnh/thành phố sau.
// Các key là plain-Latin không dấu.
export const NON_HCMC_PLACE_CENTERS: { key: string; coords: [number, number]; label: string }[] = [

    // ═══════════════════════ MIỀN NAM ═══════════════════════

    // ── Đồng Nai ──
    { key: 'nhon trach',       coords: [10.7116, 106.9165], label: 'Nhơn Trạch, Đồng Nai' },
    { key: 'vinh thanh',       coords: [10.6973, 106.9452], label: 'Vĩnh Thanh, Nhơn Trạch, Đồng Nai' },
    { key: 'phu huu dn',       coords: [10.7215, 106.8995], label: 'Phú Hữu, Nhơn Trạch, Đồng Nai' },
    { key: 'long an dn',       coords: [10.7432, 106.9213], label: 'Long An, Nhơn Trạch, Đồng Nai' },
    { key: 'phuoc thien',      coords: [10.7628, 106.9312], label: 'Phước Thiền, Nhơn Trạch, Đồng Nai' },
    { key: 'long thanh',       coords: [10.7851, 106.9565], label: 'Long Thành, Đồng Nai' },
    { key: 'bien hoa',         coords: [10.9575, 106.8432], label: 'Biên Hòa, Đồng Nai' },
    { key: 'long khanh',       coords: [10.9316, 107.2419], label: 'Long Khánh, Đồng Nai' },
    { key: 'trang bom',        coords: [10.9523, 107.0118], label: 'Trảng Bom, Đồng Nai' },
    { key: 'thong nhat dn',    coords: [10.9898, 107.1219], label: 'Thống Nhất, Đồng Nai' },
    { key: 'cam my',           coords: [10.9135, 107.3057], label: 'Cẩm Mỹ, Đồng Nai' },
    { key: 'xuan loc',         coords: [10.9396, 107.2352], label: 'Xuân Lộc, Đồng Nai' },
    { key: 'dinh quan',        coords: [11.1665, 107.3715], label: 'Định Quán, Đồng Nai' },
    { key: 'tan phu dn',       coords: [11.3346, 107.4197], label: 'Tân Phú, Đồng Nai' },
    { key: 'vinh cuu',         coords: [11.0878, 106.9888], label: 'Vĩnh Cửu, Đồng Nai' },
    { key: 'aqua city',        coords: [10.7851, 106.9565], label: 'Aqua City, Long Thành, Đồng Nai' },
    { key: 'dong nai',         coords: [10.9455, 106.8243], label: 'Đồng Nai' },

    // ── Bình Dương ──
    { key: 'thu dau mot',      coords: [10.9805, 106.6475], label: 'Thủ Dầu Một, Bình Dương' },
    { key: 'thuan an',         coords: [10.8765, 106.7216], label: 'Thuận An, Bình Dương' },
    { key: 'di an',            coords: [10.8985, 106.7755], label: 'Dĩ An, Bình Dương' },
    { key: 'ben cat',          coords: [11.0760, 106.5959], label: 'Bến Cát, Bình Dương' },
    { key: 'tan uyen',         coords: [11.0680, 106.8124], label: 'Tân Uyên, Bình Dương' },
    { key: 'phu giao',         coords: [11.2696, 106.8618], label: 'Phú Giáo, Bình Dương' },
    { key: 'bac tan uyen',     coords: [11.2166, 106.8999], label: 'Bắc Tân Uyên, Bình Dương' },
    { key: 'bau bang',         coords: [11.2228, 106.5891], label: 'Bàu Bàng, Bình Dương' },
    { key: 'dau tieng',        coords: [11.2781, 106.4133], label: 'Dầu Tiếng, Bình Dương' },
    { key: 'binh duong',       coords: [11.1601, 106.6624], label: 'Bình Dương' },

    // ── Long An ──
    { key: 'tan an',           coords: [10.5312, 106.4086], label: 'Tân An, Long An' },
    { key: 'ben luc',          coords: [10.6410, 106.4860], label: 'Bến Lức, Long An' },
    { key: 'can giuoc',        coords: [10.5700, 106.5830], label: 'Cần Giuộc, Long An' },
    { key: 'can duoc',         coords: [10.4892, 106.5937], label: 'Cần Đước, Long An' },
    { key: 'chau thanh la',    coords: [10.5744, 106.3256], label: 'Châu Thành, Long An' },
    { key: 'duc hoa',          coords: [10.7355, 106.4041], label: 'Đức Hòa, Long An' },
    { key: 'duc hue',          coords: [10.7696, 106.2190], label: 'Đức Huệ, Long An' },
    { key: 'moc hoa',          coords: [10.7771, 105.8803], label: 'Mộc Hóa, Long An' },
    { key: 'tan hung la',      coords: [10.9793, 105.7806], label: 'Tân Hưng, Long An' },
    { key: 'tan thanh la',     coords: [10.8127, 105.9769], label: 'Tân Thạnh, Long An' },
    { key: 'thanh hoa la',     coords: [10.7278, 106.1143], label: 'Thạnh Hóa, Long An' },
    { key: 'thu thua',         coords: [10.5960, 106.3034], label: 'Thủ Thừa, Long An' },
    { key: 'vinh hung',        coords: [10.9079, 105.6566], label: 'Vĩnh Hưng, Long An' },
    { key: 'tan tru',          coords: [10.4951, 106.4474], label: 'Tân Trụ, Long An' },
    { key: 'kien tuong',       coords: [10.7988, 105.8418], label: 'Kiến Tường, Long An' },
    { key: 'long an',          coords: [10.5388, 106.4103], label: 'Long An' },

    // ── Bà Rịa - Vũng Tàu ──
    { key: 'vung tau',         coords: [10.4113, 107.1361], label: 'Vũng Tàu' },
    { key: 'ba ria',           coords: [10.4990, 107.1673], label: 'Bà Rịa' },
    { key: 'phu my brvt',      coords: [10.5616, 107.0592], label: 'Phú Mỹ, Bà Rịa - Vũng Tàu' },
    { key: 'long dien',        coords: [10.4670, 107.2072], label: 'Long Điền, Bà Rịa - Vũng Tàu' },
    { key: 'dat do',           coords: [10.4010, 107.3000], label: 'Đất Đỏ, Bà Rịa - Vũng Tàu' },
    { key: 'xuyen moc',        coords: [10.5743, 107.4130], label: 'Xuyên Mộc, Bà Rịa - Vũng Tàu' },
    { key: 'chau duc',         coords: [10.6293, 107.2660], label: 'Châu Đức, Bà Rịa - Vũng Tàu' },
    { key: 'con dao',          coords: [8.6830,  106.6270], label: 'Côn Đảo, Bà Rịa - Vũng Tàu' },

    // ── Tây Ninh ──
    { key: 'tay ninh city',    coords: [11.3101, 106.0985], label: 'Tây Ninh' },
    { key: 'hoa thanh tn',     coords: [11.2979, 106.1323], label: 'Hòa Thành, Tây Ninh' },
    { key: 'go dau',           coords: [11.1321, 106.2639], label: 'Gò Dầu, Tây Ninh' },
    { key: 'ben cau',          coords: [11.1059, 106.0282], label: 'Bến Cầu, Tây Ninh' },
    { key: 'duong minh chau',  coords: [11.4398, 106.1648], label: 'Dương Minh Châu, Tây Ninh' },
    { key: 'chau thanh tn',    coords: [11.3944, 106.1872], label: 'Châu Thành, Tây Ninh' },
    { key: 'tan bien',         coords: [11.7016, 106.0260], label: 'Tân Biên, Tây Ninh' },
    { key: 'tan chau tn',      coords: [11.7080, 106.3266], label: 'Tân Châu, Tây Ninh' },
    { key: 'trang bang',       coords: [11.0386, 106.3696], label: 'Trảng Bàng, Tây Ninh' },
    { key: 'tay ninh',         coords: [11.3101, 106.0985], label: 'Tây Ninh' },

    // ── Bình Phước ──
    { key: 'dong xoai',        coords: [11.5332, 106.8947], label: 'Đồng Xoài, Bình Phước' },
    { key: 'binh long',        coords: [11.6743, 106.6059], label: 'Bình Long, Bình Phước' },
    { key: 'phuoc long bp',    coords: [11.8834, 107.0046], label: 'Phước Long, Bình Phước' },
    { key: 'loc ninh',         coords: [11.8390, 106.5860], label: 'Lộc Ninh, Bình Phước' },
    { key: 'bu dop',           coords: [12.0630, 106.8270], label: 'Bù Đốp, Bình Phước' },
    { key: 'bu gia map',       coords: [12.3420, 107.1160], label: 'Bù Gia Mập, Bình Phước' },
    { key: 'dong phu',         coords: [11.6120, 106.9200], label: 'Đồng Phú, Bình Phước' },
    { key: 'hon quan',         coords: [11.6850, 106.6430], label: 'Hớn Quản, Bình Phước' },
    { key: 'chon thanh',       coords: [11.4150, 106.6370], label: 'Chơn Thành, Bình Phước' },
    { key: 'phu rieng',        coords: [11.7190, 107.0670], label: 'Phú Riềng, Bình Phước' },
    { key: 'binh phuoc',       coords: [11.7511, 106.7234], label: 'Bình Phước' },

    // ── Tiền Giang ──
    { key: 'my tho',           coords: [10.3600, 106.3600], label: 'Mỹ Tho, Tiền Giang' },
    { key: 'go cong',          coords: [10.3665, 106.6664], label: 'Gò Công, Tiền Giang' },
    { key: 'cai lay',          coords: [10.4777, 106.0849], label: 'Cai Lậy, Tiền Giang' },
    { key: 'chau thanh tg',    coords: [10.3820, 106.3640], label: 'Châu Thành, Tiền Giang' },
    { key: 'cho gao',          coords: [10.3099, 106.5169], label: 'Chợ Gạo, Tiền Giang' },
    { key: 'go cong dong',     coords: [10.2726, 106.6975], label: 'Gò Công Đông, Tiền Giang' },
    { key: 'go cong tay',      coords: [10.3574, 106.5820], label: 'Gò Công Tây, Tiền Giang' },
    { key: 'tan phuoc',        coords: [10.5972, 106.1494], label: 'Tân Phước, Tiền Giang' },
    { key: 'cai be',           coords: [10.3827, 105.9771], label: 'Cái Bè, Tiền Giang' },
    { key: 'tan phu dong',     coords: [10.2270, 106.6140], label: 'Tân Phú Đông, Tiền Giang' },
    { key: 'tien giang',       coords: [10.3600, 106.3600], label: 'Tiền Giang' },

    // ── Bến Tre ──
    { key: 'ben tre city',     coords: [10.2434, 106.3756], label: 'Bến Tre' },
    { key: 'chau thanh bt',    coords: [10.2282, 106.4565], label: 'Châu Thành, Bến Tre' },
    { key: 'cho lach',         coords: [10.1898, 106.1856], label: 'Chợ Lách, Bến Tre' },
    { key: 'mo cay bac',       coords: [10.1095, 106.2848], label: 'Mỏ Cày Bắc, Bến Tre' },
    { key: 'mo cay nam',       coords: [10.0569, 106.2739], label: 'Mỏ Cày Nam, Bến Tre' },
    { key: 'giong trom',       coords: [10.2222, 106.4180], label: 'Giồng Trôm, Bến Tre' },
    { key: 'binh dai',         coords: [10.1765, 106.6185], label: 'Bình Đại, Bến Tre' },
    { key: 'ba tri',           coords: [10.0358, 106.6048], label: 'Ba Tri, Bến Tre' },
    { key: 'thanh phu',        coords: [9.9397,  106.5347], label: 'Thạnh Phú, Bến Tre' },
    { key: 'ben tre',          coords: [10.2434, 106.3756], label: 'Bến Tre' },

    // ── Vĩnh Long ──
    { key: 'vinh long city',   coords: [10.2560, 105.9726], label: 'Vĩnh Long' },
    { key: 'long ho',          coords: [10.2164, 105.9768], label: 'Long Hồ, Vĩnh Long' },
    { key: 'mang thit',        coords: [10.2083, 106.0499], label: 'Mang Thít, Vĩnh Long' },
    { key: 'vung liem',        coords: [10.1185, 106.1081], label: 'Vũng Liêm, Vĩnh Long' },
    { key: 'tam binh',         coords: [10.0869, 105.9803], label: 'Tam Bình, Vĩnh Long' },
    { key: 'tra on',           coords: [9.9741,  105.9535], label: 'Trà Ôn, Vĩnh Long' },
    { key: 'binh tan vl',      coords: [10.1956, 105.8453], label: 'Bình Tân, Vĩnh Long' },
    { key: 'binh minh vl',     coords: [10.0711, 105.8399], label: 'Bình Minh, Vĩnh Long' },
    { key: 'vinh long',        coords: [10.2560, 105.9726], label: 'Vĩnh Long' },

    // ── Trà Vinh ──
    { key: 'tra vinh city',    coords: [9.9352,  106.3452], label: 'Trà Vinh' },
    { key: 'chau thanh tv',    coords: [9.9637,  106.4082], label: 'Châu Thành, Trà Vinh' },
    { key: 'cang long',        coords: [9.9833,  106.2252], label: 'Càng Long, Trà Vinh' },
    { key: 'cau ke',           coords: [9.8635,  106.0953], label: 'Cầu Kè, Trà Vinh' },
    { key: 'tieu can',         coords: [9.8756,  106.1724], label: 'Tiểu Cần, Trà Vinh' },
    { key: 'cau ngang',        coords: [9.7858,  106.4158], label: 'Cầu Ngang, Trà Vinh' },
    { key: 'tra cu',           coords: [9.6881,  106.3543], label: 'Trà Cú, Trà Vinh' },
    { key: 'duyen hai',        coords: [9.6370,  106.5268], label: 'Duyên Hải, Trà Vinh' },
    { key: 'tra vinh',         coords: [9.9352,  106.3452], label: 'Trà Vinh' },

    // ── Đồng Tháp ──
    { key: 'cao lanh city',    coords: [10.4937, 105.6882], label: 'Cao Lãnh, Đồng Tháp' },
    { key: 'sa dec',           coords: [10.2900, 105.7559], label: 'Sa Đéc, Đồng Tháp' },
    { key: 'hong ngu',         coords: [10.8238, 105.3381], label: 'Hồng Ngự, Đồng Tháp' },
    { key: 'tan hong',         coords: [10.9197, 105.3527], label: 'Tân Hồng, Đồng Tháp' },
    { key: 'tam nong',         coords: [10.7035, 105.5124], label: 'Tam Nông, Đồng Tháp' },
    { key: 'thanh binh dt',    coords: [10.5779, 105.3851], label: 'Thanh Bình, Đồng Tháp' },
    { key: 'lap vo',           coords: [10.3534, 105.6124], label: 'Lấp Vò, Đồng Tháp' },
    { key: 'lai vung',         coords: [10.2637, 105.6602], label: 'Lai Vung, Đồng Tháp' },
    { key: 'chau thanh dt',    coords: [10.3715, 105.7219], label: 'Châu Thành, Đồng Tháp' },
    { key: 'thap muoi',        coords: [10.5937, 105.9218], label: 'Tháp Mười, Đồng Tháp' },
    { key: 'dong thap',        coords: [10.4937, 105.6882], label: 'Đồng Tháp' },

    // ── An Giang ──
    { key: 'long xuyen',       coords: [10.3861, 105.4353], label: 'Long Xuyên, An Giang' },
    { key: 'chau doc',         coords: [10.7025, 105.1201], label: 'Châu Đốc, An Giang' },
    { key: 'an phu ag',        coords: [10.8013, 104.9717], label: 'An Phú, An Giang' },
    { key: 'tan chau ag',      coords: [10.8046, 105.2365], label: 'Tân Châu, An Giang' },
    { key: 'phu tan ag',       coords: [10.5671, 105.3176], label: 'Phú Tân, An Giang' },
    { key: 'chau phu',         coords: [10.5584, 105.1212], label: 'Châu Phú, An Giang' },
    { key: 'tinh bien',        coords: [10.5749, 104.8618], label: 'Tịnh Biên, An Giang' },
    { key: 'tri ton',          coords: [10.4348, 104.9904], label: 'Tri Tôn, An Giang' },
    { key: 'chau thanh ag',    coords: [10.4506, 105.4110], label: 'Châu Thành, An Giang' },
    { key: 'cho moi',          coords: [10.4562, 105.5195], label: 'Chợ Mới, An Giang' },
    { key: 'thoai son',        coords: [10.3135, 105.2380], label: 'Thoại Sơn, An Giang' },
    { key: 'an giang',         coords: [10.3861, 105.4353], label: 'An Giang' },

    // ── Kiên Giang ──
    { key: 'rach gia',         coords: [10.0124, 105.0810], label: 'Rạch Giá, Kiên Giang' },
    { key: 'ha tien',          coords: [10.3858, 104.4882], label: 'Hà Tiên, Kiên Giang' },
    { key: 'phu quoc',         coords: [10.2899, 103.9840], label: 'Phú Quốc, Kiên Giang' },
    { key: 'kien luong',       coords: [10.2770, 104.5874], label: 'Kiên Lương, Kiên Giang' },
    { key: 'hon dat',          coords: [10.2296, 104.7896], label: 'Hòn Đất, Kiên Giang' },
    { key: 'tan hiep kg',      coords: [9.9277,  104.9843], label: 'Tân Hiệp, Kiên Giang' },
    { key: 'chau thanh kg',    coords: [10.0596, 105.2098], label: 'Châu Thành, Kiên Giang' },
    { key: 'giong rieng',      coords: [9.8530,  105.3079], label: 'Giồng Riềng, Kiên Giang' },
    { key: 'go quao',          coords: [9.7279,  105.1620], label: 'Gò Quao, Kiên Giang' },
    { key: 'an bien',          coords: [9.7020,  105.0265], label: 'An Biên, Kiên Giang' },
    { key: 'an minh',          coords: [9.5966,  104.8996], label: 'An Minh, Kiên Giang' },
    { key: 'vinh thuan',       coords: [9.4854,  105.1048], label: 'Vĩnh Thuận, Kiên Giang' },
    { key: 'kien giang',       coords: [10.0124, 105.0810], label: 'Kiên Giang' },

    // ── Cà Mau ──
    { key: 'ca mau city',      coords: [9.1768,  105.1524], label: 'Cà Mau' },
    { key: 'thoi binh',        coords: [9.2839,  105.0183], label: 'Thới Bình, Cà Mau' },
    { key: 'tran van thoi',    coords: [9.1808,  104.8969], label: 'Trần Văn Thời, Cà Mau' },
    { key: 'cai nuoc',         coords: [9.0161,  105.0665], label: 'Cái Nước, Cà Mau' },
    { key: 'phu tan cm',       coords: [9.0491,  104.8580], label: 'Phú Tân, Cà Mau' },
    { key: 'ngoc hien',        coords: [8.8372,  104.9783], label: 'Ngọc Hiển, Cà Mau' },
    { key: 'nam can',          coords: [8.9777,  105.1163], label: 'Năm Căn, Cà Mau' },
    { key: 'dam doi',          coords: [8.9969,  105.2186], label: 'Đầm Dơi, Cà Mau' },
    { key: 'u minh',           coords: [9.3672,  105.0208], label: 'U Minh, Cà Mau' },
    { key: 'ca mau',           coords: [9.1768,  105.1524], label: 'Cà Mau' },

    // ── Hậu Giang ──
    { key: 'vi thanh',         coords: [9.7882,  105.4706], label: 'Vị Thanh, Hậu Giang' },
    { key: 'long my',          coords: [9.7067,  105.6598], label: 'Long Mỹ, Hậu Giang' },
    { key: 'nga bay',          coords: [9.8407,  105.8379], label: 'Ngã Bảy, Hậu Giang' },
    { key: 'chau thanh hg',    coords: [9.7965,  105.7020], label: 'Châu Thành, Hậu Giang' },
    { key: 'chau thanh a',     coords: [10.0132, 105.7540], label: 'Châu Thành A, Hậu Giang' },
    { key: 'phung hiep',       coords: [9.7702,  105.7527], label: 'Phụng Hiệp, Hậu Giang' },
    { key: 'vi thuy',          coords: [9.7588,  105.5277], label: 'Vị Thủy, Hậu Giang' },
    { key: 'hau giang',        coords: [9.7882,  105.4706], label: 'Hậu Giang' },

    // ── Sóc Trăng ──
    { key: 'soc trang city',   coords: [9.6027,  105.9730], label: 'Sóc Trăng' },
    { key: 'chau thanh st',    coords: [9.7100,  105.9610], label: 'Châu Thành, Sóc Trăng' },
    { key: 'ke sach',          coords: [9.7420,  105.8220], label: 'Kế Sách, Sóc Trăng' },
    { key: 'my tu',            coords: [9.6130,  106.0020], label: 'Mỹ Tú, Sóc Trăng' },
    { key: 'cu lao dung',      coords: [9.5040,  106.1610], label: 'Cù Lao Dung, Sóc Trăng' },
    { key: 'long phu st',      coords: [9.5840,  106.0640], label: 'Long Phú, Sóc Trăng' },
    { key: 'my xuyen',         coords: [9.5030,  105.9640], label: 'Mỹ Xuyên, Sóc Trăng' },
    { key: 'nga nam',          coords: [9.5093,  105.6832], label: 'Ngã Năm, Sóc Trăng' },
    { key: 'thanh tri',        coords: [9.6120,  105.7720], label: 'Thạnh Trị, Sóc Trăng' },
    { key: 'vinh chau',        coords: [9.3820,  106.0000], label: 'Vĩnh Châu, Sóc Trăng' },
    { key: 'tran de',          coords: [9.4847,  106.1367], label: 'Trần Đề, Sóc Trăng' },
    { key: 'soc trang',        coords: [9.6027,  105.9730], label: 'Sóc Trăng' },

    // ── Bạc Liêu ──
    { key: 'bac lieu city',    coords: [9.2941,  105.7278], label: 'Bạc Liêu' },
    { key: 'gia rai',          coords: [9.2375,  105.4497], label: 'Giá Rai, Bạc Liêu' },
    { key: 'hoa binh bl',      coords: [9.3503,  105.6164], label: 'Hòa Bình, Bạc Liêu' },
    { key: 'vinh loi',         coords: [9.2818,  105.5876], label: 'Vĩnh Lợi, Bạc Liêu' },
    { key: 'phuoc long bl',    coords: [9.3784,  105.4393], label: 'Phước Long, Bạc Liêu' },
    { key: 'hong dan',         coords: [9.5081,  105.4126], label: 'Hồng Dân, Bạc Liêu' },
    { key: 'dong hai bl',      coords: [9.1649,  105.5869], label: 'Đông Hải, Bạc Liêu' },
    { key: 'bac lieu',         coords: [9.2941,  105.7278], label: 'Bạc Liêu' },

    // ── Cần Thơ ──
    { key: 'ninh kieu',        coords: [10.0278, 105.7469], label: 'Ninh Kiều, Cần Thơ' },
    { key: 'cai rang',         coords: [9.9974,  105.7720], label: 'Cái Răng, Cần Thơ' },
    { key: 'binh thuy',        coords: [10.0686, 105.7268], label: 'Bình Thủy, Cần Thơ' },
    { key: 'o mon',            coords: [10.0866, 105.6786], label: 'Ô Môn, Cần Thơ' },
    { key: 'thot not',         coords: [10.2624, 105.5899], label: 'Thốt Nốt, Cần Thơ' },
    { key: 'phong dien ct',    coords: [9.9750,  105.7260], label: 'Phong Điền, Cần Thơ' },
    { key: 'co do',            coords: [10.1419, 105.6285], label: 'Cờ Đỏ, Cần Thơ' },
    { key: 'thoi lai',         coords: [10.0614, 105.5927], label: 'Thới Lai, Cần Thơ' },
    { key: 'vinh thanh ct',    coords: [10.2924, 105.5468], label: 'Vĩnh Thạnh, Cần Thơ' },
    { key: 'can tho',          coords: [10.0452, 105.7469], label: 'Cần Thơ' },

    // ═══════════════════════ MIỀN TRUNG ═══════════════════════

    // ── Thừa Thiên Huế ──
    { key: 'hue city',         coords: [16.4614, 107.5905], label: 'Huế' },
    { key: 'huong thuy',       coords: [16.3724, 107.6312], label: 'Hương Thủy, Huế' },
    { key: 'huong tra',        coords: [16.5253, 107.5416], label: 'Hương Trà, Huế' },
    { key: 'a luoi',           coords: [16.2196, 107.2291], label: 'A Lưới, Thừa Thiên Huế' },
    { key: 'nam dong',         coords: [16.1451, 107.7135], label: 'Nam Đông, Thừa Thiên Huế' },
    { key: 'phu loc',          coords: [16.2290, 107.8926], label: 'Phú Lộc, Thừa Thiên Huế' },
    { key: 'phu vang',         coords: [16.4000, 107.7239], label: 'Phú Vang, Thừa Thiên Huế' },
    { key: 'phong dien tt',    coords: [16.6581, 107.2946], label: 'Phong Điền, Thừa Thiên Huế' },
    { key: 'quang dien',       coords: [16.5545, 107.4505], label: 'Quảng Điền, Thừa Thiên Huế' },
    { key: 'hue',              coords: [16.4614, 107.5905], label: 'Huế, Thừa Thiên Huế' },
    { key: 'thua thien hue',   coords: [16.4614, 107.5905], label: 'Thừa Thiên Huế' },

    // ── Đà Nẵng ──
    { key: 'hai chau',         coords: [16.0544, 108.2125], label: 'Hải Châu, Đà Nẵng' },
    { key: 'thanh khe',        coords: [16.0695, 108.1878], label: 'Thanh Khê, Đà Nẵng' },
    { key: 'son tra',          coords: [16.0838, 108.2522], label: 'Sơn Trà, Đà Nẵng' },
    { key: 'ngu hanh son',     coords: [16.0117, 108.2487], label: 'Ngũ Hành Sơn, Đà Nẵng' },
    { key: 'lien chieu',       coords: [16.1005, 108.1419], label: 'Liên Chiểu, Đà Nẵng' },
    { key: 'cam le',           coords: [16.0198, 108.1929], label: 'Cẩm Lệ, Đà Nẵng' },
    { key: 'hoa vang',         coords: [16.0020, 108.0950], label: 'Hòa Vang, Đà Nẵng' },
    { key: 'da nang',          coords: [16.0471, 108.2068], label: 'Đà Nẵng' },
    { key: 'danang',           coords: [16.0471, 108.2068], label: 'Đà Nẵng' },

    // ── Quảng Nam ──
    { key: 'tam ky',           coords: [15.5716, 108.4737], label: 'Tam Kỳ, Quảng Nam' },
    { key: 'hoi an',           coords: [15.8801, 108.3380], label: 'Hội An, Quảng Nam' },
    { key: 'dien ban',         coords: [15.8950, 108.2699], label: 'Điện Bàn, Quảng Nam' },
    { key: 'dai loc',          coords: [15.8740, 108.0818], label: 'Đại Lộc, Quảng Nam' },
    { key: 'duy xuyen',        coords: [15.7247, 108.3091], label: 'Duy Xuyên, Quảng Nam' },
    { key: 'thang binh',       coords: [15.7026, 108.3610], label: 'Thăng Bình, Quảng Nam' },
    { key: 'que son',          coords: [15.6880, 108.1951], label: 'Quế Sơn, Quảng Nam' },
    { key: 'nui thanh',        coords: [15.4640, 108.5260], label: 'Núi Thành, Quảng Nam' },
    { key: 'phu ninh',         coords: [15.5480, 108.4200], label: 'Phú Ninh, Quảng Nam' },
    { key: 'tiep phuoc',       coords: [15.5010, 108.1490], label: 'Tiên Phước, Quảng Nam' },
    { key: 'bac tra my',       coords: [15.3620, 108.1918], label: 'Bắc Trà My, Quảng Nam' },
    { key: 'nam tra my',       coords: [15.1774, 108.1001], label: 'Nam Trà My, Quảng Nam' },
    { key: 'quang nam',        coords: [15.5394, 108.0191], label: 'Quảng Nam' },

    // ── Quảng Ngãi ──
    { key: 'quang ngai city',  coords: [15.1205, 108.8031], label: 'Quảng Ngãi' },
    { key: 'binh son',         coords: [15.2843, 108.7434], label: 'Bình Sơn, Quảng Ngãi' },
    { key: 'son tinh',         coords: [15.1879, 108.7399], label: 'Sơn Tịnh, Quảng Ngãi' },
    { key: 'tu nghia',         coords: [15.0878, 108.7984], label: 'Tư Nghĩa, Quảng Ngãi' },
    { key: 'nghia hanh',       coords: [14.9920, 108.7850], label: 'Nghĩa Hành, Quảng Ngãi' },
    { key: 'mo duc',           coords: [14.9478, 108.8190], label: 'Mộ Đức, Quảng Ngãi' },
    { key: 'duc pho',          coords: [14.8600, 108.9170], label: 'Đức Phổ, Quảng Ngãi' },
    { key: 'ly son',           coords: [15.3734, 109.1199], label: 'Lý Sơn, Quảng Ngãi' },
    { key: 'quang ngai',       coords: [15.1205, 108.8031], label: 'Quảng Ngãi' },

    // ── Bình Định ──
    { key: 'quy nhon',         coords: [13.7765, 109.2232], label: 'Quy Nhơn, Bình Định' },
    { key: 'an nhon',          coords: [13.8785, 109.0971], label: 'An Nhơn, Bình Định' },
    { key: 'hoai nhon',        coords: [14.5022, 109.0170], label: 'Hoài Nhơn, Bình Định' },
    { key: 'tay son bd',       coords: [13.9984, 108.9588], label: 'Tây Sơn, Bình Định' },
    { key: 'phu my bd',        coords: [14.2286, 109.0880], label: 'Phù Mỹ, Bình Định' },
    { key: 'phu cat',          coords: [13.9756, 109.0500], label: 'Phù Cát, Bình Định' },
    { key: 'tuy phuoc',        coords: [13.7100, 109.1445], label: 'Tuy Phước, Bình Định' },
    { key: 'binh dinh',        coords: [13.7765, 109.2232], label: 'Bình Định' },

    // ── Phú Yên ──
    { key: 'tuy hoa',          coords: [13.0881, 109.0925], label: 'Tuy Hòa, Phú Yên' },
    { key: 'song cau',         coords: [13.4830, 109.2190], label: 'Sông Cầu, Phú Yên' },
    { key: 'dong hoa py',      coords: [13.0430, 109.1890], label: 'Đông Hòa, Phú Yên' },
    { key: 'tuy an',           coords: [13.1560, 109.1610], label: 'Tuy An, Phú Yên' },
    { key: 'son hoa',          coords: [13.0820, 108.8590], label: 'Sơn Hòa, Phú Yên' },
    { key: 'song hinh',        coords: [12.9760, 108.9510], label: 'Sông Hinh, Phú Yên' },
    { key: 'dong xuan',        coords: [13.3450, 108.9250], label: 'Đồng Xuân, Phú Yên' },
    { key: 'phu yen',          coords: [13.0881, 109.0925], label: 'Phú Yên' },

    // ── Khánh Hòa ──
    { key: 'nha trang',        coords: [12.2388, 109.1967], label: 'Nha Trang, Khánh Hòa' },
    { key: 'cam ranh',         coords: [11.9197, 109.1572], label: 'Cam Ranh, Khánh Hòa' },
    { key: 'ninh hoa',         coords: [12.4918, 109.1200], label: 'Ninh Hòa, Khánh Hòa' },
    { key: 'dien khanh',       coords: [12.2559, 109.0848], label: 'Diên Khánh, Khánh Hòa' },
    { key: 'van ninh',         coords: [12.6500, 109.2300], label: 'Vạn Ninh, Khánh Hòa' },
    { key: 'cam lam',          coords: [12.1430, 109.1250], label: 'Cam Lâm, Khánh Hòa' },
    { key: 'khanh vinh',       coords: [12.2510, 108.8140], label: 'Khánh Vĩnh, Khánh Hòa' },
    { key: 'khanh son',        coords: [12.0540, 108.8760], label: 'Khánh Sơn, Khánh Hòa' },
    { key: 'khanh hoa',        coords: [12.2388, 109.1967], label: 'Khánh Hòa' },

    // ── Ninh Thuận ──
    { key: 'phan rang',        coords: [11.5639, 108.9886], label: 'Phan Rang, Ninh Thuận' },
    { key: 'ninh hai',         coords: [11.7300, 109.0028], label: 'Ninh Hải, Ninh Thuận' },
    { key: 'ninh phuoc',       coords: [11.4350, 108.9700], label: 'Ninh Phước, Ninh Thuận' },
    { key: 'ninh son',         coords: [11.6280, 108.7960], label: 'Ninh Sơn, Ninh Thuận' },
    { key: 'thuan bac',        coords: [11.7860, 108.9330], label: 'Thuận Bắc, Ninh Thuận' },
    { key: 'thuan nam',        coords: [11.3700, 108.9160], label: 'Thuận Nam, Ninh Thuận' },
    { key: 'ninh thuan',       coords: [11.5639, 108.9886], label: 'Ninh Thuận' },

    // ── Bình Thuận ──
    { key: 'phan thiet',       coords: [10.9289, 108.1021], label: 'Phan Thiết, Bình Thuận' },
    { key: 'la gi',            coords: [10.6567, 107.7660], label: 'La Gi, Bình Thuận' },
    { key: 'tuy phong',        coords: [11.3440, 108.7490], label: 'Tuy Phong, Bình Thuận' },
    { key: 'bac binh',         coords: [11.2050, 108.5430], label: 'Bắc Bình, Bình Thuận' },
    { key: 'ham thuan bac',    coords: [11.0620, 108.0530], label: 'Hàm Thuận Bắc, Bình Thuận' },
    { key: 'ham thuan nam',    coords: [10.8080, 108.0680], label: 'Hàm Thuận Nam, Bình Thuận' },
    { key: 'tanh linh',        coords: [11.1220, 107.7620], label: 'Tánh Linh, Bình Thuận' },
    { key: 'duc linh',         coords: [11.2840, 107.6690], label: 'Đức Linh, Bình Thuận' },
    { key: 'ham tan',          coords: [10.7890, 107.7860], label: 'Hàm Tân, Bình Thuận' },
    { key: 'phu quy',          coords: [10.5147, 108.9283], label: 'Phú Quý, Bình Thuận' },
    { key: 'binh thuan',       coords: [11.0892, 108.0720], label: 'Bình Thuận' },

    // ── Lâm Đồng ──
    { key: 'da lat',           coords: [11.9404, 108.4583], label: 'Đà Lạt, Lâm Đồng' },
    { key: 'bao loc',          coords: [11.5453, 107.8073], label: 'Bảo Lộc, Lâm Đồng' },
    { key: 'lac duong',        coords: [12.0810, 108.5870], label: 'Lạc Dương, Lâm Đồng' },
    { key: 'lam ha',           coords: [11.8010, 108.3020], label: 'Lâm Hà, Lâm Đồng' },
    { key: 'don duong',        coords: [11.7820, 108.6000], label: 'Đơn Dương, Lâm Đồng' },
    { key: 'duc trong',        coords: [11.7670, 108.3350], label: 'Đức Trọng, Lâm Đồng' },
    { key: 'di linh',          coords: [11.5840, 108.0680], label: 'Di Linh, Lâm Đồng' },
    { key: 'bao lam',          coords: [11.6320, 107.9730], label: 'Bảo Lâm, Lâm Đồng' },
    { key: 'da huoai',         coords: [11.4480, 107.7260], label: 'Đạ Huoai, Lâm Đồng' },
    { key: 'da teh',           coords: [11.5160, 107.7680], label: 'Đạ Tẻh, Lâm Đồng' },
    { key: 'cat tien',         coords: [11.5520, 107.5390], label: 'Cát Tiên, Lâm Đồng' },
    { key: 'lam dong',         coords: [11.9404, 108.4583], label: 'Lâm Đồng' },

    // ── Đắk Lắk ──
    { key: 'buon ma thuot',    coords: [12.7100, 108.2378], label: 'Buôn Ma Thuột, Đắk Lắk' },
    { key: 'buon ho',          coords: [12.9133, 108.2670], label: 'Buôn Hồ, Đắk Lắk' },
    { key: 'ea hleo',          coords: [13.0860, 108.0950], label: 'Ea H\'leo, Đắk Lắk' },
    { key: 'ea sup',           coords: [13.0620, 107.9780], label: 'Ea Súp, Đắk Lắk' },
    { key: 'krong nang',       coords: [12.9580, 108.3250], label: 'Krông Năng, Đắk Lắk' },
    { key: 'buon don',         coords: [12.7580, 107.9960], label: 'Buôn Đôn, Đắk Lắk' },
    { key: 'cu mgar',          coords: [12.7960, 108.1470], label: 'Cư M\'gar, Đắk Lắk' },
    { key: 'ea kar',           coords: [12.7980, 108.4490], label: 'Ea Kar, Đắk Lắk' },
    { key: 'mdrak',            coords: [12.6880, 108.7690], label: 'M\'Đrắk, Đắk Lắk' },
    { key: 'krong bong',       coords: [12.5450, 108.5450], label: 'Krông Bông, Đắk Lắk' },
    { key: 'krong ana',        coords: [12.5660, 108.0520], label: 'Krông Ana, Đắk Lắk' },
    { key: 'lak',              coords: [12.3680, 108.1890], label: 'Lắk, Đắk Lắk' },
    { key: 'krong pak',        coords: [12.7490, 108.4080], label: 'Krông Pắk, Đắk Lắk' },
    { key: 'dak lak',          coords: [12.7100, 108.2378], label: 'Đắk Lắk' },

    // ── Đắk Nông ──
    { key: 'gia nghia',        coords: [12.0004, 107.6924], label: 'Gia Nghĩa, Đắk Nông' },
    { key: 'dak mil',          coords: [12.4490, 107.6280], label: 'Đắk Mil, Đắk Nông' },
    { key: 'krong no',         coords: [12.1130, 107.7410], label: 'Krông Nô, Đắk Nông' },
    { key: 'dak song',         coords: [12.0370, 107.5450], label: 'Đắk Song, Đắk Nông' },
    { key: 'dak rlap',         coords: [11.9430, 107.7330], label: 'Đắk R\'Lấp, Đắk Nông' },
    { key: 'dak glong',        coords: [11.9100, 107.9590], label: 'Đắk Glong, Đắk Nông' },
    { key: 'cu jut',           coords: [12.3820, 107.7640], label: 'Cư Jút, Đắk Nông' },
    { key: 'tuy duc',          coords: [11.9880, 107.4810], label: 'Tuy Đức, Đắk Nông' },
    { key: 'dak nong',         coords: [12.0004, 107.6924], label: 'Đắk Nông' },

    // ── Gia Lai ──
    { key: 'pleiku',           coords: [13.9784, 108.0021], label: 'Pleiku, Gia Lai' },
    { key: 'an khe',           coords: [13.9573, 108.6484], label: 'An Khê, Gia Lai' },
    { key: 'ayun pa',          coords: [13.3790, 108.4470], label: 'Ayun Pa, Gia Lai' },
    { key: 'kbang',            coords: [14.2850, 108.7680], label: 'Kbang, Gia Lai' },
    { key: 'dak doa',          coords: [13.9420, 107.9870], label: 'Đak Đoa, Gia Lai' },
    { key: 'chu pah',          coords: [14.1290, 107.9770], label: 'Chư Păh, Gia Lai' },
    { key: 'ia grai',          coords: [13.9200, 107.6770], label: 'Ia Grai, Gia Lai' },
    { key: 'mang yang',        coords: [13.8370, 108.2010], label: 'Mang Yang, Gia Lai' },
    { key: 'duc co',           coords: [13.8490, 107.5370], label: 'Đức Cơ, Gia Lai' },
    { key: 'chu prong',        coords: [13.7480, 107.7980], label: 'Chư Prông, Gia Lai' },
    { key: 'chu se',           coords: [13.6780, 108.0870], label: 'Chư Sê, Gia Lai' },
    { key: 'krong pa',         coords: [13.1820, 108.7340], label: 'Krông Pa, Gia Lai' },
    { key: 'phu thien',        coords: [13.5980, 108.3140], label: 'Phú Thiện, Gia Lai' },
    { key: 'gia lai',          coords: [13.9784, 108.0021], label: 'Gia Lai' },

    // ── Kon Tum ──
    { key: 'kon tum city',     coords: [14.3544, 107.9921], label: 'Kon Tum' },
    { key: 'dak glei',         coords: [15.0950, 107.8470], label: 'Đắk Glei, Kon Tum' },
    { key: 'ngoc hoi',         coords: [14.7740, 107.6840], label: 'Ngọc Hồi, Kon Tum' },
    { key: 'dak to',           coords: [14.6670, 107.9810], label: 'Đắk Tô, Kon Tum' },
    { key: 'kon plong',        coords: [14.6310, 108.3020], label: 'Kon Plông, Kon Tum' },
    { key: 'sa thay',          coords: [14.2230, 107.7560], label: 'Sa Thầy, Kon Tum' },
    { key: 'dak ha',           coords: [14.5310, 107.9550], label: 'Đắk Hà, Kon Tum' },
    { key: 'kon tum',          coords: [14.3544, 107.9921], label: 'Kon Tum' },

    // ── Quảng Bình ──
    { key: 'dong hoi',         coords: [17.4694, 106.5993], label: 'Đồng Hới, Quảng Bình' },
    { key: 'ba don',           coords: [17.7490, 106.4370], label: 'Ba Đồn, Quảng Bình' },
    { key: 'minh hoa',         coords: [17.8040, 106.0920], label: 'Minh Hóa, Quảng Bình' },
    { key: 'tuyen hoa',        coords: [17.7080, 106.0750], label: 'Tuyên Hóa, Quảng Bình' },
    { key: 'bo trach',         coords: [17.6190, 106.4940], label: 'Bố Trạch, Quảng Bình' },
    { key: 'quang ninh qb',    coords: [17.3220, 106.6260], label: 'Quảng Ninh, Quảng Bình' },
    { key: 'le thuy',          coords: [17.1370, 106.7080], label: 'Lệ Thủy, Quảng Bình' },
    { key: 'quang binh',       coords: [17.4694, 106.5993], label: 'Quảng Bình' },

    // ── Quảng Trị ──
    { key: 'dong ha',          coords: [16.7496, 107.1879], label: 'Đông Hà, Quảng Trị' },
    { key: 'quang tri city',   coords: [16.7498, 107.1924], label: 'Quảng Trị' },
    { key: 'vinh linh',        coords: [17.0490, 107.0830], label: 'Vĩnh Linh, Quảng Trị' },
    { key: 'huong hoa',        coords: [16.8620, 106.7500], label: 'Hướng Hóa, Quảng Trị' },
    { key: 'gio linh',         coords: [16.9250, 107.1190], label: 'Gio Linh, Quảng Trị' },
    { key: 'cam lo',           coords: [16.7870, 107.0390], label: 'Cam Lộ, Quảng Trị' },
    { key: 'trieu phong',      coords: [16.6890, 107.1470], label: 'Triệu Phong, Quảng Trị' },
    { key: 'hai lang',         coords: [16.6280, 107.2190], label: 'Hải Lăng, Quảng Trị' },
    { key: 'quang tri',        coords: [16.7496, 107.1879], label: 'Quảng Trị' },

    // ── Nghệ An ──
    { key: 'vinh city',        coords: [18.6734, 105.6922], label: 'Vinh, Nghệ An' },
    { key: 'cua lo',           coords: [18.7935, 105.7289], label: 'Cửa Lò, Nghệ An' },
    { key: 'thai hoa na',      coords: [19.3670, 105.4410], label: 'Thái Hòa, Nghệ An' },
    { key: 'quynh luu',        coords: [19.1120, 105.6510], label: 'Quỳnh Lưu, Nghệ An' },
    { key: 'dien chau',        coords: [18.9470, 105.5620], label: 'Diễn Châu, Nghệ An' },
    { key: 'yen thanh na',     coords: [19.0240, 105.4800], label: 'Yên Thành, Nghệ An' },
    { key: 'do luong',         coords: [18.8920, 105.3530], label: 'Đô Lương, Nghệ An' },
    { key: 'nghi loc',         coords: [18.7620, 105.7190], label: 'Nghi Lộc, Nghệ An' },
    { key: 'hung nguyen',      coords: [18.7350, 105.6190], label: 'Hưng Nguyên, Nghệ An' },
    { key: 'nam dan',          coords: [18.7090, 105.4820], label: 'Nam Đàn, Nghệ An' },
    { key: 'thanh chuong',     coords: [18.7340, 105.2280], label: 'Thanh Chương, Nghệ An' },
    { key: 'con cuong',        coords: [19.0520, 104.8860], label: 'Con Cuông, Nghệ An' },
    { key: 'tan ky',           coords: [19.1830, 105.2230], label: 'Tân Kỳ, Nghệ An' },
    { key: 'nghia dan',        coords: [19.3720, 105.3090], label: 'Nghĩa Đàn, Nghệ An' },
    { key: 'quy hop',          coords: [19.3890, 105.1140], label: 'Quỳ Hợp, Nghệ An' },
    { key: 'hoang mai na',     coords: [19.1600, 105.6100], label: 'Hoàng Mai, Nghệ An' },
    { key: 'nghe an',          coords: [18.6734, 105.6922], label: 'Nghệ An' },

    // ── Hà Tĩnh ──
    { key: 'ha tinh city',     coords: [18.3428, 105.9057], label: 'Hà Tĩnh' },
    { key: 'hong linh',        coords: [18.5050, 105.7440], label: 'Hồng Lĩnh, Hà Tĩnh' },
    { key: 'huong son',        coords: [18.5680, 105.4480], label: 'Hương Sơn, Hà Tĩnh' },
    { key: 'duc tho',          coords: [18.5240, 105.6270], label: 'Đức Thọ, Hà Tĩnh' },
    { key: 'can loc',          coords: [18.3980, 105.7390], label: 'Can Lộc, Hà Tĩnh' },
    { key: 'huong khe',        coords: [18.2750, 105.7060], label: 'Hương Khê, Hà Tĩnh' },
    { key: 'thach ha',         coords: [18.3200, 105.9770], label: 'Thạch Hà, Hà Tĩnh' },
    { key: 'cam xuyen',        coords: [18.2180, 105.9530], label: 'Cẩm Xuyên, Hà Tĩnh' },
    { key: 'ky anh',           coords: [18.0800, 106.2760], label: 'Kỳ Anh, Hà Tĩnh' },
    { key: 'loc ha',           coords: [18.4570, 105.8550], label: 'Lộc Hà, Hà Tĩnh' },
    { key: 'ha tinh',          coords: [18.3428, 105.9057], label: 'Hà Tĩnh' },

    // ── Thanh Hóa ──
    { key: 'thanh hoa city',   coords: [19.8067, 105.7852], label: 'Thanh Hóa' },
    { key: 'sam son',          coords: [19.7414, 105.9076], label: 'Sầm Sơn, Thanh Hóa' },
    { key: 'bim son',          coords: [20.0887, 105.8623], label: 'Bỉm Sơn, Thanh Hóa' },
    { key: 'ngoc lac',         coords: [20.0750, 105.4200], label: 'Ngọc Lặc, Thanh Hóa' },
    { key: 'thach thanh',      coords: [20.2100, 105.5920], label: 'Thạch Thành, Thanh Hóa' },
    { key: 'ha trung',         coords: [20.0050, 105.8190], label: 'Hà Trung, Thanh Hóa' },
    { key: 'vinh loc',         coords: [20.0500, 105.7250], label: 'Vĩnh Lộc, Thanh Hóa' },
    { key: 'tho xuan',         coords: [19.9400, 105.5220], label: 'Thọ Xuân, Thanh Hóa' },
    { key: 'thuong xuan',      coords: [19.8490, 105.1830], label: 'Thường Xuân, Thanh Hóa' },
    { key: 'nhu xuan',         coords: [19.6320, 105.3030], label: 'Như Xuân, Thanh Hóa' },
    { key: 'tinh gia',         coords: [19.5770, 105.9280], label: 'Tĩnh Gia, Thanh Hóa' },
    { key: 'hoang hoa',        coords: [19.8700, 105.8390], label: 'Hoằng Hóa, Thanh Hóa' },
    { key: 'nong cong',        coords: [19.6020, 105.6440], label: 'Nông Cống, Thanh Hóa' },
    { key: 'thanh hoa',        coords: [19.8067, 105.7852], label: 'Thanh Hóa' },

    // ═══════════════════════ MIỀN BẮC ═══════════════════════

    // ── Hà Nội ──
    { key: 'ba dinh',          coords: [21.0358, 105.8411], label: 'Ba Đình, Hà Nội' },
    { key: 'hoan kiem',        coords: [21.0285, 105.8542], label: 'Hoàn Kiếm, Hà Nội' },
    { key: 'tay ho',           coords: [21.0673, 105.8289], label: 'Tây Hồ, Hà Nội' },
    { key: 'long bien hn',     coords: [21.0452, 105.9010], label: 'Long Biên, Hà Nội' },
    { key: 'cau giay',         coords: [21.0391, 105.7996], label: 'Cầu Giấy, Hà Nội' },
    { key: 'dong da',          coords: [21.0272, 105.8414], label: 'Đống Đa, Hà Nội' },
    { key: 'hai ba trung',     coords: [21.0039, 105.8623], label: 'Hai Bà Trưng, Hà Nội' },
    { key: 'hoang mai hn',     coords: [20.9852, 105.8656], label: 'Hoàng Mai, Hà Nội' },
    { key: 'thanh xuan',       coords: [21.0032, 105.8153], label: 'Thanh Xuân, Hà Nội' },
    { key: 'ha dong',          coords: [20.9621, 105.7790], label: 'Hà Đông, Hà Nội' },
    { key: 'bac tu liem',      coords: [21.0650, 105.7824], label: 'Bắc Từ Liêm, Hà Nội' },
    { key: 'nam tu liem',      coords: [21.0302, 105.7618], label: 'Nam Từ Liêm, Hà Nội' },
    { key: 'soc son',          coords: [21.2650, 105.8440], label: 'Sóc Sơn, Hà Nội' },
    { key: 'dong anh',         coords: [21.1464, 105.8427], label: 'Đông Anh, Hà Nội' },
    { key: 'gia lam',          coords: [21.0065, 105.9291], label: 'Gia Lâm, Hà Nội' },
    { key: 'me linh',          coords: [21.1793, 105.7361], label: 'Mê Linh, Hà Nội' },
    { key: 'hoai duc',         coords: [21.0164, 105.7278], label: 'Hoài Đức, Hà Nội' },
    { key: 'dan phuong',       coords: [21.0797, 105.6952], label: 'Đan Phượng, Hà Nội' },
    { key: 'thach that',       coords: [21.0247, 105.6323], label: 'Thạch Thất, Hà Nội' },
    { key: 'phuc tho',         coords: [21.1056, 105.6530], label: 'Phúc Thọ, Hà Nội' },
    { key: 'ba vi',            coords: [21.1272, 105.4157], label: 'Ba Vì, Hà Nội' },
    { key: 'quoc oai',         coords: [20.9997, 105.6476], label: 'Quốc Oai, Hà Nội' },
    { key: 'chuong my',        coords: [20.8877, 105.7191], label: 'Chương Mỹ, Hà Nội' },
    { key: 'thanh oai',        coords: [20.8695, 105.8049], label: 'Thanh Oai, Hà Nội' },
    { key: 'thuong tin',       coords: [20.8672, 105.8662], label: 'Thường Tín, Hà Nội' },
    { key: 'phu xuyen',        coords: [20.7239, 105.8895], label: 'Phú Xuyên, Hà Nội' },
    { key: 'my duc',           coords: [20.7030, 105.7011], label: 'Mỹ Đức, Hà Nội' },
    { key: 'ung hoa',          coords: [20.7573, 105.7814], label: 'Ứng Hòa, Hà Nội' },
    { key: 'thanh tri',        coords: [20.9399, 105.8487], label: 'Thanh Trì, Hà Nội' },
    { key: 'son tay',          coords: [21.1306, 105.5027], label: 'Sơn Tây, Hà Nội' },
    { key: 'ha noi',           coords: [21.0285, 105.8542], label: 'Hà Nội' },
    { key: 'hanoi',            coords: [21.0285, 105.8542], label: 'Hà Nội' },

    // ── Hải Phòng ──
    { key: 'hong bang',        coords: [20.8583, 106.6708], label: 'Hồng Bàng, Hải Phòng' },
    { key: 'ngo quyen',        coords: [20.8624, 106.7018], label: 'Ngô Quyền, Hải Phòng' },
    { key: 'le chan',          coords: [20.8460, 106.6876], label: 'Lê Chân, Hải Phòng' },
    { key: 'hai an',           coords: [20.8380, 106.7449], label: 'Hải An, Hải Phòng' },
    { key: 'kien an',          coords: [20.8124, 106.6435], label: 'Kiến An, Hải Phòng' },
    { key: 'do son',           coords: [20.7195, 106.7624], label: 'Đồ Sơn, Hải Phòng' },
    { key: 'duong kinh',       coords: [20.7695, 106.7295], label: 'Dương Kinh, Hải Phòng' },
    { key: 'thuy nguyen',      coords: [20.9305, 106.7109], label: 'Thuỷ Nguyên, Hải Phòng' },
    { key: 'an duong hp',      coords: [20.9082, 106.6447], label: 'An Dương, Hải Phòng' },
    { key: 'an lao hp',        coords: [20.7980, 106.5680], label: 'An Lão, Hải Phòng' },
    { key: 'kien thuy',        coords: [20.7670, 106.6310], label: 'Kiến Thuỵ, Hải Phòng' },
    { key: 'tien lang hp',     coords: [20.7228, 106.4897], label: 'Tiên Lãng, Hải Phòng' },
    { key: 'vinh bao',         coords: [20.7097, 106.3914], label: 'Vĩnh Bảo, Hải Phòng' },
    { key: 'cat hai',          coords: [20.8038, 106.9239], label: 'Cát Hải, Hải Phòng' },
    { key: 'hai phong',        coords: [20.8449, 106.6881], label: 'Hải Phòng' },

    // ── Quảng Ninh ──
    { key: 'ha long',          coords: [20.9396, 107.0851], label: 'Hạ Long, Quảng Ninh' },
    { key: 'mong cai',         coords: [21.5254, 107.9569], label: 'Móng Cái, Quảng Ninh' },
    { key: 'cam pha',          coords: [21.0170, 107.3430], label: 'Cẩm Phả, Quảng Ninh' },
    { key: 'uong bi',          coords: [21.0340, 106.7720], label: 'Uông Bí, Quảng Ninh' },
    { key: 'dong trieu',       coords: [21.1670, 106.6860], label: 'Đông Triều, Quảng Ninh' },
    { key: 'quang yen',        coords: [20.9440, 106.8090], label: 'Quảng Yên, Quảng Ninh' },
    { key: 'binh lieu',        coords: [21.5390, 107.6050], label: 'Bình Liêu, Quảng Ninh' },
    { key: 'tien yen',         coords: [21.3330, 107.4020], label: 'Tiên Yên, Quảng Ninh' },
    { key: 'dam ha',           coords: [21.3900, 107.5430], label: 'Đầm Hà, Quảng Ninh' },
    { key: 'hai ha',           coords: [21.4730, 107.8060], label: 'Hải Hà, Quảng Ninh' },
    { key: 'van don',          coords: [21.0780, 107.4610], label: 'Vân Đồn, Quảng Ninh' },
    { key: 'co to',            coords: [20.9760, 107.7770], label: 'Cô Tô, Quảng Ninh' },
    { key: 'ba che',           coords: [21.3390, 107.2590], label: 'Ba Chẽ, Quảng Ninh' },
    { key: 'quang ninh',       coords: [21.0064, 107.2925], label: 'Quảng Ninh' },

    // ── Hải Dương ──
    { key: 'hai duong city',   coords: [20.9373, 106.3145], label: 'Hải Dương' },
    { key: 'chi linh',         coords: [21.1388, 106.3835], label: 'Chí Linh, Hải Dương' },
    { key: 'kinh mon',         coords: [21.0110, 106.5370], label: 'Kinh Môn, Hải Dương' },
    { key: 'nam sach',         coords: [21.0150, 106.3070], label: 'Nam Sách, Hải Dương' },
    { key: 'thanh ha hd',      coords: [20.8870, 106.4020], label: 'Thanh Hà, Hải Dương' },
    { key: 'cam giang',        coords: [20.9640, 106.2410], label: 'Cẩm Giàng, Hải Dương' },
    { key: 'gia loc',          coords: [20.8580, 106.2940], label: 'Gia Lộc, Hải Dương' },
    { key: 'tu ky',            coords: [20.8050, 106.4240], label: 'Tứ Kỳ, Hải Dương' },
    { key: 'ninh giang hd',    coords: [20.7330, 106.3960], label: 'Ninh Giang, Hải Dương' },
    { key: 'thanh mien',       coords: [20.7510, 106.2570], label: 'Thanh Miện, Hải Dương' },
    { key: 'kim thanh',        coords: [20.8900, 106.4840], label: 'Kim Thành, Hải Dương' },
    { key: 'hai duong',        coords: [20.9373, 106.3145], label: 'Hải Dương' },

    // ── Hưng Yên ──
    { key: 'hung yen city',    coords: [20.6465, 106.0511], label: 'Hưng Yên' },
    { key: 'my hao',           coords: [20.9303, 106.0534], label: 'Mỹ Hào, Hưng Yên' },
    { key: 'an thi',           coords: [20.7520, 106.0490], label: 'Ân Thi, Hưng Yên' },
    { key: 'khoai chau',       coords: [20.7670, 106.0040], label: 'Khoái Châu, Hưng Yên' },
    { key: 'kim dong',         coords: [20.7000, 106.0580], label: 'Kim Động, Hưng Yên' },
    { key: 'tien lu',          coords: [20.6430, 106.1230], label: 'Tiên Lữ, Hưng Yên' },
    { key: 'phu cu',           coords: [20.6390, 106.2040], label: 'Phù Cừ, Hưng Yên' },
    { key: 'van giang',        coords: [20.9468, 105.9854], label: 'Văn Giang, Hưng Yên' },
    { key: 'van lam',          coords: [20.9730, 106.0550], label: 'Văn Lâm, Hưng Yên' },
    { key: 'yen my',           coords: [20.9410, 105.9900], label: 'Yên Mỹ, Hưng Yên' },
    { key: 'hung yen',         coords: [20.6465, 106.0511], label: 'Hưng Yên' },

    // ── Bắc Ninh ──
    { key: 'bac ninh city',    coords: [21.1861, 106.0763], label: 'Bắc Ninh' },
    { key: 'tu son',           coords: [21.0996, 105.9905], label: 'Từ Sơn, Bắc Ninh' },
    { key: 'tien du',          coords: [21.1250, 106.0420], label: 'Tiên Du, Bắc Ninh' },
    { key: 'yen phong',        coords: [21.1720, 105.9600], label: 'Yên Phong, Bắc Ninh' },
    { key: 'que vo',           coords: [21.2230, 106.1470], label: 'Quế Võ, Bắc Ninh' },
    { key: 'thuan thanh',      coords: [21.0520, 106.0840], label: 'Thuận Thành, Bắc Ninh' },
    { key: 'gia binh',         coords: [21.0130, 106.2080], label: 'Gia Bình, Bắc Ninh' },
    { key: 'luong tai',        coords: [20.9570, 106.2340], label: 'Lương Tài, Bắc Ninh' },
    { key: 'bac ninh',         coords: [21.1861, 106.0763], label: 'Bắc Ninh' },

    // ── Vĩnh Phúc ──
    { key: 'vinh yen',         coords: [21.3609, 105.5474], label: 'Vĩnh Yên, Vĩnh Phúc' },
    { key: 'phuc yen',         coords: [21.2550, 105.7238], label: 'Phúc Yên, Vĩnh Phúc' },
    { key: 'lap thach',        coords: [21.4670, 105.4740], label: 'Lập Thạch, Vĩnh Phúc' },
    { key: 'tam duong',        coords: [21.3880, 105.5980], label: 'Tam Dương, Vĩnh Phúc' },
    { key: 'tam dao',          coords: [21.4870, 105.6230], label: 'Tam Đảo, Vĩnh Phúc' },
    { key: 'binh xuyen',       coords: [21.3150, 105.6200], label: 'Bình Xuyên, Vĩnh Phúc' },
    { key: 'yen lac',          coords: [21.2650, 105.5670], label: 'Yên Lạc, Vĩnh Phúc' },
    { key: 'vinh tuong',       coords: [21.2450, 105.4420], label: 'Vĩnh Tường, Vĩnh Phúc' },
    { key: 'song lo',          coords: [21.5200, 105.5240], label: 'Sông Lô, Vĩnh Phúc' },
    { key: 'vinh phuc',        coords: [21.3609, 105.5474], label: 'Vĩnh Phúc' },

    // ── Hà Nam ──
    { key: 'phu ly',           coords: [20.5411, 105.9101], label: 'Phủ Lý, Hà Nam' },
    { key: 'duy tien',         coords: [20.5900, 105.9610], label: 'Duy Tiên, Hà Nam' },
    { key: 'kim bang',         coords: [20.5530, 105.8160], label: 'Kim Bảng, Hà Nam' },
    { key: 'thanh liem',       coords: [20.4200, 105.9270], label: 'Thanh Liêm, Hà Nam' },
    { key: 'binh luc',         coords: [20.4430, 106.0560], label: 'Bình Lục, Hà Nam' },
    { key: 'ly nhan',          coords: [20.5390, 106.1260], label: 'Lý Nhân, Hà Nam' },
    { key: 'ha nam',           coords: [20.5411, 105.9101], label: 'Hà Nam' },

    // ── Nam Định ──
    { key: 'nam dinh city',    coords: [20.4388, 106.1621], label: 'Nam Định' },
    { key: 'my loc',           coords: [20.5010, 106.1540], label: 'Mỹ Lộc, Nam Định' },
    { key: 'vu ban',           coords: [20.4520, 106.0610], label: 'Vụ Bản, Nam Định' },
    { key: 'y yen',            coords: [20.3240, 106.0350], label: 'Ý Yên, Nam Định' },
    { key: 'nghia hung',       coords: [20.2500, 106.1010], label: 'Nghĩa Hưng, Nam Định' },
    { key: 'nam truc',         coords: [20.3630, 106.2000], label: 'Nam Trực, Nam Định' },
    { key: 'truc ninh',        coords: [20.3540, 106.2740], label: 'Trực Ninh, Nam Định' },
    { key: 'xuan truong',      coords: [20.3950, 106.3460], label: 'Xuân Trường, Nam Định' },
    { key: 'giao thuy',        coords: [20.3090, 106.4260], label: 'Giao Thủy, Nam Định' },
    { key: 'hai hau',          coords: [20.2810, 106.3840], label: 'Hải Hậu, Nam Định' },
    { key: 'nam dinh',         coords: [20.4388, 106.1621], label: 'Nam Định' },

    // ── Thái Bình ──
    { key: 'thai binh city',   coords: [20.4463, 106.3375], label: 'Thái Bình' },
    { key: 'quynh phu',        coords: [20.5360, 106.4020], label: 'Quỳnh Phụ, Thái Bình' },
    { key: 'hung ha',          coords: [20.5110, 106.2600], label: 'Hưng Hà, Thái Bình' },
    { key: 'dong hung tb',     coords: [20.4310, 106.3850], label: 'Đông Hưng, Thái Bình' },
    { key: 'vu thu',           coords: [20.3780, 106.3020], label: 'Vũ Thư, Thái Bình' },
    { key: 'kien xuong',       coords: [20.3350, 106.4280], label: 'Kiến Xương, Thái Bình' },
    { key: 'tien hai',         coords: [20.2920, 106.5460], label: 'Tiền Hải, Thái Bình' },
    { key: 'thai thuy',        coords: [20.5070, 106.5130], label: 'Thái Thụy, Thái Bình' },
    { key: 'thai binh',        coords: [20.4463, 106.3375], label: 'Thái Bình' },

    // ── Ninh Bình ──
    { key: 'ninh binh city',   coords: [20.2506, 105.9745], label: 'Ninh Bình' },
    { key: 'tam diep',         coords: [20.2180, 105.8740], label: 'Tam Điệp, Ninh Bình' },
    { key: 'nho quan',         coords: [20.3340, 105.7470], label: 'Nho Quan, Ninh Bình' },
    { key: 'gia vien',         coords: [20.2960, 105.8540], label: 'Gia Viễn, Ninh Bình' },
    { key: 'hoa lu',           coords: [20.2660, 105.9450], label: 'Hoa Lư, Ninh Bình' },
    { key: 'yen khanh',        coords: [20.2030, 106.0640], label: 'Yên Khánh, Ninh Bình' },
    { key: 'yen mo',           coords: [20.1880, 105.9950], label: 'Yên Mô, Ninh Bình' },
    { key: 'kim son',          coords: [20.0810, 106.1540], label: 'Kim Sơn, Ninh Bình' },
    { key: 'ninh binh',        coords: [20.2506, 105.9745], label: 'Ninh Bình' },

    // ── Bắc Giang ──
    { key: 'bac giang city',   coords: [21.2820, 106.1979], label: 'Bắc Giang' },
    { key: 'yen the',          coords: [21.4380, 106.1550], label: 'Yên Thế, Bắc Giang' },
    { key: 'tan yen',          coords: [21.3130, 106.0250], label: 'Tân Yên, Bắc Giang' },
    { key: 'lang giang',       coords: [21.3710, 106.2530], label: 'Lạng Giang, Bắc Giang' },
    { key: 'luc nam',          coords: [21.3700, 106.4260], label: 'Lục Nam, Bắc Giang' },
    { key: 'luc ngan',         coords: [21.3930, 106.5430], label: 'Lục Ngạn, Bắc Giang' },
    { key: 'son dong',         coords: [21.3200, 106.7930], label: 'Sơn Động, Bắc Giang' },
    { key: 'yen dung',         coords: [21.2280, 106.2950], label: 'Yên Dũng, Bắc Giang' },
    { key: 'viet yen',         coords: [21.2590, 106.0880], label: 'Việt Yên, Bắc Giang' },
    { key: 'hiep hoa',         coords: [21.3670, 105.9850], label: 'Hiệp Hòa, Bắc Giang' },
    { key: 'bac giang',        coords: [21.2820, 106.1979], label: 'Bắc Giang' },

    // ── Thái Nguyên ──
    { key: 'thai nguyen city', coords: [21.5670, 105.8252], label: 'Thái Nguyên' },
    { key: 'song cong',        coords: [21.4570, 105.8550], label: 'Sông Công, Thái Nguyên' },
    { key: 'pho yen',          coords: [21.3690, 105.9950], label: 'Phổ Yên, Thái Nguyên' },
    { key: 'dinh hoa',         coords: [21.8560, 105.6490], label: 'Định Hóa, Thái Nguyên' },
    { key: 'vo nhai',          coords: [21.7620, 106.0590], label: 'Võ Nhai, Thái Nguyên' },
    { key: 'phu luong',        coords: [21.7030, 105.7900], label: 'Phú Lương, Thái Nguyên' },
    { key: 'dong hy',          coords: [21.6650, 105.9010], label: 'Đồng Hỷ, Thái Nguyên' },
    { key: 'dai tu',           coords: [21.6730, 105.7200], label: 'Đại Từ, Thái Nguyên' },
    { key: 'phu binh',         coords: [21.4300, 106.0200], label: 'Phú Bình, Thái Nguyên' },
    { key: 'thai nguyen',      coords: [21.5670, 105.8252], label: 'Thái Nguyên' },

    // ── Phú Thọ ──
    { key: 'viet tri',         coords: [21.4221, 105.2272], label: 'Việt Trì, Phú Thọ' },
    { key: 'phu tho city',     coords: [21.4028, 105.2295], label: 'Phú Thọ' },
    { key: 'doan hung',        coords: [21.6970, 105.1410], label: 'Đoan Hùng, Phú Thọ' },
    { key: 'ha hoa',           coords: [21.5410, 104.9400], label: 'Hạ Hòa, Phú Thọ' },
    { key: 'thanh ba',         coords: [21.4480, 105.0840], label: 'Thanh Ba, Phú Thọ' },
    { key: 'phu ninh pt',      coords: [21.5450, 105.2330], label: 'Phù Ninh, Phú Thọ' },
    { key: 'yen lap',          coords: [21.3810, 104.9880], label: 'Yên Lập, Phú Thọ' },
    { key: 'cam khe',          coords: [21.4080, 105.0380], label: 'Cẩm Khê, Phú Thọ' },
    { key: 'tam nong pt',      coords: [21.2560, 105.1310], label: 'Tam Nông, Phú Thọ' },
    { key: 'lam thao',         coords: [21.3620, 105.2880], label: 'Lâm Thao, Phú Thọ' },
    { key: 'thanh son',        coords: [21.2060, 104.9860], label: 'Thanh Sơn, Phú Thọ' },
    { key: 'thanh thuy pt',    coords: [21.2740, 105.1350], label: 'Thanh Thủy, Phú Thọ' },
    { key: 'phu tho',          coords: [21.4221, 105.2272], label: 'Phú Thọ' },

    // ── Yên Bái ──
    { key: 'yen bai city',     coords: [21.7167, 104.9113], label: 'Yên Bái' },
    { key: 'nghia lo',         coords: [21.5928, 104.4770], label: 'Nghĩa Lộ, Yên Bái' },
    { key: 'luc yen',          coords: [22.0930, 104.7610], label: 'Lục Yên, Yên Bái' },
    { key: 'van yen',          coords: [21.8430, 104.6810], label: 'Văn Yên, Yên Bái' },
    { key: 'mu cang chai',     coords: [21.8350, 104.0850], label: 'Mù Cang Chải, Yên Bái' },
    { key: 'tran yen',         coords: [21.7630, 104.8590], label: 'Trấn Yên, Yên Bái' },
    { key: 'van chan',         coords: [21.6130, 104.5380], label: 'Văn Chấn, Yên Bái' },
    { key: 'yen binh',         coords: [21.8010, 105.0560], label: 'Yên Bình, Yên Bái' },
    { key: 'tram tau',         coords: [21.6060, 104.2740], label: 'Trạm Tấu, Yên Bái' },
    { key: 'yen bai',          coords: [21.7167, 104.9113], label: 'Yên Bái' },

    // ── Lào Cai ──
    { key: 'lao cai city',     coords: [22.4804, 103.9750], label: 'Lào Cai' },
    { key: 'sa pa',            coords: [22.3363, 103.8444], label: 'Sa Pa, Lào Cai' },
    { key: 'bac ha',           coords: [22.5310, 104.3030], label: 'Bắc Hà, Lào Cai' },
    { key: 'muong khuong',     coords: [22.7400, 104.2560], label: 'Mường Khương, Lào Cai' },
    { key: 'bao thang',        coords: [22.4300, 104.1220], label: 'Bảo Thắng, Lào Cai' },
    { key: 'bao yen',          coords: [22.1610, 104.4140], label: 'Bảo Yên, Lào Cai' },
    { key: 'van ban',          coords: [22.0900, 104.3350], label: 'Văn Bàn, Lào Cai' },
    { key: 'lao cai',          coords: [22.4804, 103.9750], label: 'Lào Cai' },

    // ── Tuyên Quang ──
    { key: 'tuyen quang city', coords: [21.8236, 105.2146], label: 'Tuyên Quang' },
    { key: 'na hang',          coords: [22.3600, 105.3740], label: 'Na Hang, Tuyên Quang' },
    { key: 'chiem hoa',        coords: [22.0660, 105.1060], label: 'Chiêm Hóa, Tuyên Quang' },
    { key: 'ham yen',          coords: [22.0860, 105.0340], label: 'Hàm Yên, Tuyên Quang' },
    { key: 'yen son tq',       coords: [21.9460, 105.2110], label: 'Yên Sơn, Tuyên Quang' },
    { key: 'son duong',        coords: [21.6670, 105.4140], label: 'Sơn Dương, Tuyên Quang' },
    { key: 'lam binh',         coords: [22.3240, 105.0570], label: 'Lâm Bình, Tuyên Quang' },
    { key: 'tuyen quang',      coords: [21.8236, 105.2146], label: 'Tuyên Quang' },

    // ── Hà Giang ──
    { key: 'ha giang city',    coords: [22.8037, 104.9784], label: 'Hà Giang' },
    { key: 'dong van',         coords: [23.2720, 105.3620], label: 'Đồng Văn, Hà Giang' },
    { key: 'meo vac',          coords: [23.1560, 105.4180], label: 'Mèo Vạc, Hà Giang' },
    { key: 'yen minh',         coords: [23.1140, 105.1460], label: 'Yên Minh, Hà Giang' },
    { key: 'quan ba',          coords: [23.0560, 105.0270], label: 'Quản Bạ, Hà Giang' },
    { key: 'vi xuyen',         coords: [22.7280, 104.9830], label: 'Vị Xuyên, Hà Giang' },
    { key: 'hoang su phi',     coords: [22.7520, 104.6960], label: 'Hoàng Su Phì, Hà Giang' },
    { key: 'xin man',          coords: [22.6700, 104.5620], label: 'Xín Mần, Hà Giang' },
    { key: 'bac quang',        coords: [22.4990, 104.8540], label: 'Bắc Quang, Hà Giang' },
    { key: 'ha giang',         coords: [22.8037, 104.9784], label: 'Hà Giang' },

    // ── Cao Bằng ──
    { key: 'cao bang city',    coords: [22.6647, 106.2622], label: 'Cao Bằng' },
    { key: 'bao lac',          coords: [22.9800, 105.6730], label: 'Bảo Lạc, Cao Bằng' },
    { key: 'ha quang',         coords: [22.8890, 106.0630], label: 'Hà Quảng, Cao Bằng' },
    { key: 'trung khanh',      coords: [22.8220, 106.5280], label: 'Trùng Khánh, Cao Bằng' },
    { key: 'quang hoa',        coords: [22.5630, 106.4430], label: 'Quảng Hòa, Cao Bằng' },
    { key: 'thach an',         coords: [22.5200, 106.2590], label: 'Thạch An, Cao Bằng' },
    { key: 'hoa an',           coords: [22.6290, 106.2050], label: 'Hòa An, Cao Bằng' },
    { key: 'nguyen binh',      coords: [22.6860, 105.9520], label: 'Nguyên Bình, Cao Bằng' },
    { key: 'cao bang',         coords: [22.6647, 106.2622], label: 'Cao Bằng' },

    // ── Lạng Sơn ──
    { key: 'lang son city',    coords: [21.8481, 106.7603], label: 'Lạng Sơn' },
    { key: 'trang dinh',       coords: [22.1680, 106.5760], label: 'Tràng Định, Lạng Sơn' },
    { key: 'binh gia',         coords: [22.0360, 106.4100], label: 'Bình Gia, Lạng Sơn' },
    { key: 'van lang ls',      coords: [22.1230, 106.6460], label: 'Văn Lãng, Lạng Sơn' },
    { key: 'cao loc',          coords: [21.9430, 106.7540], label: 'Cao Lộc, Lạng Sơn' },
    { key: 'loc binh',         coords: [21.7850, 106.9670], label: 'Lộc Bình, Lạng Sơn' },
    { key: 'dinh lap',         coords: [21.5320, 107.1100], label: 'Đình Lập, Lạng Sơn' },
    { key: 'chi lang',         coords: [21.7060, 106.7310], label: 'Chi Lăng, Lạng Sơn' },
    { key: 'huu lung',         coords: [21.5940, 106.5280], label: 'Hữu Lũng, Lạng Sơn' },
    { key: 'bac son',          coords: [21.8870, 106.3630], label: 'Bắc Sơn, Lạng Sơn' },
    { key: 'lang son',         coords: [21.8481, 106.7603], label: 'Lạng Sơn' },

    // ── Bắc Kạn ──
    { key: 'bac kan city',     coords: [22.1474, 105.8348], label: 'Bắc Kạn' },
    { key: 'ba be',            coords: [22.3590, 105.7560], label: 'Ba Bể, Bắc Kạn' },
    { key: 'ngan son',         coords: [22.5030, 105.9580], label: 'Ngân Sơn, Bắc Kạn' },
    { key: 'bach thong',       coords: [22.2310, 105.8350], label: 'Bạch Thông, Bắc Kạn' },
    { key: 'cho don',          coords: [22.1480, 105.6230], label: 'Chợ Đồn, Bắc Kạn' },
    { key: 'na ri',            coords: [22.2640, 106.0980], label: 'Na Rì, Bắc Kạn' },
    { key: 'bac kan',          coords: [22.1474, 105.8348], label: 'Bắc Kạn' },

    // ── Điện Biên ──
    { key: 'dien bien phu',    coords: [21.3854, 103.0226], label: 'Điện Biên Phủ, Điện Biên' },
    { key: 'muong lay',        coords: [22.0620, 103.1450], label: 'Mường Lay, Điện Biên' },
    { key: 'tuan giao',        coords: [21.5710, 103.4190], label: 'Tuần Giáo, Điện Biên' },
    { key: 'muong ang',        coords: [21.5040, 103.5020], label: 'Mường Ảng, Điện Biên' },
    { key: 'tua chua',         coords: [21.8460, 103.4320], label: 'Tủa Chùa, Điện Biên' },
    { key: 'dien bien',        coords: [21.3854, 103.0226], label: 'Điện Biên' },

    // ── Lai Châu ──
    { key: 'lai chau city',    coords: [22.3961, 103.4592], label: 'Lai Châu' },
    { key: 'tam duong lc',     coords: [22.3920, 103.5900], label: 'Tam Đường, Lai Châu' },
    { key: 'sin ho',           coords: [22.3450, 103.2730], label: 'Sìn Hồ, Lai Châu' },
    { key: 'phong tho',        coords: [22.5430, 103.3660], label: 'Phong Thổ, Lai Châu' },
    { key: 'than uyen',        coords: [22.0220, 103.9040], label: 'Than Uyên, Lai Châu' },
    { key: 'muong te',         coords: [22.5220, 102.7920], label: 'Mường Tè, Lai Châu' },
    { key: 'lai chau',         coords: [22.3961, 103.4592], label: 'Lai Châu' },

    // ── Sơn La ──
    { key: 'son la city',      coords: [21.3272, 103.9144], label: 'Sơn La' },
    { key: 'moc chau',         coords: [20.8320, 104.6540], label: 'Mộc Châu, Sơn La' },
    { key: 'thuan chau',       coords: [21.4390, 103.7130], label: 'Thuận Châu, Sơn La' },
    { key: 'muong la',         coords: [21.6870, 104.0550], label: 'Mường La, Sơn La' },
    { key: 'bac yen',          coords: [21.4250, 104.2360], label: 'Bắc Yên, Sơn La' },
    { key: 'phu yen sl',       coords: [21.2610, 104.5140], label: 'Phù Yên, Sơn La' },
    { key: 'yen chau',         coords: [21.0570, 104.2620], label: 'Yên Châu, Sơn La' },
    { key: 'mai son',          coords: [21.2670, 103.9820], label: 'Mai Sơn, Sơn La' },
    { key: 'song ma',          coords: [21.0690, 103.7460], label: 'Sông Mã, Sơn La' },
    { key: 'son la',           coords: [21.3272, 103.9144], label: 'Sơn La' },

    // ── Hòa Bình ──
    { key: 'hoa binh city',    coords: [20.8135, 105.3388], label: 'Hòa Bình' },
    { key: 'da bac',           coords: [20.8900, 105.0470], label: 'Đà Bắc, Hòa Bình' },
    { key: 'mai chau',         coords: [20.6620, 104.9840], label: 'Mai Châu, Hòa Bình' },
    { key: 'tan lac',          coords: [20.6390, 105.3250], label: 'Tân Lạc, Hòa Bình' },
    { key: 'cao phong',        coords: [20.6990, 105.3590], label: 'Cao Phong, Hòa Bình' },
    { key: 'lac son',          coords: [20.5550, 105.5380], label: 'Lạc Sơn, Hòa Bình' },
    { key: 'kim boi',          coords: [20.6340, 105.5100], label: 'Kim Bôi, Hòa Bình' },
    { key: 'luong son',        coords: [20.9230, 105.5150], label: 'Lương Sơn, Hòa Bình' },
    { key: 'lac thuy',         coords: [20.5270, 105.6530], label: 'Lạc Thủy, Hòa Bình' },
    { key: 'yen thuy',         coords: [20.4300, 105.6000], label: 'Yên Thủy, Hòa Bình' },
    { key: 'hoa binh',         coords: [20.8135, 105.3388], label: 'Hòa Bình' },
];

// ── Pre-compiled lookup tables (built once at module load) ───────────────────
// Creating `new RegExp(...)` inside a loop that runs 300–700 times per listing
// freezes the browser main thread when 400+ listings are processed in Phase 1
// of the MapView geocoding pipeline.  All regexes are compiled here once so
// subsequent calls to getProvinceFallback / getDistrictFallback / isNonHCMCAddress
// only call RegExp.prototype.test() on already-compiled objects (~100 ns each).

function makeWordBoundaryRe(plainKey: string): RegExp {
    const escaped = plainKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i');
}

const _PROVINCE_COMPILED: { re: RegExp; coords: [number, number]; label: string }[] =
    NON_HCMC_PLACE_CENTERS.map(e => ({ re: makeWordBoundaryRe(e.key), coords: e.coords, label: e.label }));

const _DISTRICT_COMPILED: { re: RegExp; key: string }[] =
    Object.keys(HCMC_DISTRICT_CENTERS)
        .sort((a, b) => b.length - a.length)          // longest key first → most-specific match wins
        .map(key => ({ re: makeWordBoundaryRe(key), key }));

const _NON_HCMC_PROVINCE_COMPILED: RegExp[] =
    NON_HCMC_PROVINCES.map(province => {
        const plain = province.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return makeWordBoundaryRe(plain);
    });

const _HCMC_MARKERS_LOWER = [
    'hcm', 'ho chi minh', 'tphcm', 'tp hcm',
    'thanh pho ho chi minh', 'tp. ho chi minh', 'tp.ho chi minh',
];

// ── End pre-compiled lookup tables ───────────────────────────────────────────

/**
 * Scan an address for a known non-HCMC province / district name and return
 * its approximate centre coordinates.  Returns null when nothing matches.
 */
export function getProvinceFallback(address: string): { coords: [number, number]; label: string } | null {
    const lower = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const { re, coords, label } of _PROVINCE_COMPILED) {
        if (re.test(lower)) return { coords, label };
    }
    return null;
}

/**
 * Scan an address string for a known HCMC district/ward name and return its
 * centre coordinates.  Returns null when no match found.
 */
export function getDistrictFallback(address: string): { coords: [number, number]; district: string } | null {
    const lower = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const { re, key } of _DISTRICT_COMPILED) {
        if (re.test(lower)) return { coords: HCMC_DISTRICT_CENTERS[key], district: HCMC_DISTRICTS[key] || key };
    }
    return null;
}
