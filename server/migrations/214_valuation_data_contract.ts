import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add explicit units, observation timestamps, expiry, and provenance to valuation history',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE market_price_history
        ADD COLUMN IF NOT EXISTS price_unit VARCHAR(32) NOT NULL DEFAULT 'VND_PER_M2',
        ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    // Existing rows predate the contract. Their recorded_at timestamp is the
    // best available observation time; do not invent a new measurement time.
    await client.query(`
      UPDATE market_price_history
      SET observed_at = COALESCE(observed_at, recorded_at, NOW())
      WHERE observed_at IS NULL
    `);
    await client.query(`
      ALTER TABLE market_price_history
        ALTER COLUMN observed_at SET NOT NULL
    `);

    await client.query(`
      COMMENT ON COLUMN listings.price IS
        'Total property price in VND; never VND/m²';
      COMMENT ON COLUMN market_price_history.price_per_m2 IS
        'Market price in VND/m², identified by price_unit';
      COMMENT ON COLUMN market_price_history.provenance IS
        'Bounded JSON provenance for source, segment, timestamps, and scope';
    `);

    // NOT VALID keeps a legacy bad row from blocking deployment while still
    // enforcing the contract for every new write. A later cleanup can validate
    // these constraints after reviewing the reported legacy rows.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'market_price_history_price_unit_check'
        ) THEN
          ALTER TABLE market_price_history
            ADD CONSTRAINT market_price_history_price_unit_check
            CHECK (price_unit = 'VND_PER_M2') NOT VALID;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'market_price_history_price_range_check'
        ) THEN
          ALTER TABLE market_price_history
            ADD CONSTRAINT market_price_history_price_range_check
            CHECK (
              price_per_m2 > 0
              AND (price_min IS NULL OR (price_min > 0 AND price_min <= price_per_m2))
              AND (price_max IS NULL OR (price_max >= price_per_m2))
            ) NOT VALID;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'market_price_history_confidence_check'
        ) THEN
          ALTER TABLE market_price_history
            ADD CONSTRAINT market_price_history_confidence_check
            CHECK (confidence BETWEEN 0 AND 100) NOT VALID;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mph_segment_freshness
        ON market_price_history (location_key, property_type, recorded_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mph_global_segment
        ON market_price_history (tenant_id, property_type, location_key, recorded_at DESC)
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS idx_mph_global_segment');
    await client.query('DROP INDEX IF EXISTS idx_mph_segment_freshness');
    await client.query(`
      ALTER TABLE market_price_history
        DROP CONSTRAINT IF EXISTS market_price_history_confidence_check,
        DROP CONSTRAINT IF EXISTS market_price_history_price_range_check,
        DROP CONSTRAINT IF EXISTS market_price_history_price_unit_check,
        DROP COLUMN IF EXISTS provenance,
        DROP COLUMN IF EXISTS expires_at,
        DROP COLUMN IF EXISTS observed_at,
        DROP COLUMN IF EXISTS price_unit
    `);
  },
};

export default migration;