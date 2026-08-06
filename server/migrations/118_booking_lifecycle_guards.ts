import type { PoolClient } from 'pg';

/**
 * 118 - Booking lifecycle guards.
 *
 * Migration 099 created `bookings` with no protection against two buyers
 * holding the same listing at the same time, and nothing ever read
 * `expires_at`. This migration adds the database-level half of the fix:
 *
 *   1. Legacy PENDING rows whose TTL elapsed are closed as CANCELLED
 *      (the status CHECK has no EXPIRED value; 099 documents CANCELLED as
 *      "buyer abandoned / expired").
 *   2. Duplicated live PENDING rows are collapsed to the newest one, so the
 *      unique index below can always be created.
 *   3. A partial UNIQUE index guarantees one live PENDING hold per listing
 *      (per unit when the booking names one). NULL unit_id is folded onto a
 *      sentinel UUID because NULLs never collide in a unique index.
 *   4. Two partial indexes so the lifecycle sweeper stays cheap.
 *
 * All statements are idempotent - re-running the migration is a no-op.
 */

const NIL_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";

const up = async (client: PoolClient): Promise<void> => {
  const stale = await client.query(
    `UPDATE bookings
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE status = 'PENDING' AND expires_at <= NOW()
      RETURNING id`,
  );
  console.log(`[118] Dong ${stale.rowCount ?? 0} don PENDING da het han`);

  const dedup = await client.query(
    `UPDATE bookings b
        SET status = 'CANCELLED', updated_at = NOW()
      WHERE b.status = 'PENDING'
        AND EXISTS (
              SELECT 1 FROM bookings b2
               WHERE b2.status = 'PENDING'
                 AND b2.listing_id = b.listing_id
                 AND b2.unit_id IS NOT DISTINCT FROM b.unit_id
                 AND (b2.created_at > b.created_at
                      OR (b2.created_at = b.created_at AND b2.id > b.id)))
      RETURNING b.id`,
  );
  console.log(`[118] Gop ${dedup.rowCount ?? 0} don PENDING trung listing/unit`);

  const dup = await client.query(
    `SELECT b.listing_id
       FROM bookings b
      WHERE b.status = 'PENDING'
      GROUP BY b.listing_id, COALESCE(b.unit_id, ${NIL_UUID})
     HAVING COUNT(*) > 1
      LIMIT 1`,
  );
  if ((dup.rowCount ?? 0) === 0) {
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_active_per_listing
         ON bookings (listing_id, COALESCE(unit_id, ${NIL_UUID}))
       WHERE status = 'PENDING'`,
    );
    console.log('[118] Unique index idx_bookings_one_active_per_listing da tao');
  } else {
    console.log('[118] Bo qua unique index - van con du lieu PENDING trung');
  }

  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry
       ON bookings (expires_at)
     WHERE status = 'PENDING'`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_listings_hold_expiry
       ON listings (hold_expires_at)
     WHERE status = 'HOLD'`,
  );
  console.log('[118] Hoan tat: booking lifecycle guards.');
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS idx_listings_hold_expiry`);
  await client.query(`DROP INDEX IF EXISTS idx_bookings_pending_expiry`);
  await client.query(`DROP INDEX IF EXISTS idx_bookings_one_active_per_listing`);
};

export default {
  up,
  down,
  description: 'Booking lifecycle guards - one live hold per listing + sweeper indexes',
};
