import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Add idempotent auction booking conversion and contract linkage',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auction_id UUID;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_one_per_auction
        ON contracts(auction_id) WHERE auction_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS auction_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        auction_id UUID NOT NULL,
        listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
        winner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CONFIRMATION'
          CHECK (status IN ('PENDING_CONFIRMATION','CONFIRMED','CANCELLED')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, auction_id)
      );
      CREATE INDEX IF NOT EXISTS idx_auction_bookings_tenant_status
        ON auction_bookings(tenant_id, status, created_at DESC);
      ALTER TABLE auction_bookings ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auction_bookings' AND policyname = 'auction_bookings_tenant_isolation') THEN
          CREATE POLICY auction_bookings_tenant_isolation ON auction_bookings
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS auction_bookings; DROP INDEX IF EXISTS idx_contracts_one_per_auction; ALTER TABLE contracts DROP COLUMN IF EXISTS auction_id;');
  },
};

export default migration;