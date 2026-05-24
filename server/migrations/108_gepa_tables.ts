/**
 * Migration 108 — GEPA tables + chat_sessions columns for Phase 4
 *
 * 1. ALTER chat_sessions: add turn_count, session_status
 * 2. CREATE prompt_variants: GEPA evolutionary prompt optimization
 * 3. CREATE feedback_events: user feedback for GEPA fitness scoring
 */
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add GEPA tables (prompt_variants, feedback_events) and turn_count/session_status to chat_sessions',

  async up(client) {
    // 1. Extend chat_sessions with turn tracking
    await client.query(`
      ALTER TABLE chat_sessions
        ADD COLUMN IF NOT EXISTS turn_count     INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS session_status TEXT    NOT NULL DEFAULT 'active';
    `);

    // 2. GEPA prompt variants
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_variants (
        id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id            TEXT    NOT NULL,
        system_prompt_suffix TEXT   NOT NULL,
        fitness_score       FLOAT   NOT NULL DEFAULT 0.5,
        generation_count    INTEGER NOT NULL DEFAULT 0,
        wins                INTEGER NOT NULL DEFAULT 0,
        losses              INTEGER NOT NULL DEFAULT 0,
        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_variants_agent
        ON prompt_variants(agent_id, fitness_score DESC);
    `);

    // 3. Feedback events
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback_events (
        id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id  TEXT    NOT NULL,
        message_id  TEXT    NOT NULL,
        agent_id    TEXT    NOT NULL,
        variant_id  UUID,
        rating      TEXT    NOT NULL CHECK (rating IN ('positive','negative','neutral')),
        timestamp   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        optimized_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (session_id, message_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_events_agent
        ON feedback_events(agent_id, optimized_at);
    `);
  },

  async down(client) {
    await client.query(`DROP TABLE IF EXISTS feedback_events;`);
    await client.query(`DROP TABLE IF EXISTS prompt_variants;`);
    await client.query(`
      ALTER TABLE chat_sessions
        DROP COLUMN IF EXISTS turn_count,
        DROP COLUMN IF EXISTS session_status;
    `);
  },
};

export default migration;
