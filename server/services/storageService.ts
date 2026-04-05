/**
 * storageService.ts
 *
 * Stores uploaded files as BYTEA in PostgreSQL (`uploaded_files` table).
 * This works on every Replit deployment type (Autoscale, Reserved VM) without
 * any external object storage setup.
 *
 * Local disk is kept as a read-only fallback: if a file cannot be found in the
 * DB it is served from `uploads/<tenantId>/<filename>` so dev workflows continue
 * to work while the DB is being populated.
 *
 * Server-side LRU buffer cache (in-memory):
 *   - Up to FILE_CACHE_MAX_BYTES bytes of file data (default 120 MB)
 *   - LRU eviction: least-recently-used entry evicted when limit is exceeded
 *   - Prevents repeated PostgreSQL bytea round-trips for frequently-served images
 *   - Cache is invalidated on storeFile / deleteFile for the affected entry
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../db';

const LOCAL_UPLOAD_BASE = path.join(process.cwd(), 'uploads');

// ─────────────────────────────────────────────────────────────────────────────
// LRU in-memory buffer cache
// ─────────────────────────────────────────────────────────────────────────────
const FILE_CACHE_MAX_BYTES = 120 * 1024 * 1024; // 120 MB total
const FILE_CACHE_MAX_ENTRIES = 300;

interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  size: number;
}

const fileCache = new Map<string, CacheEntry>();
let cacheTotalBytes = 0;

function lruGet(key: string): CacheEntry | undefined {
  const entry = fileCache.get(key);
  if (!entry) return undefined;
  // Move to end (most-recently-used)
  fileCache.delete(key);
  fileCache.set(key, entry);
  return entry;
}

function lruSet(key: string, entry: CacheEntry): void {
  // Evict if over limits
  while (
    fileCache.size > 0 &&
    (cacheTotalBytes + entry.size > FILE_CACHE_MAX_BYTES || fileCache.size >= FILE_CACHE_MAX_ENTRIES)
  ) {
    const firstKey = fileCache.keys().next().value!;
    const evicted = fileCache.get(firstKey)!;
    cacheTotalBytes -= evicted.size;
    fileCache.delete(firstKey);
  }
  fileCache.set(key, entry);
  cacheTotalBytes += entry.size;
}

function lruDelete(key: string): void {
  const entry = fileCache.get(key);
  if (entry) {
    cacheTotalBytes -= entry.size;
    fileCache.delete(key);
  }
}

function cacheKey(tenantId: string, filename: string): string {
  return `${tenantId}/${filename}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Store a file in PostgreSQL. Returns the relative public URL path. */
export async function storeFile(
    tenantId: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
): Promise<string> {
    await pool.query(
        `INSERT INTO uploaded_files (tenant_id, filename, content_type, data, size)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, filename) DO UPDATE
           SET data = EXCLUDED.data,
               content_type = EXCLUDED.content_type,
               size = EXCLUDED.size`,
        [tenantId, filename, contentType, buffer, buffer.length],
    );
    // Invalidate cache so the new version is fetched on next access
    lruDelete(cacheKey(tenantId, filename));
    return `/uploads/${tenantId}/${filename}`;
}

/**
 * Retrieve a file as a Buffer.
 * Order of lookups:
 *   1. In-memory LRU cache (instant)
 *   2. PostgreSQL uploaded_files table
 *   3. Local disk fallback (dev / pre-migration files)
 * Returns null when the file does not exist in any location.
 */
export async function getFile(
    tenantId: string,
    filename: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
    const key = cacheKey(tenantId, filename);

    // 1. LRU cache hit — O(1), no I/O
    const cached = lruGet(key);
    if (cached) {
        return { buffer: cached.buffer, contentType: cached.contentType };
    }

    // 2. Primary: PostgreSQL
    try {
        const result = await pool.query(
            'SELECT data, content_type FROM uploaded_files WHERE tenant_id = $1 AND filename = $2',
            [tenantId, filename],
        );
        if (result.rows.length > 0) {
            const buffer = result.rows[0].data as Buffer;
            const contentType: string = result.rows[0].content_type || 'application/octet-stream';
            lruSet(key, { buffer, contentType, size: buffer.length });
            return { buffer, contentType };
        }
    } catch (err) {
        console.warn('[Storage] DB read failed, trying local disk:', err);
    }

    // 3. Fallback: local disk (development / pre-migration files)
    const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
    if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const contentType = 'application/octet-stream';
        lruSet(key, { buffer, contentType, size: buffer.length });
        return { buffer, contentType };
    }

    return null;
}

/** Delete a file from PostgreSQL (and local disk if present). */
export async function deleteFile(
    tenantId: string,
    filename: string,
): Promise<void> {
    await pool.query(
        'DELETE FROM uploaded_files WHERE tenant_id = $1 AND filename = $2',
        [tenantId, filename],
    );
    // Evict from LRU cache
    lruDelete(cacheKey(tenantId, filename));

    // Also remove from local disk if it exists (dev cleanup)
    const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
    if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
}

/** Expose cache stats for monitoring */
export function getStorageCacheStats(): { entries: number; totalMB: number; maxMB: number } {
    return {
        entries: fileCache.size,
        totalMB: Math.round(cacheTotalBytes / 1024 / 1024 * 10) / 10,
        maxMB: FILE_CACHE_MAX_BYTES / 1024 / 1024,
    };
}
