import type {
  SocialPlatformContent,
  SocialPublishResult,
  SocialPublisher,
} from './types';
import { getFacebookDefaultPage } from '../services/facebookService';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const IG_FIELDS_LINKED_ACCOUNT = 'instagram_business_account%7Bid,username%7D';
const IG_CAPTION_MAX_LENGTH = 2200;
const IG_CAROUSEL_MAX_IMAGES = 10;

type GraphBody = {
  id?: string;
  permalink?: string;
  instagram_business_account?: { id?: string; username?: string };
  error?: { message?: string; code?: number };
};

type GraphCall = { ok: boolean; status: number; body: GraphBody };

async function graphGet(path: string, accessToken: string): Promise<GraphCall> {
  const response = await fetch(GRAPH_API_BASE + path, {
    headers: { Authorization: 'Bearer ' + accessToken },
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await response.json().catch(() => ({}))) as GraphBody;
  return { ok: response.ok, status: response.status, body };
}

async function graphPost(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<GraphCall> {
  const response = await fetch(GRAPH_API_BASE + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as GraphBody;
  return { ok: response.ok, status: response.status, body };
}

async function getLinkedInstagramAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<{ id: string; username?: string } | null> {
  const result = await graphGet('/' + pageId + '?fields=' + IG_FIELDS_LINKED_ACCOUNT, pageAccessToken);
  if (!result.ok) return null;
  const account = result.body.instagram_business_account;
  if (!account || !account.id) return null;
  return { id: account.id, username: account.username };
}

function fail(errorCode: string, safeMessage: string, retryable = false): SocialPublishResult {
  return { status: 'FAILED', errorCode, safeMessage, retryable };
}

export const instagramPublisher: SocialPublisher = {
  platform: 'INSTAGRAM',

  async isAvailable({ tenantId }) {
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return { ready: false, reason: 'Tenant chua ket noi Facebook Page Access Token.' };
    }
    try {
      const account = await getLinkedInstagramAccount(page.pageId, page.accessToken);
      if (!account) {
        return {
          ready: false,
          reason: 'Facebook Page chua lien ket Instagram Business/Creator account (Page Settings > Linked accounts).',
        };
      }
      const probe = await graphGet('/' + account.id + '?fields=id', page.accessToken);
      if (!probe.ok) {
        return {
          ready: false,
          retryable: probe.status >= 500,
          reason: 'Token chua duoc cap quyen instagram_content_publish cho Instagram account nay.',
        };
      }
      return { ready: true };
    } catch {
      return { ready: false, retryable: true, reason: 'Khong the xac minh Instagram Graph API.' };
    }
  },

  async publish({ tenantId, content }): Promise<SocialPublishResult> {
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return fail('INSTAGRAM_NOT_CONNECTED', 'Tenant chua ket noi Facebook Page Access Token.');
    }
    let account: { id: string; username?: string } | null;
    try {
      account = await getLinkedInstagramAccount(page.pageId, page.accessToken);
    } catch {
      return fail('INSTAGRAM_PROVIDER_UNAVAILABLE', 'Khong the truy van Instagram Graph API.', true);
    }
    if (!account) {
      return fail('INSTAGRAM_NOT_LINKED', 'Facebook Page chua lien ket Instagram Business/Creator account.');
    }
    const imageUrls = content.imageUrls.filter(url => url.toLowerCase().startsWith('https://'));
    if (!imageUrls.length) {
      return fail('INSTAGRAM_NO_IMAGES', 'Instagram can it nhat mot anh HTTPS de dang.');
    }
    const caption = content.text.slice(0, IG_CAPTION_MAX_LENGTH);
    try {
      let creationId: string;
      if (imageUrls.length === 1) {
        const container = await graphPost('/' + account.id + '/media', page.accessToken, {
          image_url: imageUrls[0],
          caption,
        });
        if (!container.ok || !container.body.id) {
          return fail(
            'INSTAGRAM_CONTAINER_FAILED',
            container.body.error?.message || 'HTTP ' + container.status,
            container.status >= 500,
          );
        }
        creationId = container.body.id;
      } else {
        const children: string[] = [];
        for (const imageUrl of imageUrls.slice(0, IG_CAROUSEL_MAX_IMAGES)) {
          const child = await graphPost('/' + account.id + '/media', page.accessToken, {
            image_url: imageUrl,
            is_carousel_item: true,
          });
          if (!child.ok || !child.body.id) {
            return fail(
              'INSTAGRAM_CONTAINER_FAILED',
              child.body.error?.message || 'HTTP ' + child.status,
              child.status >= 500,
            );
          }
          children.push(child.body.id);
        }
        const carousel = await graphPost('/' + account.id + '/media', page.accessToken, {
          media_type: 'CAROUSEL',
          children,
          caption,
        });
        if (!carousel.ok || !carousel.body.id) {
          return fail(
            'INSTAGRAM_CONTAINER_FAILED',
            carousel.body.error?.message || 'HTTP ' + carousel.status,
            carousel.status >= 500,
          );
        }
        creationId = carousel.body.id;
      }
      const published = await graphPost('/' + account.id + '/media_publish', page.accessToken, {
        creation_id: creationId,
      });
      if (!published.ok || !published.body.id) {
        return fail(
          'INSTAGRAM_PUBLISH_FAILED',
          published.body.error?.message || 'HTTP ' + published.status,
          published.status >= 500,
        );
      }
      const providerPostId = published.body.id;
      let providerPostUrl: string | undefined;
      const detail = await graphGet('/' + providerPostId + '?fields=permalink', page.accessToken);
      if (detail.ok && typeof detail.body.permalink === 'string') {
        providerPostUrl = detail.body.permalink;
      }
      return { status: 'PUBLISHED', providerPostId, providerPostUrl };
    } catch {
      return fail('INSTAGRAM_PROVIDER_UNAVAILABLE', 'Khong the ket noi Instagram Graph API.', true);
    }
  },
};
