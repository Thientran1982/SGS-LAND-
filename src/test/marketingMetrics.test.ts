import { describe, expect, it } from 'vitest';
import { countNonDirectLeads, summarizePaidMarketing } from '../../components/reports/marketingMetrics';

describe('paid marketing report metrics', () => {
    it('excludes direct-sale and unspent-channel revenue from paid ROI', () => {
        const result = summarizePaidMarketing([
            { channel: 'FACEBOOK', spend: 100, leads: 5, revenue: 150, roi: 50 },
            { channel: 'ORGANIC', spend: 0, leads: 8, revenue: 500, roi: 0 },
            { channel: 'DIRECT_SALE', spend: 0, leads: 10, revenue: 1000, roi: 0 },
        ]);

        expect(result).toMatchObject({
            revenue: 150,
            spend: 100,
            leads: 5,
            roi: 50,
        });
        expect(result.channels.map(row => row.channel)).toEqual(['FACEBOOK']);
    });

    it('keeps ROI unavailable when no paid spend is recorded', () => {
        const result = summarizePaidMarketing([
            { channel: 'ORGANIC', spend: 0, leads: 3, revenue: 80, roi: 0 },
            { channel: 'DIRECT_SALE', spend: 0, leads: 2, revenue: 120, roi: 0 },
        ]);

        expect(result).toMatchObject({ revenue: 0, spend: 0, leads: 0, roi: null });
    });

    it('keeps a measured zero-revenue channel as a valid -100% ROI', () => {
        const result = summarizePaidMarketing([
            { channel: 'GOOGLE', spend: 25, leads: 1, revenue: 0, roi: -100 },
        ]);

        expect(result.roi).toBe(-100);
    });

    it('does not count direct-sale listing totals as lead totals', () => {
        expect(countNonDirectLeads([
            { channel: 'FACEBOOK', spend: 100, leads: 4, revenue: 0, roi: -100 },
            { channel: 'DIRECT_SALE', spend: 0, leads: 7, revenue: 0, roi: 0 },
        ])).toBe(4);
    });
});