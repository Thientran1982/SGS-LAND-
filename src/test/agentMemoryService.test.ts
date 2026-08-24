import { describe, expect, it } from 'vitest';
import { scrubPii, validateWeights, DEFAULT_MATCHER_WEIGHTS } from '../../server/services/agentMemoryService';

describe('agent memory safety', () => {
  it('scrubs common customer PII before persistence', () => {
    const result = scrubPii('Liên hệ a@example.com, số 0912 345 678, CCCD 012345678901 và STK: 1234567890');
    expect(result).not.toContain('a@example.com');
    expect(result).not.toContain('0912 345 678');
    expect(result).not.toContain('012345678901');
    expect(result).not.toContain('1234567890');
  });

  it('normalizes valid matcher weights and rejects invalid weights', () => {
    expect(validateWeights({ location: 4, price: 2, legal: 2, rating: 2 })).toEqual({
      location: 0.4, price: 0.2, legal: 0.2, rating: 0.2,
    });
    expect(() => validateWeights({ location: -1, price: 1, legal: 1, rating: 1 })).toThrow();
    expect(Object.values(DEFAULT_MATCHER_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});