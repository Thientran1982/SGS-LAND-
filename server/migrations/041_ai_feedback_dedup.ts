import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add unique constraint on ai_feedback for deduplication and recency index',

  async up(client: PoolClient) {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_feedback_dedup 
        ON ai_feedback (tenant_id, interaction_id, user_id) 
        WHERE interaction_id IS NOT NULL AND user_id IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_feedback_intent_recency 
        ON ai_feedback (tenant_id, intent, rating, created_at DESC)
        WHERE intent IS NOT NULL
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP INDEX IF EXISTS idx_ai_feedback_dedup`);
    await client.query(`DROP INDEX IF EXISTS idx_ai_feedback_intent_recency`);
  },
};

export default migration;
