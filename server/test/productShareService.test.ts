import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendText, sendImage } = vi.hoisted(() => ({
  sendText: vi.fn(),
  sendImage: vi.fn(),
}));

vi.mock('../services/zaloService', () => ({
  sendZaloTextMessage: sendText,
  sendZaloImageMessage: sendImage,
}));

import {
  buildProductShareText,
  normalizeProductImages,
  sendProductViaZalo,
  splitZaloText,
} from '../services/productShareService';

describe('product sharing', () => {
  beforeEach(() => {
    sendText.mockReset();
    sendImage.mockReset();
    sendText.mockResolvedValue({ success: true, messageId: 'text-1' });
    sendImage.mockResolvedValue({ success: true, messageId: 'image-1' });
  });

  it('builds the complete snapshot without replacing details with a URL', () => {
    const text = buildProductShareText({
      title: 'Nhà phố ven sông',
      code: 'SGS-001',
      price: 3500000000,
      area: 120,
      bedrooms: 4,
      bathrooms: 3,
      location: 'Thủ Đức, TP.HCM',
      description: 'Bàn giao hoàn thiện.',
      attributes: { legalStatus: 'Sổ hồng riêng', direction: 'Đông Nam' },
    });
    expect(text).toContain('Giá: 3.50 tỷ VNĐ');
    expect(text).toContain('Pháp lý: Sổ hồng riêng');
    expect(text).toContain('Bàn giao hoàn thiện.');
    expect(text).not.toContain('http');
  });

  it('splits long text at the provider limit', () => {
    const chunks = splitZaloText(`${'Thông tin sản phẩm '.repeat(300)}`);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map(chunk => chunk.length))).toBeLessThanOrEqual(2000);
  });

  it('normalizes relative images, removes duplicates, and caps the list', () => {
    const images = normalizeProductImages(['/images/a.jpg', 'https://cdn.test/a.jpg', '/images/a.jpg'], 'https://sgs.test');
    expect(images).toEqual([
      'https://sgs.test/images/a.jpg',
      'https://cdn.test/a.jpg',
    ]);
  });

  it('sends every text chunk before every image and stops on ambiguous failure', async () => {
    sendText
      .mockResolvedValueOnce({ success: true, messageId: 'text-1' })
      .mockResolvedValueOnce({ success: false, ambiguous: true, error: 'timeout' });
    const result = await sendProductViaZalo({
      accessToken: 'token',
      userId: 'zalo-user',
      product: { title: 'A', description: 'x'.repeat(5000) },
      imageUrls: ['https://cdn.test/a.jpg'],
      deliveryKey: 'delivery-1',
    });
    expect(result.success).toBe(false);
    expect(result.ambiguous).toBe(true);
    expect(sendImage).not.toHaveBeenCalled();
    expect(sendText.mock.calls[0][3]).toBe('delivery-1:text:1');
  });

  it('uses Zalo media messages for images instead of putting image URLs in text', async () => {
    const result = await sendProductViaZalo({
      accessToken: 'token',
      userId: 'zalo-user',
      product: { title: 'A' },
      imageUrls: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
      deliveryKey: 'delivery-2',
    });
    expect(result.success).toBe(true);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendImage).toHaveBeenNthCalledWith(
      1,
      'token',
      'zalo-user',
      'https://cdn.test/a.jpg',
      undefined,
      'delivery-2:image:1',
    );
    expect(sendImage).toHaveBeenNthCalledWith(
      2,
      'token',
      'zalo-user',
      'https://cdn.test/b.jpg',
      undefined,
      'delivery-2:image:2',
    );
  });
});