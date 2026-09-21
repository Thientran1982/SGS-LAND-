import { Router } from 'express';
import type { Request, Response as ExpressResponse } from 'express';
import { logger } from '../middleware/logger';

const PNG_SIGNATURE = '89504e470d0a1a0a';
const PLACEHOLDER_MARKERS = [
  'api key required',
  'api_key_required',
  'access blocked',
  'map unavailable',
  'unauthorized',
  'forbidden',
];

export type FetchLike = typeof fetch;

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).toString('hex') === PNG_SIGNATURE;
}

function containsPlaceholderMarker(buffer: Buffer): boolean {
  const body = buffer.toString('latin1').toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => body.includes(marker));
}

function isBlockedResponse(response: globalThis.Response, body?: Buffer): boolean {
  return Boolean(
    response.headers.get('x-blocked')
    || response.headers.get('x-robots-tag')
    || (body && containsPlaceholderMarker(body)),
  );
}

export function createMapTileRouter(fetchImpl: FetchLike = fetch): Router {
  const router = Router();

  router.get('/api/map-tiles/:z/:x/:y.png', async (req: Request, res: ExpressResponse) => {
    const z = String(req.params.z);
    const x = String(req.params.x);
    const y = String(req.params.y);
    if (!/^\d{1,2}$/.test(z) || !/^\d{1,7}$/.test(x) || !/^\d{1,7}$/.test(y)) {
      return res.status(400).end();
    }

    const tileSources = [
      `https://a.tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`,
      `https://tile.openstreetmap.de/${z}/${x}/${y}.png`,
    ];
    let tile: Buffer | null = null;
    let lastError: unknown;

    for (const tileUrl of tileSources) {
      try {
        const upstream = await fetchImpl(tileUrl, {
          headers: {
            // OSM tile servers may return a tiny empty PNG to unknown bot-style
            // user agents. Use a browser-compatible UA while keeping requests
            // server-side so the Preview iframe never contacts OSM directly.
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!upstream.ok) continue;

        const candidate = Buffer.from(await upstream.arrayBuffer());
        // Providers can return HTTP 200 for a blocked/API-key placeholder.
        // Validate both the response markers and the actual image signature
        // before allowing Leaflet to receive the body.
        if (isBlockedResponse(upstream, candidate) || !isPng(candidate)) continue;

        tile = candidate;
        break;
      } catch (error) {
        // A failed primary provider must not prevent trying the fallback.
        lastError = error;
      }
    }

    if (!tile) {
      if (lastError) {
        logger.warn(`[MapTiles] upstream tile unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
      }
      return res.status(502).end();
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.send(tile);
  });

  return router;
}