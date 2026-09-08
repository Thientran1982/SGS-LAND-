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
}

export interface SocialTarget {
  id: string;
  platform: string;
  status: string;
  providerPostUrl?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export interface SocialPublication {
  id: string;
  listingId: string;
  status: string;
  publishMode: 'NOW' | 'SCHEDULED';
  scheduledAt: string | null;
  contentSnapshot: Record<string, unknown>;
  assetSnapshot: string[];
  createdAt: string;
  targets: SocialTarget[];
}

export const socialPublicationApi = {
  getCatalog: (): Promise<{ data: SocialCapability[] }> =>
    api.get('/api/social-publications/catalog'),
  getPublications: (): Promise<{ data: SocialPublication[]; total: number }> =>
    api.get('/api/social-publications'),
  preview: (listingId: string, platforms: string[], imageUrls: string[] = []) =>
    api.post<{
      snapshot: Record<string, unknown>;
      previews: Array<{ platform: string; title: string; text: string; imageUrls: string[]; link: string | null }>;
      catalog: SocialCapability[];
    }>('/api/social-publications/preview', { listingId, platforms, imageUrls }),
  createDraft: (input: {
    listingId: string;
    platforms: string[];
    publishMode: 'NOW' | 'SCHEDULED';
    scheduledAt?: string | null;
  }) => api.post<SocialPublication>('/api/social-publications', input),
  activate: (id: string) => api.post<SocialPublication>(`/api/social-publications/${id}/activate`),
  cancel: (id: string) => api.post<{ ok: true }>(`/api/social-publications/${id}/cancel`),
};