import { describe, it, expect } from 'vitest';
import { formatPriceLang, formatUnitPriceLang, formatSmartPrice } from '../../utils/priceFormat';

describe('priceFormat (UX audit U5)', () => {
  it('formats billions with comma decimals and lowercase unit', () => {
    expect(formatPriceLang(8_499_000_000, 'vi')).toBe('8,499 tỷ');
    expect(formatPriceLang(25_197_000_000, 'vi')).toBe('25,197 tỷ');
    expect(formatPriceLang(3_000_000_000, 'vi')).toBe('3 tỷ');
  });

  it('formats millions and unit price consistently', () => {
    expect(formatPriceLang(850_000_000, 'vi')).toBe('850 triệu');
    expect(formatUnitPriceLang(8_499_000_000, 114, 'vi')).toBe('74,6 triệu/m²');
  });

  it('CRM default (no translator) is unchanged', () => {
    expect(formatSmartPrice(8_499_000_000)).toBe('8,499 Tỷ');
  });
});
