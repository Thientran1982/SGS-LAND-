import * as XLSX from 'xlsx';
import type { Listing } from '../types';

// ─── Mapping tables (VI ↔ API) ───────────────────────────────────────────────

export const TYPE_VI: Record<string, string> = {
    Apartment:  'Căn hộ',
    Penthouse:  'Penthouse',
    Townhouse:  'Nhà phố',
    House:      'Nhà riêng',
    Villa:      'Biệt thự',
    Land:       'Đất nền',
    Factory:    'Nhà xưởng',
    Office:     'Văn phòng',
    Commercial: 'Thương mại',
};
const TYPE_FROM_VI = Object.fromEntries(Object.entries(TYPE_VI).map(([k, v]) => [v, k]));

export const STATUS_VI: Record<string, string> = {
    AVAILABLE: 'Đang bán',
    HOLD:      'Giữ chỗ',
    SOLD:      'Đã bán',
    RENTED:    'Đã thuê',
    INACTIVE:  'Ngưng GD',
    BOOKING:   'Booking',
    OPENING:   'Đang mở bán',
};
const STATUS_FROM_VI = Object.fromEntries(Object.entries(STATUS_VI).map(([k, v]) => [v, k]));

export const TRANSACTION_VI: Record<string, string> = {
    SALE: 'Bán',
    RENT: 'Cho thuê',
};
const TRANSACTION_FROM_VI = Object.fromEntries(Object.entries(TRANSACTION_VI).map(([k, v]) => [v, k]));

export const DIRECTION_VI: Record<string, string> = {
    North:     'Bắc',
    South:     'Nam',
    East:      'Đông',
    West:      'Tây',
    NorthEast: 'Đông Bắc',
    NorthWest: 'Tây Bắc',
    SouthEast: 'Đông Nam',
    SouthWest: 'Tây Nam',
};
const DIRECTION_FROM_VI = Object.fromEntries(Object.entries(DIRECTION_VI).map(([k, v]) => [v, k]));

export const FURNITURE_VI: Record<string, string> = {
    FULL:  'Đầy đủ',
    BASIC: 'Cơ bản',
    NONE:  'Không nội thất',
};
const FURNITURE_FROM_VI = Object.fromEntries(Object.entries(FURNITURE_VI).map(([k, v]) => [v, k]));

export const LEGAL_VI: Record<string, string> = {
    PinkBook: 'Sổ hồng',
    Contract: 'Hợp đồng',
    Waiting:  'Chờ sổ',
};
const LEGAL_FROM_VI = Object.fromEntries(Object.entries(LEGAL_VI).map(([k, v]) => [v, k]));

// ─── Column definitions ───────────────────────────────────────────────────────

const COLS = [
    { key: 'code',              header: 'Mã sản phẩm',        required: true  },
    { key: 'title',             header: 'Tên sản phẩm',       required: true  },
    { key: 'location',          header: 'Địa chỉ',            required: true  },
    { key: 'type',              header: 'Loại hình',           required: true  },
    { key: 'status',            header: 'Trạng thái',          required: true  },
    { key: 'transaction',       header: 'Loại GD',             required: false },
    { key: 'area',              header: 'Diện tích (m²)',      required: true  },
    { key: 'builtArea',         header: 'DT xây dựng (m²)',   required: false },
    { key: 'clearArea',         header: 'DT thông thủy (m²)', required: false },
    { key: 'bedrooms',          header: 'Số PN',               required: false },
    { key: 'bathrooms',         header: 'Số WC',               required: false },
    { key: 'price',             header: 'Giá (VND)',           required: true  },
    { key: 'direction',         header: 'Hướng',               required: false },
    { key: 'tower',             header: 'Toà',                 required: false },
    { key: 'floor',             header: 'Tầng',                required: false },
    { key: 'view',              header: 'View',                required: false },
    { key: 'furniture',         header: 'Nội thất',            required: false },
    { key: 'legalStatus',       header: 'Pháp lý',             required: false },
    { key: 'frontage',          header: 'Mặt tiền (m)',        required: false },
    { key: 'roadWidth',         header: 'Lộ giới (m)',         required: false },
    { key: 'notes',             header: 'Ghi chú',             required: false },
];

