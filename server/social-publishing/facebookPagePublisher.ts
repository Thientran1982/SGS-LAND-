import type {
  SocialPlatformContent,
  SocialPublishResult,
  SocialPublisher,
} from './types';
import {
  getFacebookDefaultPage,
  publishFacebookPageContent,
  verifyFacebookPageAccess,
} from '../services/facebookService';

export const facebookPagePublisher: SocialPublisher = {
  platform: 'FACEBOOK_PAGE',

  async isAvailable({ tenantId }) {
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return {
        ready: false,
        reason: 'Tenant chưa kết nối Facebook Page Access Token.',
      };
    }

    const verification = await verifyFacebookPageAccess(page.pageId, page.accessToken);
    return verification.valid
      ? { ready: true }
      : {
          ready: false,
          retryable: verification.retryable,
          reason: verification.reason || 'Facebook chưa xác minh được Page hoặc quyền đăng.',
        };
  },

  async publish({
    tenantId,
    content,
    idempotencyKey,
  }): Promise<SocialPublishResult> {
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return {
        status: 'FAILED',
        retryable: false,
        errorCode: 'FACEBOOK_PAGE_NOT_CONNECTED',
        safeMessage: 'Tenant chưa kết nối Facebook Page Access Token.',
      };
    }

    const verification = await verifyFacebookPageAccess(page.pageId, page.accessToken);
    if (!verification.valid) {
      return {
        status: 'FAILED',
        retryable: false,
        errorCode: 'FACEBOOK_PAGE_NOT_VERIFIED',
        safeMessage: verification.reason || 'Facebook Page chưa được provider xác minh.',
      };
    }

    return publishFacebookPageContent({
      pageId: page.pageId,
      pageAccessToken: page.accessToken,
      content,
      idempotencyKey,
    });
  },
};