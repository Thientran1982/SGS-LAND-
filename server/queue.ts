import { Server } from 'socket.io';
import { logger } from './middleware/logger';

// ---------------------------------------------------------------------------
// Queue — Upstash REST (production) or in-memory (dev/fallback)
//
// Upstash does not support TCP pub/sub (BullMQ), so we use the REST API
// for distributed rate limiting and fall back to in-memory job processing.
// For true distributed job queues, upgrade to Upstash QStash.
// ---------------------------------------------------------------------------

const inMemoryJobs: any[] = [];
let inMemoryProcessor: ((job: any) => Promise<void>) | null = null;

const MAX_IN_MEMORY_ATTEMPTS = 3;
const IN_MEMORY_BACKOFF_MS = 2000;

function runWithRetry(job: any, attempt = 1): void {
  setTimeout(async () => {
    try {
      await inMemoryProcessor!(job);
    } catch (err: any) {
      if (attempt < MAX_IN_MEMORY_ATTEMPTS) {
        const wait = IN_MEMORY_BACKOFF_MS * Math.pow(2, attempt - 1);
        logger.warn(`[Queue] Job ${job.id} attempt ${attempt} failed: ${err.message}. Retrying in ${wait}ms…`);
        runWithRetry(job, attempt + 1);
      } else {
        logger.error(`[Queue] Job ${job.id} permanently failed after ${MAX_IN_MEMORY_ATTEMPTS} attempts`, err);
      }
    }
  }, attempt === 1 ? 0 : IN_MEMORY_BACKOFF_MS * Math.pow(2, attempt - 2));
}

console.log("Using in-memory job queue (Upstash REST does not support BullMQ TCP pub/sub).");

export const webhookQueue = {
  add: async (name: string, data: any) => {
    const job = { name, data, id: `job-${Date.now()}` };
    if (inMemoryProcessor) {
      runWithRetry(job);
    } else {
      inMemoryJobs.push(job);
    }
    return job;
  },
  close: async () => {},
};

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

  logger.info(`[Webhook] Created new lead ${lead.id} from ${sourceName} (socialId: ${socialId})`);
  return lead;
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

