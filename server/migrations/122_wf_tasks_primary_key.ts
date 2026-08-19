/**
 * Migration 122: wf_tasks is missing its PRIMARY KEY constraint.
 *
 * Root cause of the "Khong the tai du lieu" / "Khong the tai cong viec" errors on
 * Task Overview and Kanban Board: queries in taskRoutes.ts / taskReportRoutes.ts do
 * `SELECT t.*, ... GROUP BY t.id, ...`. Postgres only allows selecting ungrouped
 * columns of a table when the GROUP BY column is that table's PRIMARY KEY (functional
 * dependency). Because wf_tasks currently has no PRIMARY KEY (only a NOT NULL
 * constraint on id), every such query fails with:
 *   42803 column "t.tenant_id" must appear in the GROUP BY clause or be used in an
 *   aggregate function
 * This restores the PRIMARY KEY that migration 020_task_management.ts originally
 * declared when creating the table.
 */
import { PoolClient } from 'pg';

export default {
  id: '122_wf_tasks_primary_key',
  description: 'Restore missing PRIMARY KEY on wf_tasks(id)',
  async up(client: PoolClient): Promise<void> {
    const existing = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conrelid = 'wf_tasks'::regclass AND contype = 'p'`
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log('[122_wf_tasks_primary_key] PRIMARY KEY already present, skipping.');
      return;
    }
    await client.query(`ALTER TABLE wf_tasks ADD CONSTRAINT wf_tasks_pkey PRIMARY KEY (id)`);
    console.log('[122_wf_tasks_primary_key] Added PRIMARY KEY on wf_tasks(id).');
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE wf_tasks DROP CONSTRAINT IF EXISTS wf_tasks_pkey`);
  },
};
