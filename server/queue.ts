import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Server } from 'socket.io';

const redisUrl = process.env.REDIS_URL;
const useRedis = !!redisUrl;

let connection: any;
export let webhookQueue: any;

// Simple in-memory queue for when Redis is not available
const inMemoryJobs: any[] = [];
let inMemoryProcessor: ((job: any) => Promise<void>) | null = null;

if (useRedis) {
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', (err: any) => {
    console.error('Redis connection error in queue:', err.message);
  });
  webhookQueue = new Queue('webhook-events', { connection });
  webhookQueue.on('error', (err: any) => {
    console.error('Webhook queue error:', err.message);
  });
} else {
  console.log("No REDIS_URL provided, using in-memory mock queue.");
  webhookQueue = {
    add: async (name: string, data: any) => {
      const job = { name, data, id: `mock-${Date.now()}` };
      if (inMemoryProcessor) {
        setTimeout(() => inMemoryProcessor!(job).catch(console.error), 0);
      } else {
        inMemoryJobs.push(job);
      }
      return job;
    }
  };
}

export function setupWebhookWorker(io: Server) {
  const processJob = async (job: any) => {
    const { platform, payload } = job.data;
    
    if (platform === 'zalo') {
      const { sender, message, timestamp, event_name } = payload;
      if (event_name === 'user_send_text') {
        const leadId = sender?.id || `zalo_${Date.now()}`;
        const textContent = message?.text;

        const newInteraction = {
          id: `msg_${Date.now()}`,
          leadId: leadId,
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
        } catch (err) {
          console.error("AI Scoring Error:", err);
        }
      }
    } else if (platform === 'facebook') {
      const { object, entry } = payload;
      if (object === 'page') {
        for (const pageEntry of entry) {
          const webhookEvent = pageEntry.messaging[0];
          const senderId = webhookEvent.sender.id;
          const messageText = webhookEvent.message?.text;

          if (messageText) {
            const leadId = senderId;
            const newInteraction = {
              id: `msg_${Date.now()}`,
              leadId: leadId,
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
            } catch (err) {
              console.error("AI Scoring Error:", err);
            }
          }
        }
      }
    }
  };

  if (useRedis) {
    const worker = new Worker('webhook-events', processJob, { connection });

    worker.on('completed', job => {
      console.log(`Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed with ${err.message}`);
    });

    worker.on('error', (err) => {
      console.error('Webhook worker error:', err.message);
    });

    return worker;
  } else {
    inMemoryProcessor = processJob;
    // Process any jobs that were added before the processor was attached
    while (inMemoryJobs.length > 0) {
      const job = inMemoryJobs.shift();
      setTimeout(() => inMemoryProcessor!(job).catch(console.error), 0);
    }
    return {
      on: () => {},
      close: async () => {}
    };
  }
}
