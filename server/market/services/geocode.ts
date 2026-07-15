/**
 * Geocoding via Mapbox Geocoding API (REST, no SDK needed).
 * We already ship Mapbox GL JS on the frontend, so reusing Mapbox keeps one
 * vendor. Requires MAPBOX_TOKEN. If the token is missing, geocoding is skipped
 * gracefully (returns null) so ingest still works with pre-known coordinates.
 */
import { getRegion, isPointInRegion, type RegionCode } from '../config/regions';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || '';

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** True when the point falls inside the region bbox (sanity check passed). */
  inRegion: boolean;
}

/**
 * Geocode a raw address, biased to the region's bounding box + proximity.
 * Returns null if no token, empty address, or no result.
 */
export async function geocodeAddress(
  address: string,
  region: RegionCode,
): Promise<GeocodeResult | null> {
  const q = (address || '').trim();
  if (!q) return null;
  if (!MAPBOX_TOKEN) {
    console.warn('[market:geocode] MAPBOX_TOKEN not set — skipping geocode.');
    return null;
  }

  const cfg = getRegion(region);
  const [minLng, minLat, maxLng, maxLat] = cfg.bbox;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('country', 'VN');
  url.searchParams.set('language', 'vi');
  url.searchParams.set('limit', '1');
  // Bias results toward the region.
  url.searchParams.set('bbox', `${minLng},${minLat},${maxLng},${maxLat}`);
  url.searchParams.set('proximity', `${cfg.center.lng},${cfg.center.lat}`);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`[market:geocode] Mapbox HTTP ${res.status} for "${q}"`);
      return null;
    }
    const data: any = await res.json();
    const feat = data?.features?.[0];
    if (!feat || !Array.isArray(feat.center) || feat.center.length < 2) return null;

    const [lng, lat] = feat.center as [number, number];
    return { lat, lng, inRegion: isPointInRegion(region, lat, lng) };
  } catch (err) {
    console.warn('[market:geocode] request failed:', (err as Error).message);
    return null;
  }
}
