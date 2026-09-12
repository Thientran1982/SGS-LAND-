import { describe, expect, it } from 'vitest';
import { classifyLiveChatIntent } from '../ai/liveChatEngine';

describe('classifyLiveChatIntent — P0-5 keyword precision', () => {
  it('routes price-bounded search requests to SEARCH, not VALUATION', () => {
    expect(classifyLiveChatIntent('tìm căn hộ giá 3 tỷ ở Long Thành').intent).toBe('SEARCH');
  });

  it('still routes explicit valuation questions to VALUATION', () => {
    expect(classifyLiveChatIntent('nhà này định giá bao nhiêu tiền?').intent).toBe('VALUATION');
    expect(classifyLiveChatIntent('trị giá lô đất này là bao nhiêu?').intent).toBe('VALUATION');
  });

  it('keeps the price-question contract from landingBuilderChat.test', () => {
    expect(classifyLiveChatIntent('Giá căn hộ này bao nhiêu?').intent).toBe('VALUATION');
  });

  it('no longer treats every mention of khách as LEAD_SCORING', () => {
    expect(classifyLiveChatIntent('khách hàng A muốn xem nhà quận 2').intent).not.toBe('LEAD_SCORING');
    expect(classifyLiveChatIntent('chấm điểm lead này giúp tôi').intent).toBe('LEAD_SCORING');
  });
});
