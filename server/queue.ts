import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Server } from 'socket.io';
import { logger } from './middleware/logger';

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

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function setupWebhookWorker(io: Server) {
  const processJob = async (job: any) => {
    const { platform, payload } = job.data;
    
    if (platform === 'zalo') {
      const { sender, message, timestamp, event_name } = payload;
      if (event_name === 'user_send_text') {
        const leadId = sender?.id || `zalo_${Date.now()}`;
        const textContent = message?.text;

        let savedInteraction: any = null;
        try {
          const { interactionRepository } = await import('./repositories/interactionRepository');
          savedInteraction = await interactionRepository.create(DEFAULT_TENANT_ID, {
            leadId,
            channel: 'ZALO',
            direction: 'INBOUND',
            type: 'TEXT',
            content: textContent,
            metadata: { platform: 'zalo', senderId: sender?.id },
          });
          logger.info(`Zalo message persisted for lead ${leadId}`);
        } catch (err) {
          logger.error('Failed to persist Zalo message to DB', err);
        }

        const newInteraction = savedInteraction || {
          id: `msg_${Date.now()}`,
          leadId,
          channel: 'ZALO',
          direction: 'INBOUND',
          type: 'TEXT',
          content: textContent,
          timestamp: new Date(parseInt(timestamp) || Date.now()).toISOString(),
          status: 'DELIVERED'
        };

        io.to(leadId).emit("receive_message", { room: leadId, message: newInteraction, isWebhook: true });
        io.emit("new_inbound_message", { leadId, message: newInteraction });

        try {
          const { aiService } = await import('./ai');
          const scoreResult = await aiService.scoreLead({ name: 'Zalo User', source: 'Zalo' }, textContent);
          io.emit("lead_scored", { leadId, score: scoreResult });

          if (scoreResult && leadId) {
            try {
              const { leadRepository } = await import('./repositories/leadRepository');
              await leadRepository.update(DEFAULT_TENANT_ID, leadId, {
                score: scoreResult.score || scoreResult.totalScore,
                scoreGrade: scoreResult.grade,
              }, 'ADMIN');
            } catch (e) {
              logger.warn(`Could not persist webhook AI score for lead ${leadId}`);
            }
          }
        } catch (err) {
          logger.error("AI Scoring Error:", err);
        }
      }
    } else if (platform === 'facebook') {
      const { object, entry } = payload;
      if (object === 'page') {
        for (const pageEntry of entry) {
          const webhookEvent = pageEntry.messaging?.[0];
          if (!webhookEvent) continue;
          
          const senderId = webhookEvent.sender?.id;
          const messageText = webhookEvent.message?.text;

          if (messageText && senderId) {
            const leadId = senderId;

            let savedInteraction: any = null;
            try {
              const { interactionRepository } = await import('./repositories/interactionRepository');
              savedInteraction = await interactionRepository.create(DEFAULT_TENANT_ID, {
                leadId,
                channel: 'FACEBOOK',
                direction: 'INBOUND',
                type: 'TEXT',
                content: messageText,
                metadata: { platform: 'facebook', senderId },
              });
              logger.info(`Facebook message persisted for lead ${leadId}`);
            } catch (err) {
              logger.error('Failed to persist Facebook message to DB', err);
            }

            const newInteraction = savedInteraction || {
              id: `msg_${Date.now()}`,
              leadId,
              channel: 'FACEBOOK',
              direction: 'INBOUND',
              type: 'TEXT',
              content: messageText,
              timestamp: new Date().toISOString(),
              status: 'DELIVERED'
            };

            io.to(leadId).emit("receive_message", { room: leadId, message: newInteraction, isWebhook: true });
            io.emit("new_inbound_message", { leadId, message: newInteraction });

            try {
              const { aiService } = await import('./ai');
              const scoreResult = await aiService.scoreLead({ name: 'Facebook User', source: 'Facebook' }, messageText);
              io.emit("lead_scored", { leadId, score: scoreResult });

              if (scoreResult && leadId) {
                try {
                  const { leadRepository } = await import('./repositories/leadRepository');
                  await leadRepository.update(DEFAULT_TENANT_ID, leadId, {
                    score: scoreResult.score || scoreResult.totalScore,
                    scoreGrade: scoreResult.grade,
                  }, 'ADMIN');
                } catch (e) {
                  logger.warn(`Could not persist Facebook webhook AI score for lead ${leadId}`);
                }
              }
            } catch (err) {
              logger.error("AI Scoring Error:", err);
            }
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
