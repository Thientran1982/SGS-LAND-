import { api } from './apiClient';

export interface SocialCapability {
  platform: string;
  label: string;
  kind: 'PUBLIC_POST' | 'BROADCAST';
  status: 'NOT_READY' | 'READY' | 'UNSUPPORTED';
  canPublish: boolean;
  messagingSupported: boolean;
  reason: string;
  requiresConnection: boolean;
  hasPublisher: boolean;
  maxImages?: number;
}

export function isSocialCapabilityReady(capability: Pick<SocialCapability, 'status' | 'canPublish'>): boolean {
  return capability.status === 'READY' && capability.canPublish;
}

export interface SocialTarget {
  id: string;
  platform: string;
  status: string;
  accountId?: string;
  attemptCount?: number;
  providerPostId?: string | null;
  providerRequestId?: string | null;
  providerPostUrl?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  publishedAt?: string | null;
  attempts?: SocialAttempt[];
}

export interface SocialAttempt {
  id: string;
  attemptNumber: number;
  requestId: string;
  providerRequestId?: string | null;
  statusCode?: number | null;
  resultStatus: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface SocialPublicationEvent {
  id: string;
  targetId?: string | null;
  actorId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SocialPublicationListingReview {
  eligible: boolean;
  listingExists: boolean;
  listingStatus: string | null;
  listingCode?: string | null;
  listingTitle?: string | null;
  reason: 'LISTING_NOT_FOUND' | 'LISTING_STATUS_NOT_ELIGIBLE' | null;
}

export interface SocialPublication {
  id: string;
  listingId: string;
  source?: 'MANUAL' | 'AUTO';
  autoPostingKey?: string | null;
  status: string;
  publishMode: 'NOW' | 'SCHEDULED';
  scheduledAt: string | null;
  contentSnapshot: Record<string, unknown>;
  assetSnapshot: string[];
  createdAt: string;
  targets: SocialTarget[];
  events?: SocialPublicationEvent[];
  listingReview?: SocialPublicationListingReview;
}

export interface SocialPublicationQuery {
  source?: 'AUTO' | 'MANUAL';
  staleOnly?: boolean;
  limit?: number;
}

export const socialPublicationApi = {
  getCatalog: (): Promise<{ data: SocialCapability[] }> =>
    api.get('/api/social-publications/catalog'),
  getPublications: (
    options: SocialPublicationQuery | 'AUTO' | 'MANUAL' = {},
  ): Promise<{ data: SocialPublication[]; total: number }> => {
    const query = typeof options === 'string' ? { source: options } : options;
    return api.get('/api/social-publications', query);
  },
  getPublication: (id: string): Promise<SocialPublication> =>
    api.get(`/api/social-publications/${id}`),
  preview: (listingId: string, platforms: string[], imageUrls: string[] = [], caption?: string) =>
    api.post<{
      snapshot: Record<string, unknown>;
      previews: Array<{ platform: string; title: string; text: string; imageUrls: string[]; link: string | null }>;
      catalog: SocialCapability[];
    }>('/api/social-publications/preview', { listingId, platforms, imageUrls, caption }),
  createDraft: (input: {
    listingId: string;
    platforms: string[];
    publishMode: 'NOW' | 'SCHEDULED';
    scheduledAt?: string | null;
    caption?: string;
    imageUrls?: string[];
  }) => api.post<SocialPublication>('/api/social-publications', input),
  activate: (id: string) => api.post<SocialPublication>(`/api/social-publications/${id}/activate`),
  cancel: (id: string) => api.post<{ ok: true }>(`/api/social-publications/${id}/cancel`),
  reconcile: (
    publicationId: string,
    targetId: string,
    input: {
      action: 'CONFIRM_PUBLISHED' | 'MARK_FAILED' | 'REQUEUE';
      reason: string;
      providerPostId?: string;
      providerPostUrl?: string;
    },
  ) => api.post<SocialPublication>(
    `/api/social-publications/${publicationId}/targets/${targetId}/reconcile`,
    input,
  ),
};