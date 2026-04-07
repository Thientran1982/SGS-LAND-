import { PoolClient } from 'pg';

const migration = {
  description: 'Add articles.videos (jsonb) column for storing uploaded video URLs',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    // Intentionally left as no-op — removing this column could destroy data.
  },
};

export default migration;
