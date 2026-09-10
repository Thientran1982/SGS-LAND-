import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow the privileged skill publication path to inspect binding tenant IDs for cache invalidation',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      DROP POLICY IF EXISTS agent_skill_binding_cache_lookup ON agent_skill_bindings;
      CREATE POLICY agent_skill_binding_cache_lookup ON agent_skill_bindings
        AS PERMISSIVE
        FOR SELECT
        TO PUBLIC
        USING (current_setting('app.bypass_rls', true) = 'on');
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP POLICY IF EXISTS agent_skill_binding_cache_lookup ON agent_skill_bindings');
  },
};

export default migration;