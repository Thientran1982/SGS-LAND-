import { logger } from '../middleware/logger';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';

type EventHandler = (event: any) => Promise<void>;
const handlers = new Map<string, EventHandler>();
const MAX_ATTEMPTS = 5;
let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;
let operatorIo: any = null;

export function setAgentOperatorIo(io: any) {
  operatorIo = io;
}

export function registerAgentEventHandler(eventType: string, handler: EventHandler) {
  handlers.set(eventType, handler);
}

export async function processAgentEvents(tenantId: string, limit = 25) {
  const events = await agentOperatingRepository.claimEvents(tenantId, limit);
  const results: Array<{ id: string; status: string }> = [];
  for (const event of events) {
    const handler = handlers.get(event.event_type);
    const heartbeat = setInterval(() => {
      agentOperatingRepository.heartbeatEvent(event.tenant_id, event.id, event.lease_token)
        .then(alive => {
          if (!alive) logger.warn(`[AgentDaemon] event lease lost while processing event=${event.event_id}`);
        })
        .catch(error => logger.warn(`[AgentDaemon] event heartbeat failed event=${event.event_id}: ${error?.message || error}`));
    }, 30_000);
    heartbeat.unref?.();
    try {
      if (!handler) throw new Error(`NO_AGENT_EVENT_HANDLER:${event.event_type}`);
      await handler(event);
      const finished = await agentOperatingRepository.finishEvent(tenantId, event.id, 'DONE', undefined, event.lease_token);
      if (!finished) {
        logger.warn(`[AgentDaemon] lease lost event=${event.event_id}; success ignored`);
        continue;
      }
      results.push({ id: event.id, status: 'DONE' });
    } catch (error: any) {
      const status = Number(event.attempts) >= MAX_ATTEMPTS ? 'DEAD_LETTER' : 'FAILED';
      const finished = await agentOperatingRepository.finishEvent(
        tenantId, event.id, status, error?.message || String(error), event.lease_token,
      );
      if (!finished) {
        logger.warn(`[AgentDaemon] lease lost event=${event.event_id}; result ignored`);
        continue;
      }
      logger.warn(`[AgentDaemon] ${status} event=${event.event_id} type=${event.event_type}`);
      results.push({ id: event.id, status });
    }
    finally {
      clearInterval(heartbeat);
    }
  }
  return results;
}

/** Default bridge: real inbox/live-chat events use the existing durable chat runner. */
registerAgentEventHandler('INBOUND_MESSAGE', async event => {
  const { triggerAutoReply } = await import('../queue');
  const payload = event.payload_json || {};
  if (!operatorIo) throw new Error('AGENT_OPERATOR_IO_NOT_READY');
  await triggerAutoReply(operatorIo, event.tenant_id, payload.lead, payload.inboundText, payload.channel, payload.inboundEventId, true);
});

registerAgentEventHandler('LIVE_CHAT_MESSAGE', async event => {
  const { liveChatEngine } = await import('../ai/liveChatEngine');
  const payload = event.payload_json || {};
  await liveChatEngine.callTool('handle_live_chat', {
    ...payload,
    tenantId: event.tenant_id,
    __fromOperator: true,
    runId: payload.runId || event.event_id,
  });
});

export function startAgentOperatorWorker(getTenantIds: () => Promise<string[]>, intervalMs = 5000) {
  if (workerTimer) return { stop: stopAgentOperatorWorker };
  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      for (const tenantId of await getTenantIds()) {
        await processAgentEvents(tenantId, 25);
      }
    } catch (error: any) {
      logger.error(`[AgentDaemon] worker tick failed: ${error?.message || error}`);
    } finally {
      workerRunning = false;
    }
  };
  workerTimer = setInterval(() => void tick(), intervalMs);
  workerTimer.unref?.();
  void tick();
  return { stop: stopAgentOperatorWorker };
}

export function stopAgentOperatorWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}