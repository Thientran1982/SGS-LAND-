import type { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { processDueSequenceEnrollments } from './sequenceService';

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

async function runJob(pool: Pool, path: string, secret: string, dryRun = false): Promise<void> {
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [`free-followup:${path}`],
    );
    if (!lock.rows[0]?.locked) return;

    try {
      const port = Number(process.env.PORT || 5000);
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      if (!response.ok) {
        logger.warn(`[FreeFollowupScheduler] ${path} returned HTTP ${response.status}`);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`free-followup:${path}`]);
    }
  } finally {
    client.release();
  }
}

async function tick(pool: Pool, engagementSecret: string, chatSecret: string): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    await runJob(pool, '/api/internal/engagement-email-cron', engagementSecret);
    await runJob(pool, '/api/internal/chat-followup-cron', chatSecret);
    const sequenceStats = await processDueSequenceEnrollments(pool);
    if (sequenceStats.claimed > 0) {
      logger.info(
        `[FreeFollowupScheduler] sequence tick claimed=${sequenceStats.claimed} sent=${sequenceStats.sent} failed=${sequenceStats.failed}`,
      );
    }
  } catch (error: any) {
    logger.warn(`[FreeFollowupScheduler] tick failed: ${error?.message || error}`);
  } finally {
    inFlight = false;
  }
}

export function startFreeFollowupScheduler(
  pool: Pool,
  opts: { intervalMs?: number; engagementSecret: string; chatSecret: string },
): void {
  if (timer) return;
  const intervalMs = opts.intervalMs ?? 15 * 60 * 1000;
  timer = setInterval(() => void tick(pool, opts.engagementSecret, opts.chatSecret), intervalMs);
  timer.unref?.();
  setTimeout(() => void tick(pool, opts.engagementSecret, opts.chatSecret), 30_000).unref?.();
  logger.info(`[FreeFollowupScheduler] started (interval=${intervalMs}ms)`);
}

export function stopFreeFollowupScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}