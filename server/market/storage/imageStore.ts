/**
 * Image storage: fetch -> optimize (sharp, max width 1200) -> SHA-256 dedup ->
 * upload buffer to Cloudinary via its REST API (no SDK, no temp files on disk;
 * Replit's filesystem is ephemeral so we never write raw files).
 *
 * Dedup: the SHA-256 of the OPTIMIZED bytes is checked against
 * market_listing_images; identical content reuses the existing Cloudinary URL.
 *
 * Requires: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 * If unconfigured, storeImage() throws a clear error so callers can decide to
 * skip images (ingest treats image failures as non-fatal).
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { findImageByHash, recordImage } from '../db/marketListingsRepo';
import { throttleDomain } from '../queue/rateLimiter';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const UPLOAD_FOLDER = process.env.CLOUDINARY_FOLDER || 'sgsland/market';
const MAX_WIDTH = 1200;

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Cloudinary signed upload signature (sha1 of sorted params + api_secret). */
function signParams(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  // Throttle per image host to be a good citizen with CDNs.
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  })();
  await throttleDomain(`img:${host}`, { minIntervalMs: 1000, maxWaitMs: 20_000 });

  const res = await fetch(url, {
    headers: { 'User-Agent': 'SGSLand-MarketBot/1.0 (+internal analytics)' },
  });
  if (!res.ok) throw new Error(`image fetch HTTP ${res.status} for ${url}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function optimize(input: Buffer): Promise<{ buf: Buffer; w: number; h: number }> {
  const img = sharp(input, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const pipeline =
    meta.width && meta.width > MAX_WIDTH
      ? img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : img;
  const buf = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const outMeta = await sharp(buf).metadata();
  return { buf, w: outMeta.width ?? 0, h: outMeta.height ?? 0 };
}

async function uploadToCloudinary(
  buf: Buffer,
): Promise<{ url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('[market:imageStore] Cloudinary env not configured.');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signParamsObj: Record<string, string> = {
    folder: UPLOAD_FOLDER,
    timestamp,
  };
  const signature = signParams(signParamsObj);

  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), 'image.jpg');
  form.append('api_key', API_KEY);
  form.append('timestamp', timestamp);
  form.append('folder', UPLOAD_FOLDER);
  form.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[market:imageStore] Cloudinary HTTP ${res.status}: ${body}`);
  }
  const json: any = await res.json();
  if (!json.secure_url) throw new Error('[market:imageStore] no secure_url in response');
  return { url: json.secure_url as string };
}

/**
 * Store one source image URL. Returns the stored (Cloudinary) URL, reusing an
 * existing URL when the optimized content hash already exists.
 */
export async function storeImage(sourceUrl: string): Promise<string> {
  const raw = await fetchImageBuffer(sourceUrl);
  const { buf, w, h } = await optimize(raw);
  const hash = sha256(buf);

  const existing = await findImageByHash(hash);
  if (existing) return existing;

  const { url } = await uploadToCloudinary(buf);
  await recordImage(hash, url, w, h, buf.length);
  return url;
}

/**
 * Store many images, best-effort. Failures are logged and skipped so one bad
 * image never fails the whole listing. Returns the successfully stored URLs.
 */
export async function storeImages(sourceUrls: string[] = []): Promise<string[]> {
  const out: string[] = [];
  for (const src of sourceUrls) {
    try {
      out.push(await storeImage(src));
    } catch (err) {
      console.warn('[market:imageStore] skip image:', src, (err as Error).message);
    }
  }
  return out;
}
