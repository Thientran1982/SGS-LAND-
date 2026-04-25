import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'RAG vector store — enable pgvector, create knowledge_chunks table with HNSW index',

  async up(client: PoolClient): Promise<void> {
    // 1. Enable pgvector extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. knowledge_chunks: each row is one embedded chunk of a source document/article
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID NOT NULL,
        source_type   VARCHAR(30) NOT NULL,   -- 'document' | 'article' | 'listing'
        source_id     VARCHAR(100) NOT NULL,
        chunk_index   INT NOT NULL DEFAULT 0,
        content       TEXT NOT NULL,
        embedding     vector(768),
        metadata      JSONB DEFAULT '{}',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tenant_id, source_type, source_id, chunk_index)
      )
    `);

    // 3. RLS: tenants can only see their own chunks
    await client.query(`ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'knowledge_chunks' AND policyname = 'knowledge_chunks_tenant_isolation'
        ) THEN
          CREATE POLICY knowledge_chunks_tenant_isolation ON knowledge_chunks
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$
    `);

    // 4. HNSW index for fast cosine similarity search (better than ivfflat for <1M rows)
    await client.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
        ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);

    // 5. B-tree indexes for filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_tenant_source_idx
        ON knowledge_chunks (tenant_id, source_type, source_id)
    `);

    // 6. Trigger: auto-update updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_knowledge_chunks_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'knowledge_chunks_updated_at'
        ) THEN
          CREATE TRIGGER knowledge_chunks_updated_at
            BEFORE UPDATE ON knowledge_chunks
            FOR EACH ROW EXECUTE FUNCTION update_knowledge_chunks_updated_at();
        END IF;
      END $$
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS knowledge_chunks CASCADE`);
    await client.query(`DROP FUNCTION IF EXISTS update_knowledge_chunks_updated_at CASCADE`);
  },
};

export default migration;