// ─── EXPORT ───────────────────────────────────────────────────────────────────

function listingToRow(l: Listing): (string | number)[] {
    const attr = l.attributes || {};
    return [
        l.code ?? '',
        l.title ?? '',
        l.location ?? '',
        TYPE_VI[l.type] ?? l.type ?? '',
        STATUS_VI[l.status] ?? l.status ?? '',
        TRANSACTION_VI[(l.transaction as string)] ?? l.transaction ?? 'Bán',
        l.area ?? '',
        l.builtArea ?? '',
        (attr.clearArea as number) ?? '',
        l.bedrooms ?? '',
        l.bathrooms ?? '',
        l.price ?? '',
        DIRECTION_VI[(attr.direction as string)] ?? (attr.direction as string) ?? '',
        (attr.tower as string) ?? '',
        (attr.floor as number) ?? '',
        (attr.view as string) ?? '',
        FURNITURE_VI[(attr.furniture as string)] ?? (attr.furniture as string) ?? '',
        LEGAL_VI[(attr.legalStatus as string)] ?? (attr.legalStatus as string) ?? '',
        (attr.frontage as number) ?? '',
        (attr.roadWidth as number) ?? '',
        (attr.notes as string) ?? '',
    ];
}

export function exportListingsToExcel(listings: Listing[], projectName: string): void {
    const headers = COLS.map(c => c.header);
    const rows = listings.map(listingToRow);
    const data = [headers, ...rows];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    ws['!cols'] = [
        { wch: 16 }, // Mã
        { wch: 30 }, // Tên
        { wch: 35 }, // Địa chỉ
        { wch: 14 }, // Loại hình
        { wch: 14 }, // Trạng thái
        { wch: 10 }, // Loại GD
        { wch: 14 }, // Diện tích
        { wch: 16 }, // DT XD
        { wch: 18 }, // DT thông thủy
        { wch: 8  }, // PN
        { wch: 8  }, // WC
        { wch: 18 }, // Giá
        { wch: 12 }, // Hướng
        { wch: 8  }, // Toà
        { wch: 8  }, // Tầng
        { wch: 16 }, // View
        { wch: 16 }, // Nội thất
        { wch: 14 }, // Pháp lý
        { wch: 14 }, // Mặt tiền
        { wch: 12 }, // Lộ giới
        { wch: 30 }, // Ghi chú
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh mục');

    // Add a reference sheet with allowed values
    const refData = [
        ['Loại hình', 'Trạng thái', 'Loại GD', 'Hướng', 'Nội thất', 'Pháp lý'],
        ...Array.from({ length: 9 }, (_, i) => [
            Object.values(TYPE_VI)[i] ?? '',
            Object.values(STATUS_VI)[i] ?? '',
            Object.values(TRANSACTION_VI)[i] ?? '',
            Object.values(DIRECTION_VI)[i] ?? '',
            Object.values(FURNITURE_VI)[i] ?? '',
            Object.values(LEGAL_VI)[i] ?? '',
        ]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [14, 14, 10, 14, 16, 14].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, wsRef, 'Tham chiếu');

    const safeProject = projectName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
    XLSX.writeFile(wb, `DanhMuc_${safeProject}.xlsx`);
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

export interface ImportRow {
    row: number;
    data?: Record<string, unknown>;
    error?: string;
}

export interface ImportResult {
    valid: ImportRow[];
    errors: ImportRow[];
}

function mapValue(key: string, raw: unknown): unknown {
    const v = String(raw ?? '').trim();
    if (!v) return undefined;

    switch (key) {
        case 'type':        return TYPE_FROM_VI[v] ?? v;
        case 'status':      return STATUS_FROM_VI[v] ?? v;
        case 'transaction': return TRANSACTION_FROM_VI[v] ?? v;
        case 'direction':   return DIRECTION_FROM_VI[v] ?? v;
        case 'furniture':   return FURNITURE_FROM_VI[v] ?? v;
        case 'legalStatus': return LEGAL_FROM_VI[v] ?? v;
        case 'area':
        case 'builtArea':
        case 'clearArea':
        case 'bedrooms':
        case 'bathrooms':
        case 'price':
        case 'frontage':
        case 'roadWidth':
        case 'floor': {
            const n = Number(v.replace(/[.,\s]/g, ''));
            return isNaN(n) ? undefined : n;
        }
        default: return v;
    }
}

export async function parseListingsFromExcel(file: File): Promise<ImportResult> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        raw: false,
        defval: '',
    });

    const valid: ImportRow[] = [];
    const errors: ImportRow[] = [];

    // Build a header → key mapping (match by header text)
    const headerToKey: Record<string, string> = {};
    COLS.forEach(c => { headerToKey[c.header] = c.key; });

    rows.forEach((row, idx) => {
        const rowNum = idx + 2; // 1-based, +1 for header row
        const data: Record<string, unknown> = {};
        const attributes: Record<string, unknown> = {};
        const attrKeys = new Set(['direction', 'tower', 'floor', 'view', 'furniture', 'legalStatus', 'clearArea', 'frontage', 'roadWidth', 'notes']);

        for (const [header, rawVal] of Object.entries(row)) {
            const key = headerToKey[header];
            if (!key) continue;
            const val = mapValue(key, rawVal);
            if (val === undefined || val === '') continue;
            if (attrKeys.has(key)) {
                attributes[key] = val;
            } else {
                data[key] = val;
            }
        }

        if (Object.keys(attributes).length > 0) {
            data.attributes = attributes;
        }

        // Default transaction
        if (!data.transaction) data.transaction = 'SALE';

        // Validate required fields
        const missing: string[] = [];
        COLS.filter(c => c.required).forEach(c => {
            const key = attrKeys.has(c.key) ? null : c.key;
            if (key && (data[key] === undefined || data[key] === '')) {
                missing.push(c.header);
            }
        });

        if (missing.length > 0) {
            errors.push({ row: rowNum, error: `Thiếu trường bắt buộc: ${missing.join(', ')}` });
        } else {
            valid.push({ row: rowNum, data });
        }
    });

    return { valid, errors };
}

