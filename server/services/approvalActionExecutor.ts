import { withTenantContext } from '../db';

const LEAD_STAGES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);

export function buildChangeLeadStageApproval(result: any, leadId: string, idempotencyKey: string) {
  const actionType = result?.suggestedAction;
  const payload = result?.suggestedActionPayload || {};
  if (!['CHANGE_LEAD_STAGE', 'BOOK_VIEWING', 'CREATE_PROPOSAL', 'SEND_DOCS', 'CONFIRM_DEPOSIT'].includes(actionType)) return undefined;
  if (actionType === 'CHANGE_LEAD_STAGE' && !LEAD_STAGES.has(String(payload.targetStage || ''))) return undefined;
  if (actionType === 'BOOK_VIEWING' && !String(payload.dateText || '').trim()) return undefined;
  if (actionType === 'CREATE_PROPOSAL' && (!payload.listingId || !Number.isFinite(Number(payload.basePrice)) || !Number.isFinite(Number(payload.finalPrice)))) return undefined;
  if (actionType === 'SEND_DOCS' && (!Array.isArray(payload.documentIds) || !payload.documentIds.length || !String(payload.recipientEmail || '').trim())) return undefined;
  if (actionType === 'CONFIRM_DEPOSIT' && !payload.bookingId) return undefined;
  return {
    leadId,
    actionType,
    payload: { ...payload, userMessage: String(result?.userMessage || '').slice(0, 500) },
    idempotencyKey: `${idempotencyKey}:${actionType}`,
  };
}

