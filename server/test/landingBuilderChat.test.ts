import { describe, expect, it } from 'vitest';
import { buildLandingBuilderResponse, ensureLandingResponseLink } from '../ai/landingResponse';
import { inspectAgentOutput } from '../ai/agentGuardrails';
import {
  buildLandingClassificationTelemetry,
  classifyLiveChatIntent,
  isLandingBuilderRequest,
} from '../ai/liveChatEngine';

describe('landing_builder chat response contract', () => {
  it('prioritizes landing creation over price and project details in the brief', () => {
    const message = 'Tạo landing page cho dự án Aqua City, giá 5 tỷ, diện tích 80m2';

    expect(isLandingBuilderRequest(message)).toBe(true);
    expect(classifyLiveChatIntent(message)).toEqual({
      intent: 'LANDING',
      suggestedTool: 'landing_builder',
    });

    const response = ensureLandingResponseLink(
      'Đã dựng xong trang landing cho dự án.',
      classifyLiveChatIntent(message).intent,
      { status: 'CREATED', slug: 'aqua-city-80m2' },
    );
    expect(response).toContain('/landing/aqua-city-80m2');
  });

  it('recognizes the common "ladning" typo in a landing request', () => {
    const message = 'dựng trang ladning dự án manhattan';

    expect(isLandingBuilderRequest(message)).toBe(true);
    expect(classifyLiveChatIntent(message)).toEqual({
      intent: 'LANDING',
      suggestedTool: 'landing_builder',
    });
  });

  it('keeps price-only and project-only questions on their original intents', () => {
    expect(classifyLiveChatIntent('Giá căn hộ này bao nhiêu?').intent).toBe('VALUATION');
    expect(classifyLiveChatIntent('Cho tôi thông tin dự án Aqua City').intent).toBe('PROJECT');
    expect(isLandingBuilderRequest('Giá dự án Aqua City bao nhiêu?')).toBe(false);
  });

  it('includes the generated landing URL when synthesis omits it', () => {
    const response = ensureLandingResponseLink(
      'Đã dựng xong trang landing cho dự án.',
      'LANDING',
      { status: 'CREATED', slug: 'du-an-demo-zcode' },
    );

    expect(response).toContain('/landing/du-an-demo-zcode');
  });

  it('builds a deterministic response from a created landing result without synthesis', () => {
    const response = buildLandingBuilderResponse({
      status: 'CREATED',
      projectName: 'Aqua City',
      slug: 'aqua-city',
      viewUrl: '/landing/aqua-city?visitorKey=lead-123',
      editUrl: '/landing-ai/chinh-sua/aqua-city?k=lead-123',
    });

    expect(response).toContain('Đã tạo xong trang landing cho Aqua City.');
    expect(response).toContain('/landing/aqua-city?visitorKey=lead-123');
    expect(response).toContain('/landing-ai/chinh-sua/aqua-city?k=lead-123');
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

  it('records only privacy-safe landing classification signals', () => {
    const brief = 'Tạo landing page cho dự án Aqua City, giá 5 tỷ';
    const telemetry = buildLandingClassificationTelemetry(
      brief,
      'vi',
      'LANDING',
      { status: 'CREATED', slug: 'aqua-city-unsafe-detail' },
    );

    expect(telemetry).toMatchObject({
      language: 'vi',
      detected: true,
      candidate: true,
      hasProjectOrPriceContext: true,
      draftStatus: 'CREATED',
      draftCreated: true,
      falseNegative: false,
      falsePositive: false,
    });
    expect(JSON.stringify(telemetry)).not.toContain(brief);
    expect(JSON.stringify(telemetry)).not.toContain('5 tỷ');
    expect(JSON.stringify(telemetry)).not.toContain('Aqua City');
    expect(JSON.stringify(telemetry)).not.toContain('unsafe-detail');
  });

  it('surfaces candidate misses and classifier false positives by language', () => {
    const missed = buildLandingClassificationTelemetry(
      'Please craft a campaign page for the project',
      'en',
      'VALUATION',
    );
    expect(missed).toMatchObject({
      language: 'en',
      candidate: true,
      detected: false,
      falseNegative: true,
    });

    const falsePositive = buildLandingClassificationTelemetry(
      'Tạo landing page cho dự án',
      'vi',
      'PROJECT',
    );
    expect(falsePositive.falsePositive).toBe(true);
  });
});