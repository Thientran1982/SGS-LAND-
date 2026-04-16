/**
 * Migration 058 — Seed default departments for all tenants
 *
 * Migration 020 only seeded departments for DEFAULT_TENANT.
 * This migration seeds the same default departments for every
 * tenant that currently has zero departments so that the
 * CreateTaskModal department dropdown is populated for all users.
 */

import type { Migration } from './runner';

const DEFAULT_DEPARTMENTS = [
  { name: 'Kinh doanh',              description: 'Phòng kinh doanh và bán hàng' },
  { name: 'Pháp lý & Hợp đồng',      description: 'Phòng pháp lý và soạn thảo hợp đồng' },
  { name: 'Marketing & Truyền thông', description: 'Phòng marketing và truyền thông' },
  { name: 'Kỹ thuật & Thẩm định',    description: 'Phòng kỹ thuật và thẩm định dự án' },
  { name: 'Chăm sóc Khách hàng',     description: 'Phòng chăm sóc khách hàng' },
  { name: 'Ban Giám đốc',            description: 'Ban giám đốc điều hành' },
];

const migration: Migration = {
  description: 'Seed default departments for all tenants that have none',

  async up(client) {
    // Find all tenants that currently have zero departments
    const tenantsRes = await client.query(`
      SELECT t.id
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM departments d WHERE d.tenant_id = t.id
      )
    `);

    for (const row of tenantsRes.rows) {
      const tenantId = row.id;
      for (const dept of DEFAULT_DEPARTMENTS) {
        await client.query(`
          INSERT INTO departments (tenant_id, name, description)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [tenantId, dept.name, dept.description]);
      }
    }
  },

  async down(client) {
    // Remove only the seeded defaults (those matching the exact names above)
    // to avoid wiping custom departments created by users
    const names = DEFAULT_DEPARTMENTS.map(d => d.name);
    await client.query(`
      DELETE FROM departments
      WHERE name = ANY($1::text[])
        AND description IN (${DEFAULT_DEPARTMENTS.map((_, i) => `$${i + 2}`).join(',')})
    `, [names, ...DEFAULT_DEPARTMENTS.map(d => d.description)]);
  },
};

export default migration;
