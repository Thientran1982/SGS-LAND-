/**
 * campaignSchedulerCronRoutes.ts
 *
 * Endpoint nội bộ được QStash gọi mỗi 5 phút.
 * Quét các campaign ACTIVE có lịch hẹn giờ (schedule_type='SCHEDULED')
 * đã đến hạn (scheduled_at <= NOW()) và chưa từng chạy (last_run_at IS NULL),
 * sau đó gọi runCampaign() cho từng cái — đúng dòng chảy như bấm "Chạy ngay".
 *
 * Idempotent: dùng UPDATE ... RETURNING để claim từng campaign trước khi chạy
 * → nếu cron tick chồng chéo, mỗi campaign chỉ chạy đúng 1 lần.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { runCampaign } from '../services/campaignSenderService';

function publicBaseUrl(): string {
  const prod = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = prod || dev;
  return host ? `https://${host}` : 'http://localhost:5000';
}

export function createCampaignSchedulerCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/campaign-scheduler-cron', async (req: Request, res: Response) => {
    const providedSecret =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
      logger.warn('[CampaignSchedulerCron] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const startedAt = new Date().toISOString();
    logger.info(`[CampaignSchedulerCron] Tick ${startedAt}`);

    try {
      // Atomic claim: chỉ pick campaigns đến hạn, chưa chạy.
      // Set last_run_at=NOW() ngay để các tick chồng không pick trùng.
      // Nếu runCampaign fail, last_run_at vẫn được set + last_error ghi rõ
      // → user có thể bấm "Chạy ngay" thủ công để retry.
      const due = await pool.query(
        `UPDATE campaigns
            SET last_run_at = NOW()
          WHERE id IN (
            SELECT id FROM campaigns
             WHERE status = 'ACTIVE'
               AND schedule_type = 'SCHEDULED'
               AND scheduled_at IS NOT NULL
               AND scheduled_at <= NOW()
               AND last_run_at IS NULL
             ORDER BY scheduled_at ASC
             LIMIT 50
             FOR UPDATE SKIP LOCKED
          )
          RETURNING id, name, tenant_id`,
      );

      if (!due.rowCount) {
        return res.json({ ok: true, run_at: startedAt, picked: 0, sent: 0, failed: 0 });
      }

      let totalSent = 0;
      let totalFailed = 0;
      const results: Array<{ id: string; name: string; queued: number; sent: number; failed: number; error?: string }> = [];

      for (const row of due.rows) {
        try {
          const r = await runCampaign(pool, row.id, publicBaseUrl());
          totalSent += r.sent;
          totalFailed += r.failed;
          results.push({ id: row.id, name: row.name, queued: r.queued, sent: r.sent, failed: r.failed, error: r.error });

          // Đánh dấu COMPLETED khi đã gửi xong (giữ ACTIVE chỉ khi audience trống)
          if (r.queued > 0) {
            await pool.query(
              `UPDATE campaigns SET status='COMPLETED', updated_at=NOW() WHERE id=$1`,
              [row.id],
            );
          }
          logger.info(`[CampaignSchedulerCron] ${row.name} — queued=${r.queued} sent=${r.sent} failed=${r.failed}`);
        } catch (err: any) {
          totalFailed++;
          await pool.query(
            `UPDATE campaigns SET last_error=$2, updated_at=NOW() WHERE id=$1`,
            [row.id, `Cron run failed: ${err.message}`],
          );
          results.push({ id: row.id, name: row.name, queued: 0, sent: 0, failed: 0, error: err.message });
          logger.error(`[CampaignSchedulerCron] ${row.name} lỗi: ${err.message}`);
        }
      }

      logger.info(`[CampaignSchedulerCron] Hoàn thành — picked=${due.rowCount} sent=${totalSent} failed=${totalFailed}`);
      return res.json({
        ok: true,
        run_at: startedAt,
        picked: due.rowCount,
        sent: totalSent,
        failed: totalFailed,
        results,
      });
    } catch (err: any) {
      logger.error('[CampaignSchedulerCron] Lỗi không xác định:', err.message);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  });

  return router;
}
