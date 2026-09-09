import { randomUUID } from 'crypto';
import { listingRepository } from '../repositories/listingRepository';
import {
  MAX_PRODUCT_SHARE_IMAGES,
  normalizeProductImages,
  resolveConfiguredPublicBaseUrl,
} from './productShareService';
import {
  getSocialPlatformCapability,
  getSocialPlatformCatalog,
  getSocialPublisher,
  getTenantSocialPlatformCapability,
} from '../social-publishing/registry';
import type {
  SocialPlatform,
  SocialPlatformContent,
  SocialProductSnapshot,
} from '../social-publishing/types';

export const PUBLISHABLE_LISTING_STATUSES = new Set([
  'AVAILABLE',
  'OPENING',
  'BOOKING',
  'BEST_MARKET',
]);

const PLATFORM_SET = new Set<SocialPlatform>([
  'FACEBOOK_PAGE',
  'INSTAGRAM',
  'LINKEDIN_PAGE',
  'TIKTOK',
  'ZALO_BROADCAST',
]);

export const MAX_SOCIAL_PUBLICATION_IMAGES = MAX_PRODUCT_SHARE_IMAGES;
export const MAX_FACEBOOK_REPRESENTATIVE_IMAGES = 1;
export const MAX_SOCIAL_PUBLICATION_CAPTION_LENGTH = 63206;

function textValue(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return String(value).trim();
}

export function normalizePublicationCaption(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('Caption phải là chuỗi văn bản');
  const caption = value.trim();
  if (!caption) return null;
  if (caption.length > MAX_SOCIAL_PUBLICATION_CAPTION_LENGTH) {
    throw new Error(`Caption không được dài quá ${MAX_SOCIAL_PUBLICATION_CAPTION_LENGTH.toLocaleString('vi-VN')} ký tự`);
  }
  return caption;
}

function numberOrValue(value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : String(value);
}

function publicListingUrl(code: string | null): string | null {
  const base = resolveConfiguredPublicBaseUrl();
  if (!base || !code) return null;
  return `${base.replace(/\/+$/, '')}/p/${encodeURIComponent(code)}`;
}

export function normalizeSocialPlatforms(input: unknown): SocialPlatform[] {
  if (!Array.isArray(input)) return [];
  const result: SocialPlatform[] = [];
  for (const raw of input) {
    const platform = String(raw || '').trim().toUpperCase() as SocialPlatform;
    if (PLATFORM_SET.has(platform) && !result.includes(platform)) result.push(platform);
  }
  return result;
}

export async function buildSocialProductSnapshot(
  tenantId: string,
  listingId: string,
): Promise<SocialProductSnapshot> {
  const listing = await listingRepository.findById(tenantId, listingId);
  if (!listing) throw new Error('Không tìm thấy sản phẩm trong tenant hiện tại');

  const status = String(listing.status || '').toUpperCase();
  if (!PUBLISHABLE_LISTING_STATUSES.has(status)) {
    throw new Error(`Sản phẩm chưa ở trạng thái được phép xuất bản (${status || 'không xác định'})`);
  }

  const title = textValue(listing.title);
  if (!title) throw new Error('Sản phẩm thiếu tiêu đề, không thể tạo snapshot');

  const code = textValue(listing.code);
  const attributes = listing.attributes && typeof listing.attributes === 'object'
    ? { ...listing.attributes }
    : {};
  const baseUrl = resolveConfiguredPublicBaseUrl();

  return {
    version: 1,
    listingId: String(listing.id),
    code,
    title,
    description: textValue(listing.description),
    price: numberOrValue(listing.price),
    currency: textValue(listing.currency),
    area: numberOrValue(listing.area),
    builtArea: numberOrValue(listing.builtArea),
    bedrooms: numberOrValue(listing.bedrooms),
    bathrooms: numberOrValue(listing.bathrooms),
    location: textValue(listing.location),
    type: textValue(listing.type),
    transaction: textValue(listing.transaction),
    status,
    attributes,
    contactPhone: textValue(listing.contactPhone),
    publicUrl: publicListingUrl(code),
    capturedAt: new Date().toISOString(),
  };
}

