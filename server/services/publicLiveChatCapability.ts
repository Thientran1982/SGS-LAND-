import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const PUBLIC_LIVECHAT_CAPABILITY_COOKIE = 'sgs_minh_livechat';
const CAPABILITY_VERSION = 1;
const CAPABILITY_TTL_SECONDS = 60 * 60 * 24 * 30;

type PublicLiveChatCapabilityPayload = {
  v: number;
  leadId: string;
  tenantId: string;
  userId?: string;
  exp: number;
};

export type PublicLiveChatAttachmentProofParams = {
  leadId: string;
  tenantId: string;
  id: string;
  kind: 'image' | 'document';
  mimeType: string;
  size: number;
  contentHash: string;
  textHash?: string;
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
    throw new Error('PUBLIC_LIVECHAT_CAPABILITY_SECRET_MISSING');
  }
  return 'local-development-public-livechat-capability-secret';
}

function sign(payload: string): string {
  return base64UrlEncode(createHmac('sha256', capabilitySecret()).update(payload).digest());
}

export function publicLiveChatCapabilityCookieName(leadId: string): string {
  const suffix = createHash('sha256').update(String(leadId)).digest('hex').slice(0, 24);
  return `${PUBLIC_LIVECHAT_CAPABILITY_COOKIE}_${suffix}`;
}

function canonicalAttachmentProof(params: PublicLiveChatAttachmentProofParams): string {
  return [
    params.leadId,
    params.tenantId,
    params.id,
    params.kind,
    params.mimeType,
    String(params.size),
    params.contentHash,
    params.textHash || '',
  ].join('|');
}

export function createPublicLiveChatAttachmentProof(
  params: PublicLiveChatAttachmentProofParams,
): string {
  return sign(canonicalAttachmentProof(params));
}

export function verifyPublicLiveChatAttachmentProof(
  params: PublicLiveChatAttachmentProofParams,
  proof: unknown,
): boolean {
  if (typeof proof !== 'string' || !proof) return false;
  const expected = createPublicLiveChatAttachmentProof(params);
  const suppliedBuffer = Buffer.from(proof);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function createPublicLiveChatCapability(params: {
  leadId: string;
  tenantId: string;
  userId?: string;
  nowSeconds?: number;
}): string {
  const payload: PublicLiveChatCapabilityPayload = {
    v: CAPABILITY_VERSION,
    leadId: String(params.leadId),
    tenantId: String(params.tenantId),
    ...(params.userId ? { userId: String(params.userId) } : {}),
    exp: (params.nowSeconds ?? Math.floor(Date.now() / 1000)) + CAPABILITY_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPublicLiveChatCapability(
  token: unknown,
  expected: { leadId: string; tenantId: string; userId?: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): PublicLiveChatCapabilityPayload | null {
  if (typeof token !== 'string') return null;
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) return null;
  let expectedSignature: string;
  try {
    expectedSignature = sign(encoded);
  } catch {
    return null;
  }
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    suppliedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PublicLiveChatCapabilityPayload;
    if (payload.v !== CAPABILITY_VERSION) return null;
    if (!payload.leadId || payload.leadId !== String(expected.leadId)) return null;
    if (!payload.tenantId || payload.tenantId !== String(expected.tenantId)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) return null;
    if (expected.userId && payload.userId !== String(expected.userId)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getPublicLiveChatCapabilityToken(req: any): string | undefined {
  const cookieValues = Object.entries(req?.cookies || {})
    .filter(([name]) => name === PUBLIC_LIVECHAT_CAPABILITY_COOKIE || name.startsWith(`${PUBLIC_LIVECHAT_CAPABILITY_COOKIE}_`))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string' && Boolean(value));
  const cookieValue = cookieValues[0];
  if (cookieValue) return cookieValue;
  const header = req?.get?.('X-Minh-Chat-Capability');
  return typeof header === 'string' && header ? header : undefined;
}

export function verifyPublicLiveChatRequest(
  req: any,
  leadId: string,
  tenantId: string,
): PublicLiveChatCapabilityPayload | null {
  const expected = { leadId, tenantId };
  const headerToken = req?.get?.('X-Minh-Chat-Capability');
  const headerResult = verifyPublicLiveChatCapability(headerToken, expected);
  if (headerResult) return headerResult;
  const cookies = req?.cookies || {};
  const preferredName = publicLiveChatCapabilityCookieName(leadId);
  const cookieNames = [
    preferredName,
    PUBLIC_LIVECHAT_CAPABILITY_COOKIE,
    ...Object.keys(cookies).filter(name => name.startsWith(`${PUBLIC_LIVECHAT_CAPABILITY_COOKIE}_`)),
  ];
  for (const name of [...new Set(cookieNames)]) {
    const result = verifyPublicLiveChatCapability(cookies[name], expected);
    if (result) return result;
  }
  return null;
}

export function setPublicLiveChatCapability(
  res: any,
  req: any,
  params: { leadId: string; tenantId: string; userId?: string },
): string {
  const token = createPublicLiveChatCapability(params);
  res.cookie(publicLiveChatCapabilityCookieName(params.leadId), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(req?.secure || req?.headers?.['x-forwarded-proto'] === 'https'),
    path: '/',
    maxAge: CAPABILITY_TTL_SECONDS * 1000,
  });
  return token;
}

export function denyPublicLiveChatRequest(res: any): void {
  res.status(403).json({
    error: 'Phiên chat không hợp lệ hoặc đã hết hạn',
    code: 'LIVECHAT_CAPABILITY_REQUIRED',
  });
}