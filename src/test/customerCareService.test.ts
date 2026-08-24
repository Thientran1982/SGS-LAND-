import { describe, expect, it } from 'vitest';
import { careEmailContent, dayMark } from '../../server/services/customerCareService';

describe('Customer Care Agent', () => {
  it('selects the latest eligible calendar day mark', () => {
    const first = new Date('2026-08-20T23:30:00+07:00');
    expect(dayMark(first, new Date('2026-08-21T08:00:00+07:00'))).toBe('D1');
    expect(dayMark(first, new Date('2026-08-23T08:00:00+07:00'))).toBe('D3');
    expect(dayMark(first, new Date('2026-08-28T08:00:00+07:00'))).toBe('D7');
    expect(dayMark(first, new Date('2026-08-20T12:00:00+07:00'))).toBeNull();
  });

  it('uses real lead fields and escapes HTML personalization', () => {
    const email = careEmailContent('D1', {
      name: '<Khách>',
      product_interest: 'Dự án & A',
      sales_owner_name: 'Sales "A"',
    });
    expect(email.subject).toContain('&lt;Khách&gt;');
    expect(email.html).toContain('Dự án &amp; A');
    expect(email.html).not.toContain('<Khách>');
    expect(email.text).toContain('Dự án &amp; A');
  });
});