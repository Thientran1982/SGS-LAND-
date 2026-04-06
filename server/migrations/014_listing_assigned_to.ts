import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add assigned_to column to listings for internal role-based assignment',

  async up(client) {
    await client.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_tenant_assigned
        ON listings(tenant_id, assigned_to);
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_listings_tenant_assigned;`);
    await client.query(`ALTER TABLE listings DROP COLUMN IF EXISTS assigned_to;`);
  },
};

export default migration;
