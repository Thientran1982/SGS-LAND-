/**
 * Repository for market_listings + market_listing_images.
 * Reuses the shared pg pool and the RLS-bypass transaction helper from server/db.
 */
import { withRlsBypass } from '../../db';
import type { NormalizedListing } from '../ingest/types';

export interface UpsertOutcome {
  action: 'inserted' | 'updated' | 'unchanged';
  id: number;
}

/**
 * Insert or update a listing keyed by (source, external_listing_id).
 * - New row  -> inserted.
 * - Existing + same rawHash -> unchanged (only bumps last_seen_at, resets misses).
 * - Existing + different rawHash -> updated.
 * geom is set from lat/lng via PostGIS ST_MakePoint when both are present.
 */
export async function upsertListing(n: NormalizedListing): Promise<UpsertOutcome> {
  return withRlsBypass(async (client) => {
    const existing = await client.query<{ id: number; raw_html_hash: string | null }>(
      `SELECT id, raw_html_hash
         FROM market_listings
        WHERE source = $1 AND external_listing_id = $2`,
      [n.source, n.externalListingId],
    );

    // Build geom expression only when coordinates exist.
    const hasCoords = n.lat != null && n.lng != null;
    const geomExpr = hasCoords
      ? 'ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography'
      : 'NULL';

    if (existing.rowCount === 0) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO market_listings
           (source, region, external_listing_id, title, price, price_unit,
            area_m2, address_raw, lat, lng, geom, images, raw_html_hash,
            missed_crawls, is_active, first_seen_at, last_seen_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${geomExpr},
            $11::jsonb, $12, 0, TRUE, now(), now())
         RETURNING id`,
        [
          n.source, n.region, n.externalListingId, n.title, n.price, n.priceUnit,
          n.areaM2, n.addressRaw, n.lat, n.lng, JSON.stringify(n.images), n.rawHash,
        ],
      );
      return { action: 'inserted', id: res.rows[0].id };
    }

    const row = existing.rows[0];
    if (row.raw_html_hash === n.rawHash) {
      // Unchanged content: just mark it as seen again and reactivate if needed.
      await client.query(
        `UPDATE market_listings
            SET last_seen_at = now(), missed_crawls = 0, is_active = TRUE,
                updated_at = now()
          WHERE id = $1`,
        [row.id],
      );
      return { action: 'unchanged', id: row.id };
    }

    // Content changed: update fields + geom + timestamps.
    await client.query(
      `UPDATE market_listings
          SET title = $2, price = $3, price_unit = $4, area_m2 = $5,
              address_raw = $6, lat = $7, lng = $8,
              geom = ${hasCoords ? 'ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography' : 'NULL'},
              images = $9::jsonb, raw_html_hash = $10,
              last_seen_at = now(), missed_crawls = 0, is_active = TRUE,
              updated_at = now()
        WHERE id = $1`,
      [
        row.id, n.title, n.price, n.priceUnit, n.areaM2, n.addressRaw,
        n.lat, n.lng, JSON.stringify(n.images), n.rawHash,
      ],
    );
    return { action: 'updated', id: row.id };
  });
}

/**
 * Increment missed_crawls for active listings of a region that were NOT seen in
 * the latest sync (last_seen_at older than cutoff), and mark them inactive once
 * they exceed `threshold` consecutive misses. Returns count marked inactive.
 */
export async function markStaleInactive(
  region: string,
  cutoffIso: string,
  threshold = 3,
): Promise<number> {
  return withRlsBypass(async (client) => {
    await client.query(
      `UPDATE market_listings
          SET missed_crawls = missed_crawls + 1, updated_at = now()
        WHERE region = $1 AND is_active = TRUE AND last_seen_at < $2`,
      [region, cutoffIso],
    );
    const res = await client.query(
      `UPDATE market_listings
          SET is_active = FALSE, updated_at = now()
        WHERE region = $1 AND is_active = TRUE AND missed_crawls >= $2`,
      [region, threshold],
    );
    return res.rowCount ?? 0;
  });
}

/** Look up a previously stored image URL by its content hash (dedup). */
export async function findImageByHash(sha256: string): Promise<string | null> {
  return withRlsBypass(async (client) => {
    const res = await client.query<{ url: string }>(
      'SELECT url FROM market_listing_images WHERE sha256 = $1',
      [sha256],
    );
    return res.rowCount ? res.rows[0].url : null;
  });
}

/** Record a newly stored image so future identical bytes are deduped. */
export async function recordImage(
  sha256: string,
  url: string,
  width?: number,
  height?: number,
  bytes?: number,
): Promise<void> {
  await withRlsBypass(async (client) => {
    await client.query(
      `INSERT INTO market_listing_images (sha256, url, width, height, bytes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sha256) DO NOTHING`,
      [sha256, url, width ?? null, height ?? null, bytes ?? null],
    );
  });
}
