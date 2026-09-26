import { describe, expect, it } from 'vitest';
import { STATUS_ACTIONS, elapsedRatio, formatVnd, minimumNextBid, parseMoney, splitDuration } from '../../utils/auction';

describe('auction helpers', () => {
    it('lets the first bid equal the start price, then requires one step', () => {
        expect(minimumNextBid({ startPrice: 5e9, stepPrice: 5e7, currentBid: 5e9, bidCount: 0 })).toBe(5e9);
        expect(minimumNextBid({ startPrice: 5e9, stepPrice: 5e7, currentBid: 5.2e9, bidCount: 3 })).toBe(5.25e9);
    });

    it('only offers valid operator transitions', () => {
        expect(STATUS_ACTIONS.UPCOMING).toEqual(['LIVE', 'CANCELLED']);
        expect(STATUS_ACTIONS.PAUSED).toContain('LIVE');
        expect(STATUS_ACTIONS.ENDED).toEqual([]);
        expect(STATUS_ACTIONS.CANCELLED).toEqual([]);
    });

    it('parses Vietnamese money input', () => {
        expect(parseMoney('5.000.000.000')).toBe(5e9);
        expect(parseMoney('5,2 tỷ')).toBe(5.2e9);
        expect(parseMoney('5.25 ty')).toBe(5.25e9);
        expect(parseMoney('800 triệu')).toBe(8e8);
        expect(parseMoney('800tr')).toBe(8e8);
        expect(parseMoney('')).toBeNull();
        expect(parseMoney('abc')).toBeNull();
    });

    it('formats amounts and durations', () => {
        const labels = { billion: 'tỷ', million: 'triệu', dong: 'đ' };
        expect(formatVnd(5.25e9, labels)).toBe('5,25 tỷ');
        expect(formatVnd(8e8, labels)).toBe('800 triệu');
        expect(splitDuration(90061000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
        expect(splitDuration(-5)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
    });

    it('clamps elapsed ratio to the auction window', () => {
        const a = { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T10:00:00Z' };
        expect(elapsedRatio(a, Date.parse('2025-12-31T00:00:00Z'))).toBe(0);
        expect(elapsedRatio(a, Date.parse('2026-01-01T05:00:00Z'))).toBeCloseTo(0.5);
        expect(elapsedRatio(a, Date.parse('2026-02-01T00:00:00Z'))).toBe(1);
    });
});
