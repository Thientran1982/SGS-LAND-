import { describe, expect, it } from 'vitest';
import { ensureLandingResponseLink } from '../ai/landingResponse';

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
});