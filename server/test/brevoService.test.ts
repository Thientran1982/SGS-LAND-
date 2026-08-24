import { describe, expect, it } from 'vitest';
import { parseBrevoEvents } from '../services/brevoService';

describe('parseBrevoEvents', () => {
  it('normalizes Brevo tag formats so delivery keys can be matched', () => {
    expect(parseBrevoEvents({
      event: 'delivered',
      email: 'admin@example.com',
      tags: '["delivery-key:tenant-date-admin@example.com", "daily-report"]',
    })[0].tags).toEqual([
      'delivery-key:tenant-date-admin@example.com',
      'daily-report',
    ]);

    expect(parseBrevoEvents({
      event: 'bounced',
      email: 'admin@example.com',
      tag: 'delivery-key:tenant-date-admin@example.com, daily-report',
    })[0].tags).toEqual([
      'delivery-key:tenant-date-admin@example.com',
      'daily-report',
    ]);
  });

  it('does not invent delivery tags for malformed payload values', () => {
    expect(parseBrevoEvents({
      event: 'delivered',
      email: 'admin@example.com',
      tags: { unexpected: true },
    })[0].tags).toEqual([]);
  });
});