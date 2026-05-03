import type { PoolClient } from 'pg';

/**
 * Buyer accounts + per-user favorites & inquiry lookup (Task #52).
 *
 * Adds:
 *   - buyer_users           : phone-keyed buyer accounts (OTP login).
 *   - buyer_otp_log         : OTP issuance/verification audit + rate-limit base.
 *   - buyer_favorites       : per-user favorites (synced across devices).
 *   - buyer_saved_searches.buyer_user_id : nullable column so the existing
 *     device-id keyed table (Task #53) can also be queried by logged-in user.
 *
 * Buyer phones are normalised to canonical 0XXXXXXXXX form (10–11 digits) on
 * insert. The audit table stores the *hashed* OTP so a DB leak doesn't expose
 * live codes — verification re-hashes the submitted code and compares.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone         VARCHAR(20) NOT NULL UNIQUE,
      display_name  VARCHAR(120),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_otp_log (
      id           BIGSERIAL PRIMARY KEY,
      phone        VARCHAR(20) NOT NULL,
      code_hash    TEXT NOT NULL,
      expires_at   TIMESTAMPTZ NOT NULL,
      consumed_at  TIMESTAMPTZ,
      attempts     INT NOT NULL DEFAULT 0,
      ip           VARCHAR(64),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_otp_phone_created
      ON buyer_otp_log(phone, created_at DESC);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_favorites (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_user_id  UUID NOT NULL REFERENCES buyer_users(id) ON DELETE CASCADE,
      listing_id     UUID NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (buyer_user_id, listing_id)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_favorites_user_created
      ON buyer_favorites(buyer_user_id, created_at DESC);
  `);

  // Hook the existing device-keyed saved-search table (Task #53) up to buyer
  // accounts. Old rows keep working; new logged-in writes also stamp the user.
  await client.query(`
    ALTER TABLE buyer_saved_searches
      ADD COLUMN IF NOT EXISTS buyer_user_id UUID
        REFERENCES buyer_users(id) ON DELETE CASCADE;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_saved_searches_user
      ON buyer_saved_searches(buyer_user_id, created_at DESC)
      WHERE buyer_user_id IS NOT NULL;
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`ALTER TABLE buyer_saved_searches DROP COLUMN IF EXISTS buyer_user_id;`);
  await client.query(`DROP TABLE IF EXISTS buyer_favorites;`);
  await client.query(`DROP TABLE IF EXISTS buyer_otp_log;`);
  await client.query(`DROP TABLE IF EXISTS buyer_users;`);
};

export default {
  up,
  down,
  description:
    'Buyer accounts (OTP login), per-user favorites, OTP audit log, and buyer_user_id on saved searches',
};
