import { describe, expect, it } from 'vitest';
import { buildStackingPlan, matchesStatus, summarize, toInventoryUnit, unitLabel } from '../../utils/unitInventory';

const listing = (over: Record<string, any> = {}, attrs: Record<string, any> = {}) => ({
    id: over.id ?? Math.random().toString(36).slice(2),
    code: 'LST000001',
    title: 'B2-07-08',
    type: 'APARTMENT',
    status: 'AVAILABLE',
    price: 5_000_000_000,
    area: 90,
    bedrooms: 2,
    attributes: { tower: 'B', floor: 7, clearArea: 85, direction: 'North', ...attrs },
    ...over,
});

describe('unit inventory helpers', () => {
    it('maps a catalog listing to a unit', () => {
        const u = toInventoryUnit(listing());
        expect(u).toMatchObject({ label: 'B2-07-08', tower: 'B', floor: 7, bedrooms: 2, clearArea: 85, tone: 'available' });
    });

    it('prefers a short title as label, falls back to the code', () => {
        expect(unitLabel('A-12.01', 'LST1')).toBe('A-12.01');
        expect(unitLabel('Bán nhà phố Aqua City 120m2 hướng Đông', 'LST043221')).toBe('LST043221');
        expect(unitLabel('', '')).toBe('—');
    });

    it('groups placed units by tower and floor (top floor first) and keeps the rest aside', () => {
        const units = [
            listing({ id: '1', title: 'A-05-02' }, { tower: 'A', floor: 5 }),
            listing({ id: '2', title: 'A-05-01' }, { tower: 'A', floor: 5 }),
            listing({ id: '3', title: 'A-10-01' }, { tower: 'A', floor: '10' }),
            listing({ id: '4', title: 'B-02-01' }, { tower: 'B', floor: 2 }),
            listing({ id: '5', title: 'Nhà phố 1', type: 'TOWNHOUSE' }, { tower: '', floor: null }),
        ].map(toInventoryUnit);
        const plan = buildStackingPlan(units);
        expect(plan.towers.map(t => t.tower)).toEqual(['A', 'B']);
        expect(plan.towers[0].floors.map(f => f.floor)).toEqual([10, 5]);
        expect(plan.towers[0].floors[1].units.map(u => u.label)).toEqual(['A-05-01', 'A-05-02']);
        expect(plan.unplaced.map(u => u.id)).toEqual(['5']);
    });

    it('summarises availability and sold rate over sellable stock', () => {
        const units = [
            listing({ status: 'AVAILABLE', price: 1e9 }),
            listing({ status: 'OPENING', price: 2e9 }),
            listing({ status: 'HOLD' }),
            listing({ status: 'SOLD' }),
            listing({ status: 'INACTIVE' }),
        ].map(toInventoryUnit);
        const s = summarize(units);
        expect(s).toMatchObject({ total: 5, available: 2, reserved: 1, sold: 1, inactive: 1, availableValue: 3e9 });
        expect(s.soldRate).toBeCloseTo(0.25);
        expect(units.filter(u => matchesStatus(u, 'reserved'))).toHaveLength(1);
    });
});
