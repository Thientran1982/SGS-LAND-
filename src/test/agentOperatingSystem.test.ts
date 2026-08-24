import { describe, expect, it } from 'vitest';
import { gateAgentOutput, shouldRetryAfterFailure } from '../../server/ai/agentOperatingContracts';
import { critiqueQuoteDraft } from '../../server/ai/quoteCritic';
import { detectBuyerSignals } from '../../server/ai/buyerSignals';
import { nextPlanAction } from '../../server/ai/agentPlanner';

describe('agent operating system contracts', () => {
  it('fails closed when confidence or evidence is missing', () => {
    expect(gateAgentOutput('draft', 0.9).canAct).toBe(false);
    expect(gateAgentOutput('draft', 0.4, { evidence: [{ source: 'crm' }] }).canAct).toBe(false);
    expect(gateAgentOutput('draft', 0.9, { evidence: [{ source: 'crm' }] }).canAct).toBe(true);
  });

  it('requires quote drafts to pass the critic before acting', () => {
    const weak = critiqueQuoteDraft({ content: 'Giá tham khảo là 5 tỷ.' });
    expect(weak.content.passed).toBe(false);
    expect(weak.canAct).toBe(false);
    const strong = critiqueQuoteDraft({
      content: 'Báo giá tham khảo, chưa phải cam kết. Vui lòng xác nhận nhu cầu để nhận bước tiếp theo.',
      price: 5000000000,
      currency: 'VND',
      source: 'bảng giá dự án cập nhật 2026-08-24',
      nextStep: 'Nhân viên sẽ xác nhận lại tình trạng căn.',
    });
    expect(strong.content.score).toBe(100);
    expect(strong.canAct).toBe(true);
  });

  it('puts urgent buyer messages first', () => {
    const signal = detectBuyerSignals('Tôi cần xử lý gấp ngay hôm nay, đang chờ phản hồi.');
    expect(signal.content.urgency).toBe('CRITICAL');
    expect(signal.content.priority).toBe(100);
    expect(signal.canAct).toBe(true);
  });

  it('replans after a first failure and escalates after a second', () => {
    expect(nextPlanAction({ status: 'FAILED', attempts: 1 })).toBe('REPLAN');
    expect(nextPlanAction({ status: 'FAILED', attempts: 2 })).toBe('ESCALATE');
    expect(shouldRetryAfterFailure(0)).toBe('RETRY');
  });
});