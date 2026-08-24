import { Server } from 'socket.io';
import { logger } from './middleware/logger';
import { getAdapter } from './channels/registry';
import { isHighImpactAction } from './repositories/approvalRequestRepository';
import { buildChangeLeadStageApproval } from './services/approvalActionExecutor';
import { createHash } from 'crypto';
// ---------------------------------------------------------------------------
// Queue — Upstash QStash (production) hoặc in-memory (dev/fallback)
//
// Khi QSTASH_TOKEN được cấu hình:
//   - webhookQueue.add() → publish lên QStash
//   - QStash gọi callback đến /api/qstash/process
//   - Job được lưu bền vững, retry tự động (tối đa 3 lần)
//
// Khi không có QSTASH_TOKEN:
//   - Fallback về in-memory với exponential backoff
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------
const inMemoryJobs: any[] = [];
let inMemoryProcessor: ((job: any) => Promise<void>) | null = null;
const MAX_IN_MEMORY_ATTEMPTS = 3;
const IN_MEMORY_BACKOFF_MS = 2000;
let outboundRecoveryTimer: NodeJS.Timeout | null = null;

async function recoverStaleOutboundDeliveries(io: Server): Promise<void> {
  try {
    const { agentOutboundRepository } = await import('./repositories/agentOutboundRepository');
    const { interactionRepository } = await import('./repositories/interactionRepository');
    const stale = await agentOutboundRepository.recoverStaleSending();
    for (const delivery of stale) {
      await interactionRepository.updateThreadAiMode(
        delivery.tenantId,
        delivery.leadId,
        'HUMAN_TAKEOVER',
      );
      io.to(`tenant:${delivery.tenantId}`).emit('escalate_to_human', {
        leadId: delivery.leadId,
        reason: `Outbound delivery ${delivery.deliveryId} expired; manual verification required`,
      });
    }
    if (stale.length > 0) {
      logger.warn(`[AutoReply] ${stale.length} stale outbound delivery claim(s) moved to UNKNOWN`);
    }
  } catch (error) {
    logger.error('[AutoReply] Outbound recovery scan failed:', error);
  }
}

