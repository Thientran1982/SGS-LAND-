import { describe, expect, it } from 'vitest';
import {
  createPublicLiveChatAttachmentProof,
  createPublicLiveChatCapability,
  verifyPublicLiveChatAttachmentProof,
  verifyPublicLiveChatCapability,
} from '../services/publicLiveChatCapability';

describe('public live-chat capability', () => {
  const leadId = '11111111-1111-4111-8111-111111111111';
  const tenantId = '00000000-0000-0000-0000-000000000001';

  it('binds a capability to one lead and tenant until expiry', () => {
    const token = createPublicLiveChatCapability({
      leadId,
      tenantId,
      nowSeconds: 100,
    });

    expect(verifyPublicLiveChatCapability(token, { leadId, tenantId }, 101)).not.toBeNull();
    expect(verifyPublicLiveChatCapability(token, { leadId: '22222222-2222-4222-8222-222222222222', tenantId }, 101)).toBeNull();
    expect(verifyPublicLiveChatCapability(token, { leadId, tenantId: 'other-tenant' }, 101)).toBeNull();
    expect(verifyPublicLiveChatCapability(token, { leadId, tenantId }, 100 + 60 * 60 * 24 * 30 + 1)).toBeNull();
  });

  it('rejects tampered capability and attachment proofs', () => {
    const token = createPublicLiveChatCapability({ leadId, tenantId, nowSeconds: 100 });
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    expect(verifyPublicLiveChatCapability(tampered, { leadId, tenantId }, 101)).toBeNull();

    const attachment = {
      leadId,
      tenantId,
      id: 'chat-file-1.pdf',
      kind: 'document' as const,
      mimeType: 'application/pdf',
      size: 123,
      contentHash: 'a'.repeat(64),
      textHash: 'b'.repeat(64),
    };
    const proof = createPublicLiveChatAttachmentProof(attachment);
    expect(verifyPublicLiveChatAttachmentProof(attachment, proof)).toBe(true);
    expect(verifyPublicLiveChatAttachmentProof({ ...attachment, leadId: '22222222-2222-4222-8222-222222222222' }, proof)).toBe(false);
    expect(verifyPublicLiveChatAttachmentProof({ ...attachment, textHash: 'c'.repeat(64) }, proof)).toBe(false);
  });
});