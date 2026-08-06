import type { PoolClient } from 'pg';

/**
 * 119 - market_price_history.listing_id must hold a listing UUID.
 *
 * The column was declared INTEGER back when listings had serial ids. Listings
 * are UUIDs now, so the sold-transaction calibration path did
 * `parseInt(uuid, 10)` -> NaN and every insert was rejected (silently, the
 * caller swallows the error). Widening to TEXT keeps any legacy numeric ids
 * readable while letting UUIDs through.
 */
const up = async (client: PoolClient): Promise<void> => {
  const col = await client.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'market_price_history' AND column_name = 'listing_id'`,
  );
  if (col.rowCount === 0) {
    console.log('[119] Bo qua - khong tim thay cot listing_id');
    return;
  }
  const type = String(col.rows[0].data_type || '').toLowerCase();
  if (type === 'text' || type === 'character varying') {
    console.log('[119] listing_id da la kieu text - bo qua');
  } else {
    await client.query(
      `ALTER TABLE market_price_history
         ALTER COLUMN listing_id TYPE TEXT USING listing_id::text`,
    );
    console.log(`[119] listing_id: ${type} -> text`);
  }
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_mph_listing_id
       ON market_price_history (listing_id)
     WHERE listing_id IS NOT NULL`,
  );
  console.log('[119] Hoan tat: market_price_history.listing_id nhan UUID.');
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS idx_mph_listing_id`);
  // Non-numeric ids cannot be cast back, so they are dropped on rollback.
  await client.query(
    `ALTER TABLE market_price_history
       ALTER COLUMN listing_id TYPE INTEGER
       USING (CASE WHEN listing_id ~ '^[0-9]+$' THEN listing_id::integer ELSE NULL END)`,
  );
};

export default {
  up,
  down,
  description: 'market_price_history.listing_id INTEGER -> TEXT (listings are UUIDs)',
};
