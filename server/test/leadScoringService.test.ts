import { describe, expect, it } from 'vitest';
import { computeFactors, gradeFor, resolveConfig, scoreWithConfig } from '../services/leadScoringService';

const NOW = new Date('2026-09-26T08:00:00Z');

describe('config-based lead scoring', () => {
  it('measures a complete, engaged lead with matching stock as strong on every criterion', () => {
    const f = computeFactors({
      now: NOW,
      lead: {
        name: 'Nguyễn Văn An', phone: '0901234567', email: 'an@example.com', stage: 'QUALIFIED',
        preferences: { budgetMin: 3e9, budgetMax: 5e9, regions: ['Thủ Đức'], propertyTypes: ['APARTMENT'] },
      },
      text: 'Cho tôi xin bảng giá và đặt lịch đi xem nhà tuần này, pháp lý sổ hồng thế nào?',
      inboundCount: 5,
      lastInboundAt: '2026-09-26T06:00:00Z',
      matchingListings: 8,
    });
    expect(f.engagement).toBe(100);
    expect(f.completeness).toBe(100);
    expect(f.budgetFit).toBe(100);
    expect(f.velocity).toBeGreaterThanOrEqual(80);
  });

  it('gives a bare placeholder lead low fulfilment', () => {
    const f = computeFactors({ now: NOW, lead: { name: 'Khách Zalo', createdAt: '2026-06-01T00:00:00Z' } });
    expect(f).toEqual({ engagement: 0, completeness: 0, budgetFit: 0, velocity: 0 });
  });

  it('reads the budget from the customer message when preferences are empty', () => {
    const f = computeFactors({ now: NOW, lead: {}, text: 'ngân sách khoảng 4 tỷ', matchingListings: 0 });
    expect(f.budgetFit).toBe(40);
  });

  it('applies the tenant weights and thresholds', () => {
    const factors = { engagement: 100, completeness: 0, budgetFit: 0, velocity: 0 };
    // Only engagement counts → 100 points.
    expect(scoreWithConfig(factors, { weights: { engagement: 10, completeness: 0, budgetFit: 0, velocity: 0 } }).score).toBe(100);
    // Engagement is 1/4 of the weight → 25 points; grade D with default thresholds, C when C starts at 20.
    const even = { weights: { engagement: 10, completeness: 10, budgetFit: 10, velocity: 10 } };
    expect(scoreWithConfig(factors, even).score).toBe(25);
    expect(scoreWithConfig(factors, even).grade).toBe('D');
    expect(scoreWithConfig(factors, { ...even, thresholds: { A: 90, B: 50, C: 20, D: 10 } }).grade).toBe('C');
  });

  it('falls back to defaults for invalid configuration', () => {
    const r = resolveConfig({ weights: { engagement: 0, completeness: 0, budgetFit: 0, velocity: 0 }, thresholds: { A: 10, B: 50, C: 40, D: 20 } });
    expect(r.weights).toEqual({ engagement: 15, completeness: 10, budgetFit: 40, velocity: 10 });
    expect(r.thresholds).toEqual({ A: 80, B: 60, C: 40, D: 20 });
    expect(gradeFor(80, r.thresholds)).toBe('A');
    expect(gradeFor(79, r.thresholds)).toBe('B');
  });

  it('explains the score in Vietnamese with the config version', () => {
    const r = scoreWithConfig({ engagement: 80, completeness: 20, budgetFit: 90, velocity: 40 }, { version: 3 });
    expect(r.reasoning).toMatch(/cấu hình điểm số v3/);
    expect(r.reasoning).toMatch(/Điểm mạnh: Phù hợp ngân sách 90%/);
    expect(r.reasoning).toMatch(/Cần bổ sung: Độ đầy đủ hồ sơ 20%/);
  });
});
