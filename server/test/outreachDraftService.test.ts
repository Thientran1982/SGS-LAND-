import { describe, expect, it } from 'vitest';
import { createOutreachDraft } from '../services/outreachDraftService';

const baseInput = {
  leadId: 'lead-a',
  leadName: 'Lan',
  brokerAssigned: 'broker-a',
  qualification: {
    status: 'QUALIFIED' as const,
    score: 82,
    buyingSignals: ['đã hỏi lịch xem'],
    missingData: [],
  },
  projectContext: {
    name: 'SGS Riverside',
    facts: ['vị trí gần tuyến metro đã xác minh'],
  },
  interactionHistory: [{ direction: 'INBOUND', channel: 'WEB', content: 'Tôi muốn biết thêm', timestamp: new Date() }],
  consent: { valid: true, channels: ['EMAIL', 'CALL_SCRIPT'] as const },
};

describe('Week 8 outreach draft contract', () => {
  it('creates at most two grounded variants and never calls a provider', () => {
    const result = createOutreachDraft(baseInput);
    expect(result.status).toBe('DRAFT');
    expect(result.draftVariants).toHaveLength(2);
    expect(result.requiresBrokerApproval).toBe(true);
    expect(result.providerCalled).toBe(false);
    expect(result.draftVariants.every(variant => variant.message.length > 0)).toBe(true);
  });

  it('blocks NURTURE/NEEDS_INFO outreach until qualification is sufficient', () => {
    const result = createOutreachDraft({
      ...baseInput,
      qualification: { ...baseInput.qualification, status: 'NEEDS_INFO' },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.draftVariants).toEqual([]);
    expect(result.blockedReasons).toContain('qualification_needs_more_information');
  });

  it('blocks missing consent and does not trust requested channels', () => {
    const result = createOutreachDraft({
      ...baseInput,
      consent: { valid: false, channels: [] },
      requestedChannels: ['ZALO'],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockedReasons).toContain('missing_or_expired_consent');
    expect(result.providerCalled).toBe(false);
  });

  it('keeps sensitive numeric/legal claims out when facts do not provide them', () => {
    const result = createOutreachDraft(baseInput);
    const messages = result.draftVariants.map(variant => variant.message).join(' ');
    expect(messages).not.toMatch(/tỷ|triệu\/m²|sổ hồng|cam kết lợi nhuận/i);
  });
});