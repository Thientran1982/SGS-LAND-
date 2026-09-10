export type SocialPlatform =
  | 'FACEBOOK_PAGE'
  | 'INSTAGRAM'
  | 'LINKEDIN_PAGE'
  | 'TIKTOK'
  | 'ZALO_BROADCAST';

export type SocialCapabilityStatus = 'NOT_READY' | 'READY' | 'UNSUPPORTED';

/** Facebook Page album posts support up to ten approved photos. */
export const FACEBOOK_PAGE_MAX_IMAGES = 10;

export interface SocialPlatformCapability {
  platform: SocialPlatform;
  label: string;
  kind: 'PUBLIC_POST' | 'BROADCAST';
  status: SocialCapabilityStatus;
  canPublish: boolean;
  messagingSupported: boolean;
  reason: string;
  requiresConnection: boolean;
  retryable?: boolean;
  maxImages?: number;
}

export interface SocialProductSnapshot {
  version: 1;
  listingId: string;
  code: string | null;
  title: string;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  area: number | string | null;
  builtArea: number | string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  location: string | null;
  type: string | null;
  transaction: string | null;
  status: string;
  attributes: Record<string, unknown>;
  contactPhone: string | null;
  publicUrl: string | null;
  capturedAt: string;
  /** Operator-approved caption saved with the publication draft. */
  caption?: string;
}

export interface SocialProjectSnapshot {
  version: 1;
  projectId: string;
  code: string | null;
  title: string;
  description: string | null;
  location: string | null;
  totalUnits: number | null;
  status: string;
  priceLabel: string;
  images: string[];
  publicUrl: string | null;
  capturedAt: string;
  /** Operator-approved caption saved with the publication draft. */
  caption?: string;
}

export type SocialContentSnapshot = SocialProductSnapshot | SocialProjectSnapshot;

export interface SocialPlatformContent {
  platform: SocialPlatform;
  text: string;
  title: string;
  link: string | null;
  imageUrls: string[];
  hashtags: string[];
}

export interface SocialPublishResult {
  status: 'PUBLISHED' | 'FAILED' | 'AMBIGUOUS';
  providerPostId?: string;
  providerPostUrl?: string;
  providerRequestId?: string;
  retryable?: boolean;
  errorCode?: string;
  safeMessage?: string;
}

export interface SocialPublisher {
  platform: SocialPlatform;
  isAvailable?(input: {
    tenantId: string;
    accountId: string;
  }): Promise<{
    ready: boolean;
    reason?: string;
    retryable?: boolean;
  }>;
  publish(input: {
    tenantId: string;
    accountId: string;
    content: SocialPlatformContent;
    idempotencyKey: string;
  }): Promise<SocialPublishResult>;
}