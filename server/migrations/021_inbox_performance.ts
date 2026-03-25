import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add per-lead composite indexes critical for inbox DISTINCT ON and ORDER BY queries',

  async up(client: PoolClient): Promise<void> {
    // DISTINCT ON (lead_id) ORDER BY lead_id, timestamp DESC in getInboxThreads
    // WHERE lead_id = $1 ORDER BY timestamp ASC in findByLead
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_interactions_lead_ts
       ON interactions(lead_id, timestamp DESC)`
    );

    // Covers tenant-scoped per-lead queries (most common read pattern)
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_interactions_tenant_lead_ts
       ON interactions(tenant_id, lead_id, timestamp DESC)`
    );

    // Partial index for unread count sub-query (direction='INBOUND' AND status!='READ')
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_interactions_unread
       ON interactions(lead_id, direction, status)
       WHERE direction = 'INBOUND' AND status != 'READ'`
    );
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP INDEX IF EXISTS idx_interactions_lead_ts`);
    await client.query(`DROP INDEX IF EXISTS idx_interactions_tenant_lead_ts`);
    await client.query(`DROP INDEX IF EXISTS idx_interactions_unread`);
  },
};

export default migration;
