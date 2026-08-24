import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Create tenant-scoped auction sessions and bids',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS auction_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
        title VARCHAR(500) NOT NULL,
        start_price NUMERIC(20,2) NOT NULL CHECK (start_price >= 0),
        step_price NUMERIC(20,2) NOT NULL CHECK (step_price > 0),
        current_bid NUMERIC(20,2) NOT NULL CHECK (current_bid >= 0),
        bid_count INTEGER NOT NULL DEFAULT 0 CHECK (bid_count >= 0),
        status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING'
          CHECK (status IN ('UPCOMING', 'LIVE', 'PAUSED', 'ENDED', 'CANCELLED')),
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        winning_bid NUMERIC(20,2),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (ends_at > starts_at),
        UNIQUE (id, tenant_id)
      );
      CREATE INDEX IF NOT EXISTS idx_auction_sessions_tenant_status
        ON auction_sessions(tenant_id, status, ends_at);
      CREATE INDEX IF NOT EXISTS idx_auction_sessions_tenant_listing
        ON auction_sessions(tenant_id, listing_id);

      CREATE TABLE IF NOT EXISTS auction_bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auction_id UUID NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
        idempotency_key VARCHAR(160) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (auction_id, tenant_id)
          REFERENCES auction_sessions(id, tenant_id) ON DELETE CASCADE,
        UNIQUE (auction_id, bidder_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_created
        ON auction_bids(auction_id, created_at DESC);
      ALTER TABLE auction_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auction_sessions' AND policyname = 'auction_sessions_tenant_isolation') THEN
          CREATE POLICY auction_sessions_tenant_isolation ON auction_sessions
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auction_bids' AND policyname = 'auction_bids_tenant_isolation') THEN
          CREATE POLICY auction_bids_tenant_isolation ON auction_bids
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS auction_bids; DROP TABLE IF EXISTS auction_sessions;');
  },
};

export default migration;