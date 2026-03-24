import type { Migration } from './runner';

const migration: Migration = {
  description: 'Create user_page_views table for tracking which pages each user visits',

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_page_views (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        path VARCHAR(255) NOT NULL,
        page_label VARCHAR(255) NOT NULL DEFAULT '',
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
        ip_address VARCHAR(45)
      );
    `);

    await client.query(`ALTER TABLE user_page_views ENABLE ROW LEVEL SECURITY;`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_page_views' AND policyname = 'tenant_isolation_policy') THEN
          CREATE POLICY tenant_isolation_policy ON user_page_views FOR ALL
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_page_views_tenant_user_visited
        ON user_page_views(tenant_id, user_id, visited_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_page_views_tenant_visited
        ON user_page_views(tenant_id, visited_at DESC);
    `);
  },

  async down(client) {
    await client.query(`DROP TABLE IF EXISTS user_page_views CASCADE;`);
  },
};

export default migration;
