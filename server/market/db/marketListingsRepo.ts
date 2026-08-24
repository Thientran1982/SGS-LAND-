/**
 * Repository for market_listings + market_listing_images.
 * Reuses the shared pg pool and the RLS-bypass transaction helper from server/db.
 */
import { withRlsBypass } from '../../db';
import type { NormalizedListing } from '../ingest/types';
import { validateMarketListing } from '../../services/listingValidation';

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
  validateMarketListing(n);
  return withRlsBypass(async (client) => {
    // Build geom expression only when coordinates exist.
    const hasCoords = n.lat != null && n.lng != null;
    const geomExpr = hasCoords
      ? 'ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography'
      : 'NULL';

    const res = await client.query<{ id: number; raw_html_hash: string | null; inserted: boolean }>(
        `INSERT INTO market_listings
           (source, region, external_listing_id, title, price, price_unit,
            area_m2, address_raw, lat, lng, geom, images, raw_html_hash,
            missed_crawls, is_active, first_seen_at, last_seen_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${geomExpr},
            $11::jsonb, $12, 0, TRUE, now(), now())
         ON CONFLICT (source, external_listing_id) DO UPDATE SET
           title = EXCLUDED.title, price = EXCLUDED.price, price_unit = EXCLUDED.price_unit,
           area_m2 = EXCLUDED.area_m2, address_raw = EXCLUDED.address_raw,
           lat = EXCLUDED.lat, lng = EXCLUDED.lng, geom = EXCLUDED.geom,
           images = EXCLUDED.images, raw_html_hash = EXCLUDED.raw_html_hash,
           last_seen_at = now(), missed_crawls = 0, is_active = TRUE, updated_at = now()
         WHERE market_listings.raw_html_hash IS DISTINCT FROM EXCLUDED.raw_html_hash
         RETURNING id, raw_html_hash, (xmax = 0) AS inserted`,
        [
          n.source, n.region, n.externalListingId, n.title, n.price, n.priceUnit,
          n.areaM2, n.addressRaw, n.lat, n.lng, JSON.stringify(n.images), n.rawHash,
        ],
      );
      if (res.rows[0]) {
        return { action: res.rows[0].inserted ? 'inserted' : 'updated', id: res.rows[0].id };
      }
      const unchanged = await client.query<{ id: number }>(
        `SELECT id FROM market_listings WHERE source = $1 AND external_listing_id = $2`,
        [n.source, n.externalListingId],
      );
      if (!unchanged.rows[0]) {
        // A concurrent delete may remove the conflict row between the
        // no-op upsert and this lookup. Surface it so the caller can retry
        // without opening a second connection while this transaction is held.
        throw new Error('Market listing disappeared during upsert; retry required');
      }
      await client.query(
        `UPDATE market_listings
            SET last_seen_at = now(), missed_crawls = 0, is_active = TRUE, updated_at = now()
          WHERE id = $1`,
        [unchanged.rows[0].id],
      );
    return { action: 'unchanged', id: unchanged.rows[0].id };
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
