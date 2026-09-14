import { describe, expect, it } from 'vitest';
import { buildLiveChatRequestHash, classifyLiveChatIntent, classifyLiveChatIntents, getLiveChatClarification, isLongFormRequest } from '../ai/liveChatEngine';

describe('classifyLiveChatIntent — P0-5 keyword precision', () => {
  it('routes price-bounded search requests to SEARCH, not VALUATION', () => {
    expect(classifyLiveChatIntent('tìm căn hộ giá 3 tỷ ở Long Thành').intent).toBe('SEARCH');
  });

  it('still routes explicit valuation questions to VALUATION', () => {
    expect(classifyLiveChatIntent('nhà này định giá bao nhiêu tiền?').intent).toBe('VALUATION');
    expect(classifyLiveChatIntent('trị giá lô đất này là bao nhiêu?').intent).toBe('VALUATION');
  });

  it('routes generic price wording to the fast clarification path', () => {
    expect(classifyLiveChatIntent('báo giá').intent).toBe('VALUATION');
    expect(classifyLiveChatIntent('giá bán').intent).toBe('VALUATION');
    expect(getLiveChatClarification('báo giá')?.reason).toBe('UNDERSPECIFIED_PRICE_REQUEST');
    expect(getLiveChatClarification('giá bán')?.response).toContain('dự án');
  });

  it('does not clarify when a price request contains a specific project', () => {
    expect(getLiveChatClarification('Giá bán căn hộ Aqua City bao nhiêu?')).toBeNull();
  });

  it('keeps the price-question contract from landingBuilderChat.test', () => {
    expect(classifyLiveChatIntent('Giá căn hộ này bao nhiêu?').intent).toBe('VALUATION');
  });

  it('no longer treats every mention of khách as LEAD_SCORING', () => {
    expect(classifyLiveChatIntent('khách hàng A muốn xem nhà quận 2').intent).not.toBe('LEAD_SCORING');
    expect(classifyLiveChatIntent('chấm điểm lead này giúp tôi').intent).toBe('LEAD_SCORING');
  });

  it('detects an explicit request for a detailed, structured answer', () => {
    expect(isLongFormRequest('Hãy phân tích chi tiết ưu nhược điểm và giải thích từng bước.')).toBe(true);
    expect(isLongFormRequest('Cho tôi biết giá căn hộ này.')).toBe(false);
  });

  it('keeps independent valuation and legal workstreams for a compound question', () => {
    expect(classifyLiveChatIntents('Giá căn hộ này bao nhiêu và pháp lý ra sao?').map(item => item.intent))
      .toEqual(['VALUATION', 'LEGAL']);
  });

  it('does not turn a price filter into a valuation workstream', () => {
    expect(classifyLiveChatIntents('Tìm căn hộ giá 3 tỷ ở Long Thành và pháp lý thế nào?').map(item => item.intent))
      .toEqual(['SEARCH', 'LEGAL']);
  });

  it('keeps reconnect idempotency stable when history has changed', () => {
    const first = buildLiveChatRequestHash({
      sessionId: 'session-1',
      message: 'Tìm căn hộ ở Long Thành',
      attachmentFingerprint: 'none',
    });
    const replay = buildLiveChatRequestHash({
      sessionId: 'session-1',
      message: 'Tìm căn hộ ở Long Thành',
      attachmentFingerprint: 'none',
    });
    expect(replay).toBe(first);
    expect(buildLiveChatRequestHash({
      sessionId: 'session-1',
      message: 'Tìm căn hộ ở Long Thành',
      requestId: 'event-1',
    })).toBe(buildLiveChatRequestHash({
      sessionId: 'different-session',
      message: 'changed local history',
      requestId: 'event-1',
    }));
  });
});
