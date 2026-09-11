import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { logger } from '../middleware/logger';
import { agentMemoryService, scrubPii } from './agentMemoryService';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { agentExecutionRepository } from '../repositories/agentExecutionRepository';
import { createHash } from 'crypto';
import { withTenantContext } from '../db';

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
/**
 * Also reaps agent_executions rows stuck at RUNNING with an expired lease
 * (worker crashed without releasing the lease and nobody re-claimed it).
 */
/** P4.6 + P4.7: resume chat FAILED (transient) — retry qua idempotency key, execute boc timeout 90s. */
export async function resumeFailedChatExecutions(tenantId: string): Promise<number> {
  let resumed = 0;
  const rows = await withTenantContext(tenantId, async client => client.query(
    "SELECT id, idempotency_key, session_id, lead_id, input_json, attempt, max_steps FROM agent_executions WHERE tenant_id=$1 AND trigger_source='public-livechat' AND status='ERROR' AND attempt < max_steps AND (error_text ILIKE '%timeout%' OR error_text ILIKE '%connect%') AND updated_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 3",
    [tenantId],
  ));
  const { runDurableAgentExecution } = await import('./durableAgentExecutionService');
  const { liveChatEngine } = await import('../ai/liveChatEngine');
  const { runWithSubagentPolicy } = await import('./subagentPolicy');
  const { interactionRepository } = await import('../repositories/interactionRepository');
  for (const row of rows.rows) {
    try {
      const input = (row.input_json || {}) as { message?: string };
      const message = String(input.message || '').trim();
      if (!message || !row.lead_id) continue;
      const history = await interactionRepository.findByLead(tenantId, row.lead_id);
      const result = await runDurableAgentExecution({
        tenantId,
        idempotencyKey: row.idempotency_key,
        sessionId: row.session_id || undefined,
        leadId: row.lead_id || undefined,
        triggerSource: 'self_repair_retry',
        message,
        execute: () => runWithSubagentPolicy(
          () => liveChatEngine.callTool('handle_live_chat', {
            tenantId,
            message,
            language: 'vi',
            sessionId: row.lead_id,
            leadId: row.lead_id,
            context: {
              leadId: row.lead_id,
              leadName: '',
              language: 'vi',
              history: (history || []).slice(-8).map((item: any) => ({ role: item.direction === 'INBOUND' ? 'user' : 'assistant', content: item.content })),
            },
            __skipAgentEventEnqueue: true,
          }),
          { timeoutMs: 90_000 },
        ),
      });
      resumed++;
      logger.info('[SelfRepair] chat resumed exec=' + row.id + ' run=' + (result.runId || '-') + ' cached=' + result.cached);
    } catch (error: any) {
      logger.warn('[SelfRepair] chat resume failed exec=' + row.id + ': ' + (error?.message || error));
    }
  }
  return resumed;
}

export async function selfRepairTick(tenantId: string): Promise<{ replayed: number; triaged: number; reapedExecutions: number }> {
  let replayed = 0;
  let triaged = 0;
  let reapedExecutions = 0;
  try {
    reapedExecutions = await agentExecutionRepository.reapExpiredRunning(tenantId);
  try {    const resumedChats = await resumeFailedChatExecutions(tenantId);
    if (resumedChats > 0) logger.info("[SelfRepair] resumed " + resumedChats + " failed chat executions for tenant " + tenantId);
  } catch (resumeError: any) {
    logger.warn("[SelfRepair] chat resume loop failed: " + (resumeError?.message || resumeError));
  }
    if (reapedExecutions > 0) {
      logger.warn(`[SelfRepair] reaped ${reapedExecutions} stuck RUNNING agent_executions tenant=${tenantId}`);
    }
  } catch (reapError: any) {
    logger.warn('[SelfRepair] reap expired executions failed: ' + (reapError?.message || reapError));
  }
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
  try {
    const openQuestions = await withTenantContext(tenantId, async client => client.query(
      "SELECT question FROM agent_human_questions WHERE status = 'OPEN' AND created_at > NOW() - INTERVAL '7 days'"
    ));
    const openText = openQuestions.rows.map(row => String(row.question));
    for (const ev of (rows as any[])) {
      if (openText.some(text => text.includes(String(ev.id)))) continue;
      const summary = scrubPii(String(ev.last_error || 'unknown')).replace(/\s+/g, ' ').trim().slice(0, 300);
      await agentOperatingRepository.createHumanQuestion(tenantId, {
        agentKey: 'MINH_OPERATIONS',
        question: 'Dead-letter ' + ev.event_type + ' (id ' + ev.id + ', ' + ev.attempts + ' lan thu): ' + summary + '. De xuat: kiem tra handler, fix code hoac replay neu da fix.',
        priority: 70,
        context: { eventId: ev.id, eventType: ev.event_type, attempts: ev.attempts },
      });
    }
  } catch (questionError: any) {
    logger.warn('[SelfRepair] question sync skipped: ' + (questionError?.message || questionError));
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
  return { replayed, triaged, reapedExecutions };
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

