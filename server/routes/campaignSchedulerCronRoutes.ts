/**
 * campaignSchedulerCronRoutes.ts
 *
 * Scheduler cho campaign hẹn giờ. Có 2 driver chạy SONG SONG, dùng chung
 * `tickCampaignScheduler()`:
 *   1. POST /api/internal/campaign-scheduler-cron — gọi từ QStash (nếu còn quota).
 *   2. In-process setInterval mỗi 5 phút (`startCampaignSchedulerCron`)
 *      — fallback bền vững khi QStash quota hết, hoặc khi chạy local.
 *
 * Hai driver cùng chạy không gây race vì atomic claim
 * `UPDATE ... FOR UPDATE SKIP LOCKED + RETURNING` đảm bảo mỗi campaign
 * chỉ được pick đúng 1 lần.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { runCampaign } from '../services/campaignSenderService';
import { startAgentRun, finishAgentRun } from './../services/agentRunsService';

function publicBaseUrl(): string {
  const prod = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = prod || dev;
  return host ? `https://${host}` : 'http://localhost:5000';
}

export interface CampaignSchedulerTickResult {
  picked: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; name: string; queued: number; sent: number; failed: number; error?: string }>;
}

/**
 * Quét + chạy campaign đến hạn. Idempotent + safe khi gọi đồng thời.
 */
export async function tickCampaignScheduler(pool: Pool): Promise<CampaignSchedulerTickResult> {
  const due = await pool.query(
    `UPDATE campaigns
        SET last_run_at = NOW(),
            scheduled_at = CASE recurrence_type
              WHEN 'DAILY' THEN scheduled_at + INTERVAL '1 day'
              WHEN 'WEEKLY' THEN scheduled_at + INTERVAL '1 week'
              WHEN 'MONTHLY' THEN scheduled_at + INTERVAL '1 month'
              ELSE scheduled_at
            END
      WHERE id IN (
        SELECT id FROM campaigns
         WHERE status = 'ACTIVE'
           AND schedule_type = 'SCHEDULED'
           AND scheduled_at IS NOT NULL
           AND scheduled_at <= NOW()
           AND (last_run_at IS NULL OR recurrence_type <> 'ONCE')
         ORDER BY scheduled_at ASC
         LIMIT 50
         FOR UPDATE SKIP LOCKED
      )
       RETURNING id, name, tenant_id, recurrence_type`,
  );

  const result: CampaignSchedulerTickResult = { picked: due.rowCount || 0, sent: 0, failed: 0, results: [] };
  if (!due.rowCount) return result;

  for (const row of due.rows) {
    try {
      const r = await runCampaign(pool, row.id, publicBaseUrl());
      result.sent += r.sent;
      result.failed += r.failed;
      result.results.push({ id: row.id, name: row.name, queued: r.queued, sent: r.sent, failed: r.failed, error: r.error });

      if (!r.ok || r.failed > 0) {
        const errorMessage = r.error || (r.failed > 0 ? 'Một hoặc nhiều recipient gửi thất bại' : 'Campaign không chạy thành công');
        await pool.query(
          `UPDATE campaigns
              SET status='PAUSED', last_error=$2, updated_at=NOW()
            WHERE id=$1`,
          [row.id, errorMessage],
        );
      } else if (r.queued > 0 && row.recurrence_type === 'ONCE') {
        await pool.query(
          `UPDATE campaigns SET status='COMPLETED', updated_at=NOW() WHERE id=$1`,
          [row.id],
        );
      } else if (r.queued > 0 && row.recurrence_type !== 'ONCE') {
        logger.info(`[CampaignScheduler] ${row.name} — recurring ${row.recurrence_type}, next run scheduled`);
      }
      logger.info(`[CampaignScheduler] ${row.name} — queued=${r.queued} sent=${r.sent} failed=${r.failed}`);
    } catch (err: any) {
      result.failed++;
      await pool.query(
        `UPDATE campaigns SET status='PAUSED', last_error=$2, updated_at=NOW() WHERE id=$1`,
        [row.id, `Scheduler run failed: ${err.message}`],
      );
      result.results.push({ id: row.id, name: row.name, queued: 0, sent: 0, failed: 0, error: err.message });
      logger.error(`[CampaignScheduler] ${row.name} lỗi: ${err.message}`);
    }
  }

  return result;
}

// ── In-process driver ─────────────────────────────────────────────────────────

let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerInFlight = false;

async function runTickGuarded(pool: Pool, label: string): Promise<void> {
  if (schedulerInFlight) {
    logger.warn(`[CampaignScheduler] tick ${label} skipped — previous still in flight`);
    // Record skipped runs so leadership can see scheduler health.
    const startedMs = Date.now();
    const skipId = await startAgentRun(pool, 'campaign-scheduler', `in_process:${label}`);
    await finishAgentRun(pool, skipId, 'skipped', { reason: 'previous tick still in flight' }, null, startedMs);
    return;
  }
  schedulerInFlight = true;
  const startedMs = Date.now();
  const runId = await startAgentRun(pool, 'campaign-scheduler', `in_process:${label}`);
  try {
    const r = await tickCampaignScheduler(pool);
    if (r.picked > 0) {
      logger.info(`[CampaignScheduler] tick ${label} done — picked=${r.picked} sent=${r.sent} failed=${r.failed}`);
    }
    await finishAgentRun(pool, runId, 'success', { picked: r.picked, sent: r.sent, failed: r.failed }, null, startedMs);
  } catch (err: any) {
    logger.warn(`[CampaignScheduler] tick ${label} failed: ${err?.message || err}`);
    await finishAgentRun(pool, runId, 'error', {}, (err?.message || String(err)).slice(0, 4000), startedMs);
  } finally {
    schedulerInFlight = false;
  }
}

export function startCampaignSchedulerCron(pool: Pool, opts?: { intervalMs?: number }): void {
  if (schedulerTimer) return;
  const intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
  schedulerTimer = setInterval(() => {
    void runTickGuarded(pool, 'interval');
  }, intervalMs);
  if (typeof (schedulerTimer as any).unref === 'function') (schedulerTimer as any).unref();
  // Lần chạy đầu sau 30s startup để không tranh DB với quá trình boot
  setTimeout(() => {
    void runTickGuarded(pool, 'initial');
  }, 30_000).unref?.();
  logger.info(`[CampaignScheduler] In-process cron started (interval=${intervalMs}ms)`);
}

export function stopCampaignSchedulerCron(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

// ── HTTP driver (QStash) ──────────────────────────────────────────────────────

export function createCampaignSchedulerCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/campaign-scheduler-cron', async (req: Request, res: Response) => {
    const providedSecret =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
      logger.warn('[CampaignScheduler] HTTP từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const runId = await startAgentRun(pool, 'campaign-scheduler', 'qstash');
    try {
      const r = await tickCampaignScheduler(pool);
      logger.info(`[CampaignScheduler] HTTP tick — picked=${r.picked} sent=${r.sent} failed=${r.failed}`);
      await finishAgentRun(pool, runId, 'success', { picked: r.picked, sent: r.sent, failed: r.failed }, null, startedMs);
      return res.json({ ok: true, run_at: startedAt, ...r });
    } catch (err: any) {
      logger.error('[CampaignScheduler] HTTP lỗi:', err.message);
      await finishAgentRun(pool, runId, 'error', {}, (err?.message || String(err)).slice(0, 4000), startedMs);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  });

  return router;
}
