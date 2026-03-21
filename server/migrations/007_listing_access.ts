import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add listing_access table for per-listing partner view permissions (B2B2C granular access control)',

  async up(client: PoolClient): Promise<void> {
    // listing_access: restrict which listings within a project are visible per partner tenant
    // Logic: if a listing has ANY active listing_access rows → only those specific partners see it
    //        if a listing has NO listing_access rows → all partners with project_access see it (default)
    await client.query(`
      CREATE TABLE IF NOT EXISTS listing_access (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        partner_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        granted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
        granted_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at        TIMESTAMP WITH TIME ZONE,
        status            VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        note              TEXT,
        UNIQUE(listing_id, partner_tenant_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listing_access_listing ON listing_access(listing_id);
      CREATE INDEX IF NOT EXISTS idx_listing_access_partner ON listing_access(partner_tenant_id, status);
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS listing_access;`);
  },
};

export default migration;
