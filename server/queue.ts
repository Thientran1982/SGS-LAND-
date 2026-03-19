import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Server } from 'socket.io';
import { logger } from './middleware/logger';
import { DEFAULT_TENANT_ID } from './constants';

const redisUrl = process.env.REDIS_URL;
const useRedis = !!redisUrl;

let connection: any;
export let webhookQueue: any;

const inMemoryJobs: any[] = [];
let inMemoryProcessor: ((job: any) => Promise<void>) | null = null;

if (useRedis) {
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', (err: any) => {
    logger.error('Redis connection error in queue:', err);
  });
  webhookQueue = new Queue('webhook-events', { connection });
  webhookQueue.on('error', (err: any) => {
    logger.error('Webhook queue error:', err);
  });
} else {
  console.log("No REDIS_URL provided, using in-memory mock queue.");
  webhookQueue = {
    add: async (name: string, data: any) => {
      const job = { name, data, id: `mock-${Date.now()}` };
      if (inMemoryProcessor) {
        setTimeout(() => inMemoryProcessor!(job).catch((e) => logger.error('Job processing error', e)), 0);
      } else {
        inMemoryJobs.push(job);
      }
      return job;
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up or create a lead by social channel ID.
 * Returns the lead entity (existing or newly created).
 */
async function upsertLeadBySocialId(
  tenantId: string,
  channel: 'zalo' | 'facebook',
  socialId: string,
  displayName?: string
): Promise<any> {
  const { leadRepository } = await import('./repositories/leadRepository');

  // 1. Try to find existing lead with this social ID
  const existing = await leadRepository.findBySocialId(tenantId, channel, socialId);
  if (existing) return existing;

  // 2. Not found → create a new lead
  const sourceName = channel === 'zalo' ? 'Zalo' : 'Facebook';
  const name = displayName?.trim() || `${sourceName} User`;

  const lead = await leadRepository.create(tenantId, {
    name,
    phone: '',           // No phone number from social channels
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

      // recipient.id = OA ID → use it to find the correct tenant
      const oaId = recipient?.id as string | undefined;

      let tenantId = DEFAULT_TENANT_ID;
      if (oaId) {
        const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
        const found = await enterpriseConfigRepository.findTenantByZaloOaId(oaId);
        if (found) tenantId = found;
      }

      const senderId = sender?.id as string | undefined;
      if (!senderId) {
        logger.warn('[Zalo Webhook] Missing sender.id in payload');
        return;
      }

      // Handle: new follower → create lead
      if (event_name === 'follow') {
        await upsertLeadBySocialId(tenantId, 'zalo', senderId, sender?.display_name);
        logger.info(`[Zalo] New follower ${senderId} → lead created/found`);
        return;
      }

      // Handle: text message
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
        io.emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Zalo' });

        // AI scoring (non-blocking)
        try {
          const { aiService } = await import('./ai');
          const scoreResult = await aiService.scoreLead({ name: lead.name, source: 'Zalo' }, textContent);
          if (scoreResult) {
            const { leadRepository } = await import('./repositories/leadRepository');
            await leadRepository.update(tenantId, leadId, {
              score: { score: scoreResult.score || scoreResult.totalScore, grade: scoreResult.grade, reasoning: scoreResult.reasoning },
            });
            io.emit('lead_scored', { leadId, score: scoreResult });
          }
        } catch (err) {
          logger.error('[Zalo] AI scoring error:', err);
        }
      }

      // Handle: image message
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
        io.emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Zalo' });
      }
    }

    // -----------------------------------------------------------------------
    // FACEBOOK
    // -----------------------------------------------------------------------
    else if (platform === 'facebook') {
      const { object, entry } = payload;
      if (object !== 'page' || !Array.isArray(entry)) return;

      for (const pageEntry of entry) {
        // pageEntry.id = Page ID → use it to find the correct tenant
        const pageId = pageEntry.id as string | undefined;

        let tenantId = DEFAULT_TENANT_ID;
        if (pageId) {
          const { enterpriseConfigRepository } = await import('./repositories/enterpriseConfigRepository');
          const found = await enterpriseConfigRepository.findTenantByFacebookPageId(pageId);
          if (found) tenantId = found;
        }

        const messagingEvents: any[] = pageEntry.messaging || [];

        for (const webhookEvent of messagingEvents) {
          const senderId = webhookEvent.sender?.id as string | undefined;
          if (!senderId || senderId === pageId) continue; // skip echoes from the page itself

          // Text message
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
            io.emit('new_inbound_message', { leadId, message: savedInteraction, source: 'Facebook' });

            // AI scoring (non-blocking)
            try {
              const { aiService } = await import('./ai');
              const scoreResult = await aiService.scoreLead({ name: lead.name, source: 'Facebook' }, messageText);
              if (scoreResult) {
                const { leadRepository } = await import('./repositories/leadRepository');
                await leadRepository.update(tenantId, leadId, {
                  score: { score: scoreResult.score || scoreResult.totalScore, grade: scoreResult.grade, reasoning: scoreResult.reasoning },
                });
                io.emit('lead_scored', { leadId, score: scoreResult });
              }
            } catch (err) {
              logger.error('[Facebook] AI scoring error:', err);
            }
          }

          // Image/attachment message
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
            io.emit('new_inbound_message', { leadId: lead.id, message: savedInteraction, source: 'Facebook' });
          }

          // Postback (button clicks)
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
  };

  if (useRedis) {
    const worker = new Worker('webhook-events', processJob, { connection });

    worker.on('completed', job => {
      logger.info(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });

    worker.on('error', (err) => {
      logger.error('Webhook worker error:', err);
    });

    return worker;
  } else {
    inMemoryProcessor = processJob;
    while (inMemoryJobs.length > 0) {
      const job = inMemoryJobs.shift();
      setTimeout(() => inMemoryProcessor!(job).catch((e) => logger.error('Job error', e)), 0);
    }
    return {
      on: () => {},
      close: async () => {}
    };
  }
}
