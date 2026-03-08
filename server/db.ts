import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a new PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to initialize the database schema with Multi-Tenancy (RLS)
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema with Multi-Tenancy (RLS)...');
    
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 1. Tenants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE NOT NULL,
        config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default tenant if not exists
    await client.query(`
      INSERT INTO tenants (id, name, domain)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'localhost')
      ON CONFLICT (domain) DO NOTHING;
    `);

    // Helper function to create table with tenant_id and RLS
    const createTenantTable = async (tableName: string, schema: string) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${schema}
        );
      `);
      
      // Add tenant_id if it doesn't exist (for existing tables)
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${tableName}' AND column_name='tenant_id') THEN 
            ALTER TABLE ${tableName} ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
          END IF; 
        END $$;
      `);

      // Enable RLS
      await client.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);

      // Create Policy
      await client.query(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON ${tableName};
        CREATE POLICY tenant_isolation_policy ON ${tableName}
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      `);
    };

    // 2. Users
    await createTenantTable('users', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
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
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_tenant_id_email_key UNIQUE(tenant_id, email);`);

    // 3. Teams
    await createTenantTable('teams', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      name VARCHAR(255) NOT NULL,
      lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    // 4. Team Members
    await createTenantTable('team_members', `
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      PRIMARY KEY (team_id, user_id)
    `);

    // 5. Leads
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

    // 6. Listings
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
      is_favorite BOOLEAN DEFAULT false,
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

    // 7. Proposals
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

    // 8. Interactions
    await createTenantTable('interactions', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      channel VARCHAR(50) NOT NULL,
      direction VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      status VARCHAR(50) DEFAULT 'PENDING',
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    // 9. Tasks
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

    // 10. Contracts
    await createTenantTable('contracts', `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
      proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      value NUMERIC NOT NULL,
      signed_at TIMESTAMP WITH TIME ZONE,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    // 11. Audit Logs
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

    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    // Don't throw, let the app start even if DB is missing for preview purposes
  } finally {
    client.release();
  }
}

// Helper to execute queries within a tenant context
export async function withTenantContext<T>(
  tenantId: string,
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Set the tenant ID for the current transaction/session
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
    return await queryFn(client);
  } finally {
    // Reset the setting to avoid leaking context to other requests using the same pooled client
    await client.query(`RESET app.current_tenant_id`);
    client.release();
  }
}

