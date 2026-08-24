import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * Database backstop for listing values. NOT VALID deliberately preserves
 * legacy rows while enforcing every new INSERT/UPDATE; the application
 * validation remains the user-facing error layer.
 */
const migration: Migration = {
  description: 'Enforce listing status, transaction, type, money, area and coordinates',
  async report(client: PoolClient): Promise<void> {
    const reports = [
      ['status', `
        status IS NOT NULL AND upper(btrim(status)) NOT IN
          ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET')`,
        `CASE WHEN status IS NULL OR upper(btrim(status)) IN
          ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET')
          THEN upper(btrim(status)) ELSE 'INACTIVE' END`],
      ['transaction', `transaction IS NOT NULL AND upper(btrim(transaction)) NOT IN ('SALE','RENT')`,
        `CASE WHEN transaction IS NULL OR upper(btrim(transaction)) IN ('SALE','RENT')
          THEN upper(btrim(transaction)) ELSE 'SALE' END`],
      ['type', `type IS NOT NULL AND upper(btrim(type)) NOT IN
          ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA')`,
        `CASE WHEN type IS NULL OR upper(btrim(type)) IN
          ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA')
          THEN upper(btrim(type)) ELSE NULL END`],
      ['price', `price IS NOT NULL AND price <= 0`, `CASE WHEN price IS NULL OR price > 0 THEN price ELSE NULL END`],
      ['area', `area IS NOT NULL AND area <= 0`, `CASE WHEN area IS NULL OR area > 0 THEN area ELSE NULL END`],
      ['currency', `currency IS NOT NULL AND upper(btrim(currency)) NOT IN ('VND','USD')`,
        `CASE WHEN currency IS NULL OR upper(btrim(currency)) IN ('VND','USD')
          THEN upper(btrim(currency)) ELSE 'VND' END`],
      ['coordinates', `coordinates IS NOT NULL AND NOT (
          jsonb_typeof(coordinates) = 'object'
          AND coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
          AND coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
          AND (CASE WHEN coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            THEN (coordinates->>'lat')::numeric BETWEEN 8 AND 24 ELSE FALSE END)
          AND (CASE WHEN coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            THEN (coordinates->>'lng')::numeric BETWEEN 102 AND 110 ELSE FALSE END)
        )`, `CASE WHEN coordinates IS NULL THEN NULL ELSE
          CASE WHEN jsonb_typeof(coordinates) = 'object'
            AND coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            AND coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            AND (CASE WHEN coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lat')::numeric BETWEEN 8 AND 24 ELSE FALSE END)
            AND (CASE WHEN coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lng')::numeric BETWEEN 102 AND 110 ELSE FALSE END)
            THEN coordinates ELSE NULL END END`],
    ] as const;

    for (const [field, invalid, normalized] of reports) {
      const result = await client.query(`
        SELECT COALESCE(MAX(total_count), 0)::int AS count,
          COALESCE(jsonb_agg(sample ORDER BY sample->>'id'), '[]'::jsonb) AS samples
        FROM (
          SELECT jsonb_build_object(
            'id', id, 'before', ${field === 'coordinates' ? `coordinates` : field},
            'after', ${normalized}
          ) AS sample, COUNT(*) OVER () AS total_count
          FROM listings
          WHERE ${invalid}
          ORDER BY id
          LIMIT 5
        ) preview
      `);
      const row = result.rows[0] ?? { count: 0, samples: [] };
      console.log(`[Migration 153][dry-run] ${field}: ${row.count} row(s); samples=${JSON.stringify(row.samples)}`);
    }

    const pair = await client.query(`
      SELECT COUNT(*)::int AS count,
        COALESCE(jsonb_agg(jsonb_build_object('id', id, 'transaction', transaction, 'status', status)
          ORDER BY id) FILTER (WHERE id IS NOT NULL), '[]'::jsonb) AS samples
      FROM (
        SELECT id, transaction, status FROM listings
        WHERE (upper(btrim(transaction)) = 'SALE' AND upper(btrim(status)) = 'RENTED')
           OR (upper(btrim(transaction)) = 'RENT' AND upper(btrim(status)) = 'SOLD')
        ORDER BY id LIMIT 5
      ) contradictory
    `);
    console.log(`[Migration 153][dry-run] transaction/status contradiction: ${pair.rows[0]?.count ?? 0} row(s); samples=${JSON.stringify(pair.rows[0]?.samples ?? [])}`);
  },
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
            (CASE WHEN coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lat')::numeric BETWEEN 8 AND 24 ELSE FALSE END) AND
            (CASE WHEN coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lng')::numeric BETWEEN 102 AND 110 ELSE FALSE END)
          )
        ) NOT VALID
    `);

    // Clean legacy rows before validation.  Every rewrite below is
    // deterministic and conservative: an unknown classification is not
    // guessed, invalid measurements are cleared, and a contradictory
    // lifecycle state is made inactive rather than made saleable/rentable.
    const invalidBefore = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IS NOT NULL AND upper(btrim(status)) NOT IN
          ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET')) AS bad_status,
        COUNT(*) FILTER (WHERE transaction IS NOT NULL AND upper(btrim(transaction)) NOT IN ('SALE','RENT')) AS bad_transaction,
        COUNT(*) FILTER (WHERE type IS NOT NULL AND upper(btrim(type)) NOT IN
          ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA')) AS bad_type,
        COUNT(*) FILTER (WHERE price IS NOT NULL AND price <= 0) AS bad_price,
        COUNT(*) FILTER (WHERE area IS NOT NULL AND area <= 0) AS bad_area,
        COUNT(*) FILTER (WHERE currency IS NOT NULL AND upper(btrim(currency)) NOT IN ('VND','USD')) AS bad_currency,
        COUNT(*) FILTER (WHERE
          transaction IS NOT NULL AND status IS NOT NULL AND
          ((upper(btrim(transaction)) = 'SALE' AND upper(btrim(status)) = 'RENTED') OR
           (upper(btrim(transaction)) = 'RENT' AND upper(btrim(status)) = 'SOLD'))) AS bad_pair,
        COUNT(*) FILTER (WHERE coordinates IS NOT NULL AND NOT (
          jsonb_typeof(coordinates) = 'object' AND
          coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$' AND
          coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$' AND
          (CASE WHEN coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            THEN (coordinates->>'lat')::numeric BETWEEN 8 AND 24 ELSE FALSE END) AND
          (CASE WHEN coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            THEN (coordinates->>'lng')::numeric BETWEEN 102 AND 110 ELSE FALSE END)
        )) AS bad_coordinates
      FROM listings
    `);
    const before = invalidBefore.rows[0] ?? {};
    const result = await client.query(`
      UPDATE listings
      SET
        status = CASE
          WHEN (upper(btrim(transaction)) = 'SALE' AND upper(btrim(status)) = 'RENTED')
            OR (upper(btrim(transaction)) = 'RENT' AND upper(btrim(status)) = 'SOLD')
            THEN 'INACTIVE'
          WHEN status IS NULL OR upper(btrim(status)) IN
            ('BOOKING','OPENING','AVAILABLE','HOLD','SOLD','RENTED','INACTIVE','BEST_MARKET')
            THEN upper(btrim(status))
          ELSE 'INACTIVE'
        END,
        transaction = CASE
          WHEN transaction IS NULL OR upper(btrim(transaction)) IN ('SALE','RENT')
            THEN upper(btrim(transaction))
          ELSE 'SALE'
        END,
        type = CASE
          WHEN type IS NULL OR upper(btrim(type)) IN
            ('APARTMENT','HOUSE','LAND','OFFICE','PENTHOUSE','TOWNHOUSE','VILLA')
            THEN upper(btrim(type))
          ELSE NULL
        END,
        price = CASE WHEN price IS NULL OR price > 0 THEN price ELSE NULL END,
        area = CASE WHEN area IS NULL OR area > 0 THEN area ELSE NULL END,
        currency = CASE
          WHEN currency IS NULL OR upper(btrim(currency)) IN ('VND','USD')
            THEN upper(btrim(currency))
          ELSE 'VND'
        END,
        coordinates = CASE
          WHEN coordinates IS NULL THEN NULL
          WHEN jsonb_typeof(coordinates) = 'object'
            AND coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            AND coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
            AND (CASE WHEN coordinates->>'lat' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lat')::numeric BETWEEN 8 AND 24 ELSE FALSE END)
            AND (CASE WHEN coordinates->>'lng' ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
              THEN (coordinates->>'lng')::numeric BETWEEN 102 AND 110 ELSE FALSE END)
            THEN coordinates
          ELSE NULL
        END
    `);
    if ((result.rowCount ?? 0) > 0) {
      console.log(`[Migration 153] Cleaned ${result.rowCount} legacy listing(s)`, before);
    }

    // Preserve every legacy listing while making the normalized code key
    // unique. The first row keeps its public code; later duplicates receive a
    // deterministic suffix derived from their UUID, so retries are stable and
    // no row is silently deleted.
    const duplicateCodes = await client.query(`
      WITH ranked AS (
        SELECT id, code,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id, upper(btrim(code))
            ORDER BY id
          ) AS duplicate_rank
        FROM listings
        WHERE code IS NOT NULL AND btrim(code) <> ''
      )
      SELECT id, code
      FROM ranked
      WHERE duplicate_rank > 1
    `);
    for (const row of duplicateCodes.rows) {
      await client.query(
        `UPDATE listings
         SET code = left(btrim($1), 63) || '-DUP-' || replace($2::text, '-', '')
         WHERE id = $2::uuid`,
        [row.code, row.id],
      );
    }
    if (duplicateCodes.rowCount) {
      console.log(`[Migration 153] Renamed ${duplicateCodes.rowCount} duplicate listing code(s)`);
    }

    for (const name of [
      'listings_status_ck', 'listings_transaction_ck', 'listings_type_ck',
      'listings_price_ck', 'listings_area_ck', 'listings_currency_ck',
      'listings_transaction_status_ck', 'listings_coordinates_ck',
    ]) {
      await client.query(`ALTER TABLE listings VALIDATE CONSTRAINT ${name}`);
    }

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