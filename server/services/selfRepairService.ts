import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { logger } from '../middleware/logger';

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

