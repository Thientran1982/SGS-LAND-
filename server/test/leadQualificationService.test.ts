import { describe, expect, it } from 'vitest';
import {
  qualifyLeadConversation,
  scoreLeadDeterministically,
} from '../services/leadQualificationService';
import { qualifyLiveChatMessage } from '../ai/liveChatEngine';

describe('lead qualification service', () => {
  it('keeps score_lead factors deterministic and bounded', () => {
    const result = scoreLeadDeterministically({
      budget: 10_000_000_000,
      timeline: 'URGENT',
      area: 'Thủ Thiêm',
      source: 'REFERRAL',
      interactions: 12,
      viewedListings: 5,
      askedLegal: true,
      askedValuation: true,
      bookedViewing: true,
      isReturning: true,
      justSoldProperty: true,
      hasPhone: true,
    });

    expect(result).toMatchObject({
      score: 100,
      grade: 'A',
      priority: 'HOT — xử lý trong 2h',
      churnRisk: 'MEDIUM',
    });
    expect(result.topFactors).toHaveLength(3);
    expect(result.topFactors.every(factor => factor.points <= factor.max)).toBe(true);
  });

  it('returns QUALIFIED and captures Vietnamese buying signals', () => {
    const result = qualifyLeadConversation({
      source: 'WEBSITE',
      messages: [{
        role: 'user',
        content: 'Tôi có ngân sách 8 tỷ, muốn mua ở Thủ Thiêm trong 1 tháng. '
          + 'Số điện thoại 0901234567, quan tâm pháp lý và muốn đi xem nhà.',
      }],
    });

    expect(result.status).toBe('QUALIFIED');
    expect(result.captured).toMatchObject({
      budget: 8_000_000_000,
      timeline: '1M',
      area: 'Thủ Thiêm',
      hasPhone: true,
      hasEmail: false,
    });
    expect(result.buyingSignals).toEqual(expect.arrayContaining([
      'Đã nêu ngân sách',
      'Có timeline 1M',
      'Đã thể hiện ý định xem nhà',
      'Quan tâm pháp lý',
    ]));
    expect(result.nextBestAction.channel).toBe('Call');
  });

  it('returns NURTURE when the lead has intent but is not ready', () => {
    const result = qualifyLeadConversation({
      messages: [{
        role: 'user',
        content: 'Tôi đang tham khảo căn hộ Quận 7, ngân sách khoảng 3 tỷ, '
          + 'có thể mua trong 6 tháng.',
      }],
    });

    expect(result.status).toBe('NURTURE');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.missingData).toContain('contact');
    expect(result.nextBestAction.channel).toBe('Zalo');
  });

  it('returns NEEDS_INFO when the conversation lacks buying context', () => {
    const result = qualifyLeadConversation({
      messages: [{ role: 'user', content: 'Xin chào, tôi chỉ đang xem thông tin.' }],
    });

    expect(result.status).toBe('NEEDS_INFO');
    expect(result.missingData).toEqual(expect.arrayContaining(['budget', 'area', 'contact']));
    expect(result.nextBestAction.action).toContain('Hỏi bổ sung');
  });

  it('uses history plus the newest live-chat message without exposing it in the text response', () => {
    const result = qualifyLiveChatMessage(
      'Tôi có thể gửi email minh@example.com và muốn xem nhà.',
      {
        history: [
          { role: 'user', content: 'Tôi quan tâm Thủ Đức, ngân sách 5 tỷ.' },
          { role: 'assistant', content: 'Anh/chị dự kiến mua khi nào?' },
        ],
      },
    );

    expect(result.status).toBe('NURTURE');
    expect(result.captured).toMatchObject({
      budget: 5_000_000_000,
      area: 'Thủ Đức',
      hasEmail: true,
    });
    expect(JSON.stringify(result)).not.toContain('minh@example.com');
  });
});