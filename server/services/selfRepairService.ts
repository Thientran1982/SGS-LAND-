import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { logger } from '../middleware/logger';
import { agentMemoryService, scrubPii } from './agentMemoryService';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { createHash } from 'crypto';

function normalizeErrorPattern(value: unknown): string {
  return scrubPii(value)
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function parseEventPayload(value: unknown): Record<string, any> {
  if (value && typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function validLeadId(value: unknown): string | null {
  const candidate = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

/**
 * SELF-REPAIR LOOP — Vòng tự sửa chữa sự kiện (Pha 0).
 * Mỗi 15 phút: quét event DEAD_LETTER/FAILED.
 *  - Nếu nguyên nhân là handler đã được bổ sung sau này (NO_AGENT_EVENT_HANDLER đã fix)
 *    → tự replay (idempotent + có history) — KHÔNG tự áp patch code.
 *  - Nếu là lỗi khác → ghi memory triage để người/agent xem, KHÔNG tự ý retry vô hạn.
 */
export async function selfRepairTick(tenantId: string): Promise<{ replayed: number; triaged: number }> {
  let replayed = 0;
  let triaged = 0;
  try {
    const rows = await agentOperatingRepository.listEvents(tenantId, {
      deadLetter: 'YES', limit: 50,
    } as any);
    for (const ev of (rows as any[])) {
      const err = String(ev.last_error || '');
      if (err.includes('NO_AGENT_EVENT_HANDLER')) {
        const r = await agentOperatingRepository.replayEvent(
          tenantId, ev.id,
          'self-repair: handler đã được đăng ký sau khi event dead-letter', '00000000-0000-0000-0000-0000000000aa',
        );
        if (r) { replayed++; logger.info('[SelfRepair] replayed ' + ev.event_type + ' id=' + ev.id); }
      } else {
        triaged++;
        try {
          await agentMemoryService.remember(
            tenantId,
            'agent:lessons',
            `repair-triage:${ev.id}`,
            scrubPii(`${ev.event_type}: ${err || 'unknown error'}`).replace(/\s+/g, ' ').trim().slice(0, 1800),
            'procedural',
            0.5,
          );
        } catch (memoryError: any) {
          logger.warn(`[SelfRepair] triage memory skipped event=${ev.id}: ${memoryError?.message || memoryError}`);
        }
      }
    }
    const byPattern = new Map<string, any[]>();
    for (const ev of (rows as any[])) {
      const pattern = normalizeErrorPattern(ev.last_error);
      if (!pattern) continue;
      const group = byPattern.get(pattern) || [];
      group.push(ev);
      byPattern.set(pattern, group);
    }
    for (const [pattern, events] of byPattern) {
      if (events.length < 3) continue;
      const patternId = createHash('sha256').update(pattern).digest('hex').slice(0, 24);
      try {
        await agentMemoryService.recordSignal(tenantId, {
          signalType: 'repair_spike_detected',
          subjectType: 'agent_operating_error',
          subjectId: patternId,
          dedupeKey: `repair_spike_detected:${patternId}`,
          provenance: 'system',
          payload: {
            count: events.length,
            pattern,
            eventIds: events.slice(0, 20).map(event => String(event.id)),
          },
        });
        const leadId = events
          .map(event => {
            const payload = parseEventPayload(event.payload_json);
            return validLeadId(payload.leadId || payload.lead_id || payload.context?.leadId);
          })
          .find(Boolean) || null;
        if (leadId) {
          await approvalRequestRepository.create({
            tenantId,
            leadId,
            channel: 'INTERNAL',
            actionType: 'REVIEW_REPAIR_SPIKE',
            payload: {
              signalType: 'repair_spike_detected',
              pattern,
              count: events.length,
              eventIds: events.slice(0, 20).map(event => String(event.id)),
            },
            reasoning: 'Dead-letter error pattern repeated at least three times; human review required.',
            idempotencyKey: `repair-spike:${patternId}:${leadId}`,
          });
        } else {
          await agentOperatingRepository.createHumanQuestion(tenantId, {
            agentKey: 'SELF_REPAIR',
            question: `Cần người duyệt xem xét lỗi lặp ${events.length} lần trong dead-letter: ${pattern}`,
            priority: 90,
            context: {
              signalType: 'repair_spike_detected',
              pattern,
              eventIds: events.slice(0, 20).map(event => String(event.id)),
            },
          });
        }
        logger.warn(`[SelfRepair] repair spike detected tenant=${tenantId} count=${events.length} pattern=${patternId}`);
      } catch (spikeError: any) {
        logger.warn(`[SelfRepair] repair spike review skipped: ${spikeError?.message || spikeError}`);
      }
    }
  } catch (err: any) {
    logger.warn('[SelfRepair] tick failed: ' + (err?.message || err));
  }
  return { replayed, triaged };
}

let repairTimer: any = null;

export function startSelfRepairLoop(getTenantIds: () => Promise<string[]>, intervalMs = 15 * 60 * 1000) {
  if (repairTimer) return { stop: stopSelfRepairLoop };
  const tick = async () => {
    try {
      for (const tid of await getTenantIds()) await selfRepairTick(tid);
    } catch (err: any) {
      logger.warn('[SelfRepair] loop failed: ' + (err?.message || err));
    }
  };
  repairTimer = setInterval(() => void tick(), intervalMs);
  repairTimer.unref?.();
  void tick();
  return { stop: stopSelfRepairLoop };
}

export function stopSelfRepairLoop() {
  if (repairTimer) clearInterval(repairTimer);
  repairTimer = null;
}

