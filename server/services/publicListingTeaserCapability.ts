import { createHmac, timingSafeEqual } from 'node:crypto';

const CAPABILITY_VERSION = 1;
export const PUBLIC_LISTING_TEASER_TTL_SECONDS = 60 * 60 * 24 * 30;

export type PublicListingTeaserCapability = {
  v: number;
  aud: 'valuation-teaser';
  tenantId: string;
  listingId: string;
  exp: number;
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function capabilitySecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_LISTING_TEASER_CAPABILITY_SECRET_MISSING');
  }
  return 'local-development-public-listing-teaser-capability-secret';
}

function sign(encodedPayload: string): string {
  return base64UrlEncode(
    createHmac('sha256', capabilitySecret()).update(encodedPayload).digest(),
  );
}

export function createPublicListingTeaserToken(params: {
  tenantId: string;
  listingId: string;
  nowSeconds?: number;
}): string {
  const payload: PublicListingTeaserCapability = {
    v: CAPABILITY_VERSION,
    aud: 'valuation-teaser',
    tenantId: String(params.tenantId),
    listingId: String(params.listingId),
    exp: (params.nowSeconds ?? Math.floor(Date.now() / 1000)) + PUBLIC_LISTING_TEASER_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyPublicListingTeaserToken(
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): PublicListingTeaserCapability | null {
  if (typeof token !== 'string') return null;
  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }

  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length
    || !timingSafeEqual(supplied, expected)
  ) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<PublicListingTeaserCapability>;
    if (
      payload.v !== CAPABILITY_VERSION
      || payload.aud !== 'valuation-teaser'
      || typeof payload.tenantId !== 'string'
      || !payload.tenantId
      || typeof payload.listingId !== 'string'
      || !payload.listingId
      || !Number.isFinite(payload.exp)
      || Number(payload.exp) <= nowSeconds
    ) return null;
    return payload as PublicListingTeaserCapability;
  } catch {
    return null;
  }
}