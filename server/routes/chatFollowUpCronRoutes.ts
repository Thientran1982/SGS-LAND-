/**
 * chatFollowUpCronRoutes.ts
 *
 * Internal endpoint called by QStash daily at 9:00 AM ICT (2:00 UTC).
 * Automatically sends AI-generated follow-up messages via Zalo/Facebook chat
 * to leads that have not replied after 1 day, 3 days, and 7 days.
 *
 * Logic:
 *   - Finds leads whose last INBOUND chat message was ~N days ago
 *   - Thread must be AI_ACTIVE and lead must have a Zalo or Facebook social ID
 *   - No previous follow-up for this exact interval has been sent
 *   - Generates a personalised Vietnamese message via aiService.generateFollowup
 *   - Falls back to a static template if AI generation fails
 *   - Logs the interaction with { isFollowUp: true, followUpDay: N }
 *   - Emits socket event so Inbox UI updates in real-time
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { logger } from '../middleware/logger';
import { startAgentRun, finishAgentRun } from '../services/agentRunsService';
import { queryLeadsNeedingChatFollowUp, ChatFollowUpLead } from '../repositories/campaignRepository';
import { aiService } from '../ai';

// Static fallback templates used when AI generation fails
const FALLBACK_TEMPLATES: Record<1 | 3 | 7, (name: string) => string> = {
  1: (name) =>
    `Xin chào ${name || 'bạn'}! Em từ SGS LAND muốn hỏi thăm: anh/chị đã có đủ thông tin về dự án chưa ạ? Nếu còn điều gì cần tư vấn thêm, em luôn sẵn sàng hỗ trợ ạ.`,
  3: (name) =>
    `Chào ${name || 'bạn'}! SGS LAND hỏi thăm sau 3 ngày ạ. Hiện chúng em có nhiều dự án mới, pháp lý rõ ràng, giá hợp lý. Anh/chị có muốn em gợi ý thêm không ạ?`,
  7: (name) =>
    `Xin chào ${name || 'bạn'}! Đã một tuần rồi — em từ SGS LAND vẫn luôn sẵn sàng hỗ trợ anh/chị trên hành trình tìm kiếm bất động sản lý tưởng. Anh/chị cần tư vấn gì thêm không ạ?`,
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
      day1: { queried: 0, sent: 0, failed: 0, ai_generated: 0 },
      day3: { queried: 0, sent: 0, failed: 0, ai_generated: 0 },
      day7: { queried: 0, sent: 0, failed: 0, ai_generated: 0 },
    };

    try {
      const { interactionRepository } = await import('../repositories/interactionRepository');

      for (const dayInterval of [1, 3, 7] as const) {
        const key = `day${dayInterval}` as keyof typeof stats;
        const leads = await queryLeadsNeedingChatFollowUp(pool, dayInterval);
        stats[key].queried = leads.length;
        logger.info(
          `[ChatFollowUpCron] DAY_${dayInterval}: ${leads.length} lead cần follow-up`,
        );

        for (const lead of leads) {
          try {
            // Fetch recent chat history for context (best-effort, non-blocking on error)
            let history: any[] = [];
            try {
              history = await interactionRepository.findByLead(
                lead.tenant_id,
                lead.id,
                { page: 1, pageSize: 8 },
              );
            } catch {
              // History is optional — silently continue without it
            }

            // Build minimal lead object for the AI agent (id omitted — branded type; not used by generator)
            const minimalLead = {
              name:      lead.name,
              socialIds: lead.zalo_id ? { zalo: lead.zalo_id } : undefined,
            };

            // Attempt AI-generated personalised message
            let message: string;
            let aiGenerated = false;
            try {
              const result = await aiService.generateFollowup({
                tenantId:              lead.tenant_id,
                lead:                  minimalLead,
                history,
                daysSinceLastContact:  dayInterval,
                // Both ZALO and FACEBOOK are messaging channels — use ZALO format
                channel: 'ZALO',
              });
              message = result.message;
              aiGenerated = true;
              stats[key].ai_generated++;
            } catch (aiErr: any) {
              logger.warn(
                `[ChatFollowUpCron] AI generation failed for ${lead.name} — using fallback: ${aiErr.message}`,
              );
              message = FALLBACK_TEMPLATES[dayInterval](lead.name);
            }

            if (dryRun) {
              logger.info(
                `[ChatFollowUpCron][dry-run] DAY_${dayInterval} → ${lead.name} (${lead.channel}) | ai=${aiGenerated} | msg: ${message.slice(0, 80)}…`,
              );
              stats[key].sent++;
              continue;
            }

            await sendChatFollowUp(pool, lead, message, dayInterval, io);
            stats[key].sent++;
            logger.info(
              `[ChatFollowUpCron] DAY_${dayInterval} ✓ → ${lead.name} (${lead.channel}) | ai=${aiGenerated}`,
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
      const totalAi   = Object.values(stats).reduce((s, x) => s + x.ai_generated, 0);

      logger.info(
        `[ChatFollowUpCron] Hoàn thành — Tổng gửi: ${totalSent}, AI: ${totalAi}, Lỗi: ${totalFail}${dryRun ? ' (dry-run)' : ''}`,
      );

      await finishAgentRun(
        pool,
        runId,
        'success',
        { dry_run: dryRun, stats, total_sent: totalSent, total_failed: totalFail, total_ai: totalAi },
        null,
        startedMs,
      );

      return res.json({
        ok:           true,
        dry_run:      dryRun,
        run_at:       new Date().toISOString(),
        stats,
        total_sent:   totalSent,
        total_failed: totalFail,
        total_ai:     totalAi,
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
      leadId:      lead.id,
      message:     interaction,
      source:      lead.channel,
      isAi:        true,
      isFollowUp:  true,
      followUpDay,
    });
  }
}
