import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Create bank_rates table for user-submitted interest rate listings',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_rates (
        id            SERIAL PRIMARY KEY,
        tenant_id     VARCHAR(36)     NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        bank_name     VARCHAR(120)    NOT NULL,
        bank_slug     VARCHAR(120)    NOT NULL,
        loan_type     VARCHAR(120)    NOT NULL,
        rate_min      DECIMAL(5,2)    NOT NULL,
        rate_max      DECIMAL(5,2),
        tenor_min     INTEGER,
        tenor_max     INTEGER,
        contact_name  VARCHAR(200),
        contact_phone VARCHAR(30),
        notes         TEXT,
        is_verified   BOOLEAN         NOT NULL DEFAULT FALSE,
        submitted_by  VARCHAR(36),
        updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bank_rates_tenant   ON bank_rates(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_bank_rates_slug     ON bank_rates(bank_slug);
      CREATE INDEX IF NOT EXISTS idx_bank_rates_created  ON bank_rates(created_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS bank_rates;`);
  },
};

export default migration;