function stableEventKey(platform: string, payload: any, hint?: string): string {
  if (hint) return hint;
  const candidates = [
    payload?.message?.msg_id,
    payload?.message?.message_id,
    payload?.message?.mid,
    payload?.mid,
    payload?.event_id,
    payload?.id,
    payload?.timestamp && payload?.sender?.id
      ? `${payload.event_name || 'event'}:${payload.sender.id}:${payload.timestamp}`
      : undefined,
  ].filter(Boolean);
  if (candidates[0]) return String(candidates[0]);
  return createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

async function claimWebhookEvent(
  tenantId: string,
  platform: string,
  eventKey: string,
): Promise<boolean> {
  const { withTenantContext } = await import('./db');
  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `INSERT INTO webhook_events (platform, event_key, tenant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (platform, event_key) DO UPDATE
       SET attempts = webhook_events.attempts + 1,
           status = 'PROCESSING',
           locked_at = NOW(),
           tenant_id = EXCLUDED.tenant_id
       WHERE webhook_events.status = 'PROCESSING'
         AND webhook_events.locked_at < NOW() - INTERVAL '10 minutes'
       RETURNING id`,
      [platform, eventKey, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

async function markWebhookProcessed(tenantId: string, platform: string, eventKey: string): Promise<void> {
  const { withTenantContext } = await import('./db');
  await withTenantContext(tenantId, (client) => client.query(
    `UPDATE webhook_events
        SET status = 'PROCESSED', processed_at = NOW()
      WHERE platform = $1 AND event_key = $2`,
    [platform, eventKey],
  ));
}

async function releaseWebhookEvent(tenantId: string, platform: string, eventKey: string): Promise<void> {
  const { withTenantContext } = await import('./db');
  await withTenantContext(tenantId, client => client.query(
    `UPDATE webhook_events
        SET locked_at = NOW() - INTERVAL '11 minutes'
      WHERE platform = $1 AND event_key = $2 AND status = 'PROCESSING'`,
    [platform, eventKey],
  ));
}
function runWithRetry(job: any, attempt = 1): void {
  setTimeout(async () => {
    try {
      await inMemoryProcessor!(job);
    } catch (err: any) {
      if (attempt < MAX_IN_MEMORY_ATTEMPTS) {
        const wait = IN_MEMORY_BACKOFF_MS * Math.pow(2, attempt - 1);
        logger.warn(`[Queue] Job ${job.id} lần ${attempt} thất bại: ${err.message}. Thử lại sau ${wait}ms…`);
        runWithRetry(job, attempt + 1);
      } else {
        logger.error(`[Queue] Job ${job.id} thất bại vĩnh viễn sau ${MAX_IN_MEMORY_ATTEMPTS} lần`, err);
      }
    }
  }, attempt === 1 ? 0 : IN_MEMORY_BACKOFF_MS * Math.pow(2, attempt - 2));
}
// ---------------------------------------------------------------------------
// Kiểm tra QStash có được cấu hình không
// ---------------------------------------------------------------------------
export function isQStashEnabled(): boolean {
  return !!(getQstashToken() && process.env.QSTASH_CURRENT_SIGNING_KEY);
}

export function getQstashToken(): string {
  return (process.env.QSTASH_TOKEN || '').trim().replace(/^["']|["']$/g, '');
}

// Configuration alone is not enough for production scheduling: an expired or
// copied token can still be present in the environment. This state is set only
// after the read-only QStash API check succeeds during boot.
let qstashVerified = false;

export function isQstashVerified(): boolean {
  return qstashVerified;
}
// ---------------------------------------------------------------------------
// Startup token verification
//
// Every in-process cron that tries to register a QStash schedule already logs
// a 401 "unable to authenticate" warning when the token is bad, but those
// warnings are easy to miss among the rest of the startup log. This makes a
// single, cheap, unambiguous call at boot (listing schedules — no side
// effects) so a broken/expired QSTASH_TOKEN is impossible to miss: it prints
// one clear line saying exactly whether the token is valid or not.
// ---------------------------------------------------------------------------
export async function verifyQstashTokenAtStartup(): Promise<boolean> {
  const token = getQstashToken();
  if (!token) {
    qstashVerified = false;
    logger.info('[Queue] QStash token check bỏ qua — QSTASH_TOKEN chưa được cấu hình (dùng in-memory queue).');
    return false;
  }
  try {
    const { Client } = await import('@upstash/qstash');
    const client = new Client({ token });
    // schedules.list() is a cheap, read-only, no-side-effect call — perfect
    // for an auth check without touching any real schedule/job.
    await client.schedules.list();
    qstashVerified = true;
    logger.info('[Queue] QStash token hợp lệ — kết nối Upstash QStash thành công.');
    return true;
  } catch (err: any) {
    qstashVerified = false;
    const detail = err?.message || String(err);
    logger.error(`[Queue] QStash scheduler NOT READY — token lỗi: ${detail}. Production schedules sẽ không được đăng ký; in-process fallback chỉ là biện pháp tạm thời và không bền vững sau restart. Vào Upstash dashboard để lấy token mới.`);
    return false;
  }
}
function getReceiverUrl(): string {
  if (process.env.QSTASH_RECEIVER_URL) return process.env.QSTASH_RECEIVER_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const domains = process.env.REPLIT_DOMAINS;
    const domain = domains ? domains.split(',')[0].trim() : process.env.APP_DOMAIN || 'sgs-land.replit.app';
    return `https://${domain}/api/qstash/process`;
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}/api/qstash/process`;
  return 'http://localhost:5000/api/qstash/process';
}
// ---------------------------------------------------------------------------
// Queue public API
// ---------------------------------------------------------------------------
const QSTASH_ENABLED = isQStashEnabled();
if (QSTASH_ENABLED) {
  logger.info('[Queue] QStash đã được cấu hình — đang chờ xác thực kết nối trước khi gửi job production.');
} else {
  logger.info('[Queue] Sử dụng in-memory queue (fallback). Cấu hình QSTASH_TOKEN để kích hoạt QStash.');
}
export const webhookQueue = {
  add: async (name: string, data: any) => {
    const job = { name, data, id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    if (isQstashVerified()) {
      try {
        const { Client } = await import('@upstash/qstash');
        const client = new Client({ token: getQstashToken() });
        const receiverUrl = getReceiverUrl();
        await client.publishJSON({
          url: receiverUrl,
          body: job,
          retries: 3,
          headers: { 'x-job-name': name },
        });
        logger.info(`[Queue] Job "${name}" (${job.id}) đã gửi lên QStash → ${receiverUrl}`);
      } catch (err: any) {
        logger.error(`[Queue] Không thể gửi job lên QStash: ${err.message}. Chuyển sang in-memory.`);
        if (inMemoryProcessor) {
          runWithRetry(job);
        } else {
          inMemoryJobs.push(job);
        }
      }
    } else {
      if (inMemoryProcessor) {
        runWithRetry(job);
      } else {
        inMemoryJobs.push(job);
      }
    }
    return job;
  },
  close: async () => {},
};

/** Publish an operating event and wake the durable operator worker. */
export async function enqueueAgentOperatingEvent(
  tenantId: string,
  event: {
    eventId: string;
    eventType: string;
    idempotencyKey: string;
    actor: 'SYSTEM' | 'STAFF' | 'BUYER' | 'AGENT';
    urgency?: number;
    payload?: Record<string, unknown>;
  },
) {
  const { agentOperatingRepository } = await import('./repositories/agentOperatingRepository');
  const row = await agentOperatingRepository.enqueueEvent(tenantId, event);
  await webhookQueue.add('agent-operating-event', {
    platform: 'agent-operating',
    tenantId,
    eventId: row.id,
  });
  return row;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertLeadBySocialId(
  tenantId: string,
  channel: 'zalo' | 'facebook',
  socialId: string,
  displayName?: string
): Promise<any> {
  const { leadRepository } = await import('./repositories/leadRepository');
  const existing = await leadRepository.findBySocialId(tenantId, channel, socialId);
  if (existing) return existing;
  const sourceName = channel === 'zalo' ? 'Zalo' : 'Facebook';
  const name = displayName?.trim() || `${sourceName} User`;
  const lead = await leadRepository.create(tenantId, {
    name,
    phone: '',
    source: sourceName,
    stage: 'NEW',
    socialIds: { [channel]: socialId },
    tags: [sourceName],
  });
  logger.info(`[Webhook] Tạo lead mới ${lead.id} từ ${sourceName} (socialId: ${socialId})`);
  return lead;
}
// ---------------------------------------------------------------------------
// Auto-reply: gọi AI + gửi reply qua kênh tương ứng (fire-and-forget)
// ---------------------------------------------------------------------------
export async function triggerAutoReply(
  io: Server,
  tenantId: string,
  lead: any,
  inboundText: string,
  channel: 'ZALO' | 'FACEBOOK' | 'EMAIL',
  inboundEventId: string,
  fromOperator = false,
): Promise<void> {
  try {
    if (!fromOperator) {
      const { enqueueAgentOperatingEvent } = await import('./queue');
      await enqueueAgentOperatingEvent(tenantId, {
        eventId: `inbound:${channel}:${inboundEventId}`,
        eventType: 'INBOUND_MESSAGE',
        idempotencyKey: `inbound:${channel}:${inboundEventId}`,
        actor: 'BUYER',
        urgency: /gấp|khẩn|urgent|hôm nay|ngay/i.test(inboundText) ? 90 : 50,
        payload: { lead, inboundText, channel, inboundEventId },
      });
      return;
    }
    // 1. Kiểm tra thread_status — chỉ auto-reply khi AI_ACTIVE
    const { withTenantContext } = await import('./db');
    const statusResult = await withTenantContext(tenantId, async (client) => {
      return client.query(
        `SELECT COALESCE(thread_status, 'AI_ACTIVE') AS thread_status FROM leads WHERE id = $1`,
        [lead.id]
      );
    });
    const threadStatus: string = statusResult.rows[0]?.thread_status ?? 'AI_ACTIVE';
    if (threadStatus === 'HUMAN_TAKEOVER') {
      logger.info(`[AutoReply] Lead ${lead.id} đang ở chế độ HUMAN_TAKEOVER — bỏ qua auto-reply`);
      return;
    }
    // 2. Lấy lịch sử hội thoại gần nhất (tối đa 20 tin)
    const { interactionRepository } = await import('./repositories/interactionRepository');
    const allHistory = await interactionRepository.findByLead(tenantId, lead.id);
    const history = allHistory.slice(-20);
    // 3. Gọi AI tạo câu trả lời
    // Thử fetch favorites nếu lead có userId liên kết (thường không có với Zalo/Facebook leads)
    let autoReplyFavorites: any[] = [];
    try {
      if (lead.userId) {
        const { listingRepository } = await import('./repositories/listingRepository');
        const favRaw = await listingRepository.getFavorites(tenantId, lead.userId);
        autoReplyFavorites = favRaw.map((f: any) => ({
          id: f.id, title: f.title, address: f.address, price: f.price, area: f.area, propertyType: f.propertyType,
        }));
      }
    } catch { }
    const { aiService } = await import('./ai');
    const { runDurableAgentExecution } = await import('./services/durableAgentExecutionService');
    const t = (key: string) => key;
    const execution = await runDurableAgentExecution({
      tenantId,
      idempotencyKey: `${channel.toLowerCase()}:${inboundEventId}`,
      sessionId: lead.id,
      leadId: lead.id,
      triggerSource: `${channel.toLowerCase()}-webhook`,
      message: inboundText,
      approval: (result: any) => {
        return buildChangeLeadStageApproval(result, lead.id, `${channel}:${inboundEventId}`);
      },
      execute: () => aiService.processMessage(
        lead,
        inboundText,
        history,
        t,
        tenantId,
        'vn',
        autoReplyFavorites,
      ),
    });
    const aiResult = execution.result;
    if (!aiResult?.content) {
      logger.warn(`[AutoReply] AI không trả về nội dung cho lead ${lead.id}`);
      return;
    }

    // Permission Broker: neu AI de xuat hanh dong high-impact, tao approval_request
    // PENDING de nhan vien duyet (tab moi trong Inbox) thay vi de suggestedAction
    // nam im khong ai xu ly. AI van tra loi tin nhan binh thuong o duoi.
    if (isHighImpactAction(aiResult.suggestedAction)) {
      const { approvalRequestRepository } = await import('./repositories/approvalRequestRepository');
      approvalRequestRepository.create({
        tenantId,
        leadId: lead.id,
        channel,
        actionType: aiResult.suggestedAction,
        payload: { userMessage: inboundText?.slice(0, 500), aiReply: aiResult.content?.slice(0, 500) },
      }).catch((err: any) => logger.error('[PermissionBroker] Loi tao approval_request:', err));
    }
    // 4. Lưu tin trả lời vào DB
    const aiInteraction = await interactionRepository.create(tenantId, {
      leadId: lead.id,
      channel,
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: aiResult.content,
      metadata: {
        isAi: true,
        isAgent: true,
        aiConfidence: aiResult.confidence,
        suggestedAction: aiResult.suggestedAction,
        escalated: aiResult.escalated ?? false,
        intent: aiResult.intent,
        userMessage: inboundText?.slice(0, 300),
        agentRunId: execution.runId,
        traceId: execution.traceId,
        needsVerification: execution.guardrail.requiresVerification,
      },
      externalEventId: `agent:${execution.runId}`,
    });
    // 5. Durable delivery claim. SENDING from an earlier process is treated as
    // ambiguous and never resent automatically because providers do not expose
    // a portable idempotency key.
    const { agentOutboundRepository } = await import('./repositories/agentOutboundRepository');
    await recoverStaleOutboundDeliveries(io);
    const delivery = await agentOutboundRepository.createAndClaim({
      tenantId,
      executionId: execution.runId,
      interactionId: aiInteraction.id,
      leadId: lead.id,
      channel,
      content: aiResult.content,
    });
    const adapter = getAdapter(channel);
    if (delivery.state === 'BUSY') {
      throw new Error(`OUTBOUND_DELIVERY_IN_PROGRESS:${delivery.id}`);
    }
    if (delivery.state === 'AMBIGUOUS' || delivery.state === 'FAILED') {
      await interactionRepository.updateThreadAiMode(tenantId, lead.id, 'HUMAN_TAKEOVER');
      io.to(`tenant:${tenantId}`).emit('escalate_to_human', {
        leadId: lead.id,
        reason: `Outbound ${channel} delivery requires manual verification (${delivery.state})`,
      });
      throw new Error(`OUTBOUND_DELIVERY_${delivery.state}:${delivery.id}`);
    }
    if (delivery.state === 'SEND') {
      if (!adapter || !delivery.claimToken) {
        const error = `Khong tim thay ChannelAdapter cho kenh ${channel}`;
        if (delivery.claimToken) {
          await agentOutboundRepository.markFailed({
            tenantId,
            deliveryId: delivery.id,
            claimToken: delivery.claimToken,
            error,
          });
        }
        await interactionRepository.updateThreadAiMode(tenantId, lead.id, 'HUMAN_TAKEOVER');
        throw new Error(error);
      }
      try {
        const sendResult = await adapter.sendOutbound(tenantId, lead, aiResult.content, {
          deliveryId: delivery.id,
          deliveryKey: delivery.deliveryKey || `agent-outbound:${delivery.id}`,
        });
        if (!sendResult.success) {
          const mark = sendResult.ambiguous
            ? agentOutboundRepository.markUnknown({
              tenantId, deliveryId: delivery.id, claimToken: delivery.claimToken,
              error: sendResult.error || 'Provider outcome unknown; automatic resend blocked',
            })
            : agentOutboundRepository.markFailed({
              tenantId, deliveryId: delivery.id, claimToken: delivery.claimToken,
              error: sendResult.error || 'Channel provider rejected outbound message',
            });
          await mark;
          await interactionRepository.updateThreadAiMode(tenantId, lead.id, 'HUMAN_TAKEOVER');
          throw new Error(sendResult.error || `Gui ${channel} that bai`);
        }
        await agentOutboundRepository.markSent({
          tenantId,
          deliveryId: delivery.id,
          claimToken: delivery.claimToken,
          providerMessageId: sendResult.messageId,
        });
      } catch (error: any) {
        await agentOutboundRepository.markFailed({
          tenantId,
          deliveryId: delivery.id,
          claimToken: delivery.claimToken,
          error: error?.message || String(error),
        }).catch(() => {});
        await interactionRepository.updateThreadAiMode(tenantId, lead.id, 'HUMAN_TAKEOVER');
        throw error;
      }
    }
    // 6. Phát socket event cho UI cập nhật realtime
    if (!execution.cached) {
      io.to(lead.id).emit('receive_message', {
        room: lead.id,
        message: aiInteraction,
        isAi: true,
      });
      io.to(`tenant:${tenantId}`).emit('new_inbound_message', {
        leadId: lead.id,
        message: aiInteraction,
        source: channel,
        isAi: true,
      });
    }
    logger.info(`[AutoReply] AI đã trả lời lead ${lead.id} qua ${channel} (confidence=${aiResult.confidence})`);
    // 7. Nếu AI đề xuất chuyển agent → cập nhật HUMAN_TAKEOVER
    if (aiResult.escalated) {
      await withTenantContext(tenantId, async (client) => {
        return client.query(
          `UPDATE leads SET thread_status = 'HUMAN_TAKEOVER' WHERE id = $1`,
          [lead.id]
        );
      });
      io.to(`tenant:${tenantId}`).emit('escalate_to_human', {
        leadId: lead.id,
        reason: 'AI escalated conversation to human agent',
      });
      logger.info(`[AutoReply] Chuyển lead ${lead.id} sang HUMAN_TAKEOVER (AI escalated)`);
    }
  } catch (err: any) {
    logger.error(`[AutoReply] Lỗi khi tạo auto-reply cho lead ${lead.id} (${channel}):`, err);
    throw err;
  }
}

async function triggerWebhookAutoReply(
  io: Server,
  tenantId: string,
  lead: any,
  inboundText: string,
  channel: 'ZALO' | 'FACEBOOK' | 'EMAIL',
  inboundEventId: string,
  platform: string,
  eventKey: string,
): Promise<void> {
  try {
    await triggerAutoReply(io, tenantId, lead, inboundText, channel, inboundEventId);
  } catch (error) {
    await releaseWebhookEvent(tenantId, platform, eventKey).catch(() => {});
    throw error;
  }
}
// ---------------------------------------------------------------------------
// Bộ xử lý job — được export để /api/qstash/process gọi trực tiếp
// ---------------------------------------------------------------------------
export async function processWebhookJob(io: Server, job: any): Promise<void> {
  const { platform, payload } = job.data;
  if (platform === 'agent-operating') {
    const { processAgentEvents } = await import('./services/agentOperatorDaemon');
    const tenantId = String(job.data.tenantId || payload?.tenantId || '');
    if (!tenantId) throw new Error('AGENT_EVENT_TENANT_REQUIRED');
    // The database claim is the source of truth; duplicate QStash deliveries
    // simply find no claimable work.
    await processAgentEvents(tenantId, 25);
    return;
  }
  // -------------------------------------------------------------------------
  // ZALO
  // -------------------------------------------------------------------------
  if (platform === 'zalo') {
    const { event_name, sender, recipient, message, timestamp } = payload;

    const oaId = recipient?.id as string | undefined;
    if (!oaId) {
      logger.warn('[Zalo Webhook] Thiếu recipient.id (OA ID), không xác định được tenant — bỏ qua sự kiện');
      return;
    }
    const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
    const foundTenant = await enterpriseConfigRepository.findTenantByZaloOaId(oaId);
    if (!foundTenant) {
      logger.warn(`[Zalo Webhook] OA ID ${oaId} chưa được đăng ký cho tenant nào — bỏ qua sự kiện`);
      return;
    }
    const tenantId = foundTenant;
    const eventKey = stableEventKey('zalo', payload);
    if (!(await claimWebhookEvent(tenantId, 'zalo', eventKey))) {
      logger.info(`[Zalo Webhook] Bỏ qua event trùng ${eventKey}`);
      return;
    }
    const senderId = sender?.id as string | undefined;
    if (!senderId) {
      logger.warn('[Zalo Webhook] Thiếu sender.id trong payload');
      return;
    }
    if (event_name === 'follow') {
      const followLead = await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
      logger.info(`[Zalo] Người theo dõi mới ${senderId} → lead đã tạo/tìm thấy`);
      // Notify admins about new Zalo OA follower
      (async () => {
        try {
          const { notificationRepository } = await import('./repositories/notificationRepository');
          const { withTenantContext } = await import('./db');
          const admins = await withTenantContext(tenantId, (client) => client.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('ADMIN', 'TEAM_LEAD') LIMIT 5`,
            [tenantId]
          ));
          const followerName = sender?.display_name || `Zalo User ${senderId.slice(-6)}`;
          for (const admin of admins.rows) {
            await notificationRepository.create({
              tenantId,
              userId: admin.id,
              type: 'ZALO_MESSAGE',
              title: `Người dùng Zalo mới theo dõi OA`,
              body: followerName,
              metadata: { leadId: followLead.id, senderId, channel: 'ZALO', event: 'follow' },
            });
            io.to(`user:${admin.id}`).emit('notification', {
              type: 'ZALO_MESSAGE',
              title: `Người dùng Zalo mới theo dõi OA`,
              body: followerName,
              leadId: followLead.id,
            });
          }
        } catch (err: any) {
          logger.warn('[Zalo] Lỗi tạo thông báo follow:', err.message);
        }
      })();
      await markWebhookProcessed(tenantId, 'zalo', eventKey);
      return;
    }
    if (event_name === 'user_send_text') {
      const textContent = message?.text as string;
      if (!textContent) {
        await markWebhookProcessed(tenantId, 'zalo', eventKey);
        return;
      }
      const lead = await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
      const leadId = lead.id;
      const { interactionRepository } = await import('./repositories/interactionRepository');
      const savedInteraction = await interactionRepository.create(tenantId, {
        leadId,
        channel: 'ZALO',
        direction: 'INBOUND',
        type: 'TEXT',
        content: textContent,
        externalEventId: eventKey,
        metadata: {
          platform: 'zalo',
          senderId,
          oaId,
          originalTimestamp: timestamp,
        },
      });
      logger.info(`[Zalo] Tin nhắn từ ${senderId} → lead ${leadId}`);

      io.to(leadId).emit('receive_message', { room: leadId, message: savedInteraction, isWebhook: true });
      io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Zalo' });
      // Gửi thông báo in-app cho agent phụ trách (hoặc tất cả admin nếu chưa có agent)
      (async () => {
        try {
          const { notificationRepository } = await import('./repositories/notificationRepository');
          const preview = textContent.length > 60 ? textContent.slice(0, 60) + '…' : textContent;
          const title = `Zalo: ${lead.name || senderId}`;
          if (lead.assignedTo) {
            await notificationRepository.create({
              tenantId,
              userId: lead.assignedTo,
              type: 'ZALO_MESSAGE',
              title,
              body: preview,
              metadata: { leadId, senderId, channel: 'ZALO' },
            });
            io.to(`user:${lead.assignedTo}`).emit('notification', {
              type: 'ZALO_MESSAGE', title, body: preview, leadId,
            });
          } else {
            // Chưa có agent — thông báo cho tất cả ADMIN trong tenant
            const { withTenantContext } = await import('./db');
            const admins = await withTenantContext(tenantId, (client) => client.query(
              `SELECT id FROM users WHERE tenant_id = $1 AND role = 'ADMIN' LIMIT 5`,
              [tenantId]
            ));
            for (const admin of admins.rows) {
              await notificationRepository.create({
                tenantId,
                userId: admin.id,
                type: 'ZALO_MESSAGE',
                title,
                body: preview,
                metadata: { leadId, senderId, channel: 'ZALO', unassigned: true },
              });
              io.to(`user:${admin.id}`).emit('notification', {
                type: 'ZALO_MESSAGE', title, body: preview, leadId,
              });
            }
          }
        } catch (err: any) {
          logger.warn('[Zalo] Lỗi tạo thông báo agent:', err.message);
        }
      })();
      // AI scoring + auto-reply chạy song song trong background
      (async () => {
        try {
          const { aiService } = await import('./ai');
          const scoreResult = await aiService.scoreLead({ name: lead.name, source: 'Zalo' }, textContent);
          if (scoreResult) {
            const { leadRepository } = await import('./repositories/leadRepository');
            await leadRepository.update(tenantId, leadId, {
              score: { score: scoreResult.score || (scoreResult as any).totalScore, grade: scoreResult.grade, reasoning: scoreResult.reasoning },
            });
            io.to(`tenant:${tenantId}`).emit('lead_scored', { leadId, score: scoreResult });
          }
        } catch (err) {
          logger.error('[Zalo] Lỗi AI scoring:', err);
        }
      })();
      // Auto-reply qua Zalo
      await triggerWebhookAutoReply(
        io, tenantId, lead, textContent, 'ZALO', savedInteraction.id, 'zalo', eventKey,
      );
      await markWebhookProcessed(tenantId, 'zalo', eventKey);
    }
    if (event_name === 'user_send_image') {
      const imgUrl = message?.attachments?.[0]?.payload?.url as string | undefined;
      const lead = await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
      const { interactionRepository } = await import('./repositories/interactionRepository');
      const savedInteraction = await interactionRepository.create(tenantId, {
        leadId: lead.id,
        channel: 'ZALO',
        direction: 'INBOUND',
        type: 'IMAGE',
        content: imgUrl || '[Hình ảnh]',
        externalEventId: `${eventKey}:image`,
        metadata: { platform: 'zalo', senderId, oaId, imageUrl: imgUrl },
      });
      io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
      io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Zalo' });
      // Trả lời tự động khi nhận hình ảnh
      await triggerWebhookAutoReply(
        io, tenantId, lead, '[Khách gửi hình ảnh]', 'ZALO', savedInteraction.id, 'zalo', eventKey,
      );
      await markWebhookProcessed(tenantId, 'zalo', eventKey);
    }
  }
  // -------------------------------------------------------------------------
  // FACEBOOK
  // -------------------------------------------------------------------------
  else if (platform === 'facebook') {
    const { object, entry } = payload;
    if (object !== 'page' || !Array.isArray(entry)) return;

    for (const pageEntry of entry) {
      const pageId = pageEntry.id as string | undefined;
      if (!pageId) {
        logger.warn('[Facebook Webhook] Thiếu pageEntry.id, không xác định được tenant — bỏ qua entry');
        continue;
      }
      const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
      const foundTenant = await enterpriseConfigRepository.findTenantByFacebookPageId(pageId);
      if (!foundTenant) {
        logger.warn(`[Facebook Webhook] Page ID ${pageId} chưa đăng ký cho tenant nào — bỏ qua entry`);
        continue;
      }
      const tenantId = foundTenant;
      const messagingEvents: any[] = pageEntry.messaging || [];
      for (const webhookEvent of messagingEvents) {
        const senderId = webhookEvent.sender?.id as string | undefined;
        if (!senderId || senderId === pageId) continue;
        const eventKey = stableEventKey('facebook', webhookEvent, `${pageId}:${webhookEvent.message?.mid || webhookEvent.timestamp || JSON.stringify(webhookEvent)}`);
        if (!(await claimWebhookEvent(tenantId, 'facebook', eventKey))) {
          logger.info(`[Facebook Webhook] Bỏ qua event trùng ${eventKey}`);
          continue;
        }
        const messageText = webhookEvent.message?.text as string | undefined;
        if (messageText) {
          const lead = await upsertLeadBySocialId(tenantId, 'facebook', senderId);
          const leadId = lead.id;
          const { interactionRepository } = await import('./repositories/interactionRepository');
          const savedInteraction = await interactionRepository.create(tenantId, {
            leadId,
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            type: 'TEXT',
            content: messageText,
            externalEventId: eventKey,
            metadata: {
              platform: 'facebook',
              senderId,
              pageId,
              mid: webhookEvent.message?.mid,
            },
          });
          logger.info(`[Facebook] Tin nhắn từ ${senderId} → lead ${leadId}`);
          io.to(leadId).emit('receive_message', { room: leadId, message: savedInteraction, isWebhook: true });
          io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Facebook' });
          // AI scoring chạy background
          (async () => {
            try {
              const { aiService } = await import('./ai');
              const scoreResult = await aiService.scoreLead({ name: lead.name, source: 'Facebook' }, messageText);
              if (scoreResult) {
                const { leadRepository } = await import('./repositories/leadRepository');
                await leadRepository.update(tenantId, leadId, {
                  score: { score: scoreResult.score || (scoreResult as any).totalScore, grade: scoreResult.grade, reasoning: scoreResult.reasoning },
                });
                io.to(`tenant:${tenantId}`).emit('lead_scored', { leadId, score: scoreResult });
              }
            } catch (err) {
              logger.error('[Facebook] Lỗi AI scoring:', err);
            }
          })();
          // Auto-reply qua Facebook Messenger
          await triggerWebhookAutoReply(
            io, tenantId, lead, messageText, 'FACEBOOK', savedInteraction.id, 'facebook', eventKey,
          );
          await markWebhookProcessed(tenantId, 'facebook', eventKey);
        }
        const attachments = webhookEvent.message?.attachments as any[] | undefined;
        if (attachments?.length && !messageText) {
          const lead = await upsertLeadBySocialId(tenantId, 'facebook', senderId);
          const attachment = attachments[0];
          const contentType = attachment.type === 'image' ? 'IMAGE' : 'FILE';
          const contentText = attachment.payload?.url || `[${attachment.type || 'File'}]`;
          const { interactionRepository } = await import('./repositories/interactionRepository');
          const savedInteraction = await interactionRepository.create(tenantId, {
            leadId: lead.id,
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            type: contentType,
            content: contentText,
            externalEventId: eventKey,
            metadata: { platform: 'facebook', senderId, pageId, attachmentType: attachment.type },
          });
          io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
          io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Facebook' });
          // Auto-reply cho file/ảnh
          await triggerWebhookAutoReply(
            io,
            tenantId,
            lead,
            `[Khách gửi ${attachment.type || 'file'}]`,
            'FACEBOOK',
            savedInteraction.id,
            'facebook',
            eventKey,
          );
          await markWebhookProcessed(tenantId, 'facebook', eventKey);
        }
        const postback = webhookEvent.postback;
        if (postback) {
          const lead = await upsertLeadBySocialId(tenantId, 'facebook', senderId);
          const { interactionRepository } = await import('./repositories/interactionRepository');
          const pbContent = postback.title || postback.payload || '[Postback]';
          const savedInteraction = await interactionRepository.create(tenantId, {
            leadId: lead.id,
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            type: 'TEXT',
            content: pbContent,
            externalEventId: eventKey,
            metadata: { platform: 'facebook', senderId, pageId, postbackPayload: postback.payload },
          });
          // Auto-reply cho postback
          await triggerWebhookAutoReply(
            io, tenantId, lead, pbContent, 'FACEBOOK', savedInteraction.id, 'facebook', eventKey,
          );
          await markWebhookProcessed(tenantId, 'facebook', eventKey);
        }
      }
    }
  }
  // -------------------------------------------------------------------------
  // EMAIL INBOUND
  // -------------------------------------------------------------------------
  else if (platform === 'email') {
    const { from, fromName, subject, body, to, tenantId: payloadTenantId } = payload;
    if (!from) {
      logger.warn('[Email Webhook] Thiếu địa chỉ from');
      return;
    }
    if (!payloadTenantId) {
      logger.warn('[Email Webhook] Thiếu tenantId trong payload — bỏ qua sự kiện');
      return;
    }
    const tenantId = payloadTenantId;
    const eventKey = stableEventKey('email', payload);
    if (!(await claimWebhookEvent(tenantId, 'email', eventKey))) {
      logger.info(`[Email Webhook] Bỏ qua event trùng ${eventKey}`);
      return;
    }
    const fromEmail = (from.match(/<(.+?)>/) || [])[1] || from.trim();
    const senderName = fromName || (from.match(/^(.+?)\s*</) || [])[1]?.trim() || fromEmail.split('@')[0];
    const { leadRepository } = await import('./repositories/leadRepository');
    const { interactionRepository } = await import('./repositories/interactionRepository');
    let lead: any;
    try {
      const { withTenantContext } = await import('./db');
      const existingResult = await withTenantContext(tenantId, async (client) => {
        return client.query(
          `SELECT * FROM leads WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [fromEmail]
        );
      });
      if (existingResult.rows[0]) {
        const { BaseRepository } = await import('./repositories/baseRepository');
        const br = new BaseRepository('leads');
        lead = (br as any).rowToEntity(existingResult.rows[0]);
        logger.info(`[Email] Tìm thấy lead ${lead.id} cho ${fromEmail}`);
      } else {
        lead = await leadRepository.create(tenantId, {
          name: senderName,
          phone: '',
          email: fromEmail,
          source: 'Email',
          stage: 'NEW',
          tags: ['Email'],
        });
        logger.info(`[Email] Tạo lead mới ${lead.id} từ ${fromEmail}`);
      }
    } catch (err) {
      logger.error('[Email] Lỗi tra cứu/tạo lead:', err);
      return;
    }
    const content = subject
      ? `**${subject}**\n\n${body || ''}`
      : (body || '[Email không có nội dung]');
    try {
      const savedInteraction = await interactionRepository.create(tenantId, {
        leadId: lead.id,
        channel: 'EMAIL',
        direction: 'INBOUND',
        type: 'TEXT',
        content: content.slice(0, 5000),
        externalEventId: eventKey,
        metadata: {
          platform: 'email',
          fromEmail,
          fromName: senderName,
          subject,
          to,
        },
      });
      logger.info(`[Email] Email đến đã lưu thành interaction ${savedInteraction.id}`);
      const { recordInboundEmailReply } = await import('./services/customerCareService');
      await recordInboundEmailReply(tenantId, lead.id);
      io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
      io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Email' });
      // Auto-reply qua Email (Brevo)
      const emailBody = subject ? `${body || ''}` : (body || '');
      await triggerWebhookAutoReply(
        io,
        tenantId,
        lead,
        emailBody || subject || content,
        'EMAIL',
        savedInteraction.id,
        'email',
        eventKey,
      );
      await markWebhookProcessed(tenantId, 'email', eventKey);
    } catch (err) {
      logger.error('[Email] Không thể tạo interaction:', err);
      throw err;
    }
  }
}
// ---------------------------------------------------------------------------
// Khởi động in-memory worker (dùng khi QStash chưa được cấu hình)
// ---------------------------------------------------------------------------
export function setupWebhookWorker(io: Server) {
  const processJob = (job: any) => processWebhookJob(io, job);
  inMemoryProcessor = processJob;
  while (inMemoryJobs.length > 0) {
    const job = inMemoryJobs.shift();
    runWithRetry(job);
  }
  if (!outboundRecoveryTimer) {
    outboundRecoveryTimer = setInterval(() => {
      void recoverStaleOutboundDeliveries(io);
    }, 60_000);
    outboundRecoveryTimer.unref?.();
    void recoverStaleOutboundDeliveries(io);
  }
  return {
    on: () => {},
    close: async () => {
      if (outboundRecoveryTimer) {
        clearInterval(outboundRecoveryTimer);
        outboundRecoveryTimer = null;
      }
    },
  };
}