/**
 * Pluggable source of "pending listings" for a region.
 *
 * A FeedProvider returns listings to ingest for a given region. Implement one
 * per LICENSED source (partner API) or for the first-party queue (listings
 * submitted on SGSLand awaiting normalization). This is the ONLY place new
 * data sources are wired in — the rest of the pipeline is source-agnostic.
 *
 * IMPORTANT: providers must only return data the platform is authorized to use
 * (first-party submissions or licensed feeds). Do not implement a provider that
 * scrapes third-party classified sites.
 */
import type { RawListingInput } from './types';
import type { RegionCode } from '../config/regions';

export interface FeedProvider {
  name: string;
  fetchPending(region: RegionCode, limit: number): Promise<RawListingInput[]>;
}

/**
 * Example first-party provider skeleton. Replace the body with a real query
 * against your submissions table / partner API client. Returns [] by default
 * so the pipeline is a safe no-op until a real source is connected.
 */
export const firstPartyProvider: FeedProvider = {
  name: 'first_party',
  async fetchPending(_region: RegionCode, _limit: number): Promise<RawListingInput[]> {
    // TODO: SELECT from your first-party submissions queue for this region,
    // map rows into RawListingInput[], and mark them as picked up.
    return [];
  },
};

const providers: FeedProvider[] = [firstPartyProvider];

export function registerProvider(p: FeedProvider): void {
  providers.push(p);
}

/** Collect pending listings for a region across all registered providers. */
export async function collectPending(
  region: RegionCode,
  limitPerProvider = 100,
): Promise<RawListingInput[]> {
  const all: RawListingInput[] = [];
  for (const p of providers) {
    try {
      const items = await p.fetchPending(region, limitPerProvider);
      all.push(...items);
    } catch (err) {
      console.error(`[market:feed] provider ${p.name} failed for ${region}:`, err);
    }
  }
  return all;
}
