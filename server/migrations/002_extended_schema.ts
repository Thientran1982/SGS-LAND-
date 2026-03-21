/**
 * Migration 002 — Extended schema
 *
 * Adds all tables and columns that are in initializeDatabase() but not in 001_baseline_schema.ts.
 * Uses IF NOT EXISTS / DO $$ blocks so it is safe to run on an already-initialized database.
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Extended multi-tenant schema: all tables, columns, constraints and indexes',

  async up(client) {
    // ---------- Extend users table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='source') THEN
          ALTER TABLE users ADD COLUMN source VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bio') THEN
          ALTER TABLE users ADD COLUMN bio TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='metadata') THEN
          ALTER TABLE users ADD COLUMN metadata JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_at') THEN
          ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
          ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;
    `);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_email_key'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_tenant_id_email_key UNIQUE(tenant_id, email);
        END IF;
      END $$;
    `);

    // ---------- Extend leads table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='address') THEN
          ALTER TABLE leads ADD COLUMN address TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='sla_breached') THEN
          ALTER TABLE leads ADD COLUMN sla_breached BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='social_ids') THEN
          ALTER TABLE leads ADD COLUMN social_ids JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='opt_out_channels') THEN
          ALTER TABLE leads ADD COLUMN opt_out_channels JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='attributes') THEN
          ALTER TABLE leads ADD COLUMN attributes JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='preferences') THEN
          ALTER TABLE leads ADD COLUMN preferences JSONB;
        END IF;
      END $$;
    `);

    // ---------- Extend listings table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='code') THEN
          ALTER TABLE listings ADD COLUMN code VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='location') THEN
          ALTER TABLE listings ADD COLUMN location TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='currency') THEN
          ALTER TABLE listings ADD COLUMN currency VARCHAR(10) DEFAULT 'VND';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='area') THEN
          ALTER TABLE listings ADD COLUMN area NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='bedrooms') THEN
          ALTER TABLE listings ADD COLUMN bedrooms INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='bathrooms') THEN
          ALTER TABLE listings ADD COLUMN bathrooms INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='transaction') THEN
          ALTER TABLE listings ADD COLUMN transaction VARCHAR(50) DEFAULT 'SALE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='hold_expires_at') THEN
          ALTER TABLE listings ADD COLUMN hold_expires_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='project_code') THEN
          ALTER TABLE listings ADD COLUMN project_code VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='contact_phone') THEN
          ALTER TABLE listings ADD COLUMN contact_phone VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='coordinates') THEN
          ALTER TABLE listings ADD COLUMN coordinates JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='is_verified') THEN
          ALTER TABLE listings ADD COLUMN is_verified BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='view_count') THEN
          ALTER TABLE listings ADD COLUMN view_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='booking_count') THEN
          ALTER TABLE listings ADD COLUMN booking_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='total_units') THEN
          ALTER TABLE listings ADD COLUMN total_units INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='available_units') THEN
          ALTER TABLE listings ADD COLUMN available_units INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='owner_name') THEN
          ALTER TABLE listings ADD COLUMN owner_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='owner_phone') THEN
          ALTER TABLE listings ADD COLUMN owner_phone VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='commission') THEN
          ALTER TABLE listings ADD COLUMN commission NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='commission_unit') THEN
          ALTER TABLE listings ADD COLUMN commission_unit VARCHAR(20);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='authorized_agents') THEN
          ALTER TABLE listings ADD COLUMN authorized_agents JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='project_id') THEN
          ALTER TABLE listings ADD COLUMN project_id UUID;
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_listings_tenant_type ON listings(tenant_id, type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);');

    // ---------- Extend proposals table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proposals' AND column_name='created_by_id') THEN
          ALTER TABLE proposals ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // ---------- Extend interactions table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interactions' AND column_name='sender_id') THEN
          ALTER TABLE interactions ADD COLUMN sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interactions' AND column_name='status') THEN
          ALTER TABLE interactions ADD COLUMN status VARCHAR(50) DEFAULT 'PENDING';
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_interactions_lead_dir ON interactions(lead_id, direction, timestamp DESC);');

    // ---------- Extend contracts table ----------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='party_a') THEN
          ALTER TABLE contracts ADD COLUMN party_a JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='party_b') THEN
          ALTER TABLE contracts ADD COLUMN party_b JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='property_details') THEN
          ALTER TABLE contracts ADD COLUMN property_details JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='property_price') THEN
          ALTER TABLE contracts ADD COLUMN property_price NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='deposit_amount') THEN
          ALTER TABLE contracts ADD COLUMN deposit_amount NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='updated_at') THEN
          ALTER TABLE contracts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='payment_terms') THEN
          ALTER TABLE contracts ADD COLUMN payment_terms TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='tax_responsibility') THEN
          ALTER TABLE contracts ADD COLUMN tax_responsibility VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='handover_date') THEN
          ALTER TABLE contracts ADD COLUMN handover_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='handover_condition') THEN
          ALTER TABLE contracts ADD COLUMN handover_condition VARCHAR(500);
        END IF;
      END $$;
    `);

    // ---------- teams ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE teams ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON teams FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- team_members ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        PRIMARY KEY (team_id, user_id)
      );
    `);
    await client.query(`ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON team_members FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- tasks ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'TODO',
        priority VARCHAR(50) DEFAULT 'MEDIUM',
        related_entity_id UUID,
        related_entity_type VARCHAR(50),
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        due_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON tasks FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assigned ON tasks(tenant_id, assigned_to);');

    // ---------- audit_logs ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        actor_id VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        details TEXT,
        metadata JSONB,
        ip_address VARCHAR(45)
      );
    `);
    await client.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON audit_logs FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, timestamp DESC);');

    // ---------- enterprise_config ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS enterprise_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        config_key VARCHAR(255) NOT NULL,
        config_value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE enterprise_config ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enterprise_config' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON enterprise_config FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_config_tenant_key') THEN
          ALTER TABLE enterprise_config ADD CONSTRAINT enterprise_config_tenant_key UNIQUE(tenant_id, config_key);
        END IF;
      END $$;
    `);

    // ---------- favorites ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, listing_id)
      );
    `);
    await client.query(`ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON favorites FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- sequences ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS sequences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        trigger_event VARCHAR(100) NOT NULL,
        steps JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sequences' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON sequences FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- routing_rules ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS routing_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        conditions JSONB DEFAULT '[]'::jsonb,
        action JSONB NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'routing_rules' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON routing_rules FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- scoring_configs ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS scoring_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        weights JSONB DEFAULT '{}'::jsonb,
        thresholds JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE scoring_configs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scoring_configs' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON scoring_configs FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- documents ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        title VARCHAR(500) NOT NULL,
        type VARCHAR(100) DEFAULT 'document',
        content TEXT,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        file_url TEXT,
        size_kb INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON documents FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='size_kb') THEN
          ALTER TABLE documents ADD COLUMN size_kb INTEGER;
        END IF;
      END $$;
    `);

    // ---------- articles ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500),
        content TEXT,
        excerpt TEXT,
        category VARCHAR(100),
        tags JSONB DEFAULT '[]'::jsonb,
        author VARCHAR(255),
        cover_image TEXT,
        status VARCHAR(50) DEFAULT 'DRAFT',
        view_count INTEGER DEFAULT 0,
        published_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE articles ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON articles FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- user_sessions ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      );
    `);
    await client.query(`ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_sessions' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON user_sessions FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);');

    // ---------- templates ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        content TEXT,
        variables JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE templates ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'templates' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON templates FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- campaign_costs ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_costs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        campaign_name VARCHAR(255) NOT NULL,
        source VARCHAR(100) NOT NULL,
        cost NUMERIC NOT NULL DEFAULT 0,
        period VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE campaign_costs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_costs' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON campaign_costs FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- subscriptions ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        plan_id VARCHAR(50) NOT NULL DEFAULT 'ENTERPRISE',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON subscriptions FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- usage_tracking ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        metric_type VARCHAR(100) NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        period VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_tracking' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON usage_tracking FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- ai_safety_logs ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_safety_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        prompt TEXT,
        response TEXT,
        model VARCHAR(255),
        task_type VARCHAR(100),
        latency_ms INTEGER DEFAULT 0,
        cost_usd NUMERIC DEFAULT 0,
        flagged BOOLEAN DEFAULT false,
        safety_flags JSONB DEFAULT '[]'::jsonb,
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE ai_safety_logs ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_safety_logs' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON ai_safety_logs FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- prompt_templates ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        active_version INTEGER DEFAULT 1,
        versions JSONB DEFAULT '[]'::jsonb,
        variables JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_templates' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON prompt_templates FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // ---------- password_reset_tokens (no RLS — cross-tenant) ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);');

    // ---------- visitor_logs (no RLS) ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        session_id VARCHAR(64),
        ip_address VARCHAR(45),
        country VARCHAR(100),
        country_code VARCHAR(10),
        region VARCHAR(100),
        city VARCHAR(100),
        lat NUMERIC(9,6),
        lon NUMERIC(9,6),
        isp VARCHAR(255),
        page VARCHAR(255),
        listing_id UUID,
        user_agent TEXT,
        referrer TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_logs_tenant_created ON visitor_logs(tenant_id, created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_logs_listing ON visitor_logs(listing_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_logs_country ON visitor_logs(tenant_id, country_code);');

    // ---------- projects ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        description TEXT,
        location TEXT,
        total_units INTEGER,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        open_date DATE,
        handover_date DATE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON projects FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_tenant_created ON projects(tenant_id, created_at DESC);');

    // ---------- project_access ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_access (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        partner_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        note TEXT,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        UNIQUE(project_id, partner_tenant_id)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_access_partner ON project_access(partner_tenant_id, status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_access_project ON project_access(project_id);');

    // ---------- listings → projects FK (if projects now exists) ----------
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='project_id') THEN
          BEGIN
            ALTER TABLE listings ADD CONSTRAINT fk_listings_project_id
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(tenant_id, created_at DESC);');
  },

  async down(client) {
    const tables = [
      'project_access', 'projects', 'visitor_logs', 'password_reset_tokens',
      'prompt_templates', 'ai_safety_logs', 'usage_tracking', 'subscriptions',
      'campaign_costs', 'templates', 'user_sessions', 'articles', 'documents',
      'scoring_configs', 'routing_rules', 'sequences', 'favorites', 'enterprise_config',
      'audit_logs', 'tasks', 'team_members', 'teams',
    ];
    for (const t of tables) {
      await client.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }
  },
};

export default migration;
