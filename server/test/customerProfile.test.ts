import { describe, expect, it } from 'vitest';
import { normalizeProfileFact } from '../services/customerProfileService';

describe('customer profile guardrails', () => {
  it('accepts a sourced, categorized fact and preserves sensitive flag', () => {
    expect(normalizeProfileFact({
      fact: 'Quan tâm khu vực Quận 7',
      category: 'preference_location',
      source: 'Khách tự nói trong phiên chat',
      sensitive: false,
      confidence: 0.9,
    })).toEqual({
      fact: 'Quan tâm khu vực Quận 7',
      category: 'preference_location',
      source: 'Khách tự nói trong phiên chat',
      sensitive: false,
      confidence: 0.9,
    });
  });

  it('rejects missing source, unsupported categories and invalid confidence', () => {
    expect(() => normalizeProfileFact({ fact: '3 tỷ', category: 'budget' })).toThrow(/source/);
    expect(() => normalizeProfileFact({ fact: 'x', category: 'marital_status', source: 'chat' })).toThrow(/category/);
    expect(() => normalizeProfileFact({ fact: 'x', category: 'budget', source: 'chat', confidence: 2 })).toThrow(/confidence/);
  });
});