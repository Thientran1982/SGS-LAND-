import { logger } from '../middleware/logger';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';

type EventHandler = (event: any) => Promise<void>;
const handlers = new Map<string, EventHandler>();

export function registerAgentEventHandler(eventType: string, handler: EventHandler) {
  handlers.set(eventType, handler);
}

export async function processAgentEvents(tenantId: string, limit = 25) {
  const events = await agentOperatingRepository.claimEvents(tenantId, limit);
  const results: Array<{ id: string; status: string }> = [];
  for (const event of events) {
    const handler = handlers.get(event.event_type);
    try {
      if (!handler) throw new Error(`NO_AGENT_EVENT_HANDLER:${event.event_type}`);
      await handler(event);
      await agentOperatingRepository.finishEvent(tenantId, event.id, 'DONE');
      results.push({ id: event.id, status: 'DONE' });
    } catch (error: any) {
      const status = Number(event.attempts) >= 3 ? 'DEAD_LETTER' : 'FAILED';
      await agentOperatingRepository.finishEvent(tenantId, event.id, status, error?.message || String(error));
      logger.warn(`[AgentDaemon] ${status} event=${event.event_id} type=${event.event_type}`);
      results.push({ id: event.id, status });
    }
  }
  return results;
}