export function setupWebhookWorker(io: Server) {
  const processJob = async (job: any) => {
    const { platform, payload } = job.data;

    // -----------------------------------------------------------------------
    // ZALO
    // -----------------------------------------------------------------------
    if (platform === 'zalo') {
      const { event_name, sender, recipient, message, timestamp } = payload;

      const oaId = recipient?.id as string | undefined;
      if (!oaId) {
        logger.warn('[Zalo Webhook] Missing recipient.id (OA ID), cannot resolve tenant — dropping event');
        return;
      }

      const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
      const foundTenant = await enterpriseConfigRepository.findTenantByZaloOaId(oaId);
      if (!foundTenant) {
        logger.warn(`[Zalo Webhook] OA ID ${oaId} not registered to any tenant — dropping event`);
        return;
      }
      const tenantId = foundTenant;

      const senderId = sender?.id as string | undefined;
      if (!senderId) {
        logger.warn('[Zalo Webhook] Missing sender.id in payload');
        return;
      }

      if (event_name === 'follow') {
        await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
        logger.info(`[Zalo] New follower ${senderId} → lead created/found`);
        return;
      }

      if (event_name === 'user_send_text') {
        const textContent = message?.text as string;
        if (!textContent) return;

        const lead = await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
        const leadId = lead.id;

        const { interactionRepository } = await import('./repositories/interactionRepository');
        const savedInteraction = await interactionRepository.create(tenantId, {
          leadId,
          channel: 'ZALO',
          direction: 'INBOUND',
          type: 'TEXT',
          content: textContent,
          metadata: {
            platform: 'zalo',
            senderId,
            oaId,
            originalTimestamp: timestamp,
          },
        });

        logger.info(`[Zalo] Message from ${senderId} → lead ${leadId}`);

        io.to(leadId).emit('receive_message', { room: leadId, message: savedInteraction, isWebhook: true });
        io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Zalo' });

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
            logger.error('[Zalo] AI scoring error:', err);
          }
        })();
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
          metadata: { platform: 'zalo', senderId, oaId, imageUrl: imgUrl },
        });

        io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
        io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Zalo' });
      }
    }

    // -----------------------------------------------------------------------
    // FACEBOOK
    // -----------------------------------------------------------------------
    else if (platform === 'facebook') {
      const { object, entry } = payload;
      if (object !== 'page' || !Array.isArray(entry)) return;

      for (const pageEntry of entry) {
        const pageId = pageEntry.id as string | undefined;
        if (!pageId) {
          logger.warn('[Facebook Webhook] Missing pageEntry.id, cannot resolve tenant — skipping entry');
          continue;
        }

        const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
        const foundTenant = await enterpriseConfigRepository.findTenantByFacebookPageId(pageId);
        if (!foundTenant) {
          logger.warn(`[Facebook Webhook] Page ID ${pageId} not registered to any tenant — skipping entry`);
          continue;
        }
        const tenantId = foundTenant;

        const messagingEvents: any[] = pageEntry.messaging || [];

        for (const webhookEvent of messagingEvents) {
          const senderId = webhookEvent.sender?.id as string | undefined;
          if (!senderId || senderId === pageId) continue;

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
              metadata: {
                platform: 'facebook',
                senderId,
                pageId,
                mid: webhookEvent.message?.mid,
              },
            });

            logger.info(`[Facebook] Message from ${senderId} → lead ${leadId}`);

            io.to(leadId).emit('receive_message', { room: leadId, message: savedInteraction, isWebhook: true });
            io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Facebook' });

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
                logger.error('[Facebook] AI scoring error:', err);
              }
            })();
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
              metadata: { platform: 'facebook', senderId, pageId, attachmentType: attachment.type },
            });

            io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
            io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Facebook' });
          }

          const postback = webhookEvent.postback;
          if (postback) {
            const lead = await upsertLeadBySocialId(tenantId, 'facebook', senderId);
            const { interactionRepository } = await import('./repositories/interactionRepository');
            await interactionRepository.create(tenantId, {
              leadId: lead.id,
              channel: 'FACEBOOK',
              direction: 'INBOUND',
              type: 'TEXT',
              content: postback.title || postback.payload || '[Postback]',
              metadata: { platform: 'facebook', senderId, pageId, postbackPayload: postback.payload },
            });
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // EMAIL INBOUND
    // -----------------------------------------------------------------------
    else if (platform === 'email') {
      const { from, fromName, subject, body, to, tenantId: payloadTenantId } = payload;

      if (!from) {
        logger.warn('[Email Webhook] Missing from address');
        return;
      }

      if (!payloadTenantId) {
        logger.warn('[Email Webhook] Missing tenantId in payload — dropping event');
        return;
      }
      const tenantId = payloadTenantId;

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
          logger.info(`[Email] Matched existing lead ${lead.id} for ${fromEmail}`);
        } else {
          lead = await leadRepository.create(tenantId, {
            name: senderName,
            phone: '',
            email: fromEmail,
            source: 'Email',
            stage: 'NEW',
            tags: ['Email'],
          });
          logger.info(`[Email] Created new lead ${lead.id} from ${fromEmail}`);
        }
      } catch (err) {
        logger.error('[Email] Lead lookup/create error:', err);
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
          metadata: {
            platform: 'email',
            fromEmail,
            fromName: senderName,
            subject,
            to,
          },
        });

        logger.info(`[Email] Inbound email stored as interaction ${savedInteraction.id}`);

        io.to(lead.id).emit('receive_message', { room: lead.id, message: savedInteraction, isWebhook: true });
        io.to(`tenant:${tenantId}`).emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Email' });
      } catch (err) {
        logger.error('[Email] Failed to create interaction:', err);
      }
    }
  };

  inMemoryProcessor = processJob;
  while (inMemoryJobs.length > 0) {
    const job = inMemoryJobs.shift();
    runWithRetry(job);
  }
  return {
    on: () => {},
    close: async () => {},
  };
}
