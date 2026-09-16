import { describe, expect, it } from 'vitest';
import { buildLiveChatRequestHash, classifyLiveChatIntent, classifyLiveChatIntents, getLiveChatClarification, isLongFormRequest, resolveLiveChatFollowUp, shouldUseFastLiveChatPipeline } from '../ai/liveChatEngine';

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

  it('clarifies short non-price topics before specialist retrieval', () => {
    expect(getLiveChatClarification('pháp lý')).toMatchObject({
      reason: 'UNDERSPECIFIED_PROJECT_OR_LOCATION',
      missingData: ['project_or_location'],
    });
    expect(getLiveChatClarification('quy hoạch')).toMatchObject({
      reason: 'UNDERSPECIFIED_PROJECT_OR_LOCATION',
      missingData: ['project_or_location'],
    });
    expect(getLiveChatClarification('tìm căn hộ')).toMatchObject({
      reason: 'UNDERSPECIFIED_SEARCH_CRITERIA',
      missingData: ['location_or_budget'],
    });
    expect(getLiveChatClarification('pháp lý Aqua City')).toBeNull();
    expect(classifyLiveChatIntent('Xin chào').intent).toBe('CLARIFY');
    expect(classifyLiveChatIntent('Masteri').intent).toBe('CLARIFY');
  });

  it('asks what the customer wants for a bare project or location', () => {
    expect(getLiveChatClarification('Masteri')).toMatchObject({
      reason: 'UNDERSPECIFIED_INTENT',
      missingData: ['intent'],
    });
    expect(getLiveChatClarification('Long Thành')).toMatchObject({
      reason: 'UNDERSPECIFIED_INTENT',
      missingData: ['intent'],
    });
  });

  it('handles greetings deterministically without invoking a provider', () => {
    expect(getLiveChatClarification('Xin chào')).toMatchObject({
      reason: 'GREETING',
      missingData: [],
    });
  });

  it('uses the previous project for a topic-only price follow-up', () => {
    const resolved = resolveLiveChatFollowUp('giá', [
      { role: 'user', content: 'Aqua City' },
      { role: 'user', content: 'giá' },
    ]);
    expect(resolved.contextUsed).toBe(true);
    expect(getLiveChatClarification('giá', 'vi', resolved.previousUserMessage)).toMatchObject({
      reason: 'UNDERSPECIFIED_PROPERTY_TYPE',
      missingData: ['property_type'],
    });
  });

  it('does not confuse “giá trị pháp lý” with a price lookup', () => {
    expect(classifyLiveChatIntent('Giá trị pháp lý của Aqua City').intent).toBe('LEGAL');
    expect(getLiveChatClarification('Giá trị pháp lý của Aqua City')).toBeNull();
  });

  it('clarifies bare budgets and preserves land as an explicit property type', () => {
    expect(getLiveChatClarification('2 tỷ')).toMatchObject({
      reason: 'UNDERSPECIFIED_SEARCH_CRITERIA',
      missingData: ['property_type', 'project_or_location'],
    });
    expect(getLiveChatClarification('Trị giá lô đất này')).toBeNull();
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

  it('does not inject history into complete topic questions or product-specific price questions', () => {
    expect(resolveLiveChatFollowUp('pháp lý Aqua City', [
      { role: 'user', content: 'Long Thành' },
    ]).contextUsed).toBe(false);
    expect(resolveLiveChatFollowUp('giá căn hộ Aqua City', [
      { role: 'user', content: 'Masteri' },
    ]).contextUsed).toBe(false);
    expect(getLiveChatClarification('giá căn hộ Aqua City', 'vi', 'Masteri')).toBeNull();
  });

  it('routes no-diacritic topic messages to the same fast intent path', () => {
    expect(classifyLiveChatIntent('phap ly Aqua City').intent).toBe('LEGAL');
    expect(classifyLiveChatIntent('quy hoach Aqua City').intent).toBe('PLANNING');
    expect(shouldUseFastLiveChatPipeline('phap ly Aqua City')).toBe(true);
  });

  it('keeps English short inputs on the same clarification contract', () => {
    expect(classifyLiveChatIntent('legal Aqua City').intent).toBe('LEGAL');
    expect(getLiveChatClarification('legal')).toMatchObject({
      reason: 'UNDERSPECIFIED_PROJECT_OR_LOCATION',
      missingData: ['project_or_location'],
    });
    expect(getLiveChatClarification('legal Aqua City')).toBeNull();
    expect(getLiveChatClarification('what is the price of Masteri')?.reason)
      .toBe('UNDERSPECIFIED_PROPERTY_TYPE');
    expect(getLiveChatClarification('find apartment')?.reason)
      .toBe('UNDERSPECIFIED_SEARCH_CRITERIA');
  });

  it('does not match legal keywords inside unrelated words', () => {
    expect(classifyLiveChatIntent('Cho tôi thông tin dự án Aqua City').intent).toBe('PROJECT');
    expect(classifyLiveChatIntent('Thông tin dự án').intent).toBe('PROJECT');
  });

  it('fails closed for punctuation-only and bedroom-count questions', () => {
    expect(getLiveChatClarification('???')).toMatchObject({
      reason: 'UNDERSPECIFIED_INTENT',
      missingData: ['intent'],
    });
    expect(classifyLiveChatIntent('???').intent).toBe('CLARIFY');
    expect(getLiveChatClarification('bao nhiêu phòng ngủ')).toMatchObject({
      reason: 'UNDERSPECIFIED_INTENT',
      missingData: ['intent'],
    });
  });

  it('does not treat budget or bedroom count as a project subject', () => {
    expect(getLiveChatClarification('giá căn hộ 2 tỷ')).toMatchObject({
      reason: 'UNDERSPECIFIED_PRICE_REQUEST',
      missingData: ['project_or_location'],
    });
    expect(getLiveChatClarification('giá căn hộ 2 phòng ngủ')).toMatchObject({
      reason: 'UNDERSPECIFIED_PRICE_REQUEST',
      missingData: ['project_or_location'],
    });
    expect(getLiveChatClarification('tìm căn hộ 2 tỷ')).toMatchObject({
      reason: 'UNDERSPECIFIED_SEARCH_CRITERIA',
      missingData: ['project_or_location'],
    });
  });

  it('keeps public routing on the fast path for every deterministic clarification', () => {
    for (const message of ['???', 'Masteri', 'giá Masteri', 'pháp lý', 'tìm căn hộ', '2 tỷ']) {
      expect(shouldUseFastLiveChatPipeline(message), message).toBe(true);
    }
    expect(shouldUseFastLiveChatPipeline('câu hỏi mới hoàn chỉnh về tiến độ Aqua City')).toBe(true);
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
