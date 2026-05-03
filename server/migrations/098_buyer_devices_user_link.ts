/**
 * 098 — Link buyer devices to authenticated buyer accounts so messaging push
 * notifications (Task #55) can find every Expo push token belonging to a
 * given buyer user when the agent sends a message.
 *
 * `buyer_devices` was originally keyed only by an opaque device id (Task #53)
 * because the buyer surface was anonymous at that time. After Task #52
 * (phone+OTP login) we can now stamp the buyer user id whenever a logged-in
 * buyer registers/refreshes a push token. The column is nullable so anonymous
 * devices keep working for saved-search alerts.
 */

import { PoolClient } from 'pg';

export default {
  description: 'Add buyer_user_id to buyer_devices for messaging push',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE buyer_devices
        ADD COLUMN IF NOT EXISTS buyer_user_id UUID
          REFERENCES buyer_users(id) ON DELETE SET NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_buyer_devices_buyer_user_id
        ON buyer_devices(buyer_user_id)
        WHERE buyer_user_id IS NOT NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP INDEX IF EXISTS idx_buyer_devices_buyer_user_id;`);
    await client.query(`ALTER TABLE buyer_devices DROP COLUMN IF EXISTS buyer_user_id;`);
  },
};
