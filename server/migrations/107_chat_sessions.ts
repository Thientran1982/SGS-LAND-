/**
 * Migration 107 — Create chat_sessions table
 *
 * Implements Tier 2 (Session Memory) of MEMORY.md:
 * - session_id: stable UUID from client localStorage
 * - messages: last N messages JSONB (capped server-side)
 * - user_profile: extracted { budget, district, purpose, timeline }
 * - intent_history: array of detected intents this session
 */
import type { Migration } from './runner';

const migration: Migration = {
    description: 'Create chat_sessions table for AI widget session memory (Tier 2)',

    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                session_id      TEXT UNIQUE NOT NULL,
                lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
                messages        JSONB NOT NULL DEFAULT '[]'::jsonb,
                user_profile    JSONB NOT NULL DEFAULT '{}'::jsonb,
                intent_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id
                ON chat_sessions(session_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_lead_id
                ON chat_sessions(lead_id);
        `);
    },

    async down(client) {
        await client.query(`DROP TABLE IF EXISTS chat_sessions;`);
    },
};

export default migration;
