import { describe, expect, it, vi } from 'vitest';

// The pure matching helpers live next to the repository; keep the DB layer out of the test.
vi.mock('../../server/repositories/baseRepository', () => ({ BaseRepository: class {} }));

import { cleanConditions, normalizeRegion, ruleMismatch, validateRuleInput } from '../../server/repositories/routingRuleRepository';

const rule = (conditions: any) => ({ conditions, action: { type: 'ASSIGN_USER', targetId: 'u1' } });

describe('routing rule matching', () => {
    it('normalises regions: accents, "TP." prefix and common abbreviations', () => {
        expect(normalizeRegion('Hồ Chí Minh')).toBe('ho chi minh');
        expect(normalizeRegion('TP.HCM')).toBe('ho chi minh');
        expect(normalizeRegion('HCM')).toBe('ho chi minh');
        expect(normalizeRegion('Sài Gòn')).toBe('ho chi minh');
        expect(normalizeRegion('Thành phố Hà Nội')).toBe('ha noi');
        expect(normalizeRegion('12 Nguyễn Huệ, Q1, TP.HCM')).toContain('ho chi minh');
    });

    it('matches a "hồ chí minh" rule for HCM / TP.HCM addresses (the reported mismatch)', () => {
        const r = rule({ region: ['hồ chí minh'] });
        expect(ruleMismatch(r, { address: 'HCM' })).toBeNull();
        expect(ruleMismatch(r, { address: '12 Lê Lợi, Quận 1, TP.HCM' })).toBeNull();
        expect(ruleMismatch(r, { address: 'Hà Nội' })).toBe('region');
    });

    it('checks source case-insensitively and budget min/max', () => {
        const r = rule({ source: ['Facebook'], budgetMin: 2e9, budgetMax: 6e9 });
        expect(ruleMismatch(r, { source: 'facebook', preferences: { budget: 5e9 } })).toBeNull();
        expect(ruleMismatch(r, { source: 'Zalo', preferences: { budget: 5e9 } })).toBe('source');
        expect(ruleMismatch(r, { source: 'Facebook', preferences: { budget: 1e9 } })).toBe('budgetMin');
        expect(ruleMismatch(r, { source: 'Facebook', preferences: { budget: 7e9 } })).toBe('budgetMax');
    });

    it('treats legacy array conditions as "no conditions"', () => {
        expect(ruleMismatch({ conditions: [] }, { source: 'Zalo' })).toBeNull();
    });

    it('validates input and cleans empty conditions', () => {
        expect(validateRuleInput({ name: '', action: { type: 'ASSIGN_USER', targetId: 'u' } })).toMatch(/tên/);
        expect(validateRuleInput({ name: 'A', action: { type: 'ASSIGN_USER', targetId: '' } })).toMatch(/nhận lead/);
        expect(validateRuleInput({ name: 'A', action: { type: 'ASSIGN_USER', targetId: 'u' }, conditions: { budgetMin: 5, budgetMax: 1 } })).toMatch(/tối thiểu/);
        expect(validateRuleInput({ isActive: false }, true)).toBeNull();
        expect(cleanConditions({ source: [], region: ['', 'HCM'], budgetMin: 0, budgetMax: 3e9, junk: 1 })).toEqual({ region: ['HCM'], budgetMax: 3e9 });
    });
});
