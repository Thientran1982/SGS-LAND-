/**
 * Migration 086 — task_reminders: thêm cột phục vụ cron auto reminder
 *
 * Cron `/api/internal/task-reminder-cron` sẽ INSERT một row task_reminders
 * cho mỗi (task, ngày, kind) làm "sent-marker" idempotent. Dedupe bằng
 * UNIQUE(task_id, remind_date, kind) để tránh gửi notification lặp.
 *
 * kind: 'D-1' (trước hạn 1 ngày) | 'D-DAY' (đúng hạn) | 'OVERDUE' (quá hạn 1 ngày)
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'task_reminders: add kind/sent_at columns + dedupe unique index',

  async up(client) {
    await client.query(`
      ALTER TABLE task_reminders
        ADD COLUMN IF NOT EXISTS kind    VARCHAR(16)  NOT NULL DEFAULT 'D-DAY',
        ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_task_reminders_dedupe
        ON task_reminders(task_id, remind_date, kind)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_task_reminders_pending
        ON task_reminders(remind_date)
        WHERE is_sent = false
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_task_reminders_pending`);
    await client.query(`DROP INDEX IF EXISTS uq_task_reminders_dedupe`);
    await client.query(`
      ALTER TABLE task_reminders
        DROP COLUMN IF EXISTS sent_at,
        DROP COLUMN IF EXISTS kind
    `);
  },
};

export default migration;
