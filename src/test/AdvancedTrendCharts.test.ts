import { describe, expect, it } from 'vitest';
import {
    buildDailyLeadTrendData,
    buildMonthlyRevenueTrendData,
} from '../../components/dashboard/AdvancedTrendCharts';

describe('advanced dashboard trend data', () => {
    it('orders daily leads by date and inserts zero-count days between observations', () => {
        const points = buildDailyLeadTrendData([
            { dateKey: '2026-09-25', count: 1 },
            { dateKey: '2026-09-22', count: 2 },
            { dateKey: '2026-09-24', count: 3 },
        ]);

        expect(points.map(({ dateKey }) => dateKey)).toEqual([
            '2026-09-22',
            '2026-09-23',
            '2026-09-24',
            '2026-09-25',
        ]);
        expect(points.map(({ value }) => value)).toEqual([2, 0, 3, 1]);
    });

    it('ignores invalid dates and counts instead of plotting fabricated values', () => {
        expect(buildDailyLeadTrendData([
            { dateKey: '2026-02-30', count: 10 },
            { dateKey: '2026-09-24', count: -2 },
            { dateKey: '2026-09-25', count: Number.POSITIVE_INFINITY },
        ])).toEqual([]);
    });

    it('shows the latest twelve calendar months chronologically and fills missing months with zero', () => {
        const points = buildMonthlyRevenueTrendData([
            { month: '2026-09', revenue: 250000 },
            { month: '2026-07', revenue: 125000 },
            { month: '2025-09', revenue: 990000 },
            { month: '2026-08', revenue: 'not-a-number' },
        ], new Date(2026, 8, 26));

        expect(points).toHaveLength(12);
        expect(points[0].monthKey).toBe('2025-10');
        expect(points[11].monthKey).toBe('2026-09');
        expect(points.find(({ monthKey }) => monthKey === '2026-07')?.value).toBe(125000);
        expect(points.find(({ monthKey }) => monthKey === '2026-08')?.value).toBe(0);
        expect(points.find(({ monthKey }) => monthKey === '2026-09')?.value).toBe(250000);
        expect(points.some(({ monthKey }) => monthKey === '2025-09')).toBe(false);
    });

    it('returns no monthly series when there is no real revenue in the displayed window', () => {
        expect(buildMonthlyRevenueTrendData(
            [{ month: '2025-09', revenue: 50000 }],
            new Date(2026, 8, 26),
        )).toEqual([]);
    });
});