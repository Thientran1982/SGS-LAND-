import { describe, expect, it } from 'vitest';
import { ensureLandingResponseLink } from '../ai/landingResponse';
import { inspectAgentOutput } from '../ai/agentGuardrails';

describe('landing_builder chat response contract', () => {
  it('includes the generated landing URL when synthesis omits it', () => {
    const response = ensureLandingResponseLink(
      'Đã dựng xong trang landing cho dự án.',
      'LANDING',
      { status: 'CREATED', slug: 'du-an-demo-zcode' },
    );

    expect(response).toContain('/landing/du-an-demo-zcode');
  });

  it('does not duplicate a URL already present in the response', () => {
    const response = 'Xem trang landing: /landing/du-an-demo-zcode';

    expect(
      ensureLandingResponseLink(response, 'LANDING', {
        status: 'CREATED',
        slug: 'du-an-demo-zcode',
      }),
    ).toBe(response);
  });

  it('does not add a landing URL for another intent or an unsuccessful tool result', () => {
    expect(
      ensureLandingResponseLink('Đã xử lý.', 'GENERAL', {
        status: 'CREATED',
        slug: 'du-an-demo-zcode',
      }),
    ).toBe('Đã xử lý.');
    expect(
      ensureLandingResponseLink('Chưa tạo được.', 'LANDING', {
        status: 'PAYWALL',
        slug: 'du-an-demo-zcode',
      }),
    ).toBe('Chưa tạo được.');
  });

  it('keeps a successful live-chat engine result valid for the durable output guardrail', () => {
    const guardrail = inspectAgentOutput({
      content: 'Đã dựng xong trang landing.\n\nXem trang landing: /landing/du-an-demo-zcode',
      suggestedAction: null,
      sources: [{ tool: 'landing_builder' }],
    });

    expect(guardrail.blocked).toBe(false);
    expect(guardrail.sanitizedContent).toContain('/landing/du-an-demo-zcode');
  });
});