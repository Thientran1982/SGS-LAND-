/**
 * Region configuration for the SGSLand market-listings pipeline.
 *
 * Data source policy:
 *   This pipeline ingests FIRST-PARTY listings (submitted by SGSLand users /
 *   partner agents) and data received through LICENSED partner APIs / feeds.
 *   It does NOT scrape third-party classified sites. Region metadata below is
 *   used to validate, bucket and schedule ingestion jobs per province.
 *
 * Extensible by design: add a new entry to REGIONS to support a new area.
 * Nothing in the ingestion logic hardcodes a region code.
 */

export type RegionCode =
  | 'hcm' // TP. Hồ Chí Minh
  | 'dongnai' // Đồng Nai
  | 'binhduong' // Bình Dương
  | 'bariavungtau' // Bà Rịa - Vũng Tàu
  | 'longan' // Long An
  | 'tayninh'; // Tây Ninh

export interface RegionConfig {
  code: RegionCode;
  name: string;
  /** Province center used to bias geocoding + as a fallback point. */
  center: { lat: number; lng: number };
  /** Rough bounding box [minLng, minLat, maxLng, maxLat] to sanity-check geocodes. */
  bbox: [number, number, number, number];
  /**
   * QStash cron (UTC) used by the scheduler to stagger each region so ingest
   * jobs never all run at once. Times are offset to smooth out load.
   */
  cronUtc: string;
}

export const REGIONS: Record<RegionCode, RegionConfig> = {
  hcm: {
    code: 'hcm',
    name: 'TP. Hồ Chí Minh',
    center: { lat: 10.7769, lng: 106.7009 },
    bbox: [106.35, 10.35, 107.03, 11.16],
    cronUtc: '0 19 * * *', // 02:00 giờ VN (UTC+7)
  },
  dongnai: {
    code: 'dongnai',
    name: 'Đồng Nai',
    center: { lat: 10.9453, lng: 106.8133 },
    bbox: [106.6, 10.5, 107.6, 11.75],
    cronUtc: '30 19 * * *', // 02:30 VN
  },
  binhduong: {
    code: 'binhduong',
    name: 'Bình Dương',
    center: { lat: 11.1731, lng: 106.6667 },
    bbox: [106.35, 10.9, 106.9, 11.85],
    cronUtc: '0 20 * * *', // 03:00 VN
  },
  bariavungtau: {
    code: 'bariavungtau',
    name: 'Bà Rịa - Vũng Tàu',
    center: { lat: 10.5417, lng: 107.2428 },
    bbox: [107.0, 10.2, 107.85, 10.85],
    cronUtc: '30 20 * * *', // 03:30 VN
  },
  longan: {
    code: 'longan',
    name: 'Long An',
    center: { lat: 10.6957, lng: 106.2431 },
    bbox: [105.7, 10.35, 106.75, 11.05],
    cronUtc: '0 21 * * *', // 04:00 VN
  },
  tayninh: {
    code: 'tayninh',
    name: 'Tây Ninh',
    center: { lat: 11.31, lng: 106.0989 },
    bbox: [105.85, 10.95, 106.5, 11.75],
    cronUtc: '30 21 * * *', // 04:30 VN
  },
};

export const REGION_CODES = Object.keys(REGIONS) as RegionCode[];

export function isRegionCode(v: string): v is RegionCode {
  return v in REGIONS;
}

export function getRegion(code: string): RegionConfig {
  if (!isRegionCode(code)) {
    throw new Error(`[market] Unknown region code: ${code}`);
  }
  return REGIONS[code];
}

/** Basic sanity check: does a geocoded point fall inside the region bbox? */
export function isPointInRegion(code: RegionCode, lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = REGIONS[code].bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
