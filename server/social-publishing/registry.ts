import {
  FACEBOOK_PAGE_MAX_IMAGES,
} from './types';
import type {
  SocialPlatform,
  SocialPlatformCapability,
  SocialPublisher,
} from './types';
import { facebookPagePublisher } from './facebookPagePublisher';
import { zaloBroadcastPublisher } from './zaloBroadcastPublisher';
import { instagramPublisher } from './instagramPublisher';

/**
 * Phase 0 capability registry.
 *
 * A provider publisher is only considered READY after it proves the account,
 * permission, and provider response contract for the tenant.
 */
const CATALOG: SocialPlatformCapability[] = [
  {
    platform: 'FACEBOOK_PAGE',
    label: 'Facebook Page',
    kind: 'PUBLIC_POST',
    status: 'NOT_READY',
    canPublish: true,
    messagingSupported: true,
    reason: 'Facebook Page publisher đã có, nhưng chưa xác minh Page và quyền đăng công khai.',
    requiresConnection: true,
    maxImages: FACEBOOK_PAGE_MAX_IMAGES,
  },
  {
    platform: 'INSTAGRAM',
    label: 'Instagram Business',
    kind: 'PUBLIC_POST',
    status: 'NOT_READY',
    canPublish: true,
    messagingSupported: false,
    reason: 'Can lien ket Instagram Business/Creator account voi Facebook Page va cap quyen instagram_content_publish.',
    requiresConnection: true,
  },
  {
    platform: 'LINKEDIN_PAGE',
    label: 'LinkedIn Page',
    kind: 'PUBLIC_POST',
    status: 'UNSUPPORTED',
    canPublish: true,
    messagingSupported: false,
    reason: 'Chưa triển khai LinkedIn Organization publishing.',
    requiresConnection: true,
  },
  {
    platform: 'TIKTOK',
    label: 'TikTok Business',
    kind: 'PUBLIC_POST',
    status: 'UNSUPPORTED',
    canPublish: true,
    messagingSupported: false,
    reason: 'Chưa triển khai TikTok Content Posting API.',
    requiresConnection: true,
  },
  {
    platform: 'ZALO_BROADCAST',
    label: 'Zalo OA broadcast/public',
    kind: 'BROADCAST',
    status: 'NOT_READY',
    canPublish: false,
    messagingSupported: true,
    reason: 'Chỉ hỗ trợ gửi customer-service message/product share cho lead. Chưa xác minh API và quyền broadcast/public của Zalo OA.',
    requiresConnection: true,
  },
];

const publishers = new Map<SocialPlatform, SocialPublisher>();
publishers.set(facebookPagePublisher.platform, facebookPagePublisher);
publishers.set(zaloBroadcastPublisher.platform, zaloBroadcastPublisher);
publishers.set(instagramPublisher.platform, instagramPublisher);

export function getSocialPlatformCatalog(): SocialPlatformCapability[] {
  return CATALOG.map(item => ({ ...item }));
}

export function getSocialPlatformCapability(platform: SocialPlatform): SocialPlatformCapability {
  const item = CATALOG.find(candidate => candidate.platform === platform);
  if (!item) throw new Error(`Nền tảng không được hỗ trợ: ${platform}`);
  return {
    ...item,
    // A registered adapter is not proof of a tenant connection or provider
    // permission. Tenant-scoped readiness is established below by isAvailable.
    status: item.status,
    canPublish: false,
  };
}

export async function getTenantSocialPlatformCapability(
  platform: SocialPlatform,
  tenantId: string,
  accountId = 'default',
): Promise<SocialPlatformCapability> {
  const capability = getSocialPlatformCapability(platform);
  const publisher = publishers.get(platform);
  if (!publisher) return capability;
  if (!publisher.isAvailable) {
    return {
      ...capability,
      status: 'NOT_READY',
      canPublish: false,
      retryable: false,
      reason: 'Publisher chưa có kiểm tra kết nối và quyền provider theo tenant.',
    };
  }

  try {
    const availability = await publisher.isAvailable({ tenantId, accountId });
    return {
      ...capability,
      status: availability.ready ? 'READY' : 'NOT_READY',
      canPublish: availability.ready,
      retryable: availability.retryable,
      reason: availability.ready
        ? 'Publisher đã xác minh kết nối và quyền đăng với provider.'
        : availability.reason || 'Kết nối hoặc quyền đăng chưa được provider xác minh.',
    };
  } catch {
    return {
      ...capability,
      status: 'NOT_READY',
      canPublish: false,
      retryable: true,
      reason: 'Không thể xác minh kết nối với provider lúc này.',
    };
  }
}

export function registerSocialPublisher(publisher: SocialPublisher): void {
  publishers.set(publisher.platform, publisher);
}

export function getSocialPublisher(platform: SocialPlatform): SocialPublisher | null {
  return publishers.get(platform) || null;
}
