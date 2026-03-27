import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Create notifications table for persistent in-app notifications',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        user_id     UUID NOT NULL,
        type        VARCHAR(64) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT,
        metadata    JSONB DEFAULT '{}'::jsonb,
        read_at     TIMESTAMP WITH TIME ZONE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications (tenant_id, user_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications (tenant_id, user_id, read_at)
        WHERE read_at IS NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS notifications;`);
  },
};

export default migration;
