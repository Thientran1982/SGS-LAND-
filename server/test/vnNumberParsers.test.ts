import { describe, expect, it } from 'vitest';
import { parseArea, parseVnd } from '../ai/minhBrain';
import { parseAreaText, parseVndText } from '../ai/liveChatEngine';

describe('VN number parsing (P2-3)', () => {
  it('keeps decimal semantics for tỷ with either separator', () => {
    expect(parseVnd('nhà giá 1,5 tỷ')).toBe(1_500_000_000);
    expect(parseVnd('nhà giá 1.5 tỷ')).toBe(1_500_000_000);
    expect(parseVnd('giá 1.234 tỷ')).toBe(1_234_000_000);
  });

  it('resolves thousands separators before triệu', () => {
    expect(parseVnd('giá 1.500 triệu')).toBe(1_500_000_000);
    expect(parseVnd('giá 1,500 triệu')).toBe(1_500_000_000);
    expect(parseVnd('850 triệu')).toBe(850_000_000);
  });

  it('resolves thousands separators for area', () => {
    expect(parseArea('lô đất 1.200 m2')).toBe(1200);
    expect(parseArea('căn hộ 80,5 m2')).toBe(80.5);
    expect(parseAreaText('1.200 m2')).toBe(1200);
  });
});
