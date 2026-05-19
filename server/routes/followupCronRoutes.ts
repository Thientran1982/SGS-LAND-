/**
 * followupCronRoutes.ts
 *
 * Hourly cron endpoint for the multi-channel follow-up agent system.
 *
 * POST /api/internal/followup-cron
 *   — Called by QStash every hour (or internal setInterval as fallback).
 *   — Finds PENDING sends where NOW() >= seq.created_at + (day_number || ' days')
 *   — Dispatches via Zalo → SMS → Email cascade.
 *   — Marks sends as SENT, FAILED, or SKIPPED.
 *   — Completes parent sequence when all 4 sends are resolved.
 *
 * Security: X-Internal-Secret header (shared with other cron endpoints).
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { startAgentRun, finishAgentRun } from '../services/agentRunsService';
import { followupSequenceRepository } from '../repositories/followupSequenceRepository';
import { dispatchFollowUp } from '../services/followupDispatchService';

// ── Router factory ────────────────────────────────────────────────────────────

export function createFollowUpCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/followup-cron', async (req: Request, res: Response) => {
    const providedSecret =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!providedSecret || providedSecret !== cronSecret) {
      logger.warn('[FollowUpCron] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dryRun = req.body?.dry_run === true;
    const startedMs = Date.now();
    const runId = await startAgentRun(
      pool,
      'followup-cron',
      dryRun ? 'manual_dry_run' : 'qstash',
    );

    logger.info(
      `[FollowUpCron] Bắt đầu${dryRun ? ' (dry-run)' : ''} — ${new Date().toISOString()}`,
    );

    const stats = {
      queried: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      byDay: { 1: 0, 3: 0, 5: 0, 7: 0 } as Record<number, number>,
      byChannel: { ZALO: 0, SMS: 0, EMAIL: 0 } as Record<string, number>,
    };

    try {
      const dueSends = await followupSequenceRepository.getDueSends(pool);
      stats.queried = dueSends.length;

      logger.info(`[FollowUpCron] ${dueSends.length} sends cần xử lý`);

      for (const send of dueSends) {
        const day = send.day_number as 1 | 3 | 5 | 7;

        if (dryRun) {
          logger.info(
            `[FollowUpCron][DRY] sendId=${send.id} day=${day} lead=${send.lead_id}`,
          );
          stats.sent++;
          continue;
        }

        try {
          const result = await dispatchFollowUp(pool, send.tenant_id, send.id, day, {
            leadName: send.seq_lead_name,
            leadPhone: send.seq_lead_phone,
            leadEmail: send.seq_lead_email,
            leadZaloId: send.seq_lead_zalo_id,
          });

          if (result.success && result.channel) {
            await followupSequenceRepository.markSent(pool, send.id, result.channel, result.message);
            stats.sent++;
            stats.byDay[day] = (stats.byDay[day] || 0) + 1;
            stats.byChannel[result.channel] = (stats.byChannel[result.channel] || 0) + 1;
          } else if (!result.channel) {
            // No channel available → skip gracefully
            await followupSequenceRepository.markSkipped(
              pool,
              send.id,
              result.error || 'no_channel',
            );
            stats.skipped++;
          } else {
            await followupSequenceRepository.markFailed(
              pool,
              send.id,
              result.error || 'dispatch_failed',
            );
            stats.failed++;
          }

          // Check if entire sequence is now done
          await followupSequenceRepository.tryCompleteSequence(pool, send.sequence_id);
        } catch (err: any) {
          logger.error(
            `[FollowUpCron] sendId=${send.id} exception: ${err.message}`,
          );
          await followupSequenceRepository.markFailed(pool, send.id, err.message).catch(() => {});
          stats.failed++;
        }
      }
    } catch (err: any) {
      logger.error('[FollowUpCron] Fatal error:', err);
      await finishAgentRun(pool, runId, 'failed', {
        error: err.message,
        durationMs: Date.now() - startedMs,
      });
      return res.status(500).json({ error: err.message });
    }

    const durationMs = Date.now() - startedMs;
    await finishAgentRun(pool, runId, 'success', { stats, durationMs });

    logger.info(
      `[FollowUpCron] Hoàn tất — sent=${stats.sent} failed=${stats.failed} skipped=${stats.skipped} (${durationMs}ms)`,
    );

    return res.json({
      ok: true,
      dryRun,
      stats,
      durationMs,
    });
  });

  return router;
}

// ── In-process setInterval fallback ──────────────────────────────────────────

let followupIntervalHandle: ReturnType<typeof setInterval> | null = null;

export function startFollowUpCron(pool: Pool, cronSecret: string): void {
  if (followupIntervalHandle) return;

  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  const tick = async () => {
    try {
      const dueSends = await followupSequenceRepository.getDueSends(pool);
      if (dueSends.length === 0) return;

      logger.info(`[FollowUpCron][in-process] ${dueSends.length} sends cần xử lý`);
      for (const send of dueSends) {
        const day = send.day_number as 1 | 3 | 5 | 7;
        try {
          const result = await dispatchFollowUp(pool, send.tenant_id, send.id, day, {
            leadName: send.seq_lead_name,
            leadPhone: send.seq_lead_phone,
            leadEmail: send.seq_lead_email,
            leadZaloId: send.seq_lead_zalo_id,
          });
          if (result.success && result.channel) {
            await followupSequenceRepository.markSent(pool, send.id, result.channel, result.message);
          } else if (!result.channel) {
            await followupSequenceRepository.markSkipped(pool, send.id, result.error || 'no_channel');
          } else {
            await followupSequenceRepository.markFailed(pool, send.id, result.error || 'failed');
          }
          await followupSequenceRepository.tryCompleteSequence(pool, send.sequence_id);
        } catch (err: any) {
          logger.error(`[FollowUpCron][in-process] sendId=${send.id}: ${err.message}`);
          await followupSequenceRepository.markFailed(pool, send.id, err.message).catch(() => {});
        }
      }
    } catch (err: any) {
      logger.error('[FollowUpCron][in-process] tick error:', err.message);
    }
  };

  // Run once immediately then on interval
  tick().catch(() => {});
  followupIntervalHandle = setInterval(tick, INTERVAL_MS);
  logger.info('[FollowUpCron] In-process cron khởi động (mỗi 1 giờ)');
}
