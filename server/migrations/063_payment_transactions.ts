import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '063: Persistent payment transactions for self-upgrade checkout',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email        VARCHAR(255),
        plan_id           VARCHAR(50) NOT NULL,
        plan_name         VARCHAR(100) NOT NULL,
        amount_cents      INT NOT NULL,
        currency          VARCHAR(8) NOT NULL DEFAULT 'USD',
        status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        provider          VARCHAR(20) NOT NULL DEFAULT 'mock',
        provider_session_id VARCHAR(255),
        provider_payment_id VARCHAR(255),
        idempotency_key   VARCHAR(255) UNIQUE,
        metadata          JSONB DEFAULT '{}'::jsonb,
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at        TIMESTAMP WITH TIME ZONE,
        paid_at           TIMESTAMP WITH TIME ZONE,
        cancelled_at      TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_created
        ON payment_transactions (tenant_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_tx_status
        ON payment_transactions (status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_session
        ON payment_transactions (provider_session_id)
        WHERE provider_session_id IS NOT NULL;
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS payment_transactions CASCADE`);
  },
};

export default migration;