// ─── Download Template ────────────────────────────────────────────────────────

export function downloadImportTemplate(): void {
    const headers = COLS.map(c => c.header);
    const example = [
        'CH-01', 'Căn 2PN view sông', 'Q7, TP.HCM',
        'Căn hộ', 'Đang bán', 'Bán', 80, '', 72,
        2, 2, 5800000000,
        'Đông Nam', 'A', 15, 'Sông, Thành phố',
        'Cơ bản', 'Sổ hồng', '', '', '',
    ];
    const note = [
        '* Bắt buộc', '* Bắt buộc', '* Bắt buộc',
        'Xem sheet Tham chiếu', 'Xem sheet Tham chiếu', 'Bán / Cho thuê',
        '* m² - Bắt buộc', 'm² (nhà đất)', 'm² (căn hộ)',
        'Số phòng', 'Số phòng', '* VND - Bắt buộc',
        'Xem sheet Tham chiếu', '', '', '',
        'Xem sheet Tham chiếu', 'Xem sheet Tham chiếu', 'mét', 'mét', '',
    ];

    const data = [headers, example, note];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [16,30,35,14,14,10,14,16,18,8,8,18,12,8,8,16,16,14,14,12,30].map(wch => ({ wch }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh mục');

    // Reference sheet
    const refData = [
        ['Loại hình', 'Trạng thái', 'Loại GD', 'Hướng', 'Nội thất', 'Pháp lý'],
        ...Array.from({ length: 9 }, (_, i) => [
            Object.values(TYPE_VI)[i] ?? '',
            Object.values(STATUS_VI)[i] ?? '',
            Object.values(TRANSACTION_VI)[i] ?? '',
            Object.values(DIRECTION_VI)[i] ?? '',
            Object.values(FURNITURE_VI)[i] ?? '',
            Object.values(LEGAL_VI)[i] ?? '',
        ]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [14,14,10,14,16,14].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, wsRef, 'Tham chiếu');

    XLSX.writeFile(wb, 'MauNhapDanhMuc.xlsx');
}
