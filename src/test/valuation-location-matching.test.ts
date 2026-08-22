import { describe, expect, it } from 'vitest';
import {
  isComparableLocationMatch,
  normalizeComparableType,
} from '../../server/repositories/listingRepository';

describe('valuation comparable location provenance', () => {
  it.each([
    ['Quận 1, TP.HCM', '12 Nguyễn Huệ, Quận 1, TP.HCM'],
    ['Aqua City, Biên Hòa', 'Aqua City, Biên Hòa, Đồng Nai'],
    ['Vinhomes Grand Park, TP.HCM', 'The Origami, Vinhomes Grand Park, TP.HCM'],
    ['Đường Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM', 'Bình Thạnh, TP.HCM'],
  ])('accepts same-area candidate for %s', (target, candidate) => {
    expect(isComparableLocationMatch(target, candidate)).toBe(true);
  });

  it.each([
    ['Quận 1, TP.HCM', 'Quận 1, Long An'],
    ['Aqua City, Biên Hòa', 'Aqua City, Nhơn Trạch, Đồng Nai'],
    ['Vinhomes Grand Park, TP.HCM', 'Vinhomes Grand Park, Long An'],
    ['Bình Thạnh, TP.HCM', 'Bình Thạnh, Bình Dương'],
  ])('rejects cross-province candidate for %s', (target, candidate) => {
    expect(isComparableLocationMatch(target, candidate)).toBe(false);
  });

  it('keeps property types separate', () => {
    expect(normalizeComparableType('apartment_center')).toBe('apartment');
    expect(normalizeComparableType('căn hộ')).toBe('apartment');
    expect(normalizeComparableType('townhouse_center')).toBe('townhouse');
    expect(normalizeComparableType('villa')).toBe('villa');
    expect(normalizeComparableType('project')).toBe('project');
  });
});