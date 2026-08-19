import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add a narrowly scoped privileged function for stale outbound delivery recovery',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE OR REPLACE FUNCTION recover_stale_agent_deliveries()
      RETURNS TABLE (tenant_id UUID, lead_id UUID, delivery_id UUID)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        UPDATE agent_outbound_deliveries
           SET status = 'UNKNOWN',
               error_text = COALESCE(error_text, 'Delivery claim expired; automatic resend blocked'),
               updated_at = NOW()
         WHERE status = 'SENDING'
           AND claimed_at < NOW() - INTERVAL '5 minutes'
        RETURNING agent_outbound_deliveries.tenant_id,
                  agent_outbound_deliveries.lead_id,
                  agent_outbound_deliveries.id;
      $$;
    `);
    await client.query(`REVOKE ALL ON FUNCTION recover_stale_agent_deliveries() FROM PUBLIC`);
    await client.query(`GRANT EXECUTE ON FUNCTION recover_stale_agent_deliveries() TO sgs_app`)
      .catch(() => {});
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP FUNCTION IF EXISTS recover_stale_agent_deliveries()`);
  },
};

export default migration;