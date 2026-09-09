import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  claimDueSocialTargets,
  getPublicationForTarget,
  recordSocialAttempt,
  updateSocialTarget,
  getSocialPublisher,
  getTenantSocialPlatformCapability,
} = vi.hoisted(() => ({
  claimDueSocialTargets: vi.fn(),
  getPublicationForTarget: vi.fn(),
  recordSocialAttempt: vi.fn(),
  updateSocialTarget: vi.fn(),
  getSocialPublisher: vi.fn(),
  getTenantSocialPlatformCapability: vi.fn(),
}));

vi.mock('../repositories/socialPublicationRepository', () => ({
  claimDueSocialTargets,
  getPublicationForTarget,
  recordSocialAttempt,
  updateSocialTarget,
}));

vi.mock('../social-publishing/registry', () => ({
  getSocialPublisher,
  getTenantSocialPlatformCapability,
}));

vi.mock('../services/socialPublicationService', () => ({
  buildPlatformContent: vi.fn((_snapshot: unknown, _platform: unknown, assetSnapshot: string[]) => ({
    platform: 'FACEBOOK_PAGE',
    title: 'A',
    text: 'A',
    link: null,
    imageUrls: assetSnapshot,
    hashtags: [],
  })),
}));

import { processSocialPublicationTick } from '../services/socialPublishingWorker';
import { buildPlatformContent } from '../services/socialPublicationService';

const target = {
  id: 'target-1',
  attempt_count: 1,
};

const publicationRow: {
  id: string;
  platform: string;
  tenant_id: string;
  account_id: string;
  content_snapshot: Record<string, unknown>;
  asset_snapshot: string[];
} = {
  id: 'target-1',
  platform: 'FACEBOOK_PAGE',
  tenant_id: 'tenant-1',
  account_id: 'default',
  content_snapshot: {},
  asset_snapshot: [],
};

describe('social publishing worker safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimDueSocialTargets.mockResolvedValue([target]);
    getPublicationForTarget.mockResolvedValue(publicationRow);
    recordSocialAttempt.mockResolvedValue(undefined);
    updateSocialTarget.mockResolvedValue(undefined);
    getSocialPublisher.mockReturnValue(null);
    getTenantSocialPlatformCapability.mockResolvedValue({
      canPublish: false,
      retryable: false,
      reason: 'Facebook Page chưa được xác minh.',
    });
  });

  it('does not invoke a provider when the tenant capability is not ready', async () => {
    const result = await processSocialPublicationTick({} as any);

    expect(result).toMatchObject({ picked: 1, published: 0, failed: 1 });
    expect(recordSocialAttempt).toHaveBeenCalledWith(
      expect.anything(),
      'target-1',
      expect.objectContaining({
        resultStatus: 'FAILED_FINAL',
        errorCode: 'PUBLISHER_NOT_READY',
      }),
    );
    expect(updateSocialTarget).toHaveBeenCalledWith(
      expect.anything(),
      'target-1',
      expect.objectContaining({ status: 'FAILED_FINAL' }),
    );
  });

  it('does not retry an ambiguous provider result', async () => {
    const publish = vi.fn().mockResolvedValue({
      status: 'AMBIGUOUS',
      errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
      safeMessage: 'Provider did not confirm the result.',
    });
    getSocialPublisher.mockReturnValue({ platform: 'FACEBOOK_PAGE', publish });
    getTenantSocialPlatformCapability.mockResolvedValue({
      canPublish: true,
      reason: 'ready',
    });

    const result = await processSocialPublicationTick({} as any);

    expect(result).toMatchObject({ picked: 1, published: 0, failed: 1 });
    expect(publish).toHaveBeenCalledOnce();
    expect(updateSocialTarget).toHaveBeenCalledWith(
      expect.anything(),
      'target-1',
      expect.objectContaining({
        status: 'AMBIGUOUS',
      }),
    );
  });

  it('passes the publication snapshots to the worker content builder', async () => {
    const publish = vi.fn().mockResolvedValue({
      status: 'PUBLISHED',
      providerPostId: 'post-1',
    });
    getSocialPublisher.mockReturnValue({ platform: 'FACEBOOK_PAGE', publish });
    getTenantSocialPlatformCapability.mockResolvedValue({
      canPublish: true,
      reason: 'ready',
    });
    publicationRow.content_snapshot = { caption: 'Caption đã duyệt.' };
    publicationRow.asset_snapshot = [
      'https://cdn.test/approved-1.jpg',
      'https://cdn.test/approved-2.jpg',
    ];

    await processSocialPublicationTick({} as any);

    expect(buildPlatformContent).toHaveBeenCalledWith(
      publicationRow.content_snapshot,
      'FACEBOOK_PAGE',
      publicationRow.asset_snapshot,
    );
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({
        text: 'A',
        imageUrls: publicationRow.asset_snapshot,
      }),
    }));
  });
});