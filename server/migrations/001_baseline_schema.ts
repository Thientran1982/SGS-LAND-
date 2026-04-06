/**
 * Migration 001 — Baseline schema
 *
 * Captures the initial state already handled by initializeDatabase().
 * Uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS so it is
 * safe to run against an already-initialized database.
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Baseline multi-tenant schema with RLS and indexes',

  async up(client) {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // --- Tenants ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(255) NOT NULL,
        domain     VARCHAR(255) UNIQUE NOT NULL,
        config     JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO tenants (id, name, domain)
      VALUES ('00000000-0000-0000-0000-000000000001', 'SGS Land Demo', 'localhost')
      ON CONFLICT (domain) DO NOTHING;
    `);

    // --- Users ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        email        VARCHAR(255) NOT NULL,
        password     VARCHAR(255),
        name         VARCHAR(255),
        role         VARCHAR(50) DEFAULT 'SALES',
        status       VARCHAR(50) DEFAULT 'ACTIVE',
        avatar       TEXT,
        phone        VARCHAR(50),
        permissions  JSONB DEFAULT '[]'::jsonb,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, email)
      );
    `);

    // --- Leads ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name        VARCHAR(255) NOT NULL,
        phone       VARCHAR(50),
        email       VARCHAR(255),
        source      VARCHAR(100),
        stage       VARCHAR(50) DEFAULT 'NEW',
        score       JSONB DEFAULT '{}'::jsonb,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        notes       TEXT,
        tags        JSONB DEFAULT '[]'::jsonb,
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Listings ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        title       VARCHAR(500),
        type        VARCHAR(100),
        status      VARCHAR(50) DEFAULT 'AVAILABLE',
        price       NUMERIC,
        address     TEXT,
        attributes  JSONB DEFAULT '{}'::jsonb,
        images      JSONB DEFAULT '[]'::jsonb,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Proposals ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS proposals (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
        listing_id      UUID REFERENCES listings(id) ON DELETE SET NULL,
        base_price      NUMERIC,
        discount_amount NUMERIC DEFAULT 0,
        final_price     NUMERIC,
        currency        VARCHAR(10) DEFAULT 'VND',
        status          VARCHAR(50) DEFAULT 'DRAFT',
        token           VARCHAR(255) UNIQUE,
        valid_until     TIMESTAMP WITH TIME ZONE,
        metadata        JSONB DEFAULT '{}'::jsonb,
        created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Contracts ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
        listing_id  UUID REFERENCES listings(id) ON DELETE SET NULL,
        proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
        type        VARCHAR(100),
        status      VARCHAR(50) DEFAULT 'DRAFT',
        value       NUMERIC,
        signed_at   TIMESTAMP WITH TIME ZONE,
        created_by  VARCHAR(255),
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Interactions ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS interactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
        type        VARCHAR(50),
        channel     VARCHAR(50),
        direction   VARCHAR(20) DEFAULT 'OUTBOUND',
        content     TEXT,
        metadata    JSONB DEFAULT '{}'::jsonb,
        timestamp   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Compound indexes ---
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage)',
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone)',
      'CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_listings_tenant_status ON listings(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON interactions(tenant_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status ON contracts(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    // --- RLS ---
    const tables = ['users', 'leads', 'listings', 'proposals', 'contracts', 'interactions'];
    for (const t of tables) {
      await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = '${t}_tenant_isolation'
          ) THEN
            CREATE POLICY ${t}_tenant_isolation ON ${t}
              USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
          END IF;
        END $$;
      `);
    }
  },

  async down(client) {
    // Dangerous: only for test environments
    const tables = ['interactions', 'contracts', 'proposals', 'listings', 'leads', 'users', 'tenants'];
    for (const t of tables) {
      await client.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }
  },
};

export default migration;
