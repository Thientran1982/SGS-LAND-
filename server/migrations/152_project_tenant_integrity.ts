import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * Make project links tenant-bound at the database boundary.
 *
 * This migration deliberately fails when legacy data contains an invalid
 * cross-tenant link. Silently rewriting or nulling those links would hide a
 * security/data-integrity incident and make the audit impossible.
 */
const migration: Migration = {
  description: 'Audit and enforce tenant ownership for listing and unit project links',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'projects_id_tenant_id_key'
        ) THEN
          ALTER TABLE projects ADD CONSTRAINT projects_id_tenant_id_key UNIQUE (id, tenant_id);
        END IF;
      END $$;
    `);

    const invalid = await client.query(`
      WITH invalid_links AS (
        SELECT 'listings' AS source, l.id, l.tenant_id, l.project_id
        FROM listings l
        JOIN projects p ON p.id = l.project_id
        WHERE l.project_id IS NOT NULL AND l.tenant_id <> p.tenant_id
        UNION ALL
        SELECT 'units' AS source, u.id, u.tenant_id, u.project_id
        FROM units u
        JOIN projects p ON p.id = u.project_id
        WHERE u.project_id IS NOT NULL AND u.tenant_id <> p.tenant_id
      )
      SELECT COUNT(*)::int AS total,
             COALESCE(json_agg(invalid_links) FILTER (WHERE invalid_links.id IS NOT NULL), '[]') AS sample
      FROM (SELECT * FROM invalid_links LIMIT 20) invalid_links
    `);
    const invalidCount = invalid.rows[0]?.total ?? 0;
    if (invalidCount > 0) {
      throw new Error(
        `[152] Refusing tenant-integrity constraints: ${invalidCount} invalid project links found. ` +
        `Audit sample: ${JSON.stringify(invalid.rows[0]?.sample ?? [])}`,
      );
    }

    // Remove historical id-only listing FK, if present, before adding the
    // tenant-bound variant. Constraint names differ between old installations.
    await client.query(`
      DO $$ DECLARE constraint_name text;
      BEGIN
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'listings'
          AND c.contype = 'f'
          AND c.confrelid = 'projects'::regclass
          AND pg_get_constraintdef(c.oid) LIKE '%(project_id)%';
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE listings DROP CONSTRAINT %I', constraint_name);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'listings_project_tenant_fk'
        ) THEN
          ALTER TABLE listings
            ADD CONSTRAINT listings_project_tenant_fk
            FOREIGN KEY (project_id, tenant_id)
            REFERENCES projects (id, tenant_id)
            ON DELETE SET NULL (project_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'units_project_tenant_fk'
        ) THEN
          ALTER TABLE units
            ADD CONSTRAINT units_project_tenant_fk
            FOREIGN KEY (project_id, tenant_id)
            REFERENCES projects (id, tenant_id)
            ON DELETE SET NULL (project_id);
        END IF;
      END $$;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE units DROP CONSTRAINT IF EXISTS units_project_tenant_fk`);
    await client.query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_project_tenant_fk`);
  },
};

export default migration;