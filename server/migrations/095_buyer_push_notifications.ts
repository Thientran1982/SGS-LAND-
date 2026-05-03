import type { PoolClient } from 'pg';

/**
 * Buyer push notifications (Task #53).
 *
 * Buyer-side tables — no tenant_id (the marketplace is shared across tenants
 * and the buyer app is anonymous in this sprint, identified by a stable
 * device id from expo-device + AsyncStorage).
 *
 * - buyer_devices: one row per install. Stores the Expo push token + the
 *   user's notification preference (toggle in the Account tab).
 * - buyer_saved_searches: a saved set of marketplace filters per device.
 * - buyer_push_notification_log: dedup log so we never push the same
 *   (device, listing) pair twice for the same saved search.
 */
const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_devices (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id                TEXT NOT NULL UNIQUE,
      expo_push_token          TEXT,
      platform                 VARCHAR(16),
      app_version              VARCHAR(32),
      notifications_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_devices_token
      ON buyer_devices(expo_push_token)
      WHERE expo_push_token IS NOT NULL;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_saved_searches (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id                TEXT NOT NULL,
      label                    TEXT NOT NULL,
      filters                  JSONB NOT NULL DEFAULT '{}'::jsonb,
      notifications_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      last_notified_at         TIMESTAMPTZ,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_saved_searches_device
      ON buyer_saved_searches(device_id, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_saved_searches_active
      ON buyer_saved_searches(notifications_enabled)
      WHERE notifications_enabled = TRUE;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buyer_push_notification_log (
      id                BIGSERIAL PRIMARY KEY,
      device_id         TEXT NOT NULL,
      saved_search_id   UUID NOT NULL,
      listing_id        UUID NOT NULL,
      sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success           BOOLEAN NOT NULL DEFAULT TRUE,
      error             TEXT,
      UNIQUE (device_id, saved_search_id, listing_id)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_buyer_push_log_sent
      ON buyer_push_notification_log(sent_at DESC);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS buyer_push_notification_log;`);
  await client.query(`DROP TABLE IF EXISTS buyer_saved_searches;`);
  await client.query(`DROP TABLE IF EXISTS buyer_devices;`);
};

export default {
  up,
  down,
  description:
    'Buyer push notifications: device registry, saved searches, and dedup log for new-listing alerts',
};
