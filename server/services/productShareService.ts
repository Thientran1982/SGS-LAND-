import { logger } from '../middleware/logger';
import { sendZaloImageMessage, sendZaloTextMessage, ZaloSendResult } from './zaloService';

export const ZALO_TEXT_LIMIT = 2000;
export const MAX_PRODUCT_SHARE_IMAGES = 10;
/** Zalo direct-send modes. These are customer-service messages, not public posts. */
export const ZALO_CUSTOMER_SERVICE_MESSAGE = 'CUSTOMER_SERVICE_MESSAGE' as const;
export const ZALO_CUSTOMER_SERVICE_PRODUCT_SHARE = 'CUSTOMER_SERVICE_PRODUCT_SHARE' as const;

export function getZaloDeliveryMode(hasProductShare: boolean): typeof ZALO_CUSTOMER_SERVICE_MESSAGE | typeof ZALO_CUSTOMER_SERVICE_PRODUCT_SHARE {
  return hasProductShare ? ZALO_CUSTOMER_SERVICE_PRODUCT_SHARE : ZALO_CUSTOMER_SERVICE_MESSAGE;
}

export interface ShareableProduct {
  id?: string;
  code?: string;
  title?: string;
  price?: number | string | null;
  currency?: string;
  area?: number | string | null;
  builtArea?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  location?: string | null;
  type?: string | null;
  transaction?: string | null;
  status?: string | null;
  description?: string | null;
  contactPhone?: string | null;
  attributes?: Record<string, any> | null;
  images?: string[] | null;
}

export interface ZaloProductShareResult {
  success: boolean;
  ambiguous?: boolean;
  error?: string;
  messageIds: string[];
  textMessageCount: number;
  imageMessageCount: number;
}

function formatPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Liên hệ';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} tỷ VNĐ`;
  return `${Math.round(amount / 1_000_000).toLocaleString('vi-VN')} triệu VNĐ`;
}

function formatValue(value: unknown, suffix = ''): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return `${String(value).trim()}${suffix}`;
}

/**
 * Create the provider-independent product snapshot. Deliberately does not
 * include a landing/listing URL: the share contract is the full detail plus
 * media, not a link disguised as a product message.
 */
