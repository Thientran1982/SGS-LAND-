import type { PoolClient } from 'pg';

/**
 * 099 — Buyer deposit bookings (Task #56).
 *
 * Stores one row per "đặt cọc giữ chỗ" attempt. The lifecycle is:
 *   PENDING  → buyer hits POST /api/bookings, payment URL issued
 *   PAID     → VNPay IPN verified successfully (idempotent)
 *   FAILED   → VNPay IPN verified, response_code != '00'
 *   CANCELLED→ buyer abandoned / expired
 *   REFUNDED → manual ops (out of scope for sprint)
 *
 * `vnpay_txn_ref` is UNIQUE — VNPay requires that no two transactions of a
 * given TmnCode share a txnRef. We use the booking id as the txnRef so the
 * IPN handler can find the row in O(1).
 *
 * `tenant_id` mirrors the listing's owning tenant so back-office reports
 * (commission, vendor payout) can scope by workspace without a join.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id            UUID NOT NULL,
      listing_id           UUID NOT NULL,
      unit_id              UUID,
      buyer_user_id        UUID NOT NULL REFERENCES buyer_users(id) ON DELETE RESTRICT,
      agent_user_id        UUID,
      buyer_email          VARCHAR(160),
      deposit_amount       BIGINT NOT NULL CHECK (deposit_amount >= 0),
      currency             VARCHAR(8) NOT NULL DEFAULT 'VND',
      status               VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')),
      vnpay_txn_ref        VARCHAR(64) NOT NULL UNIQUE,
      vnpay_response_code  VARCHAR(8),
      vnpay_bank_code      VARCHAR(32),
      vnpay_pay_date       VARCHAR(32),
      paid_at              TIMESTAMPTZ,
      expires_at           TIMESTAMPTZ NOT NULL,
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bookings_buyer_user
      ON bookings(buyer_user_id, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bookings_status_created
      ON bookings(status, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bookings_listing
      ON bookings(listing_id, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_bookings_tenant
      ON bookings(tenant_id, created_at DESC);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS bookings;`);
};

export default {
  up,
  down,
  description: 'Buyer deposit bookings (VNPay) — bookings table',
};
