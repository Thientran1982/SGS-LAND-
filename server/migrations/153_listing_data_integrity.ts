import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * Database backstop for listing values. NOT VALID deliberately preserves
 * legacy rows while enforcing every new INSERT/UPDATE; the application
 * validation remains the user-facing error layer.
 */
const migration: Migration = {
  description: 'Enforce listing status, transaction, type, money, area and coordinates',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE listings
        ADD CONSTRAINT listings_status_ck CHECK (status IN
          ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET')) NOT VALID,
        ADD CONSTRAINT listings_transaction_ck CHECK (transaction IN ('SALE','RENT')) NOT VALID,
        ADD CONSTRAINT listings_type_ck CHECK (type IN
          ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA')) NOT VALID,
        ADD CONSTRAINT listings_price_ck CHECK (price IS NULL OR price > 0) NOT VALID,
        ADD CONSTRAINT listings_area_ck CHECK (area IS NULL OR area > 0) NOT VALID,
        ADD CONSTRAINT listings_currency_ck CHECK (currency IN ('VND','USD')) NOT VALID,
        ADD CONSTRAINT listings_transaction_status_ck CHECK (
          NOT (transaction = 'SALE' AND status = 'RENTED') AND
          NOT (transaction = 'RENT' AND status = 'SOLD')
        ) NOT VALID,
        ADD CONSTRAINT listings_coordinates_ck CHECK (
          coordinates IS NULL OR (
            jsonb_typeof(coordinates) = 'object' AND
            (coordinates->>'lat')::numeric BETWEEN 8 AND 24 AND
            (coordinates->>'lng')::numeric BETWEEN 102 AND 110
          )
        ) NOT VALID
    `);
    // A database unique index, not an application pre-check, closes the
    // check-then-insert race for case/whitespace variants of a code.
    await client.query(`
      CREATE UNIQUE INDEX idx_listings_tenant_code_norm_unique
        ON listings (tenant_id, upper(btrim(code)))
        WHERE code IS NOT NULL AND btrim(code) <> ''
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS idx_listings_tenant_code_norm_unique');
    for (const name of [
      'listings_status_ck', 'listings_transaction_ck', 'listings_type_ck',
      'listings_price_ck', 'listings_area_ck', 'listings_currency_ck',
      'listings_transaction_status_ck', 'listings_coordinates_ck',
    ]) await client.query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS ${name}`);
  },
};

export default migration;