function formatPrice(snapshot: SocialProductSnapshot): string {
  const price = Number(snapshot.price);
  if (!Number.isFinite(price) || price <= 0) return 'Liên hệ';
  const suffix = snapshot.currency === 'USD' ? ' USD' : ' VNĐ';
  if (snapshot.currency !== 'USD' && price >= 1_000_000_000) {
    return `${(price / 1_000_000_000).toFixed(2)} tỷ${suffix}`;
  }
  return `${Math.round(price).toLocaleString('vi-VN')}${suffix}`;
}

export function buildSocialPlatformContent(
  snapshot: SocialProductSnapshot,
  platform: SocialPlatform,
): SocialPlatformContent {
  const attrs = snapshot.attributes || {};
  const facts = [
    snapshot.type ? `Loại: ${snapshot.type}` : null,
    snapshot.transaction ? `Giao dịch: ${snapshot.transaction}` : null,
    `Giá: ${formatPrice(snapshot)}`,
    snapshot.area ? `Diện tích: ${snapshot.area} m²` : null,
    snapshot.bedrooms ? `Phòng ngủ: ${snapshot.bedrooms}` : null,
    snapshot.location ? `Vị trí: ${snapshot.location}` : null,
    attrs.legalStatus ? `Pháp lý: ${String(attrs.legalStatus)}` : null,
  ].filter((value): value is string => Boolean(value));
  const description = snapshot.description ? `\n\n${snapshot.description}` : '';
  const link = snapshot.publicUrl;
  const linkLine = link ? `\n\nXem chi tiết: ${link}` : '';
  const hashtags = ['#SGSLAND', '#batdongsan'];
  const text = [snapshot.title, ...facts, description, linkLine]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .concat(`\n\n${hashtags.join(' ')}`)
    .trim();

  return {
    platform,
    title: snapshot.title,
    text,
    link,
    imageUrls: normalizeProductImages((snapshot as any).images, resolveConfiguredPublicBaseUrl()),
    hashtags,
  };
}

/**
 * Assets are kept separately from the public content contract. The first
 * snapshot version has no hidden/private fields and deliberately does not
 * invent an image URL. The route fills imageUrls from the listing snapshot.
 */
export function buildPlatformContent(
  snapshot: SocialProductSnapshot,
  platform: SocialPlatform,
  imageUrls: string[],
): SocialPlatformContent {
  const content = buildSocialPlatformContent(snapshot, platform);
  return {
    ...content,
    text: snapshot.caption?.trim() || content.text,
    imageUrls: normalizeProductImages(imageUrls, resolveConfiguredPublicBaseUrl()).slice(0, MAX_SOCIAL_PUBLICATION_IMAGES),
  };
}

/**
 * Publication assets are sent directly to providers. Keep only absolute,
 * publicly fetchable HTTP(S) URLs in the immutable asset snapshot.
 */
export function normalizePublicationImages(images: unknown): string[] {
  return normalizeProductImages(images, resolveConfiguredPublicBaseUrl()).slice(0, MAX_SOCIAL_PUBLICATION_IMAGES);
}

export function createPublicationRequestId(): string {
  return randomUUID();
}

export function getPublicationCatalog() {
  return getSocialPlatformCatalog().map(item => {
    const capability = getSocialPlatformCapability(item.platform);
    return {
      ...item,
      ...capability,
      hasPublisher: Boolean(getSocialPublisher(item.platform)),
      capability,
    };
  });
}

export async function getTenantPublicationCatalog(tenantId: string) {
  return Promise.all(getSocialPlatformCatalog().map(async item => {
    const capability = await getTenantSocialPlatformCapability(item.platform, tenantId);
    return {
      ...item,
      ...capability,
      hasPublisher: Boolean(getSocialPublisher(item.platform)),
      capability,
    };
  }));
}