import type { PoolClient } from 'pg';

/**
 * View-count de-duplication index.
 *
 * visitorRepository.hasRecentView() runs, on every public listing view:
 *   SELECT 1 FROM visitor_logs
 *    WHERE listing_id = $1 AND ip_address = $2 AND created_at >= NOW() - interval
 *
 * visitor_logs only had a single-column index on listing_id, so a popular
 * listing forced a heap scan over every row it ever collected just to answer
 * "did this IP look at it in the last 30 minutes?". This adds the composite
 * index that query actually needs.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_logs_listing_ip_created
       ON visitor_logs (listing_id, ip_address, created_at DESC)
     WHERE listing_id IS NOT NULL`,
  );
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM visitor_logs WHERE listing_id IS NOT NULL`,
  );
  console.log('[120] idx_visitor_logs_listing_ip_created san sang; rows voi listing_id: ' + r.rows[0].n);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS idx_visitor_logs_listing_ip_created`);
};

export default {
  up,
  down,
  description: 'Composite index for listing view de-duplication (listing_id, ip_address, created_at)',
};
