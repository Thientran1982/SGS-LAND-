import { describe, expect, it } from 'vitest';
import {
  buildPlatformContent,
  getPublicationCatalog,
  normalizePublicationCaption,
  normalizePublicationImages,
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

   it('reports the Facebook public publisher separately from messaging readiness', () => {
    const catalog = getPublicationCatalog();
    const facebook = catalog.find(item => item.platform === 'FACEBOOK_PAGE');
    const zalo = catalog.find(item => item.platform === 'ZALO_BROADCAST');

    expect(facebook).toMatchObject({
      canPublish: false,
      hasPublisher: true,
      messagingSupported: true,
      status: 'NOT_READY',
      maxImages: 10,
    });
    expect(zalo).toMatchObject({
      canPublish: false,
      hasPublisher: true,
      messagingSupported: true,
      status: 'NOT_READY',
      kind: 'BROADCAST',
    });
    expect(zalo?.reason).toContain('customer-service message/product share');
    expect(zalo?.reason).not.toContain('Zalo post');
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

  it('uses the operator-approved caption while keeping the approved image snapshot', () => {
    const content = buildPlatformContent({
      version: 1,
      listingId: 'listing-1',
      code: 'SGS-001',
      title: 'Nhà phố ven sông',
      description: 'Nội dung listing cũ.',
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
      attributes: {},
      contactPhone: null,
      publicUrl: 'https://sgsland.vn/p/SGS-001',
      capturedAt: '2026-09-09T00:00:00.000Z',
      caption: 'Caption đã được operator duyệt.',
    }, 'FACEBOOK_PAGE', ['https://cdn.test/approved.jpg']);

    expect(content.text).toBe('Caption đã được operator duyệt.');
    expect(content.imageUrls).toEqual(['https://cdn.test/approved.jpg']);
  });

  it('keeps every approved Facebook album image in the provider content snapshot', () => {
    const content = buildPlatformContent({
      version: 1,
      listingId: 'listing-1',
      code: 'SGS-001',
      title: 'Nhà phố ven sông',
      description: null,
      price: null,
      currency: 'VND',
      area: null,
      builtArea: null,
      bedrooms: null,
      bathrooms: null,
      location: null,
      type: null,
      transaction: null,
      status: 'AVAILABLE',
      attributes: {},
      contactPhone: null,
      publicUrl: null,
      capturedAt: '2026-09-09T00:00:00.000Z',
    }, 'FACEBOOK_PAGE', [
      'https://cdn.test/first.jpg',
      'https://cdn.test/second.jpg',
    ]);

    expect(content.imageUrls).toEqual([
      'https://cdn.test/first.jpg',
      'https://cdn.test/second.jpg',
    ]);
  });

  it('normalizes captions and publication images before they are persisted', () => {
    expect(normalizePublicationCaption('  Caption tùy chỉnh  ')).toBe('Caption tùy chỉnh');
    expect(normalizePublicationCaption('   ')).toBeNull();
    expect(normalizePublicationImages([
      'https://cdn.test/first.jpg',
      'https://cdn.test/first.jpg',
      'https://cdn.test/second.jpg',
    ])).toEqual([
      'https://cdn.test/first.jpg',
      'https://cdn.test/second.jpg',
    ]);
  });
  it('keeps only HTTPS image URLs in the Facebook publication snapshot', () => {
    const previousAppUrl = process.env.APP_URL;
    const previousPublicUrl = process.env.PUBLIC_URL;
    delete process.env.APP_URL;
    delete process.env.PUBLIC_URL;
    try {
      expect(normalizePublicationImages([
        'https://cdn.test/first.jpg',
        'http://cdn.test/not-public-for-facebook.jpg',
        '/uploads/tenant/photo.jpg',
      ])).toEqual(['https://cdn.test/first.jpg']);
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('resolves relative uploads only with an explicit HTTPS public origin', () => {
    const previousAppUrl = process.env.APP_URL;
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.APP_URL = 'https://sgsland.vn';
    delete process.env.PUBLIC_URL;

    try {
      expect(normalizePublicationImages(['/uploads/tenant/photo.jpg'])).toEqual([
        'https://sgsland.vn/uploads/tenant/photo.jpg',
      ]);
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });
});