export async function executeApprovedAction(tenantId: string, approvalId: string, reviewerId: string): Promise<any> {
  return withTenantContext(tenantId, async client => {
    const approvalResult = await client.query(
      `SELECT * FROM approval_requests
        WHERE tenant_id=$1 AND id=$2
        FOR UPDATE`,
      [tenantId, approvalId],
    );
    const request = approvalResult.rows[0];
    if (!request) throw new Error('APPROVAL_NOT_FOUND');
    if (request.status !== 'APPROVED') throw new Error('APPROVAL_NOT_APPROVED');
    if (request.reviewed_by !== reviewerId) throw new Error('APPROVAL_REVIEWER_MISMATCH');
    if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) throw new Error('APPROVAL_EXPIRED');
    if (request.resumed_at) return { approvalId, actionType: request.action_type, executed: false, reason: 'ALREADY_EXECUTED' };
    const payload = request.payload || {};
    let actionResult: Record<string, any>;
    if (request.action_type === 'REVIEW_REPAIR_SPIKE') {
      if (!String(payload.pattern || '').trim()) throw new Error('APPROVAL_REPAIR_SPIKE_PATTERN_REQUIRED');
      actionResult = {
        leadId: request.lead_id,
        reviewed: true,
        mutation: 'NONE',
        pattern: String(payload.pattern).slice(0, 300),
      };
    } else if (request.action_type === 'CHANGE_LEAD_STAGE') {
      const targetStage = String(payload.targetStage || '');
      if (!LEAD_STAGES.has(targetStage)) throw new Error('APPROVAL_INVALID_TARGET_STAGE');
      const leadResult = await client.query(
        `UPDATE leads SET stage=$3, updated_at=CURRENT_TIMESTAMP
          WHERE id=$1 AND tenant_id=current_setting('app.current_tenant_id', true)::uuid
          RETURNING id, stage`,
        [request.lead_id, tenantId, targetStage],
      );
      if (!leadResult.rows[0]) throw new Error('APPROVAL_LEAD_NOT_FOUND');
      actionResult = { leadId: request.lead_id, targetStage };
    } else if (request.action_type === 'BOOK_VIEWING') {
      const dateText = String(payload.dateText || '').trim();
      if (!dateText) throw new Error('APPROVAL_BOOKING_DATE_REQUIRED');
      const lead = await client.query(`SELECT id, name FROM leads WHERE id=$1 AND tenant_id=current_setting('app.current_tenant_id', true)::uuid`, [request.lead_id]);
      if (!lead.rows[0]) throw new Error('APPROVAL_LEAD_NOT_FOUND');
      const content = `Lịch xem nhà được xác nhận: ${dateText}`;
      const interaction = await client.query(
        `INSERT INTO interactions (tenant_id, lead_id, channel, direction, type, content, metadata, status, external_event_id)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, 'WEB', 'OUTBOUND', 'TEXT', $2, $3::jsonb, 'SENT', $4)
         ON CONFLICT (tenant_id, channel, external_event_id) WHERE external_event_id IS NOT NULL
         DO UPDATE SET id=interactions.id RETURNING id`,
        [request.lead_id, content, JSON.stringify({ action: request.action_type, dateText, listingId: payload.listingId || null }), `approval:${approvalId}`],
      );
      actionResult = { leadId: request.lead_id, interactionId: interaction.rows[0].id, dateText };
    } else if (request.action_type === 'CREATE_PROPOSAL') {
      const listingId = String(payload.listingId || '');
      const basePrice = Number(payload.basePrice);
      const finalPrice = Number(payload.finalPrice);
      const discountAmount = Number(payload.discountAmount || 0);
      if (!listingId || !Number.isFinite(basePrice) || !Number.isFinite(finalPrice) || basePrice <= 0 || finalPrice <= 0 || discountAmount < 0 || finalPrice > basePrice) {
        throw new Error('APPROVAL_INVALID_PROPOSAL_PAYLOAD');
      }
      const existing = await client.query(`SELECT id FROM proposals WHERE tenant_id=current_setting('app.current_tenant_id', true)::uuid AND metadata->>'approvalId'=$1 LIMIT 1`, [approvalId]);
      let proposalId = existing.rows[0]?.id;
      if (!proposalId) {
        const created = await client.query(
          `INSERT INTO proposals (tenant_id, lead_id, listing_id, base_price, discount_amount, final_price, currency, status, token, valid_until, created_by, created_by_id, metadata)
           VALUES (current_setting('app.current_tenant_id', true)::uuid,$1,$2,$3,$4,$5,$6,'PENDING_APPROVAL',gen_random_uuid(),$7,$8,$9,$10::jsonb) RETURNING id`,
          [request.lead_id, listingId, basePrice, discountAmount, finalPrice, payload.currency || 'VND', payload.validUntil || null, reviewerId, reviewerId, JSON.stringify({ ...(payload.metadata || {}), approvalId })],
        );
        proposalId = created.rows[0].id;
      }
      actionResult = { leadId: request.lead_id, proposalId };
    } else if (request.action_type === 'SEND_DOCS') {
      const documentIds = Array.isArray(payload.documentIds) ? payload.documentIds.map(String).filter(Boolean) : [];
      const recipientEmail = String(payload.recipientEmail || '').trim().toLowerCase();
      if (!documentIds.length || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) throw new Error('APPROVAL_INVALID_DOCUMENT_DELIVERY_PAYLOAD');
      const docs = await client.query(`SELECT id, title, content, file_url FROM documents WHERE tenant_id=current_setting('app.current_tenant_id', true)::uuid AND id = ANY($1::uuid[]) AND status='ACTIVE'`, [documentIds]);
      if (docs.rows.length !== documentIds.length) throw new Error('APPROVAL_DOCUMENT_NOT_FOUND');
      const { emailService } = await import('./emailService');
      const body = docs.rows.map(d => `${d.title}\n${d.file_url || d.content || ''}`).join('\n\n');
      const mail = await emailService.sendEmail(tenantId, {
        to: recipientEmail,
        subject: String(payload.subject || 'Tài liệu từ SGS Land'),
        text: body,
        template: 'AI_APPROVED_DOCUMENTS',
        deliveryKey: `approval:${approvalId}`,
        dedupeKey: `approval:${approvalId}`,
      });
      if (!mail.success && mail.status !== 'deduped') throw new Error(`APPROVAL_DOCUMENT_DELIVERY_FAILED:${mail.error || mail.status}`);
      actionResult = { recipientEmail, documentIds, deliveryStatus: mail.status };
    } else if (request.action_type === 'CONFIRM_DEPOSIT') {
      const bookingId = String(payload.bookingId || '');
      if (!bookingId) throw new Error('APPROVAL_BOOKING_ID_REQUIRED');
      const booking = await client.query(
        `SELECT id, status, vnpay_response_code FROM bookings WHERE id=$1 AND tenant_id=current_setting('app.current_tenant_id', true)::uuid FOR UPDATE`,
        [bookingId],
      );
      if (!booking.rows[0]) throw new Error('APPROVAL_BOOKING_NOT_FOUND');
      if (booking.rows[0].status !== 'PAID' || booking.rows[0].vnpay_response_code !== '00') {
        throw new Error('APPROVAL_DEPOSIT_REQUIRES_VERIFIED_VNPAY');
      }
      actionResult = { bookingId, verified: true, status: 'PAID', mutation: 'NONE' };
    } else {
      throw new Error(`APPROVAL_ACTION_UNSUPPORTED:${request.action_type}`);
    }

    if (request.execution_id) {
      const executionResult = await client.query(
        `UPDATE agent_executions
            SET status='SUCCESS', current_step='END', output_json=$3::jsonb,
                approval_request_id=$4, paused_at=NULL, finished_at=NOW(),
                lease_expires_at=NOW(), updated_at=NOW()
          WHERE id=$1 AND tenant_id=$2 AND status='WAITING_APPROVAL'
          RETURNING id`,
        [request.execution_id, tenantId, JSON.stringify({ approvalId, actionType: request.action_type, ...actionResult }), approvalId],
      );
      if (request.execution_id && !executionResult.rows[0]) throw new Error('APPROVAL_EXECUTION_NOT_WAITING');
    }
    await client.query(
      `UPDATE approval_requests SET resumed_at=NOW() WHERE tenant_id=$1 AND id=$2 AND resumed_at IS NULL`,
      [tenantId, approvalId],
    );
    return { approvalId, actionType: request.action_type, ...actionResult, executed: true };
  });
}