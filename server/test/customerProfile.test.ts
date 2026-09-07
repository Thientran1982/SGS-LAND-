import { describe, expect, it } from 'vitest';
import {
  classifyInteractionOutcome,
  formatCustomerProfileContext,
  normalizeProfileFact,
  observeCustomerMessage,
  extractFactsWithLLM,
} from '../services/customerProfileService';

describe('customer profile guardrails', () => {
  it('accepts a sourced, categorized fact and preserves sensitive flag', () => {
    expect(normalizeProfileFact({
      fact: 'Quan tâm khu vực Quận 7',
      category: 'preference_location',
      source: 'Khách tự nói trong phiên chat',
      sensitive: false,
      confidence: 0.9,
    })).toMatchObject({
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

  it('extracts timeline, budget and location through the optional JSON LLM path', async () => {
    const facts = await extractFactsWithLLM(
      'tháng sau em cưới, cần nhà gấp quanh 5 tỷ ở Thủ Đức',
      async () => JSON.stringify({
        facts: [
          { fact: 'Dự kiến mua trong tháng sau vì sắp cưới', category: 'purchase_timeline', confidence: 0.92 },
          { fact: 'Ngân sách quanh 5 tỷ', category: 'budget', confidence: 0.9 },
          { fact: 'Quan tâm khu vực Thủ Đức', category: 'preference_location', confidence: 0.95 },
        ],
      }),
    );
    expect(facts.map(fact => fact.category)).toEqual(
      expect.arrayContaining(['purchase_timeline', 'budget', 'preference_location']),
    );
    expect(facts.every(fact => fact.source === 'llm_extraction')).toBe(true);
  });

  it('fails closed to an empty optional LLM result so regex facts can remain intact', async () => {
    await expect(extractFactsWithLLM('cần nhà gấp', async () => {
      throw new Error('provider timeout');
    })).resolves.toEqual([]);
  });

  it('classifies explicit recommendation outcomes without guessing from neutral text', () => {
    expect(classifyInteractionOutcome('Không phù hợp, giá quá cao')).toBe('negative');
    expect(classifyInteractionOutcome('Gửi thêm dự án phù hợp giúp tôi')).toBe('positive');
    expect(classifyInteractionOutcome('Cho tôi thêm thông tin')).toBe('neutral');
  });

  it('keeps validity explicit and formats only consented, non-sensitive context', () => {
    expect(normalizeProfileFact({
      fact: 'Cần nhà gần trường', category: 'property_need', source: 'chat', validUntil: '2027-01-15',
    }).validUntil).toBe('2027-01-15');
    expect(formatCustomerProfileContext({
      consent: true,
      facts: [{ category: 'purpose', fact: 'Ở thực' }],
      topicsToAvoid: ['tình trạng hôn nhân'],
    })).toContain('KHÔNG NHẮC LẠI');
    expect(formatCustomerProfileContext({ consent: false, facts: [{ category: 'budget', fact: '3 tỷ' }] })).toBe('');
  });
});