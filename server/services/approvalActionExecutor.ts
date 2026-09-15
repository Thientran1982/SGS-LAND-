import { withTenantContext } from '../db';
import { validateProactiveApprovalBoundary } from './minhDecisionQueueService';
import { detectColdLeads, detectMarketPriceDrift, detectCsatDrop, DEFAULT_OPPORTUNITY_DETECTOR_CONFIG } from './minhOpportunityDetectors';
import { autonomousLearningService, evaluatePromotionGate, DEFAULT_MODEL_PROMOTION_GATE } from './autonomousLearningService';
import { agentMemoryService } from './agentMemoryService';

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

async function revalidateProactiveOpportunity(
  client: { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> },
  tenantId: string,
  actionType: string,
  subjectType: string | null,
  subjectId: string | null,
): Promise<boolean> {
  // Week 5 rule: if underlying data changed after approval, revalidate
  // before acting. Re-runs the same detector the suggestion came from and
  // checks whether the opportunity is still there, instead of trusting the
  // evidence snapshot captured back when the suggestion was created.
  const now = new Date();
  if (actionType === 'DRAFT_PROACTIVE_FOLLOWUP') {
    if (subjectType !== 'lead' || !subjectId) return true;
    const rows = await client.query(
      `SELECT l.id::text, l.stage, l.score::text, l.created_at, l.updated_at,
              MAX(i.timestamp) AS last_interaction_at,
              COUNT(i.id) FILTER (WHERE UPPER(COALESCE(i.direction,''))='OUTBOUND')::int AS outbound_interactions
         FROM leads l
         LEFT JOIN interactions i
           ON i.tenant_id=l.tenant_id AND i.lead_id=l.id
        WHERE l.tenant_id=$1 AND l.id::text=$2
          AND COALESCE(l.care_status,'ACTIVE') <> 'INACTIVE'
        GROUP BY l.id, l.stage, l.score, l.created_at, l.updated_at`,
      [tenantId, subjectId],
    );
    if (!rows.rows[0]) return false;
    const opportunities = detectColdLeads(
      rows.rows.map((row: any) => ({
        id: row.id,
        stage: row.stage,
        score: row.score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastInteractionAt: row.last_interaction_at,
        outboundInteractions: row.outbound_interactions,
      })),
      now,
      DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
    );
    return opportunities.length > 0;
  }
  if (actionType === 'REVIEW_LISTING_PRICE') {
    if (subjectType !== 'listing' || !subjectId) return true;
    const [listings, references] = await Promise.all([
      client.query(
        `SELECT id::text, title, price, area, location, address, type
           FROM listings
          WHERE tenant_id=$1 AND id::text=$2
            AND status NOT IN ('SOLD','RENTED','INACTIVE')
            AND price IS NOT NULL AND price > 0
            AND area IS NOT NULL AND area > 0`,
        [tenantId, subjectId],
      ),
      client.query(
        `SELECT location_key, location_display, price_per_m2, confidence, source, recorded_at
           FROM market_price_history
          WHERE recorded_at > NOW() - INTERVAL '180 days'
          UNION ALL
          SELECT location_key, location_display, calibrated_price_per_m2 AS price_per_m2,
                 confidence_score AS confidence, 'avm_calibration' AS source, last_calibrated_at AS recorded_at
            FROM avm_calibration
           WHERE last_calibrated_at > NOW() - INTERVAL '180 days'
          ORDER BY recorded_at DESC
          LIMIT 300`,
      ),
    ]);
    if (!listings.rows[0]) return false;
    const opportunities = detectMarketPriceDrift(
      listings.rows.map((row: any) => row),
      references.rows.map((row: any) => ({
        locationKey: row.location_key,
        locationDisplay: row.location_display,
        pricePerM2: row.price_per_m2,
        confidence: row.confidence,
        source: row.source,
        recordedAt: row.recorded_at,
      })),
      DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
    );
    return opportunities.some((opportunity: any) => opportunity.subjectId === subjectId);
  }
  if (actionType === 'REVIEW_CSAT_DROP') {
    const rows = await client.query(
      `SELECT payload, created_at
         FROM agent_signals
        WHERE tenant_id=$1 AND signal_type='support_csat' AND created_at > NOW() - INTERVAL '60 days'
        ORDER BY created_at DESC
        LIMIT 1000`,
      [tenantId],
    );
    const opportunities = detectCsatDrop(
      rows.rows.map((row: any) => ({ payload: row.payload, createdAt: row.created_at })),
      now,
      DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
    );
    return opportunities.length > 0;
  }
  return true;
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
    } else if (request.action_type === 'PROMOTE_LEARNING_CANDIDATE') {
      const candidateId = String(payload.candidateId || request.subject_id || '');
      const candidate = await autonomousLearningService.findCandidate(tenantId, candidateId);
      if (!candidate || candidate.status !== 'CANARY') throw new Error('APPROVAL_CANDIDATE_NOT_CANARY');
      const artifact = typeof candidate.artifact_json === 'string'
        ? JSON.parse(candidate.artifact_json)
        : (candidate.artifact_json || {});
      const weightVersionId = String(artifact.weightVersionId || '');
      if (!weightVersionId) throw new Error('APPROVAL_CANDIDATE_WEIGHT_VERSION_REQUIRED');
      const metrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {};
      const gate = evaluatePromotionGate({
        safety: Number(metrics.safety || 0),
        groundedness: Number(metrics.groundedness || 0),
        quality: Number(metrics.quality || 0),
        latencyP95Ms: Number(metrics.latencyP95Ms || 0),
        costUsd: Number(metrics.costUsd || 0),
        minSamples: Number(metrics.minSamples || 0),
      }, DEFAULT_MODEL_PROMOTION_GATE);
      if (!gate.passed) throw new Error(`APPROVAL_RUNTIME_GATE_FAILED:${gate.failures.join(',')}`);
      const promotedWeights = await agentMemoryService.promoteWeights(
        tenantId,
        weightVersionId,
        true,
        reviewerId,
        { ...metrics, candidateId },
        client,
      );
      if (!promotedWeights) throw new Error('APPROVAL_WEIGHT_VERSION_NOT_DRAFT');
      const promotedCandidate = await autonomousLearningService.promoteCandidate(
        tenantId,
        candidateId,
        'ACTIVE',
        gate,
        undefined,
        client,
      );
      if (!promotedCandidate) throw new Error('APPROVAL_CANDIDATE_PROMOTION_FAILED');
      await autonomousLearningService.recordAudit({
        tenantId,
        eventType: 'GO_LIVE_APPROVED',
        entityType: 'LEARNING_CANDIDATE',
        entityId: candidateId,
        reason: 'manager_approved_candidate_after_runtime_gate',
        metrics: { ...metrics, weightVersionId },
        existingClient: client,
      });
      actionResult = {
        candidateId,
        weightVersionId,
        candidateStatus: 'ACTIVE',
        mutation: 'MODEL_CONTROL_PLANE_ONLY',
      };
    } else if (request.action_type === 'ROLLBACK_LEARNING_CANDIDATE') {
      const candidateId = String(payload.candidateId || request.subject_id || '');
      const candidate = await autonomousLearningService.findCandidate(tenantId, candidateId);
      if (!candidate || candidate.status !== 'ACTIVE') throw new Error('APPROVAL_CANDIDATE_NOT_ACTIVE');
      const previous = await autonomousLearningService.findLastKnownGoodCandidate(tenantId, candidateId);
      const candidateArtifact = typeof candidate.artifact_json === 'string'
        ? JSON.parse(candidate.artifact_json)
        : (candidate.artifact_json || {});
      const previousArtifact = previous && typeof previous.artifact_json === 'string'
        ? JSON.parse(previous.artifact_json)
        : (previous?.artifact_json || {});
      const previousWeightVersionId = String(
        previousArtifact.weightVersionId
          || candidateArtifact.previousWeightVersionId
          || '',
      );
      if (!previousWeightVersionId) throw new Error('APPROVAL_PREVIOUS_WEIGHT_VERSION_REQUIRED');
      const metrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {};
      const restoredWeights = await agentMemoryService.restoreWeights(
        tenantId,
        previousWeightVersionId,
        reviewerId,
        { ...metrics, candidateId, rolledBackCandidateId: candidateId },
        client,
      );
      if (!restoredWeights) throw new Error('APPROVAL_PREVIOUS_WEIGHT_VERSION_NOT_SHADOW');
      const rolledBack = await autonomousLearningService.rollbackCandidate(
        tenantId,
        candidateId,
        Array.isArray(payload.failures) ? payload.failures.join(',') : 'runtime_regression',
        metrics,
        undefined,
        client,
      );
      if (!rolledBack) throw new Error('APPROVAL_CANDIDATE_ROLLBACK_FAILED');
      const restoredCandidate = previous
        ? await autonomousLearningService.restoreCandidate(tenantId, String(previous.id), undefined, client)
        : null;
      if (previous && !restoredCandidate) throw new Error('APPROVAL_PREVIOUS_CANDIDATE_RESTORE_FAILED');
      await autonomousLearningService.recordAudit({
        tenantId,
        eventType: 'ROLLBACK_APPROVED',
        entityType: 'LEARNING_CANDIDATE',
        entityId: candidateId,
        reason: 'manager_approved_runtime_regression_rollback',
        metrics: { ...metrics, previousCandidateId: previous ? String(previous.id) : null, previousWeightVersionId },
        existingClient: client,
      });
      actionResult = {
        candidateId,
        previousCandidateId: previous ? String(previous.id) : null,
        previousWeightVersionId,
        candidateStatus: 'ROLLED_BACK',
        mutation: 'MODEL_CONTROL_PLANE_ONLY',
      };
    } else if (
      request.action_type === 'DRAFT_PROACTIVE_FOLLOWUP'
      || request.action_type === 'REVIEW_LISTING_PRICE'
      || request.action_type === 'REVIEW_CSAT_DROP'
    ) {
      const boundary = validateProactiveApprovalBoundary(
        request.action_type,
        payload.consentValid === true,
      );
      if (boundary.decision !== 'approved') {
        throw new Error(`APPROVAL_PROACTIVE_BOUNDARY:${boundary.reasons.join(',')}`);
      }
      // Week 5 rule: if underlying data changed after approval,
      // revalidate before acting rather than trusting stale evidence.
      // Older manually-created proactive approvals do not carry the Week 5
      // evidence schema. Preserve their existing review behavior; only
      // detector-generated schema v2 suggestions use stale-evidence blocking.
      const stillValid = Number(payload.schemaVersion || 0) >= 2
        ? await revalidateProactiveOpportunity(
          client,
          tenantId,
          request.action_type,
          payload.subjectType || request.subject_type || null,
          payload.subjectId || request.subject_id || null,
        )
        : true;
      if (!stillValid) {
        actionResult = {
          mutation: 'NONE',
          providerCalled: false,
          skipped: true,
          reason: 'OPPORTUNITY_STALE',
        };
      } else {
        const existingQuestion = await client.query(
          `SELECT id FROM agent_human_questions
            WHERE tenant_id=current_setting('app.current_tenant_id', true)::uuid
              AND context_json->>'approvalId'=$1
            LIMIT 1`,
          [approvalId],
        );
        const question = existingQuestion.rows[0] || (await client.query(
          `INSERT INTO agent_human_questions
            (tenant_id, agent_key, question, lead_id, priority, context_json)
           VALUES (current_setting('app.current_tenant_id', true)::uuid, 'minh_proactive', $1, $2, $3, $4::jsonb)
           RETURNING id`,
          [
            request.action_type === 'DRAFT_PROACTIVE_FOLLOWUP'
              ? 'Minh đã tạo bản nháp follow-up sau khi được duyệt; nhân viên kiểm tra và gửi thủ công nếu phù hợp.'
              : request.action_type === 'REVIEW_LISTING_PRICE'
                ? 'Minh đề nghị nhân viên rà soát lại giá listing và nguồn tham chiếu trước khi thay đổi dữ liệu.'
                : 'Minh đề nghị nhân viên rà soát nhóm nguyên nhân CSAT giảm và xác minh mẫu hội thoại.',
            request.lead_id || null,
            Math.max(0, Math.min(100, Number(payload.priority || 60))),
            JSON.stringify({
              approvalId,
              sourceSignalId: payload.sourceSignalId || request.source_signal_id || null,
              subjectType: payload.subjectType || request.subject_type || null,
              subjectId: payload.subjectId || request.subject_id || null,
              actionType: request.action_type,
              evidence: payload.evidence || {},
              providerCalled: false,
              mutation: 'NONE',
            }),
          ],
        )).rows[0];
        actionResult = {
          mutation: 'NONE',
          providerCalled: false,
          humanQuestionId: question.id,
          draftCreated: request.action_type === 'DRAFT_PROACTIVE_FOLLOWUP',
        };
      }
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