import { describe, expect, it } from 'vitest';
import { buildLiveChatRequestHash, classifyLiveChatIntent, classifyLiveChatIntents, getLiveChatClarification, isLongFormRequest, resolveLiveChatFollowUp } from '../ai/liveChatEngine';

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

  it('asks for the product type before answering a named project price question', () => {
    const clarification = getLiveChatClarification('Giá Masteri');
    expect(classifyLiveChatIntent('Giá Masteri')).toEqual({
      intent: 'VALUATION',
      suggestedTool: 'get_valuation',
    });
    expect(clarification).toMatchObject({
      reason: 'UNDERSPECIFIED_PROPERTY_TYPE',
      missingData: ['property_type'],
    });
    expect(clarification?.response).toContain('Masteri');
    expect(clarification?.response).toContain('căn hộ, nhà phố hay biệt thự');
  });

  it('keeps price-filter searches out of the project-price clarification path', () => {
    expect(classifyLiveChatIntent('Tìm căn hộ giá 3 tỷ ở Long Thành').intent).toBe('SEARCH');
    expect(getLiveChatClarification('Tìm căn hộ giá 3 tỷ ở Long Thành')).toBeNull();
  });

  it.each([
    'Giá căn hộ Masteri?',
    'Giá nhà phố Masteri?',
    'Giá biệt thự Masteri?',
    'Giá Masteri 2 phòng ngủ?',
  ])('does not ask for property type when the request identifies it: %s', (message) => {
    expect(getLiveChatClarification(message)).toBeNull();
  });

  it('carries the previous user topic into a short time follow-up', () => {
    const resolved = resolveLiveChatFollowUp('mấy giờ?', [
      { role: 'user', content: 'Aqua City có lịch mở cửa tham quan không?' },
      { role: 'assistant', content: 'Mình cần kiểm tra lịch cụ thể.' },
      { role: 'user', content: 'mấy giờ?' },
    ]);

    expect(resolved.contextUsed).toBe(true);
    expect(resolved.previousUserMessage).toContain('Aqua City');
    expect(resolved.routingMessage).toContain('Câu hỏi mới nhất của khách: mấy giờ?');
  });

  it('does not inject history into a complete new question', () => {
    const resolved = resolveLiveChatFollowUp('Giá căn hộ Aqua City bao nhiêu?', [
      { role: 'user', content: 'Long Thành có quy hoạch gì?' },
    ]);

    expect(resolved.contextUsed).toBe(false);
    expect(resolved.routingMessage).toBe('Giá căn hộ Aqua City bao nhiêu?');
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
