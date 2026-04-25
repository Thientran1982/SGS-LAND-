/**
 * engagementCronRoutes.ts
 *
 * Endpoint nội bộ được QStash gọi mỗi ngày lúc 3:00 SA (ICT).
 * Chạy 5 segment email tự động cho user + 1 segment chăm sóc lead:
 *   - NUDGE_A: User chưa đăng tin (≥ 3 ngày sau đăng ký)
 *   - NUDGE_B: User dừng sau 1 tin (≥ 7 ngày không đăng thêm)
 *   - NUDGE_C: User không hoạt động ≥ 30 ngày
 *   - NUDGE_D: User tích cực (≥ 2 tin), khuyến khích nâng cấp Premium
 *   - NUDGE_E: User đang hoạt động, giới thiệu tính năng AI
 *   - LEAD_NURTURE: Lead từ landing page, 3-14 ngày chưa phản hồi
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { emailService } from '../services/emailService';
import {
  querySegmentA,
  querySegmentB,
  querySegmentC,
  querySegmentD,
  querySegmentE,
  queryLeadsNeedingNurture,
  logCampaignEmail,
  logLeadCampaignEmail,
  CampaignUser,
  CampaignLead,
  CampaignType,
  LeadCampaignType,
} from '../repositories/campaignRepository';

export function createEngagementCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/engagement-email-cron', async (req: Request, res: Response) => {
    const providedSecret =
      req.headers['x-internal-secret'] as string | undefined ||
      req.body?.secret as string | undefined;

    if (!providedSecret || providedSecret !== cronSecret) {
      logger.warn('[EngagementCron] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dryRun = req.body?.dry_run === true;
    logger.info(`[EngagementCron] Bắt đầu${dryRun ? ' (dry-run)' : ''} — ${new Date().toISOString()}`);

    const stats = {
      nudge_a:       { queried: 0, sent: 0, failed: 0 },
      nudge_b:       { queried: 0, sent: 0, failed: 0 },
      nudge_c:       { queried: 0, sent: 0, failed: 0 },
      nudge_d:       { queried: 0, sent: 0, failed: 0 },
      nudge_e:       { queried: 0, sent: 0, failed: 0 },
      lead_nurture:  { queried: 0, sent: 0, failed: 0 },
    };

    try {
      // ── Segment A ─────────────────────────────────────────────────────────
      const usersA = await querySegmentA(pool);
      stats.nudge_a.queried = usersA.length;
      logger.info(`[EngagementCron] NUDGE_A: ${usersA.length} user`);

      for (const user of usersA) {
        await processUser(pool, user, 'NUDGE_A', dryRun, stats.nudge_a,
          () => emailService.sendNudgeA(user.tenant_id, user.email, user.name));
      }

      // ── Segment B ─────────────────────────────────────────────────────────
      const usersB = await querySegmentB(pool);
      stats.nudge_b.queried = usersB.length;
      logger.info(`[EngagementCron] NUDGE_B: ${usersB.length} user`);

      for (const user of usersB) {
        await processUser(pool, user, 'NUDGE_B', dryRun, stats.nudge_b,
          () => emailService.sendNudgeB(user.tenant_id, user.email, user.name));
      }

      // ── Segment C ─────────────────────────────────────────────────────────
      const usersC = await querySegmentC(pool);
      stats.nudge_c.queried = usersC.length;
      logger.info(`[EngagementCron] NUDGE_C: ${usersC.length} user`);

      for (const user of usersC) {
        await processUser(pool, user, 'NUDGE_C', dryRun, stats.nudge_c,
          () => emailService.sendNudgeC(user.tenant_id, user.email, user.name));
      }

      // ── Segment D ─────────────────────────────────────────────────────────
      const usersD = await querySegmentD(pool);
      stats.nudge_d.queried = usersD.length;
      logger.info(`[EngagementCron] NUDGE_D: ${usersD.length} user`);

      for (const user of usersD) {
        await processUser(pool, user, 'NUDGE_D', dryRun, stats.nudge_d,
          () => emailService.sendNudgeD(user.tenant_id, user.email, user.name));
      }

      // ── Segment E ─────────────────────────────────────────────────────────
      const usersE = await querySegmentE(pool);
      stats.nudge_e.queried = usersE.length;
      logger.info(`[EngagementCron] NUDGE_E: ${usersE.length} user`);

      for (const user of usersE) {
        await processUser(pool, user, 'NUDGE_E', dryRun, stats.nudge_e,
          () => emailService.sendNudgeE(user.tenant_id, user.email, user.name));
      }

      // ── Lead Nurture ───────────────────────────────────────────────────────
      const leads = await queryLeadsNeedingNurture(pool);
      stats.lead_nurture.queried = leads.length;
      logger.info(`[EngagementCron] LEAD_NURTURE: ${leads.length} lead`);

      for (const lead of leads) {
        await processLead(pool, lead, 'LEAD_NURTURE', dryRun, stats.lead_nurture,
          () => emailService.sendLeadNurture(lead.tenant_id, lead.email, lead.name, lead.project_name));
      }

      const totalSent = Object.values(stats).reduce((s, x) => s + x.sent, 0);
      const totalFail = Object.values(stats).reduce((s, x) => s + x.failed, 0);

      logger.info(
        `[EngagementCron] Hoàn thành — Tổng gửi: ${totalSent}, Lỗi: ${totalFail}${dryRun ? ' (dry-run)' : ''}`,
      );

      return res.json({
        ok: true,
        dry_run: dryRun,
        run_at: new Date().toISOString(),
        stats,
        total_sent: totalSent,
        total_failed: totalFail,
      });

    } catch (err: any) {
      logger.error('[EngagementCron] Lỗi không xác định:', err.message);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  });

  return router;
}

// ── Helper: gửi email cho từng user, ghi log nếu thành công ──────────────────

async function processUser(
  pool: Pool,
  user: CampaignUser,
  campaign: CampaignType,
  dryRun: boolean,
  stats: { sent: number; failed: number },
  sendFn: () => Promise<{ success: boolean }>,
): Promise<void> {
  try {
    if (dryRun) {
      logger.info(`[EngagementCron][dry-run] ${campaign} → ${user.email} (${user.name})`);
      stats.sent++;
      return;
    }

    const result = await sendFn();

    if (result.success) {
      await logCampaignEmail(pool, user.tenant_id, user.id, user.email, campaign);
      stats.sent++;
      logger.info(`[EngagementCron] ${campaign} ✓ → ${user.email}`);
    } else {
      stats.failed++;
      logger.warn(`[EngagementCron] ${campaign} ✗ → ${user.email} (email service trả về lỗi)`);
    }
  } catch (err: any) {
    stats.failed++;
    logger.error(`[EngagementCron] ${campaign} lỗi → ${user.email}: ${err.message}`);
  }
}

// ── Helper: gửi email cho từng lead, ghi log nếu thành công ──────────────────

async function processLead(
  pool: Pool,
  lead: CampaignLead,
  campaign: LeadCampaignType,
  dryRun: boolean,
  stats: { sent: number; failed: number },
  sendFn: () => Promise<{ success: boolean }>,
): Promise<void> {
  try {
    if (dryRun) {
      logger.info(`[EngagementCron][dry-run] ${campaign} → ${lead.email} (${lead.name})`);
      stats.sent++;
      return;
    }

    const result = await sendFn();

    if (result.success) {
      await logLeadCampaignEmail(pool, lead.tenant_id, lead.id, lead.email, campaign);
      stats.sent++;
      logger.info(`[EngagementCron] ${campaign} ✓ → ${lead.email}`);
    } else {
      stats.failed++;
      logger.warn(`[EngagementCron] ${campaign} ✗ → ${lead.email} (email service trả về lỗi)`);
    }
  } catch (err: any) {
    stats.failed++;
    logger.error(`[EngagementCron] ${campaign} lỗi → ${lead.email}: ${err.message}`);
  }
}
