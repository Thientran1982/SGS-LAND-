import { PoolClient } from 'pg';

const migration = {
  description: 'Ensure articles.images (jsonb) and articles.featured (boolean) columns exist',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    `);
    await client.query(`
      ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    // Intentionally left as no-op — removing these columns could destroy data.
  },
};

export default migration;
