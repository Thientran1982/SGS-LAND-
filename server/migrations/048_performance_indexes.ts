import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'pg_trgm extension + compound/trigram indexes for listings at 100k+ scale',

  async up(client: PoolClient) {
    // ── Full-text search via trigrams (makes ILIKE \'%q%\' use a GIN index) ──
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
      ON listings USING gin(title gin_trgm_ops)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_location_trgm
      ON listings USING gin(location gin_trgm_ops)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_code_trgm
      ON listings USING gin(code gin_trgm_ops)
    `);

    // ── Compound multi-filter indexes ─────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_status_type
      ON listings(tenant_id, status, type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_price
      ON listings(tenant_id, price)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_bedrooms
      ON listings(tenant_id, bedrooms)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_area
      ON listings(tenant_id, area)
    `);

    // ── Cursor-style pagination (ORDER BY created_at DESC) ───────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_cursor
      ON listings(tenant_id, created_at DESC, id DESC)
    `);
  },

  async down(client: PoolClient) {
    for (const idx of [
      'idx_listings_title_trgm',
      'idx_listings_location_trgm',
      'idx_listings_code_trgm',
      'idx_listings_tenant_status_type',
      'idx_listings_tenant_price',
      'idx_listings_tenant_bedrooms',
      'idx_listings_tenant_area',
      'idx_listings_tenant_cursor',
    ]) {
      await client.query(`DROP INDEX IF EXISTS ${idx}`);
    }
  },
};
export default migration;
