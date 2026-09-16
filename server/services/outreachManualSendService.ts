import { agentOutboundRepository } from '../repositories/agentOutboundRepository';
import { interactionRepository } from '../repositories/interactionRepository';
import { withTenantContext } from '../db';
import { getAdapter } from '../channels/registry';
import { emailService } from './emailService';

const OUTREACH_CHANNELS = new Set(['EMAIL', 'ZALO', 'CALL_SCRIPT']);

function error(code: string): Error {
  return new Error(code);
}

function optedOut(channels: unknown, channel: string): boolean {
  return Array.isArray(channels)
    && channels.some(value => String(value).toLowerCase() === channel.toLowerCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

async function loadApprovedVariant(tenantId: string, approvalId: string, variantId: string) {
  return withTenantContext(tenantId, async client => {
    const approvalResult = await client.query(
      `SELECT ar.*, l.id AS lead_id, l.email, l.name,
              l.metadata AS lead_metadata, l.social_ids AS lead_social_ids,
              l.marketing_email_consent, l.opt_out_channels
         FROM approval_requests ar
         INNER JOIN leads l ON l.id = ar.lead_id AND l.tenant_id = ar.tenant_id
        WHERE ar.tenant_id=$1 AND ar.id=$2 AND ar.action_type='DRAFT_OUTREACH'
        FOR UPDATE`,
      [tenantId, approvalId],
    );
    const request = approvalResult.rows[0];
    if (!request) throw error('OUTREACH_APPROVAL_NOT_FOUND');
    if (request.status !== 'APPROVED' || !request.resumed_at) throw error('OUTREACH_APPROVAL_NOT_APPROVED');
    if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) {
      throw error('OUTREACH_APPROVAL_EXPIRED');
    }

    const variants = Array.isArray(request.payload?.draftVariants) ? request.payload.draftVariants : [];
    const variant = variants.find((candidate: any) => String(candidate?.id || '') === variantId);
    if (!variant) throw error('OUTREACH_VARIANT_NOT_FOUND');

    const channel = String(variant.channel || '').toUpperCase();
    if (!OUTREACH_CHANNELS.has(channel)) throw error('OUTREACH_CHANNEL_INVALID');

    const currentLeadMetadata = request.lead_metadata && typeof request.lead_metadata === 'object'
      ? request.lead_metadata
      : {};
    const consentMetadata = currentLeadMetadata;
    const consentValid = channel === 'EMAIL'
      ? request.marketing_email_consent === true && !optedOut(request.opt_out_channels, 'email')
      : channel === 'ZALO'
        ? consentMetadata.outreachConsent === true && !optedOut(request.opt_out_channels, 'zalo')
        : (
          (request.marketing_email_consent === true || consentMetadata.outreachConsent === true)
          && !optedOut(request.opt_out_channels, 'call_script')
        );
    if (!consentValid) throw error('OUTREACH_CONSENT_REVOKED');

    return {
      request,
      variant,
      channel,
      lead: {
        id: request.lead_id,
        name: request.name,
        email: request.email,
        metadata: currentLeadMetadata,
        socialIds: request.lead_social_ids,
      },
    };
  });
}

/**
 * Send one broker-selected variant after the approval action has completed.
 * Provider calls are intentionally synchronous and manual; no retry is
 * scheduled here. The agent outbound claim blocks duplicate and ambiguous
 * resends across concurrent requests.
 */
export async function sendApprovedOutreachVariant(
  tenantId: string,
  approvalId: string,
  variantId: string,
  senderId: string,
): Promise<Record<string, any>> {
  if (!variantId?.trim()) throw error('OUTREACH_VARIANT_REQUIRED');
  const selected = await loadApprovedVariant(tenantId, approvalId, variantId.trim());
  const { request, variant, channel, lead } = selected;
  const content = String(variant.message || '').trim();
  if (!content) throw error('OUTREACH_CONTENT_EMPTY');

  if (channel === 'CALL_SCRIPT') {
    throw error('OUTREACH_CALL_SCRIPT_MANUAL_ONLY');
  }
  if (channel === 'EMAIL' && !String(lead.email || '').trim()) {
    throw error('OUTREACH_EMAIL_REQUIRED');
  }
  if (channel === 'ZALO' && !lead.socialIds?.zalo) {
    throw error('OUTREACH_ZALO_ID_REQUIRED');
  }

  const claim = await agentOutboundRepository.createAndClaim({
    tenantId,
    approvalRequestId: approvalId,
    variantId: String(variant.id),
    leadId: request.lead_id,
    channel,
    content,
  });
  if (claim.state === 'SENT') {
    return {
      approvalId,
      variantId: variant.id,
      channel,
      status: 'SENT',
      deduped: true,
      providerMessageId: undefined,
    };
  }
  if (claim.state === 'BUSY') throw error('OUTREACH_SEND_IN_PROGRESS');
  if (claim.state === 'AMBIGUOUS') throw error('OUTREACH_DELIVERY_UNKNOWN');
  if (claim.state === 'FAILED') throw error('OUTREACH_DELIVERY_FAILED');
  if (!claim.claimToken || !claim.deliveryKey) throw error('OUTREACH_DELIVERY_CLAIM_MISSING');

  let providerResult: { success: boolean; messageId?: string; error?: string; ambiguous?: boolean };
  try {
    if (channel === 'EMAIL') {
      const subject = String(variant.subject || 'Thông tin tiếp theo về SGS LAND').slice(0, 200);
      providerResult = await emailService.sendEmail(tenantId, {
        to: String(lead.email).trim(),
        subject,
        text: content,
        html: `<p style="white-space:pre-line">${escapeHtml(content)}</p>`,
        template: 'outreach_manual',
        dedupeKey: claim.deliveryKey,
        deliveryKey: claim.deliveryKey,
        dedupeWindowMinutes: 0,
        tags: [`outreach-approval:${approvalId}`, `outreach-variant:${variant.id}`],
      });
    } else {
      const adapter = getAdapter('ZALO');
      if (!adapter) throw error('OUTREACH_CHANNEL_UNAVAILABLE');
      providerResult = await adapter.sendOutbound(tenantId, lead, content, {
        deliveryId: claim.id,
        deliveryKey: claim.deliveryKey,
      });
    }
  } catch (sendError: any) {
    providerResult = {
      success: false,
      error: sendError?.message || String(sendError),
      ambiguous: true,
    };
  }

  const deliveryStatus = providerResult.success
    ? 'SENT'
    : providerResult.ambiguous
      ? 'UNKNOWN'
      : 'FAILED';
  if (providerResult.success) {
    await agentOutboundRepository.markSent({
      tenantId,
      deliveryId: claim.id,
      claimToken: claim.claimToken,
      providerMessageId: providerResult.messageId,
    });
  } else if (providerResult.ambiguous) {
    await agentOutboundRepository.markUnknown({
      tenantId,
      deliveryId: claim.id,
      claimToken: claim.claimToken,
      error: providerResult.error || 'Provider outcome unknown; manual verification required',
    });
  } else {
    await agentOutboundRepository.markFailed({
      tenantId,
      deliveryId: claim.id,
      claimToken: claim.claimToken,
      error: providerResult.error || 'Provider rejected outreach delivery',
    });
  }

  const interaction = await interactionRepository.create(tenantId, {
    leadId: request.lead_id,
    channel,
    direction: 'OUTBOUND',
    type: 'TEXT',
    content,
    senderId,
    status: deliveryStatus,
    externalEventId: `approval:${approvalId}:variant:${variant.id}`,
    metadata: {
      source: 'OUTREACH_APPROVAL',
      approvalId,
      variantId: variant.id,
      deliveryId: claim.id,
      deliveryKey: claim.deliveryKey,
      deliveryStatus,
      providerMessageId: providerResult.messageId || null,
      ...(providerResult.error ? { deliveryError: providerResult.error } : {}),
    },
  });

  if (!providerResult.success) {
    throw error(providerResult.ambiguous ? 'OUTREACH_DELIVERY_UNKNOWN' : 'OUTREACH_DELIVERY_FAILED');
  }
  return {
    approvalId,
    variantId: variant.id,
    channel,
    status: 'SENT',
    providerMessageId: providerResult.messageId || null,
    interactionId: interaction.id,
    deliveryId: claim.id,
  };
}