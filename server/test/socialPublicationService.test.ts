import { describe, expect, it } from 'vitest';
import {
  buildPlatformContent,
  getPublicationCatalog,
  normalizeSocialPlatforms,
} from '../services/socialPublicationService';

describe('social publication foundation', () => {
  it('normalizes supported platforms without accepting arbitrary provider names', () => {
    expect(normalizeSocialPlatforms([
      'facebook_page',
      'FACEBOOK_PAGE',
      'instagram',
      'not-a-platform',
      '',
    ])).toEqual(['FACEBOOK_PAGE', 'INSTAGRAM']);
  });

  it('does not report messaging adapters as public publishers', () => {
    const catalog = getPublicationCatalog();
    const facebook = catalog.find(item => item.platform === 'FACEBOOK_PAGE');
    const zalo = catalog.find(item => item.platform === 'ZALO_BROADCAST');

    expect(facebook).toMatchObject({
      canPublish: false,
      hasPublisher: false,
      messagingSupported: true,
      status: 'NOT_READY',
    });
    expect(zalo).toMatchObject({
      canPublish: false,
      hasPublisher: false,
      messagingSupported: true,
      status: 'NOT_READY',
    });
  });

  it('builds provider-independent content from an immutable product snapshot', () => {
    const content = buildPlatformContent({
      version: 1,
      listingId: 'listing-1',
      code: 'SGS-001',
      title: 'Nhà phố ven sông',
      description: 'Bàn giao hoàn thiện.',
      price: 3500000000,
      currency: 'VND',
      area: 120,
      builtArea: null,
      bedrooms: 4,
      bathrooms: 3,
      location: 'Thủ Đức, TP.HCM',
      type: 'Nhà phố',
      transaction: 'Bán',
      status: 'AVAILABLE',
      attributes: { legalStatus: 'Sổ hồng riêng' },
      contactPhone: null,
      publicUrl: 'https://sgsland.vn/p/SGS-001',
      capturedAt: '2026-09-09T00:00:00.000Z',
    }, 'FACEBOOK_PAGE', ['https://cdn.test/a.jpg']);

    expect(content.text).toContain('Nhà phố ven sông');
    expect(content.text).toContain('Giá: 3.50 tỷ VNĐ');
    expect(content.text).toContain('Pháp lý: Sổ hồng riêng');
    expect(content.text).toContain('https://sgsland.vn/p/SGS-001');
    expect(content.imageUrls).toEqual(['https://cdn.test/a.jpg']);
  });
});