import type { PoolClient } from 'pg';

/**
 * Listing code de-duplication support.
 *
 * listings.code is the human-facing "MA BDS" and was free text with no index
 * and no uniqueness, so the same code could be typed twice. The API now
 * rejects duplicates (listingRepository.codeExists); this index makes that
 * check an index lookup instead of a sequential scan.
 *
 * NOTE: a UNIQUE index is intentionally NOT created here - production data
 * still contains a small number of historical duplicate codes, and silently
 * renaming somebody's listing code is not a migration's job. Once the team has
 * cleaned them up, a follow-up migration can promote this to UNIQUE.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_listings_tenant_code_norm
       ON listings (tenant_id, upper(btrim(code)))
     WHERE code IS NOT NULL AND btrim(code) <> ''`,
  );
  const dup = await client.query(
    `SELECT COUNT(*)::int AS groups FROM (
       SELECT tenant_id, upper(btrim(code))
         FROM listings
        WHERE code IS NOT NULL AND btrim(code) <> ''
        GROUP BY 1, 2 HAVING COUNT(*) > 1
     ) t`,
  );
  console.log('[121] idx_listings_tenant_code_norm san sang; nhom ma trung hien co: ' + dup.rows[0].groups);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS idx_listings_tenant_code_norm`);
};

export default {
  up,
  down,
  description: 'Index for case-insensitive listing code duplicate checks',
};
