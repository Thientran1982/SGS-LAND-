import { randomUUID } from 'crypto';
import { listingRepository } from '../repositories/listingRepository';
import { projectRepository } from '../repositories/projectRepository';
import { projectPriceMatrixRepository } from '../repositories/projectPriceMatrixRepository';
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
import { FACEBOOK_PAGE_MAX_IMAGES } from '../social-publishing/types';
import type {
  SocialPlatform,
  SocialPlatformContent,
  SocialProjectSnapshot,
  SocialProductSnapshot,
} from '../social-publishing/types';

export const PUBLISHABLE_LISTING_STATUSES = new Set([
  'AVAILABLE',
  'OPENING',
  'BOOKING',
  'BEST_MARKET',
]);
export const PUBLISHABLE_PROJECT_STATUSES = new Set(['ACTIVE']);

const PLATFORM_SET = new Set<SocialPlatform>([
  'FACEBOOK_PAGE',
  'INSTAGRAM',
  'LINKEDIN_PAGE',
  'TIKTOK',
  'ZALO_BROADCAST',
]);

export const MAX_SOCIAL_PUBLICATION_IMAGES = MAX_PRODUCT_SHARE_IMAGES;
export const MAX_FACEBOOK_IMAGES = FACEBOOK_PAGE_MAX_IMAGES;
/** @deprecated Use MAX_FACEBOOK_IMAGES; Facebook now publishes approved albums. */
export const MAX_FACEBOOK_REPRESENTATIVE_IMAGES = MAX_FACEBOOK_IMAGES;
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

export function buildPublicListingUrl(listingId: string | null, title: string | null): string | null {
  const base = resolveConfiguredPublicBaseUrl();
  if (!base || !listingId) return null;
  const slug = String(title || 'bat-dong-san')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, char => char === 'Đ' ? 'D' : 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'bat-dong-san';
  return `${base.replace(/\/+$/, '')}/bds/${slug}-${encodeURIComponent(listingId)}`;
}

/**
 * Facebook must be able to fetch an image without the Replit preview proxy or
 * an application session. Only an explicitly configured HTTPS public origin
 * is safe for turning a relative upload path into a provider URL.
 */
function resolveSocialPublicImageBaseUrl(): string | undefined {
  const configured = process.env.PUBLIC_URL || process.env.APP_URL;
  if (!configured) return undefined;

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return undefined;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return undefined;
  }
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
    publicUrl: buildPublicListingUrl(String(listing.id), title),
    capturedAt: new Date().toISOString(),
  };
}

function projectPublicUrl(code: string | null): string | null {
  const base = resolveConfiguredPublicBaseUrl();
  if (!base || !code) return null;
  return `${base.replace(/\/+$/, '')}/p/${encodeURIComponent(code)}`;
}

