import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add created_by_id (UUID) to proposals and contracts for creator-based RBAC; rename proposals.created_by UUID → created_by_id and add created_by text column',

  async up(client: PoolClient): Promise<void> {
    // --- proposals ---
    // The baseline schema created proposals.created_by as UUID (the creator's user id).
    // Rename it to created_by_id so we have a stable UUID for RBAC queries,
    // then add created_by VARCHAR for the display name.
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'proposals' AND column_name = 'created_by'
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE proposals RENAME COLUMN created_by TO created_by_id;
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER TABLE proposals
        ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
    `);

    // --- contracts ---
    // baseline schema: contracts.created_by is VARCHAR(255) (stores display name).
    // Add created_by_id UUID for RBAC.
    await client.query(`
      ALTER TABLE contracts
        ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    // --- leads ---
    // leads has no created_by column — add one for optional RBAC use.
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Index the new RBAC columns
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proposals_created_by_id ON proposals(tenant_id, created_by_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_created_by_id  ON contracts(tenant_id, created_by_id);
      CREATE INDEX IF NOT EXISTS idx_listings_created_by      ON listings(tenant_id, created_by);
      CREATE INDEX IF NOT EXISTS idx_leads_created_by         ON leads(tenant_id, created_by);
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE proposals RENAME COLUMN created_by_id TO created_by`);
    await client.query(`ALTER TABLE proposals DROP COLUMN IF EXISTS created_by`);
    await client.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS created_by_id`);
    await client.query(`ALTER TABLE leads DROP COLUMN IF EXISTS created_by`);
  },
};

export default migration;
