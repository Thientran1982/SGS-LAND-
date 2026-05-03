import type { PoolClient } from 'pg';

/**
 * Buyer ↔ agent realtime messaging (Task #55).
 *
 * `conversations` is the durable thread between one buyer (buyer_users) and
 * the agent assigned to a listing (users.assigned_to). One thread per
 * (buyer, listing) pair so reopening the listing reuses the same thread.
 * `tenant_id` is denormalised from the listing so vendor admins can scope
 * conversations by tenant without joining listings every read.
 *
 * `messages` carries the timeline. `sender_kind` is BUYER or AGENT — we
 * keep both kinds in one table because socket fan-out is room-based and
 * the consumer doesn't care about the schema split.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id             UUID NOT NULL,
      buyer_user_id         UUID NOT NULL REFERENCES buyer_users(id) ON DELETE CASCADE,
      agent_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
      listing_id            UUID,
      last_message_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_preview  TEXT,
      unread_for_buyer      INT NOT NULL DEFAULT 0,
      unread_for_agent      INT NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // One conversation per (buyer, listing). NULL listing_id is allowed but
  // not deduped — generic "ask the vendor" threads are rare and acceptable.
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_buyer_listing
      ON conversations(buyer_user_id, listing_id)
      WHERE listing_id IS NOT NULL;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_buyer_recent
      ON conversations(buyer_user_id, last_message_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_agent_recent
      ON conversations(agent_user_id, last_message_at DESC)
      WHERE agent_user_id IS NOT NULL;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_kind     VARCHAR(8) NOT NULL CHECK (sender_kind IN ('BUYER','AGENT')),
      sender_user_id  UUID NOT NULL,
      body            TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at         TIMESTAMPTZ
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv_created
      ON messages(conversation_id, created_at DESC);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS messages;`);
  await client.query(`DROP TABLE IF EXISTS conversations;`);
};

export default {
  up,
  down,
  description: 'Buyer ↔ agent realtime messaging: conversations + messages tables',
};
