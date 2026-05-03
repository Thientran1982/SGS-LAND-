import type { PoolClient } from 'pg';

/**
 * 100 — Audit log for booking lifecycle events (Task #56).
 *
 * Captures every callback / IPN / state transition so ops can reconstruct
 * what VNPay actually sent us when a buyer disputes a charge. We never
 * mutate booking rows without inserting an event row first (best-effort).
 *
 * `payload` is the raw query/body received from VNPay (verified or not),
 * stored verbatim for forensics. `verified` distinguishes "we re-hashed and
 * the signature matched" from spoofed callbacks we rejected.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS booking_events (
      id            BIGSERIAL PRIMARY KEY,
      booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      kind          VARCHAR(32) NOT NULL,
      verified      BOOLEAN NOT NULL DEFAULT FALSE,
      response_code VARCHAR(8),
      message       TEXT,
      payload       JSONB,
      ip            VARCHAR(64),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_booking_events_booking
      ON booking_events(booking_id, created_at DESC);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS booking_events;`);
};

export default {
  up,
  down,
  description: 'Booking lifecycle audit log (VNPay callbacks/IPN)',
};
