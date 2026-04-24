import ExcelJS from 'exceljs';
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
    { key: 'code',              header: 'Mã sản phẩm',        required: true,  width: 16 },
    { key: 'title',             header: 'Tên sản phẩm',       required: true,  width: 30 },
    { key: 'location',          header: 'Địa chỉ',            required: true,  width: 35 },
    { key: 'type',              header: 'Loại hình',           required: true,  width: 14 },
    { key: 'status',            header: 'Trạng thái',          required: true,  width: 14 },
    { key: 'transaction',       header: 'Loại GD',             required: false, width: 10 },
    { key: 'area',              header: 'Diện tích (m²)',      required: true,  width: 14 },
    { key: 'builtArea',         header: 'DT xây dựng (m²)',   required: false, width: 16 },
    { key: 'clearArea',         header: 'DT thông thủy (m²)', required: false, width: 18 },
    { key: 'bedrooms',          header: 'Số PN',               required: false, width: 8  },
    { key: 'bathrooms',         header: 'Số WC',               required: false, width: 8  },
    { key: 'price',             header: 'Giá (VND)',           required: true,  width: 18 },
    { key: 'direction',         header: 'Hướng',               required: false, width: 12 },
    { key: 'tower',             header: 'Toà',                 required: false, width: 8  },
    { key: 'floor',             header: 'Tầng',                required: false, width: 8  },
    { key: 'view',              header: 'View',                required: false, width: 16 },
    { key: 'furniture',         header: 'Nội thất',            required: false, width: 16 },
    { key: 'legalStatus',       header: 'Pháp lý',             required: false, width: 14 },
    { key: 'frontage',          header: 'Mặt tiền (m)',        required: false, width: 14 },
    { key: 'roadWidth',         header: 'Lộ giới (m)',         required: false, width: 12 },
    { key: 'notes',             header: 'Ghi chú',             required: false, width: 30 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function triggerDownload(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function buildMainSheet(wb: ExcelJS.Workbook, rows: (string | number)[][], sheetName = 'Danh mục'): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(sheetName);
    ws.addRow(COLS.map(c => c.header));
    rows.forEach(r => ws.addRow(r));
    COLS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });
    return ws;
}

function buildRefSheet(wb: ExcelJS.Workbook): void {
    const ws = wb.addWorksheet('Tham chiếu');
    ws.addRow(['Loại hình', 'Trạng thái', 'Loại GD', 'Hướng', 'Nội thất', 'Pháp lý']);
    for (let i = 0; i < 9; i++) {
        ws.addRow([
            Object.values(TYPE_VI)[i] ?? '',
            Object.values(STATUS_VI)[i] ?? '',
            Object.values(TRANSACTION_VI)[i] ?? '',
            Object.values(DIRECTION_VI)[i] ?? '',
            Object.values(FURNITURE_VI)[i] ?? '',
            Object.values(LEGAL_VI)[i] ?? '',
        ]);
    }
    [14, 14, 10, 14, 16, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

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

export async function exportListingsToExcel(listings: Listing[], projectName: string): Promise<void> {
    const wb = new ExcelJS.Workbook();
    buildMainSheet(wb, listings.map(listingToRow));
    buildRefSheet(wb);

    const buffer = await wb.xlsx.writeBuffer();
    const safeProject = projectName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
    triggerDownload(buffer as ArrayBuffer, `DanhMuc_${safeProject}.xlsx`);
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
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.worksheets[0];
    const valid: ImportRow[] = [];
    const errors: ImportRow[] = [];

    const headerToKey: Record<string, string> = {};
    COLS.forEach(c => { headerToKey[c.header] = c.key; });

    const attrKeys = new Set(['direction', 'tower', 'floor', 'view', 'furniture', 'legalStatus', 'clearArea', 'frontage', 'roadWidth', 'notes']);

    let headers: string[] = [];
    let firstRow = true;

    ws.eachRow((row, rowNum) => {
        const values = (row.values as ExcelJS.CellValue[]).slice(1);

        if (firstRow) {
            headers = values.map(v => String(v ?? '').trim());
            firstRow = false;
            return;
        }

        const data: Record<string, unknown> = {};
        const attributes: Record<string, unknown> = {};

        headers.forEach((header, i) => {
            const key = headerToKey[header];
            if (!key) return;
            const val = mapValue(key, values[i]);
            if (val === undefined || val === '') return;
            if (attrKeys.has(key)) {
                attributes[key] = val;
            } else {
                data[key] = val;
            }
        });

        if (Object.keys(attributes).length > 0) {
            data.attributes = attributes;
        }

        if (!data.transaction) data.transaction = 'SALE';

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

export async function downloadImportTemplate(): Promise<void> {
    const example: (string | number)[] = [
        'CH-01', 'Căn 2PN view sông', 'Q7, TP.HCM',
        'Căn hộ', 'Đang bán', 'Bán', 80, '', 72,
        2, 2, 5800000000,
        'Đông Nam', 'A', 15, 'Sông, Thành phố',
        'Cơ bản', 'Sổ hồng', '', '', '',
    ];
    const note: string[] = [
        '* Bắt buộc', '* Bắt buộc', '* Bắt buộc',
        'Xem sheet Tham chiếu', 'Xem sheet Tham chiếu', 'Bán / Cho thuê',
        '* m² - Bắt buộc', 'm² (nhà đất)', 'm² (căn hộ)',
        'Số phòng', 'Số phòng', '* VND - Bắt buộc',
        'Xem sheet Tham chiếu', '', '', '',
        'Xem sheet Tham chiếu', 'Xem sheet Tham chiếu', 'mét', 'mét', '',
    ];

    const wb = new ExcelJS.Workbook();
    buildMainSheet(wb, [example, note]);
    buildRefSheet(wb);

    const buffer = await wb.xlsx.writeBuffer();
    triggerDownload(buffer as ArrayBuffer, 'MauNhapDanhMuc.xlsx');
}