function formatProjectPrice(rows: Array<{ base_price_sqm: unknown; adjustment_pct: unknown }>): string {
  if (!rows.length) return 'Liên hệ';
  const prices = rows
    .map(row => Number(row.base_price_sqm) * (1 + Number(row.adjustment_pct || 0) / 100))
    .filter(price => Number.isFinite(price) && price > 0);
  if (!prices.length) return 'Liên hệ';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const format = (price: number) => `${Math.round(price).toLocaleString('vi-VN')} VNĐ/m²`;
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

export async function buildSocialProjectSnapshot(
  tenantId: string,
  projectId: string,
): Promise<SocialProjectSnapshot> {
  const project = await projectRepository.findById(tenantId, projectId);
  if (!project) throw new Error('Không tìm thấy dự án trong tenant hiện tại');

  const status = String(project.status || '').toUpperCase();
  if (!PUBLISHABLE_PROJECT_STATUSES.has(status)) {
    throw new Error(`Dự án chưa ở trạng thái được phép xuất bản (${status || 'không xác định'})`);
  }

  const title = textValue(project.name);
  if (!title) throw new Error('Dự án thiếu tên, không thể tạo snapshot');

  const metadata = project.metadata && typeof project.metadata === 'object'
    ? project.metadata as Record<string, unknown>
    : {};
  const coverImage = textValue(metadata.coverImage ?? metadata.cover_image);
  const gallery = Array.isArray(metadata.gallery)
    ? metadata.gallery.map(textValue).filter((value): value is string => Boolean(value))
    : [];
  const images = Array.from(new Set([coverImage, ...gallery].filter((value): value is string => Boolean(value))));
  const priceRows = await projectPriceMatrixRepository.findByProject(tenantId, projectId);

  return {
    version: 1,
    projectId: String(project.id),
    code: textValue(project.code),
    title,
    description: textValue(project.description),
    location: textValue(project.location),
    totalUnits: project.total_units ?? project.totalUnits ?? null,
    status,
    priceLabel: formatProjectPrice(priceRows),
    images,
    publicUrl: projectPublicUrl(textValue(project.code)),
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

const LISTING_TYPE_LABELS: Record<string, string> = {
  PROJECT: 'Dự án',
  APARTMENT: 'Căn hộ',
  PENTHOUSE: 'Penthouse',
  TOWNHOUSE: 'Nhà phố',
  HOUSE: 'Nhà riêng',
  VILLA: 'Biệt thự',
  LAND: 'Đất nền',
  FACTORY: 'Nhà xưởng',
  OFFICE: 'Văn phòng',
  COMMERCIAL: 'Thương mại',
};

const LISTING_TRANSACTION_LABELS: Record<string, string> = {
  SALE: 'Bán',
  RENT: 'Cho thuê',
};

const LISTING_LEGAL_LABELS: Record<string, string> = {
  PINKBOOK: 'Sổ hồng',
  CONTRACT: 'Hợp đồng mua bán',
  WAITING: 'Đang chờ sổ',
};

function localizedListingValue(value: unknown, labels: Record<string, string>): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  return labels[raw.toUpperCase()] || raw;
}

export function buildSocialPlatformContent(
  snapshot: SocialProductSnapshot | SocialProjectSnapshot,
  platform: SocialPlatform,
): SocialPlatformContent {
  if ('projectId' in snapshot) {
    const facts = [
      'Đang mở bán',
      snapshot.location ? `Vị trí: ${snapshot.location}` : null,
      snapshot.totalUnits ? `Quy mô: ${snapshot.totalUnits.toLocaleString('vi-VN')} sản phẩm` : null,
      `Giá tham khảo: ${snapshot.priceLabel}`,
    ].filter((value): value is string => Boolean(value));
    const description = snapshot.description ? `\n\n${snapshot.description}` : '';
    const linkLine = snapshot.publicUrl ? `\n\nXem chi tiết: ${snapshot.publicUrl}` : '';
    const hashtags = ['#SGSLAND', '#duanbatdongsan'];
    const heading = `Dự án ${snapshot.title}`;
    const igHashtags = ['#SGSLAND', '#duanbatdongsan', '#batdongsan', '#realestate'];
    if (platform === 'INSTAGRAM') {
      const igText = [heading, ...facts, description]
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .concat(`\n\n${igHashtags.join(' ')}`)
        .trim();
      return {
        platform,
        title: snapshot.title,
        text: igText,
        link: null,
        imageUrls: normalizePublicationImages(snapshot.images),
        hashtags: igHashtags,
      };
    }
    if (platform === 'ZALO_BROADCAST') {
      const zaloText = [heading, ...facts.slice(0, 2), linkLine]
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return {
        platform,
        title: snapshot.title,
        text: zaloText,
        link: snapshot.publicUrl,
        imageUrls: normalizePublicationImages(snapshot.images),
        hashtags: [],
      };
    }
    const text = [heading, ...facts, description, linkLine]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .concat(`\n\n${hashtags.join(' ')}`)
      .trim();
    return {
      platform,
      title: snapshot.title,
      text,
      link: snapshot.publicUrl,
      imageUrls: normalizePublicationImages(snapshot.images),
      hashtags,
    };
  }

  const attrs = snapshot.attributes || {};
  const typeLabel = localizedListingValue(snapshot.type, LISTING_TYPE_LABELS);
  const transactionLabel = localizedListingValue(snapshot.transaction, LISTING_TRANSACTION_LABELS);
  const legalLabel = localizedListingValue(attrs.legalStatus, LISTING_LEGAL_LABELS);
  const facts = [
    typeLabel ? `Loại: ${typeLabel}` : null,
    transactionLabel ? `Giao dịch: ${transactionLabel}` : null,
    `Giá: ${formatPrice(snapshot)}`,
    snapshot.area ? `Diện tích: ${snapshot.area} m²` : null,
    snapshot.bedrooms ? `Phòng ngủ: ${snapshot.bedrooms}` : null,
    snapshot.location ? `Vị trí: ${snapshot.location}` : null,
    legalLabel ? `Pháp lý: ${legalLabel}` : null,
  ].filter((value): value is string => Boolean(value));
  const description = snapshot.description ? `\n\n${snapshot.description}` : '';
  const link = snapshot.publicUrl;
  const linkLine = link ? `\n\nXem chi tiết: ${link}` : '';
  const hashtags = ['#SGSLAND', '#batdongsan'];
  const igHashtagsListing = ['#SGSLAND', '#batdongsan', '#realestate', '#nhadat'];
    if (platform === 'INSTAGRAM') {
      const igText = [snapshot.title, ...facts, description]
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .concat(`\n\n${igHashtagsListing.join(' ')}`)
        .trim();
      return {
        platform,
        title: snapshot.title,
        text: igText,
        link: null,
        imageUrls: normalizePublicationImages((snapshot as any).images),
        hashtags: igHashtagsListing,
      };
    }
    if (platform === 'ZALO_BROADCAST') {
      const zaloText = [snapshot.title, ...facts.slice(0, 2), linkLine]
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return {
        platform,
        title: snapshot.title,
        text: zaloText,
        link,
        imageUrls: normalizePublicationImages((snapshot as any).images),
        hashtags: [],
      };
    }
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
    imageUrls: normalizePublicationImages((snapshot as any).images),
    hashtags,
  };
}

/**
 * Assets are kept separately from the public content contract. The first
 * snapshot version has no hidden/private fields and deliberately does not
 * invent an image URL. The route fills imageUrls from the listing snapshot.
 */
export function buildPlatformContent(
  snapshot: SocialProductSnapshot | SocialProjectSnapshot,
  platform: SocialPlatform,
  imageUrls: string[],
): SocialPlatformContent {
  const content = buildSocialPlatformContent(snapshot, platform);
  // The operator-approved caption is captured from the Facebook preview only
  // (see socialPublicationRoutes.ts draft creation). It must not overwrite the
  // platform-specific text generated above for Instagram/Zalo/others.
  const text = platform === 'FACEBOOK_PAGE' ? (snapshot.caption?.trim() || content.text) : content.text;
  return {
    ...content,
    text,
    imageUrls: normalizePublicationImages(imageUrls).slice(0, MAX_SOCIAL_PUBLICATION_IMAGES),
  };
}

/**
 * Publication assets are sent directly to providers. Keep only absolute,
 * publicly fetchable HTTPS URLs in the immutable asset snapshot.
 */
export function normalizePublicationImages(images: unknown): string[] {
  return normalizeProductImages(images, resolveSocialPublicImageBaseUrl())
    .filter(imageUrl => imageUrl.toLowerCase().startsWith('https://'))
    .slice(0, MAX_SOCIAL_PUBLICATION_IMAGES);
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