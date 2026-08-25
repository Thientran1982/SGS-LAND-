import { describe, expect, it } from 'vitest';
import { classifyInteractionOutcome, normalizeProfileFact, observeCustomerMessage } from '../services/customerProfileService';

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

  it('observes only explicit customer preferences and marks sensitive disclosures', () => {
    const facts = observeCustomerMessage('Tôi có ngân sách khoảng 3,5 tỷ, quan tâm Quận 7 để ở thực.');
    expect(facts.map(fact => fact.category)).toEqual(['budget', 'preference_location', 'purpose']);
    expect(facts.every(fact => fact.source === 'customer_message')).toBe(true);
    expect(observeCustomerMessage('Tôi đang khó khăn tài chính, xin đừng nhắc lại.').some(fact => fact.sensitive)).toBe(true);
  });

  it('classifies explicit recommendation outcomes without guessing from neutral text', () => {
    expect(classifyInteractionOutcome('Không phù hợp, giá quá cao')).toBe('negative');
    expect(classifyInteractionOutcome('Gửi thêm dự án phù hợp giúp tôi')).toBe('positive');
    expect(classifyInteractionOutcome('Cho tôi thêm thông tin')).toBe('neutral');
  });
});