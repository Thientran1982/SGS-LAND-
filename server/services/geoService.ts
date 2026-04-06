import { logger } from '../middleware/logger';

export interface GeoData {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
}

const geoCache = new Map<string, { data: GeoData | null; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h per IP

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|::ffff:127\.|fd|fc)/i;

export function isPrivateIp(ip: string): boolean {
  return !ip || PRIVATE_IP_RE.test(ip) || ip === 'localhost';
}

export async function lookupIp(ip: string): Promise<GeoData | null> {
  if (isPrivateIp(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,isp`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`);

    const json = await res.json() as any;
    if (json.status !== 'success') {
      geoCache.set(ip, { data: null, ts: Date.now() });
      return null;
    }

    const geo: GeoData = {
      country: json.country ?? '',
      countryCode: json.countryCode ?? '',
      region: json.regionName ?? '',
      city: json.city ?? '',
      lat: json.lat ?? 0,
      lon: json.lon ?? 0,
      isp: json.isp ?? '',
    };
    geoCache.set(ip, { data: geo, ts: Date.now() });
    return geo;
  } catch (err) {
    logger.warn(`[geoService] Failed to lookup IP ${ip}: ${(err as Error).message}`);
    geoCache.set(ip, { data: null, ts: Date.now() });
    return null;
  }
}

export function getClientIp(req: any): string {
  const xfwd = req.headers?.['x-forwarded-for'];
  if (xfwd) {
    const first = (typeof xfwd === 'string' ? xfwd : xfwd[0]).split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '';
}
