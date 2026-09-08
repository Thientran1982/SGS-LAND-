import type {
  SocialPlatform,
  SocialPlatformCapability,
  SocialPublisher,
} from './types';

/**
 * Phase 0 capability registry.
 *
 * Existing Facebook/Zalo adapters send direct messages to leads. They are not
 * public Page/feed publishers, so they deliberately do not make these
 * platforms READY. A provider publisher is only registered when it can prove
 * the account, permission, and provider response contract.
 */
const CATALOG: SocialPlatformCapability[] = [
  {
    platform: 'FACEBOOK_PAGE',
    label: 'Facebook Page',
    kind: 'PUBLIC_POST',
    status: 'NOT_READY',
    canPublish: true,
    messagingSupported: true,
    reason: 'Chưa có publisher cho Facebook Page và chưa xác minh quyền đăng công khai.',
    requiresConnection: true,
  },
  {
    platform: 'INSTAGRAM',
    label: 'Instagram Business',
    kind: 'PUBLIC_POST',
    status: 'UNSUPPORTED',
    canPublish: true,
    messagingSupported: false,
    reason: 'Chưa triển khai Instagram Business media publishing.',
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
    label: 'Zalo OA broadcast',
    kind: 'BROADCAST',
    status: 'NOT_READY',
    canPublish: true,
    messagingSupported: true,
    reason: 'Zalo hiện chỉ được xác minh cho customer-service message/product share, chưa xác minh broadcast/public post.',
    requiresConnection: true,
  },
];

const publishers = new Map<SocialPlatform, SocialPublisher>();

export function getSocialPlatformCatalog(): SocialPlatformCapability[] {
  return CATALOG.map(item => ({ ...item }));
}

export function getSocialPlatformCapability(platform: SocialPlatform): SocialPlatformCapability {
  const item = CATALOG.find(candidate => candidate.platform === platform);
  if (!item) throw new Error(`Nền tảng không được hỗ trợ: ${platform}`);
  const publisher = publishers.get(platform);
  return {
    ...item,
    status: publisher ? 'READY' : item.status,
    canPublish: Boolean(publisher) && item.canPublish,
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
    return capability;
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