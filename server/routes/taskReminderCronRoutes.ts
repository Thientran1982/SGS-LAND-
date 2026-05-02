/**
 * taskReminderCronRoutes.ts
 *
 * Endpoint nội bộ được QStash gọi mỗi giờ. Quét wf_tasks chưa hoàn thành,
 * sinh notification cho assignee theo 3 mốc:
 *   - D-1     (deadline = CURRENT_DATE + 1)
 *   - D-DAY   (deadline = CURRENT_DATE)
 *   - OVERDUE (deadline = CURRENT_DATE - 1)
 *
 * Idempotent: mỗi (task, remind_date, kind) chỉ gửi 1 lần (UNIQUE index ở
 * task_reminders). Re-run an toàn — chạy lại trong cùng ngày sẽ no-op.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { notificationRepository } from '../repositories/notificationRepository';

type ReminderKind = 'D-1' | 'D-DAY' | 'OVERDUE';

interface PendingTask {
  id: string;
  tenant_id: string;
  title: string;
  deadline: string; // ISO date
  kind: ReminderKind;
  assignee_ids: string[];
}

const TITLE_BY_KIND: Record<ReminderKind, (taskTitle: string) => string> = {
  'D-1':     (t) => `Nhắc việc: "${t}" — còn 1 ngày đến hạn`,
  'D-DAY':   (t) => `Đến hạn hôm nay: "${t}"`,
  'OVERDUE': (t) => `Quá hạn: "${t}"`,
};

const BODY_BY_KIND: Record<ReminderKind, (deadline: string) => string> = {
  'D-1':     (d) => `Công việc đến hạn vào ngày mai (${d}). Hãy hoàn tất hoặc cập nhật tiến độ.`,
  'D-DAY':   (d) => `Hôm nay là hạn chót (${d}). Vui lòng hoàn thành hoặc đổi trạng thái.`,
  'OVERDUE': (d) => `Công việc đã quá hạn (${d}). Cần xử lý ngay.`,
};

export function createTaskReminderCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/task-reminder-cron', async (req: Request, res: Response) => {
    const providedSecret =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
      logger.warn('[TaskReminderCron] Từ chối — sai/thiếu secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dryRun = req.body?.dry_run === true;
    const startedAt = new Date().toISOString();
    logger.info(`[TaskReminderCron] Bắt đầu${dryRun ? ' (dry-run)' : ''} — ${startedAt}`);

    const stats = {
      'D-1':     { tasks: 0, notifications: 0, skipped_duplicate: 0 },
      'D-DAY':   { tasks: 0, notifications: 0, skipped_duplicate: 0 },
      'OVERDUE': { tasks: 0, notifications: 0, skipped_duplicate: 0 },
    };

    try {
      // Tìm tất cả task chưa done/cancelled có deadline thuộc 1 trong 3 mốc.
      // Siết tenant scope ở join (tránh assignee từ tenant khác do dữ liệu lỗi).
      const pendingRes = await pool.query<PendingTask>(`
        SELECT
          t.id,
          t.tenant_id,
          t.title,
          to_char(t.deadline, 'YYYY-MM-DD') AS deadline,
          CASE
            WHEN t.deadline = CURRENT_DATE + 1 THEN 'D-1'
            WHEN t.deadline = CURRENT_DATE     THEN 'D-DAY'
            WHEN t.deadline = CURRENT_DATE - 1 THEN 'OVERDUE'
          END AS kind,
          COALESCE(
            ARRAY_AGG(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS assignee_ids
        FROM wf_tasks t
        LEFT JOIN task_assignments ta
          ON ta.task_id = t.id
         AND ta.tenant_id = t.tenant_id
        WHERE t.deadline IS NOT NULL
          AND t.status NOT IN ('done', 'cancelled')
          AND t.deadline IN (CURRENT_DATE - 1, CURRENT_DATE, CURRENT_DATE + 1)
        GROUP BY t.id
      `);

      for (const task of pendingRes.rows) {
        const kind = task.kind;
        if (!kind) continue;
        stats[kind].tasks++;

        if (!task.assignee_ids || task.assignee_ids.length === 0) continue;

        // Idempotent insert reminder marker (1 marker / task / ngày / kind)
        if (dryRun) {
          logger.info(`[TaskReminderCron][dry-run] ${kind} task=${task.id} → ${task.assignee_ids.length} assignee`);
          stats[kind].notifications += task.assignee_ids.length;
          continue;
        }

        // Claim marker pending (is_sent=false). Nếu đã có marker:
        //   - is_sent=true → đã gửi xong → skip
        //   - is_sent=false → marker từ lần trước fail → retry trong run này
        const claimRes = await pool.query<{ id: string; is_sent: boolean }>(
          `INSERT INTO task_reminders
             (tenant_id, task_id, remind_date, kind, is_sent, sent_at, remind_note)
           VALUES ($1, $2, CURRENT_DATE, $3, false, NULL, $4)
           ON CONFLICT (task_id, remind_date, kind) DO NOTHING
           RETURNING id, is_sent`,
          [task.tenant_id, task.id, kind, `auto-${kind}`]
        );

        let markerId: string;
        if (claimRes.rowCount && claimRes.rowCount > 0) {
          markerId = claimRes.rows[0].id;
        } else {
          // Marker đã tồn tại — kiểm tra trạng thái
          const existingRes = await pool.query<{ id: string; is_sent: boolean }>(
            `SELECT id, is_sent FROM task_reminders
              WHERE task_id = $1 AND remind_date = CURRENT_DATE AND kind = $2`,
            [task.id, kind]
          );
          if (existingRes.rowCount === 0) {
            // race hiếm gặp — bỏ qua an toàn
            continue;
          }
          if (existingRes.rows[0].is_sent) {
            stats[kind].skipped_duplicate++;
            continue;
          }
          markerId = existingRes.rows[0].id;
          logger.info(`[TaskReminderCron] ${kind} retry marker chưa gửi xong (task=${task.id})`);
        }

        const title = TITLE_BY_KIND[kind](task.title);
        const body  = BODY_BY_KIND[kind](task.deadline);

        let successCount = 0;
        for (const userId of task.assignee_ids) {
          try {
            await notificationRepository.create({
              tenantId: task.tenant_id,
              userId,
              type: 'TASK_REMINDER',
              title,
              body,
              metadata: {
                taskId: task.id,
                kind,
                deadline: task.deadline,
              },
            });
            stats[kind].notifications++;
            successCount++;
          } catch (e: any) {
            logger.warn(`[TaskReminderCron] tạo notification lỗi (task=${task.id}, user=${userId}): ${e.message}`);
          }
        }

        // Chỉ commit marker là "đã gửi" khi có ít nhất 1 notification thành công.
        // Nếu 0 thành công → để is_sent=false để cron lần sau retry.
        if (successCount > 0) {
          await pool.query(
            `UPDATE task_reminders
                SET is_sent = true, sent_at = NOW()
              WHERE id = $1`,
            [markerId]
          );
          logger.info(`[TaskReminderCron] ${kind} ✓ task=${task.id} → ${successCount}/${task.assignee_ids.length} notification`);
        } else {
          logger.warn(`[TaskReminderCron] ${kind} task=${task.id} — 0/${task.assignee_ids.length} notification gửi được; sẽ retry lần cron sau`);
        }
      }

      const totalNotif = Object.values(stats).reduce((s, x) => s + x.notifications, 0);
      logger.info(`[TaskReminderCron] Hoàn thành — ${totalNotif} notification${dryRun ? ' (dry-run)' : ''}`);

      return res.json({
        ok: true,
        dry_run: dryRun,
        run_at: startedAt,
        stats,
        total_notifications: totalNotif,
      });
    } catch (err: any) {
      logger.error('[TaskReminderCron] Lỗi không xác định:', err.message);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  });

  return router;
}
