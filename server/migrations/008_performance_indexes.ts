import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add compound indexes for common tenant-scoped queries to improve performance',

  async up(client: PoolClient): Promise<void> {
    // Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    // Using standard CREATE INDEX — safe for migration runner's transactional context.
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_interactions_tenant_ts ON interactions(tenant_id, timestamp DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status ON contracts(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_tenant_status ON listings(tenant_id, status)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP INDEX IF EXISTS idx_leads_tenant_stage;
      DROP INDEX IF EXISTS idx_leads_tenant_assigned;
      DROP INDEX IF EXISTS idx_interactions_tenant_ts;
      DROP INDEX IF EXISTS idx_contracts_tenant_status;
      DROP INDEX IF EXISTS idx_proposals_tenant_status;
      DROP INDEX IF EXISTS idx_listings_tenant_status;
    `);
  },
};

export default migration;
