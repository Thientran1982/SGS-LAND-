/**
 * Unit-level inventory ("tồn kho cấp căn") built from a project's product catalog.
 *
 * The catalog (listings with a projectCode) is the single source of truth: this module only
 * groups listings into a stacking plan (tower → floor → units) and summarises availability.
 */

export type UnitTone = 'available' | 'opening' | 'booking' | 'hold' | 'sold' | 'inactive';

export interface InventoryUnit {
    id: string;
    label: string;
    code: string;
    title: string;
    type: string | null;
    status: string;
    tone: UnitTone;
    tower: string | null;
    floor: number | null;
    bedrooms: number | null;
    area: number | null;
    clearArea: number | null;
    price: number | null;
    direction: string | null;
    view: string | null;
    raw: any;
}

export interface FloorRow { floor: number; units: InventoryUnit[] }
export interface TowerPlan { tower: string; floors: FloorRow[]; total: number; available: number }

export interface InventorySummary {
    total: number;
    available: number;
    reserved: number;
    sold: number;
    inactive: number;
    soldRate: number;          // 0..1 of sellable stock (excludes inactive)
    availableValue: number;    // sum of prices still for sale
}

// Listing statuses → visual tone / summary bucket.
const TONE_BY_STATUS: Record<string, UnitTone> = {
    AVAILABLE: 'available',
    BEST_MARKET: 'available',
    OPENING: 'opening',
    BOOKING: 'booking',
    HOLD: 'hold',
    SOLD: 'sold',
    RENTED: 'sold',
    INACTIVE: 'inactive',
};

export const toneOf = (status: string | null | undefined): UnitTone =>
    TONE_BY_STATUS[String(status || '').toUpperCase()] ?? 'available';

const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

const text = (v: unknown): string | null => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s ? s : null;
};

/** Short, human unit label: a compact title such as "B2-07-08" beats an opaque system code. */
export function unitLabel(title: string, code: string): string {
    const t = (title || '').trim();
    if (t && t.length <= 14) return t;
    return (code || t || '—').trim();
}

export function toInventoryUnit(listing: any): InventoryUnit {
    const a = (listing?.attributes && typeof listing.attributes === 'object') ? listing.attributes : {};
    const floor = num(a.floor);
    const status = String(listing?.status || 'AVAILABLE').toUpperCase();
    return {
        id: String(listing?.id ?? ''),
        label: unitLabel(String(listing?.title ?? ''), String(listing?.code ?? '')),
        code: String(listing?.code ?? ''),
        title: String(listing?.title ?? ''),
        type: text(listing?.type),
        status,
        tone: toneOf(status),
        tower: text(a.tower),
        floor: floor === null ? null : Math.trunc(floor),
        bedrooms: num(listing?.bedrooms ?? a.bedrooms),
        area: num(listing?.area),
        clearArea: num(a.clearArea),
        price: num(listing?.price),
        direction: text(a.direction),
        view: text(a.view),
        raw: listing,
    };
}

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

/** Group placed units (tower + floor known) into towers with floors top-down. */
export function buildStackingPlan(units: InventoryUnit[]): { towers: TowerPlan[]; unplaced: InventoryUnit[] } {
    const byTower = new Map<string, Map<number, InventoryUnit[]>>();
    const unplaced: InventoryUnit[] = [];
    for (const u of units) {
        if (!u.tower || u.floor === null) { unplaced.push(u); continue; }
        if (!byTower.has(u.tower)) byTower.set(u.tower, new Map());
        const floors = byTower.get(u.tower)!;
        if (!floors.has(u.floor)) floors.set(u.floor, []);
        floors.get(u.floor)!.push(u);
    }
    const towers: TowerPlan[] = [...byTower.entries()]
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([tower, floors]) => {
            const rows = [...floors.entries()]
                .sort(([a], [b]) => b - a)
                .map(([floor, list]) => ({ floor, units: [...list].sort((x, y) => collator.compare(x.label, y.label)) }));
            const all = rows.flatMap(r => r.units);
            return { tower, floors: rows, total: all.length, available: all.filter(u => u.tone === 'available' || u.tone === 'opening').length };
        });
    unplaced.sort((x, y) => collator.compare(x.type || '', y.type || '') || collator.compare(x.label, y.label));
    return { towers, unplaced };
}

export function summarize(units: InventoryUnit[]): InventorySummary {
    let available = 0, reserved = 0, sold = 0, inactive = 0, availableValue = 0;
    for (const u of units) {
        if (u.tone === 'available' || u.tone === 'opening') { available++; availableValue += u.price || 0; }
        else if (u.tone === 'hold' || u.tone === 'booking') reserved++;
        else if (u.tone === 'sold') sold++;
        else inactive++;
    }
    const sellable = units.length - inactive;
    return { total: units.length, available, reserved, sold, inactive, soldRate: sellable > 0 ? sold / sellable : 0, availableValue };
}

/** Status filter buckets used by the chips. */
export type StatusFilter = 'all' | 'available' | 'reserved' | 'sold' | 'inactive';
export function matchesStatus(u: InventoryUnit, f: StatusFilter): boolean {
    if (f === 'all') return true;
    if (f === 'available') return u.tone === 'available' || u.tone === 'opening';
    if (f === 'reserved') return u.tone === 'hold' || u.tone === 'booking';
    if (f === 'sold') return u.tone === 'sold';
    return u.tone === 'inactive';
}
