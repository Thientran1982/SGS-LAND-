/**
 * chatFollowUpCronRoutes.ts
 *
 * Internal endpoint called by QStash daily at 9:00 AM ICT (2:00 UTC).
 * Automatically sends follow-up messages via Zalo/Facebook chat to leads
 * that have not replied after 1 day, 3 days, and 7 days.
 *
 * Logic:
 *   - Finds leads whose last INBOUND chat message was ~N days ago
 *   - Thread must be AI_ACTIVE and lead must have a Zalo or Facebook social ID
 *   - No previous follow-up for this exact interval has been sent
 *   - Sends a personalized Vietnamese message via the correct channel
 *   - Logs the interaction with { isFollowUp: true, followUpDay: N }
 *   - Emits socket event so Inbox UI updates in real-time
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { logger } from '../middleware/logger';
import { startAgentRun, finishAgentRun } from '../services/agentRunsService';
import { queryLeadsNeedingChatFollowUp, ChatFollowUpLead } from '../repositories/campaignRepository';

// Vietnamese follow-up templates for each interval
const FOLLOW_UP_TEMPLATES: Record<1 | 3 | 7, (name: string) => string> = {
  1: (name) =>
    `Xin chào ${name || 'bạn'}! 👋 Hôm qua bạn có hỏi thăm chúng tôi về bất động sản. Tôi muốn hỏi xem bạn đã có đủ thông tin cần thiết chưa ạ? Nếu còn điều gì thắc mắc hoặc muốn xem thêm căn hộ/đất nền phù hợp, đội ngũ SGS LAND luôn sẵn lòng hỗ trợ miễn phí! 🏠`,
  3: (name) =>
    `Chào ${name || 'bạn'}! SGS LAND hỏi thăm sau 3 ngày ạ. 😊 Bạn đã tìm được bất động sản ưng ý chưa? Hiện chúng tôi có nhiều căn hộ và đất nền mới, pháp lý rõ ràng, giá hợp lý. Bạn có muốn tôi gợi ý một số dự án phù hợp với nhu cầu không ạ? Tư vấn hoàn toàn miễn phí! 🏡`,
  7: (name) =>
    `Xin chào ${name || 'bạn'}! Đã một tuần rồi, SGS LAND vẫn luôn sẵn sàng đồng hành cùng bạn trên hành trình tìm kiếm bất động sản lý tưởng. 💬 Nếu bạn cần tư vấn mua bán, định giá AI, hoặc kiểm tra pháp lý — hãy nhắn tin cho chúng tôi. Hotline: 0971-132-378 — miễn phí, không ép mua!`,
};

export function createChatFollowUpCronRouter(
  pool: Pool,
  cronSecret: string,
  io?: Server,
): Router {
  const router = Router();

  router.post('/api/internal/chat-followup-cron', async (req: Request, res: Response) => {
    const providedSecret =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!providedSecret || providedSecret !== cronSecret) {
      logger.warn('[ChatFollowUpCron] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dryRun = req.body?.dry_run === true;
    const startedMs = Date.now();
    const runId = await startAgentRun(
      pool,
      'chat-followup-cron',
      dryRun ? 'manual_dry_run' : 'qstash',
    );

    logger.info(
      `[ChatFollowUpCron] Bắt đầu${dryRun ? ' (dry-run)' : ''} — ${new Date().toISOString()}`,
    );

    const stats = {
      day1: { queried: 0, sent: 0, failed: 0 },
      day3: { queried: 0, sent: 0, failed: 0 },
      day7: { queried: 0, sent: 0, failed: 0 },
    };

    try {
      for (const dayInterval of [1, 3, 7] as const) {
        const key = `day${dayInterval}` as keyof typeof stats;
        const leads = await queryLeadsNeedingChatFollowUp(pool, dayInterval);
        stats[key].queried = leads.length;
        logger.info(
          `[ChatFollowUpCron] DAY_${dayInterval}: ${leads.length} lead cần follow-up`,
        );

        for (const lead of leads) {
          try {
            const message = FOLLOW_UP_TEMPLATES[dayInterval](lead.name);

            if (dryRun) {
              logger.info(
                `[ChatFollowUpCron][dry-run] DAY_${dayInterval} → ${lead.name} (${lead.channel}) | msg: ${message.slice(0, 60)}...`,
              );
              stats[key].sent++;
              continue;
            }

            await sendChatFollowUp(pool, lead, message, dayInterval, io);
            stats[key].sent++;
            logger.info(
              `[ChatFollowUpCron] DAY_${dayInterval} ✓ → ${lead.name} (${lead.channel})`,
            );
          } catch (err: any) {
            stats[key].failed++;
            logger.error(
              `[ChatFollowUpCron] DAY_${dayInterval} ✗ → ${lead.name}: ${err.message}`,
            );
          }
        }
      }

      const totalSent = Object.values(stats).reduce((s, x) => s + x.sent, 0);
      const totalFail = Object.values(stats).reduce((s, x) => s + x.failed, 0);

      logger.info(
        `[ChatFollowUpCron] Hoàn thành — Tổng gửi: ${totalSent}, Lỗi: ${totalFail}${dryRun ? ' (dry-run)' : ''}`,
      );

      await finishAgentRun(
        pool,
        runId,
        'success',
        { dry_run: dryRun, stats, total_sent: totalSent, total_failed: totalFail },
        null,
        startedMs,
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
      logger.error('[ChatFollowUpCron] Lỗi không xác định:', err.message);
      await finishAgentRun(
        pool,
        runId,
        'error',
        { dry_run: dryRun, stats },
        (err?.message || String(err)).slice(0, 4000),
        startedMs,
      );
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Send one follow-up message to a lead via their chat channel
// ---------------------------------------------------------------------------

async function sendChatFollowUp(
  pool: Pool,
  lead: ChatFollowUpLead,
  message: string,
  followUpDay: 1 | 3 | 7,
  io?: Server,
): Promise<void> {
  const { interactionRepository } = await import('../repositories/interactionRepository');

  // 1. Persist outbound interaction before sending (idempotent guard)
  const interaction = await interactionRepository.create(lead.tenant_id, {
    leadId: lead.id,
    channel: lead.channel,
    direction: 'OUTBOUND',
    type: 'TEXT',
    content: message,
    metadata: {
      isAi: true,
      isAgent: true,
      isFollowUp: true,
      followUpDay,
    },
  });

  // 2. Send via the actual social channel
  if (lead.channel === 'ZALO' && lead.zalo_id) {
    const { sendZaloTextMessage, getZaloAccessToken } = await import('../services/zaloService');
    const token = await getZaloAccessToken(lead.tenant_id);
    if (token) {
      const result = await sendZaloTextMessage(token, lead.zalo_id, message);
      if (!result.success) {
        logger.warn(
          `[ChatFollowUpCron] Zalo send failed for lead ${lead.id}: ${result.error}`,
        );
      }
    } else {
      logger.warn(
        `[ChatFollowUpCron] Không có Zalo token cho tenant ${lead.tenant_id}`,
      );
    }
  } else if (lead.channel === 'FACEBOOK' && lead.facebook_id) {
    const { sendFacebookTextMessage, getFacebookDefaultPage } = await import(
      '../services/facebookService'
    );
    const page = await getFacebookDefaultPage(lead.tenant_id);
    if (page?.accessToken) {
      const result = await sendFacebookTextMessage(
        page.accessToken,
        lead.facebook_id,
        message,
      );
      if (!result.success) {
        logger.warn(
          `[ChatFollowUpCron] Facebook send failed for lead ${lead.id}: ${result.error}`,
        );
      }
    } else {
      logger.warn(
        `[ChatFollowUpCron] Không có Facebook page token cho tenant ${lead.tenant_id}`,
      );
    }
  }

  // 3. Emit socket event so Inbox UI updates in real-time without reload
  if (io) {
    io.to(`tenant:${lead.tenant_id}`).emit('new_inbound_message', {
      leadId: lead.id,
      message: interaction,
      source: lead.channel,
      isAi: true,
      isFollowUp: true,
      followUpDay,
    });
  }
}
