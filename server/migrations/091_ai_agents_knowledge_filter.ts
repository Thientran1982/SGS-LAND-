import { PoolClient } from 'pg';

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    ALTER TABLE ai_agents
      ADD COLUMN IF NOT EXISTS knowledge_filter jsonb NOT NULL DEFAULT '{}'::jsonb;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_agents_knowledge_filter
      ON ai_agents USING gin (knowledge_filter);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP INDEX IF EXISTS idx_ai_agents_knowledge_filter;`);
  await client.query(`ALTER TABLE ai_agents DROP COLUMN IF EXISTS knowledge_filter;`);
};

export default {
  up,
  down,
  description: 'Add knowledge_filter jsonb column to ai_agents for per-agent RAG scoping',
};
