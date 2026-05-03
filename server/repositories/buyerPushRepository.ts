/**
 * Buyer push repository (Task #53).
 *
 * Backs `buyer_devices`, `buyer_saved_searches`, and `buyer_push_notification_log`.
 * These are buyer-facing public tables (no tenant scoping) — written through
 * the raw pool, not through tenant-context RLS.
 */

import { Pool, PoolClient } from 'pg';
import { pool as defaultPool } from '../db';

export interface BuyerDevice {
  id: string;
  deviceId: string;
  expoPushToken: string | null;
  platform: string | null;
  appVersion: string | null;
  notificationsEnabled: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerSavedSearch {
  id: string;
  deviceId: string;
  label: string;
  filters: Record<string, any>;
  notificationsEnabled: boolean;
  lastNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToDevice(r: any): BuyerDevice {
  return {
    id: r.id,
    deviceId: r.device_id,
    expoPushToken: r.expo_push_token,
    platform: r.platform,
    appVersion: r.app_version,
    notificationsEnabled: !!r.notifications_enabled,
    lastSeenAt: r.last_seen_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToSearch(r: any): BuyerSavedSearch {
  return {
    id: r.id,
    deviceId: r.device_id,
    label: r.label,
    filters: r.filters || {},
    notificationsEnabled: !!r.notifications_enabled,
    lastNotifiedAt: r.last_notified_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class BuyerPushRepository {
  constructor(private readonly pool: Pool = defaultPool) {}

  // ── Devices ────────────────────────────────────────────────────────────────

  async upsertDevice(input: {
    deviceId: string;
    expoPushToken?: string | null;
    platform?: string | null;
    appVersion?: string | null;
  }): Promise<BuyerDevice> {
    const res = await this.pool.query(
      `INSERT INTO buyer_devices (device_id, expo_push_token, platform, app_version, last_seen_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         expo_push_token = COALESCE(EXCLUDED.expo_push_token, buyer_devices.expo_push_token),
         platform        = COALESCE(EXCLUDED.platform,        buyer_devices.platform),
         app_version     = COALESCE(EXCLUDED.app_version,     buyer_devices.app_version),
         last_seen_at    = NOW(),
         updated_at      = NOW()
       RETURNING *`,
      [
        input.deviceId,
        input.expoPushToken ?? null,
        input.platform ?? null,
        input.appVersion ?? null,
      ],
    );
    return rowToDevice(res.rows[0]);
  }

  async setDevicePreference(deviceId: string, enabled: boolean): Promise<BuyerDevice | null> {
    const res = await this.pool.query(
      `UPDATE buyer_devices
          SET notifications_enabled = $2, updated_at = NOW()
        WHERE device_id = $1
        RETURNING *`,
      [deviceId, enabled],
    );
    return res.rows[0] ? rowToDevice(res.rows[0]) : null;
  }

  async findDevice(deviceId: string): Promise<BuyerDevice | null> {
    const res = await this.pool.query(
      `SELECT * FROM buyer_devices WHERE device_id = $1`,
      [deviceId],
    );
    return res.rows[0] ? rowToDevice(res.rows[0]) : null;
  }

  // ── Saved searches ─────────────────────────────────────────────────────────

  async listSavedSearches(deviceId: string): Promise<BuyerSavedSearch[]> {
    const res = await this.pool.query(
      `SELECT * FROM buyer_saved_searches
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [deviceId],
    );
    return res.rows.map(rowToSearch);
  }

  async createSavedSearch(input: {
    deviceId: string;
    label: string;
    filters: Record<string, any>;
    notificationsEnabled?: boolean;
  }): Promise<BuyerSavedSearch> {
    const res = await this.pool.query(
      `INSERT INTO buyer_saved_searches
         (device_id, label, filters, notifications_enabled)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [
        input.deviceId,
        input.label.slice(0, 200),
        JSON.stringify(input.filters || {}),
        input.notificationsEnabled !== false,
      ],
    );
    return rowToSearch(res.rows[0]);
  }

  async updateSavedSearch(
    id: string,
    deviceId: string,
    patch: { label?: string; filters?: Record<string, any>; notificationsEnabled?: boolean },
  ): Promise<BuyerSavedSearch | null> {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (patch.label !== undefined) { sets.push(`label = $${i++}`); vals.push(patch.label.slice(0, 200)); }
    if (patch.filters !== undefined) { sets.push(`filters = $${i++}::jsonb`); vals.push(JSON.stringify(patch.filters || {})); }
    if (patch.notificationsEnabled !== undefined) { sets.push(`notifications_enabled = $${i++}`); vals.push(patch.notificationsEnabled); }
    if (!sets.length) {
      const cur = await this.pool.query(
        `SELECT * FROM buyer_saved_searches WHERE id = $1 AND device_id = $2`,
        [id, deviceId],
      );
      return cur.rows[0] ? rowToSearch(cur.rows[0]) : null;
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id, deviceId);
    const res = await this.pool.query(
      `UPDATE buyer_saved_searches
          SET ${sets.join(', ')}
        WHERE id = $${i++} AND device_id = $${i++}
        RETURNING *`,
      vals,
    );
    return res.rows[0] ? rowToSearch(res.rows[0]) : null;
  }

  async deleteSavedSearch(id: string, deviceId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM buyer_saved_searches WHERE id = $1 AND device_id = $2`,
      [id, deviceId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ── Matching engine ────────────────────────────────────────────────────────

  /**
   * Return all saved searches that are eligible for new-listing matching:
   *   - notifications_enabled = true on the search
   *   - parent device exists, has a non-null expo_push_token, and
   *     notifications_enabled = true
   */
  async findActiveSearchesWithDevice(): Promise<
    Array<{ search: BuyerSavedSearch; device: BuyerDevice }>
  > {
    const res = await this.pool.query(`
      SELECT s.*,
             d.id            AS d_id,
             d.device_id     AS d_device_id,
             d.expo_push_token AS d_expo_push_token,
             d.platform      AS d_platform,
             d.app_version   AS d_app_version,
             d.notifications_enabled AS d_notifications_enabled,
             d.last_seen_at  AS d_last_seen_at,
             d.created_at    AS d_created_at,
             d.updated_at    AS d_updated_at
        FROM buyer_saved_searches s
        JOIN buyer_devices d ON d.device_id = s.device_id
       WHERE s.notifications_enabled = TRUE
         AND d.notifications_enabled = TRUE
         AND d.expo_push_token IS NOT NULL
       ORDER BY s.created_at ASC
    `);
    return res.rows.map((r) => ({
      search: rowToSearch(r),
      device: rowToDevice({
        id: r.d_id,
        device_id: r.d_device_id,
        expo_push_token: r.d_expo_push_token,
        platform: r.d_platform,
        app_version: r.d_app_version,
        notifications_enabled: r.d_notifications_enabled,
        last_seen_at: r.d_last_seen_at,
        created_at: r.d_created_at,
        updated_at: r.d_updated_at,
      }),
    }));
  }

  /**
   * Atomically claim (device, search, listing) tuples that have not been
   * notified yet. Returns the list of listing_ids that were inserted (i.e.
   * are new to this device for this saved search).
   */
  async claimUnnotifiedListings(
    deviceId: string,
    savedSearchId: string,
    listingIds: string[],
  ): Promise<string[]> {
    if (!listingIds.length) return [];
    const res = await this.pool.query(
      `INSERT INTO buyer_push_notification_log (device_id, saved_search_id, listing_id)
       SELECT $1, $2, unnest($3::uuid[])
       ON CONFLICT (device_id, saved_search_id, listing_id) DO NOTHING
       RETURNING listing_id`,
      [deviceId, savedSearchId, listingIds],
    );
    return res.rows.map((r) => r.listing_id as string);
  }

  /**
   * Move the watermark forward to `at` only if it advances. Never moves
   * backward and never uses NOW() — the caller passes the deterministic
   * max(created_at) of listings actually claimed this tick so a listing
   * inserted between the SELECT snapshot and the watermark write is still
   * picked up by the next tick.
   */
  async setLastNotifiedAt(savedSearchId: string, at: Date): Promise<void> {
    await this.pool.query(
      `UPDATE buyer_saved_searches
          SET last_notified_at = GREATEST(COALESCE(last_notified_at, $2), $2),
              updated_at = NOW()
        WHERE id = $1`,
      [savedSearchId, at],
    );
  }

  async recordFailure(
    deviceId: string,
    savedSearchId: string,
    listingId: string,
    error: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE buyer_push_notification_log
          SET success = FALSE, error = $4
        WHERE device_id = $1 AND saved_search_id = $2 AND listing_id = $3`,
      [deviceId, savedSearchId, listingId, error.slice(0, 500)],
    );
  }

  /**
   * Release a previously-claimed dedup row so the next tick will retry
   * delivery. Called when Expo returns a transport error / non-OK ticket
   * for a (device, search, listing) tuple — without this, a one-off
   * failure would silently lose the notification forever.
   */
  async releaseClaim(
    deviceId: string,
    savedSearchId: string,
    listingId: string,
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM buyer_push_notification_log
        WHERE device_id = $1 AND saved_search_id = $2 AND listing_id = $3`,
      [deviceId, savedSearchId, listingId],
    );
  }

  async invalidateToken(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE buyer_devices SET expo_push_token = NULL, updated_at = NOW()
        WHERE expo_push_token = $1`,
      [token],
    );
  }
}

export const buyerPushRepository = new BuyerPushRepository();
