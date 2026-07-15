import type { RegionCode } from '../config/regions';

/** Allowed data sources (mirrors the market_listing_source enum in SQL). */
export type MarketSource = 'user' | 'partner_api' | 'import';

/**
 * Raw listing as received from a first-party submission or a licensed
 * partner feed, BEFORE normalization / geocoding / image storage.
 */
export interface RawListingInput {
  source: MarketSource;
  region: RegionCode;
  /** Stable id from the source system (used with `source` for dedup). */
  externalListingId: string;
  title?: string;
  /** Price as a number in the given priceUnit. */
  price?: number;
  /** e.g. 'VND', 'ty' (billion), 'trieu' (million), 'VND/m2'. */
  priceUnit?: string;
  areaM2?: number;
  addressRaw?: string;
  /** Optional pre-known coordinates; if absent we geocode addressRaw. */
  lat?: number;
  lng?: number;
  /** Source image URLs to fetch, optimize, dedup and store. */
  imageUrls?: string[];
  /**
   * Optional content hash from the source. If omitted, ingest computes one
   * from the normalized fields so we can detect changes on re-sync.
   */
  contentHash?: string;
}

/** Result of an ingest run for a single listing. */
export interface IngestResult {
  externalListingId: string;
  action: 'inserted' | 'updated' | 'unchanged' | 'skipped';
  reason?: string;
  imagesStored: number;
}

/** Normalized listing ready to be upserted into market_listings. */
export interface NormalizedListing {
  source: MarketSource;
  region: RegionCode;
  externalListingId: string;
  title: string | null;
  price: number | null;
  priceUnit: string | null;
  areaM2: number | null;
  addressRaw: string | null;
  lat: number | null;
  lng: number | null;
  images: string[];
  rawHash: string;
}
