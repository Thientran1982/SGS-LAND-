/**
 * Ingest service: normalize -> geocode -> store images -> upsert.
 *
 * SOURCE POLICY: inputs come from first-party submissions or LICENSED partner
 * feeds only. This module never fetches/scrapes third-party classified pages.
 * Stored data is for INTERNAL reference-price / market analytics; do not
 * republish original third-party content or images publicly without a ToS + IP
 * review.
 */
import crypto from 'crypto';
import { getRegion } from '../config/regions';
import { geocodeAddress } from '../services/geocode';
import { storeImages, isCloudinaryConfigured } from '../storage/imageStore';
import { upsertListing } from '../db/marketListingsRepo';
import type {
  RawListingInput,
  NormalizedListing,
  IngestResult,
} from './types';

/** Collapse whitespace and trim; return null for empty. */
function clean(s?: string): string | null {
  if (s == null) return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

/** Stable content hash used for change detection across re-syncs. */
function computeHash(n: Omit<NormalizedListing, 'rawHash'>): string {
  const material = JSON.stringify({
    t: n.title,
    p: n.price,
    u: n.priceUnit,
    a: n.areaM2,
    ad: n.addressRaw,
    img: n.images,
  });
  return crypto.createHash('sha256').update(material).digest('hex');
}

/**
 * Ingest a single raw listing end-to-end. Image + geocode failures are
 * non-fatal; the listing is still upserted with whatever data is available.
 */
export async function ingestListing(raw: RawListingInput): Promise<IngestResult> {
  const region = getRegion(raw.region).code; // validates region code

  if (!raw.externalListingId) {
    return {
      externalListingId: raw.externalListingId ?? '',
      action: 'skipped',
      reason: 'missing externalListingId',
      imagesStored: 0,
    };
  }

  // 1) Store & optimize images (best-effort). Skip if Cloudinary unconfigured.
  let images: string[] = [];
  if (raw.imageUrls?.length) {
    if (isCloudinaryConfigured()) {
      images = await storeImages(raw.imageUrls);
    } else {
      console.warn(
        '[market:ingest] Cloudinary not configured — storing 0 images for',
        raw.externalListingId,
      );
    }
  }

  // 2) Geocode: prefer supplied coords, else geocode the raw address.
  let lat = raw.lat ?? null;
  let lng = raw.lng ?? null;
  const addressRaw = clean(raw.addressRaw);
  if ((lat == null || lng == null) && addressRaw) {
    const geo = await geocodeAddress(addressRaw, region);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      if (!geo.inRegion) {
        console.warn(
          `[market:ingest] geocode outside ${region} bbox for "${addressRaw}"`,
        );
      }
    }
  }

  // 3) Normalize.
  const base: Omit<NormalizedListing, 'rawHash'> = {
    source: raw.source,
    region,
    externalListingId: raw.externalListingId,
    title: clean(raw.title),
    price: Number.isFinite(raw.price as number) ? (raw.price as number) : null,
    priceUnit: clean(raw.priceUnit),
    areaM2: Number.isFinite(raw.areaM2 as number) ? (raw.areaM2 as number) : null,
    addressRaw,
    lat,
    lng,
    images,
  };
  const rawHash = raw.contentHash || computeHash(base);
  const normalized: NormalizedListing = { ...base, rawHash };

  // 4) Upsert (dedup by source+external_listing_id, change-detect by hash).
  const outcome = await upsertListing(normalized);
  return {
    externalListingId: raw.externalListingId,
    action: outcome.action,
    imagesStored: images.length,
  };
}

export interface BatchIngestSummary {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  results: IngestResult[];
}

/** Ingest a batch sequentially (keeps per-domain throttling coordinated). */
export async function ingestBatch(items: RawListingInput[]): Promise<BatchIngestSummary> {
  const summary: BatchIngestSummary = {
    total: items.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    results: [],
  };
  for (const item of items) {
    try {
      const r = await ingestListing(item);
      summary.results.push(r);
      summary[r.action] += 1;
    } catch (err) {
      console.error('[market:ingest] item failed:', item.externalListingId, err);
      summary.skipped += 1;
      summary.results.push({
        externalListingId: item.externalListingId,
        action: 'skipped',
        reason: (err as Error).message,
        imagesStored: 0,
      });
    }
  }
  return summary;
}