export function buildProductShareText(product: ShareableProduct, language: 'vi' | 'en' = 'vi'): string {
  const attrs = product.attributes || {};
  const isEnglish = language === 'en';
  const lines = [
    product.title || (isEnglish ? 'Property details' : 'Thông tin sản phẩm'),
    product.code ? `${isEnglish ? 'Code' : 'Mã'}: ${product.code}` : null,
    formatValue(product.type, isEnglish ? '' : ''),
    product.transaction ? `${isEnglish ? 'Transaction' : 'Giao dịch'}: ${product.transaction}` : null,
    `${isEnglish ? 'Price' : 'Giá'}: ${formatPrice(product.price)}`,
    formatValue(product.area, ' m²') ? `${isEnglish ? 'Land area' : 'Diện tích'}: ${formatValue(product.area, ' m²')}` : null,
    formatValue(product.builtArea, ' m²') ? `${isEnglish ? 'Built-up area' : 'DT xây dựng'}: ${formatValue(product.builtArea, ' m²')}` : null,
    formatValue(product.bedrooms) ? `${isEnglish ? 'Bedrooms' : 'Phòng ngủ'}: ${formatValue(product.bedrooms)}` : null,
    formatValue(product.bathrooms) ? `${isEnglish ? 'Bathrooms' : 'Phòng tắm'}: ${formatValue(product.bathrooms)}` : null,
    product.location ? `${isEnglish ? 'Location' : 'Vị trí'}: ${product.location}` : null,
    attrs.direction ? `${isEnglish ? 'Direction' : 'Hướng'}: ${attrs.direction}` : null,
    attrs.legalStatus ? `${isEnglish ? 'Legal status' : 'Pháp lý'}: ${attrs.legalStatus}` : null,
    attrs.furniture ? `${isEnglish ? 'Furniture' : 'Nội thất'}: ${attrs.furniture}` : null,
    attrs.amenities ? `${isEnglish ? 'Amenities' : 'Tiện ích'}: ${Array.isArray(attrs.amenities) ? attrs.amenities.join(', ') : attrs.amenities}` : null,
    attrs.parking ? `${isEnglish ? 'Parking' : 'Chỗ đậu xe'}: ${attrs.parking}` : null,
    attrs.balcony ? `${isEnglish ? 'Balcony' : 'Ban công'}: ${attrs.balcony}` : null,
    attrs.view ? `${isEnglish ? 'View' : 'Tầm nhìn'}: ${attrs.view}` : null,
    product.description ? `\n${isEnglish ? 'Description' : 'Mô tả'}:\n${product.description}` : null,
    product.contactPhone ? `\n${isEnglish ? 'Contact' : 'Liên hệ'}: ${product.contactPhone}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Split only at a natural boundary where possible, while respecting Zalo's limit. */
export function splitZaloText(text: string, limit = ZALO_TEXT_LIMIT): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < Math.floor(limit * 0.55)) cut = remaining.lastIndexOf(' ', limit);
    if (cut < Math.floor(limit * 0.55)) cut = limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function normalizeProductImages(images: unknown, baseUrl?: string): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of images) {
    const value = String(raw || '').trim();
    if (!value) continue;
    let url = value;
    try {
      url = new URL(value, baseUrl || undefined).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length >= MAX_PRODUCT_SHARE_IMAGES) break;
  }
  return result;
}

export function resolveConfiguredPublicBaseUrl(): string | undefined {
  if (process.env.APP_URL) return process.env.APP_URL;
  const domains = (process.env.REPLIT_DOMAINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const custom = domains.find(value => !value.endsWith('.replit.app') && !value.endsWith('.repl.co'));
  return custom ? `https://${custom}` : (domains[0] ? `https://${domains[0]}` : undefined);
}

export async function sendProductViaZalo(params: {
  accessToken: string;
  userId: string;
  product: ShareableProduct;
  imageUrls?: string[];
  deliveryKey?: string;
  language?: 'vi' | 'en';
}): Promise<ZaloProductShareResult> {
  const textChunks = splitZaloText(buildProductShareText(params.product, params.language));
  const images = (params.imageUrls || []).slice(0, MAX_PRODUCT_SHARE_IMAGES);
  const messageIds: string[] = [];

  for (let index = 0; index < textChunks.length; index += 1) {
    const result = await sendZaloTextMessage(
      params.accessToken,
      params.userId,
      textChunks[index],
      `${params.deliveryKey || 'product-share'}:text:${index + 1}`,
    );
    if (!result.success) {
      return {
        success: false,
        ambiguous: result.ambiguous,
        error: result.error || 'Zalo không nhận được nội dung sản phẩm',
        messageIds,
        textMessageCount: index,
        imageMessageCount: 0,
      };
    }
    if (result.messageId) messageIds.push(result.messageId);
  }

  for (let index = 0; index < images.length; index += 1) {
    const result = await sendZaloImageMessage(
      params.accessToken,
      params.userId,
      images[index],
      undefined,
      `${params.deliveryKey || 'product-share'}:image:${index + 1}`,
    );
    if (!result.success) {
      logger.warn(`[Zalo] Product text sent but image ${index + 1}/${images.length} failed`);
      return {
        success: false,
        ambiguous: result.ambiguous,
        error: result.error || 'Nội dung đã gửi nhưng ảnh sản phẩm chưa gửi được',
        messageIds,
        textMessageCount: textChunks.length,
        imageMessageCount: index,
      };
    }
    if (result.messageId) messageIds.push(result.messageId);
  }

  return {
    success: true,
    messageIds,
    textMessageCount: textChunks.length,
    imageMessageCount: images.length,
  };
}