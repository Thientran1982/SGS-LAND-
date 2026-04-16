/**
 * Migration 059 — Fix non-RFC-4122 department UUIDs
 *
 * Migration 020 seeded departments for DEFAULT_TENANT with custom IDs
 * like `d1000000-0000-0000-0000-000000000001`. These IDs have version `0`
 * and variant `0` in the wrong positions, so Zod v4's strict uuid() validator
 * rejects them with "Invalid UUID".
 *
 * This migration replaces those non-standard IDs with proper
 * uuid_generate_v4() UUIDs, updating wf_tasks.department_id references as well.
 */

import type { Migration } from './runner';

const NON_STANDARD_PATTERN = /^d[0-9a-f]{7}-0000-0000-0000-[0-9a-f]{12}$/i;

const migration: Migration = {
  description: 'Replace non-RFC-4122 department IDs with proper uuid_generate_v4() UUIDs',

  async up(client) {
    // Fetch all departments with non-standard IDs
    const deptRes = await client.query(`SELECT id, name FROM departments`);
    const nonStandard = deptRes.rows.filter((r: any) => NON_STANDARD_PATTERN.test(r.id));

    if (nonStandard.length === 0) return; // Already fixed or nothing to do

    // Temporarily drop the FK constraint so we can update the PK
    await client.query(`
      ALTER TABLE wf_tasks DROP CONSTRAINT IF EXISTS wf_tasks_department_id_fkey
    `);

    for (const dept of nonStandard) {
      const newIdRes = await client.query(`SELECT uuid_generate_v4() AS new_id`);
      const newId: string = newIdRes.rows[0].new_id;

      // Update FK references first
      await client.query(
        `UPDATE wf_tasks SET department_id = $1 WHERE department_id = $2`,
        [newId, dept.id]
      );

      // Update the primary key
      await client.query(
        `UPDATE departments SET id = $1 WHERE id = $2`,
        [newId, dept.id]
      );
    }

    // Recreate the FK constraint
    await client.query(`
      ALTER TABLE wf_tasks
        ADD CONSTRAINT wf_tasks_department_id_fkey
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    `);
  },

  async down(client) {
    // Cannot safely reverse UUID changes — no-op
  },
};

export default migration;
