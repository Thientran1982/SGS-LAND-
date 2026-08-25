import { describe, expect, it } from 'vitest';
import { inspectAgentOutput } from '../../server/ai/agentGuardrails';

describe('Agent Minh focused-output contract', () => {
  it('removes internal evidence markup and duplicate paragraphs', () => {
    const report = inspectAgentOutput({
      content: '<SPECIALIST_RESULT type="inventory">Căn A</SPECIALIST_RESULT>\n\nCăn A\n\nCăn A',
    });
    expect(report.sanitizedContent).toBe('Căn A');
    expect(report.flags).toEqual(expect.arrayContaining(['TECHNICAL_MARKUP', 'DUPLICATE_CONTENT']));
  });

  it('caps an overlong customer answer instead of leaking a specialist dump', () => {
    const report = inspectAgentOutput({ content: `Kết luận.\n\n${'Chi tiết không cần thiết. '.repeat(200)}` });
    expect(report.sanitizedContent!.length).toBeLessThanOrEqual(2200);
    expect(report.flags).toContain('OUTPUT_TRUNCATED');
  });

  it('fails closed on unsourced sensitive claims', () => {
    const report = inspectAgentOutput({ content: 'Pháp lý chắc chắn hoàn chỉnh, giá là 80 tỷ.' });
    expect(report.requiresVerification).toBe(true);
    expect(report.sanitizedContent).toContain('cần được xác minh');
  });
});