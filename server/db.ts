import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema with Multi-Tenancy (RLS)...');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE NOT NULL,
        config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO tenants (id, name, domain)
      VALUES ('00000000-0000-0000-0000-000000000001', 'SGS Land Demo', 'localhost')
      ON CONFLICT (domain) DO NOTHING;
    `);

    const createTenantTable = async (tableName: string, schema: string) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${schema}
        );
      `);
      
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${tableName}' AND column_name='tenant_id') THEN 
            ALTER TABLE ${tableName} ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
          END IF; 
        END $$;
      `);

      await client.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);

      await client.query(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON ${tableName};
        CREATE POLICY tenant_isolation_policy ON ${tableName}
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      `);
    };

    await createTenantTable('users', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255),
      role VARCHAR(50) DEFAULT 'VIEWER',
      permissions JSONB,
      avatar TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      source VARCHAR(50),
      phone VARCHAR(50),
      bio TEXT,
      metadata JSONB,
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        END IF;
      END $$;
    `);

    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_tenant_id_email_key UNIQUE(tenant_id, email);`);

    await createTenantTable('teams', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('team_members', `
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      PRIMARY KEY (team_id, user_id)
    `);

    await createTenantTable('leads', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      address TEXT,
      source VARCHAR(100),
      stage VARCHAR(50) DEFAULT 'NEW',
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      tags JSONB DEFAULT '[]'::jsonb,
      notes TEXT,
      score JSONB,
      sla_breached BOOLEAN DEFAULT false,
      social_ids JSONB,
      opt_out_channels JSONB DEFAULT '[]'::jsonb,
      attributes JSONB,
      preferences JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('listings', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      code VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      location TEXT NOT NULL,
      price NUMERIC NOT NULL,
      currency VARCHAR(10) DEFAULT 'VND',
      area NUMERIC NOT NULL,
      bedrooms INTEGER,
      bathrooms INTEGER,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'AVAILABLE',
      transaction VARCHAR(50) DEFAULT 'SALE',
      attributes JSONB DEFAULT '{}'::jsonb,
      hold_expires_at TIMESTAMP WITH TIME ZONE,
      images JSONB DEFAULT '[]'::jsonb,
      project_code VARCHAR(100),
      contact_phone VARCHAR(50),
      coordinates JSONB,
      is_verified BOOLEAN DEFAULT false,
      view_count INTEGER DEFAULT 0,
      booking_count INTEGER DEFAULT 0,
      total_units INTEGER,
      available_units INTEGER,
      owner_name VARCHAR(255),
      owner_phone VARCHAR(50),
      commission NUMERIC,
      commission_unit VARCHAR(20),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      authorized_agents JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('proposals', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
      base_price NUMERIC NOT NULL,
      discount_amount NUMERIC DEFAULT 0,
      final_price NUMERIC NOT NULL,
      currency VARCHAR(10) DEFAULT 'VND',
      status VARCHAR(50) DEFAULT 'DRAFT',
      token VARCHAR(255) UNIQUE,
      valid_until TIMESTAMP WITH TIME ZONE,
      created_by VARCHAR(255),
      created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('interactions', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      channel VARCHAR(50) NOT NULL,
      direction VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
      content TEXT NOT NULL,
      metadata JSONB,
      status VARCHAR(50) DEFAULT 'PENDING',
      sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interactions' AND column_name='sender_id') THEN
          ALTER TABLE interactions ADD COLUMN sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await createTenantTable('tasks', `
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
    `);

    await createTenantTable('contracts', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      party_a JSONB DEFAULT '{}'::jsonb,
      party_b JSONB DEFAULT '{}'::jsonb,
      property_details JSONB DEFAULT '{}'::jsonb,
      property_price NUMERIC,
      deposit_amount NUMERIC,
      payment_terms TEXT,
      tax_responsibility TEXT,
      handover_date TIMESTAMP WITH TIME ZONE,
      handover_condition TEXT,
      signed_at TIMESTAMP WITH TIME ZONE,
      metadata JSONB,
      created_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='lead_id') THEN
          ALTER TABLE contracts ADD COLUMN lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='listing_id') THEN
          ALTER TABLE contracts ADD COLUMN listing_id UUID REFERENCES listings(id) ON DELETE CASCADE;
        END IF;
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
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='created_by') THEN
          ALTER TABLE contracts ADD COLUMN created_by VARCHAR(255);
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

    await createTenantTable('audit_logs', `
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
    `);

    await createTenantTable('enterprise_config', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      config_key VARCHAR(255) NOT NULL,
      config_value JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE enterprise_config DROP CONSTRAINT IF EXISTS enterprise_config_tenant_key;
      ALTER TABLE enterprise_config ADD CONSTRAINT enterprise_config_tenant_key UNIQUE(tenant_id, config_key);
    `);

    await createTenantTable('favorites', `
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, listing_id)
    `);

    await createTenantTable('sequences', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      trigger_event VARCHAR(100) NOT NULL,
      steps JSONB DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('routing_rules', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      conditions JSONB DEFAULT '[]'::jsonb,
      action JSONB NOT NULL,
      priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('scoring_configs', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      weights JSONB DEFAULT '{}'::jsonb,
      thresholds JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('documents', `
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
    `);

    await createTenantTable('articles', `
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
    `);

    await createTenantTable('user_sessions', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    `);

    await createTenantTable('templates', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'general',
      content TEXT,
      variables JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('campaign_costs', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      campaign_name VARCHAR(255) NOT NULL,
      source VARCHAR(100) NOT NULL,
      cost NUMERIC NOT NULL DEFAULT 0,
      period VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('subscriptions', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      plan_id VARCHAR(50) NOT NULL DEFAULT 'ENTERPRISE',
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('usage_tracking', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      metric_type VARCHAR(100) NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      period VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await createTenantTable('ai_safety_logs', `
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
    `);

    await createTenantTable('prompt_templates', `
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
    `);

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

    try {
      await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_kb INTEGER;');
    } catch (e) { /* column may already exist */ }

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
    await client.query('ALTER TABLE projects ENABLE ROW LEVEL SECURITY;');
    await client.query(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON projects;
      CREATE POLICY tenant_isolation_policy ON projects
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_tenant_created ON projects(tenant_id, created_at DESC);');

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

    try {
      await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;');
    } catch (e) { /* column may already exist */ }

    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage)',
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone)',
      'CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_listings_tenant_status ON listings(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_listings_tenant_type ON listings(tenant_id, type)',
      'CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON interactions(tenant_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id)',
      'CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status ON contracts(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assigned ON tasks(tenant_id, assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role)',
      'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(tenant_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_lead_dir ON interactions(lead_id, direction, timestamp DESC)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function withTenantContext<T>(
  tenantId: string,
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const sanitized = tenantId.replace(/[^a-f0-9\-]/gi, '');
  if (sanitized.length !== tenantId.length) {
    throw new Error('Invalid tenant ID format');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant_id = '${sanitized}'`);
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
