import { describe, expect, it } from 'vitest';
import {
  buildValuationLocationCandidatePattern,
  matchValuationLocations,
  normalizeValuationLocation,
  parseValuationLocation,
} from '../services/valuationLocationContract';

describe('valuation location contract', () => {
  it('normalizes Vietnamese accents and common city aliases', () => {
    expect(normalizeValuationLocation('Bến Nghé, Quận 1, TP. Hồ Chí Minh'))
      .toBe('ben nghe quan 1 tp ho chi minh');
    expect(parseValuationLocation('Bến Nghé, Quận 1, TP. Hồ Chí Minh')).toMatchObject({
      province: 'ho chi minh',
      district: 'quan 1',
    });
  });

  it('matches a more detailed address within the same district and province', () => {
    const result = matchValuationLocations(
      'Quận 1, TP.HCM',
      'Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    );
    expect(result).toMatchObject({ matches: true, level: 'DISTRICT' });
  });

  it('rejects cross-province and cross-district collisions', () => {
    expect(matchValuationLocations('Quận 1, TP.HCM', 'Quận 1, Long An').matches).toBe(false);
    expect(matchValuationLocations('Quận 1, TP.HCM', 'Quận 7, TP.HCM').matches).toBe(false);
    expect(matchValuationLocations('Đồng Nai', 'Nghệ An').matches).toBe(false);
  });

  it('requires the same explicit project before accepting a project candidate', () => {
    expect(matchValuationLocations(
      'Aqua City, Đồng Nai',
      'Aqua City, Long An',
    ).matches).toBe(false);
    expect(matchValuationLocations(
      'Aqua City, Đồng Nai',
      'Aqua City, Long An',
    ).level).toBe('UNKNOWN');
    expect(matchValuationLocations(
      'Aqua City, Đồng Nai',
      'Aqua City, Long An',
    ).candidate.province).toBe('long an');
  });

  it('uses the strongest hierarchy anchor for SQL candidate pre-filtering', () => {
    expect(buildValuationLocationCandidatePattern('Bến Nghé, Quận 1, TP.HCM')).toBe('%quan 1%');
    expect(buildValuationLocationCandidatePattern('Aqua City, Đồng Nai')).toBe('%aqua city%');
  });
});