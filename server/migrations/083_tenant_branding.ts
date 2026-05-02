/**
 * Migration 083 — Tenant white-label & subdomain
 *
 * Adds dedicated columns for fast Host→tenant lookup. The richer branding
 * payload (logo URL, primary color, hotline, etc.) lives inside `tenants.config`
 * jsonb under the `branding` key — no schema change needed for those fields.
 *
 *   subdomain_slug              text, partial UNIQUE
 *   custom_domain               text (lowercased), partial UNIQUE
 *   custom_domain_txt_token     text
 *   custom_domain_verified_at   timestamptz
 */
import { PoolClient } from 'pg';

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS subdomain_slug              TEXT,
      ADD COLUMN IF NOT EXISTS custom_domain               TEXT,
      ADD COLUMN IF NOT EXISTS custom_domain_txt_token     TEXT,
      ADD COLUMN IF NOT EXISTS custom_domain_verified_at   TIMESTAMPTZ;
  `);

  // Partial unique indexes — cho phép NULL (chưa cấu hình) nhưng cấm duplicate
  // khi đã đặt. Đồng thời là index lookup cho Host middleware.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenants_subdomain_slug
      ON tenants (LOWER(subdomain_slug))
      WHERE subdomain_slug IS NOT NULL;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenants_custom_domain
      ON tenants (LOWER(custom_domain))
      WHERE custom_domain IS NOT NULL;
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS uniq_tenants_custom_domain;`);
  await client.query(`DROP INDEX IF EXISTS uniq_tenants_subdomain_slug;`);
  await client.query(`
    ALTER TABLE tenants
      DROP COLUMN IF EXISTS custom_domain_verified_at,
      DROP COLUMN IF EXISTS custom_domain_txt_token,
      DROP COLUMN IF EXISTS custom_domain,
      DROP COLUMN IF EXISTS subdomain_slug;
  `);
};

export default {
  up,
  down,
  description: 'Tenant white-label: subdomain_slug + custom_domain + TXT verify token',
};
