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
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../db';

const LOCAL_UPLOAD_BASE = path.join(process.cwd(), 'uploads');

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
    return `/uploads/${tenantId}/${filename}`;
}

/**
 * Retrieve a file as a Buffer.
 * Checks PostgreSQL first; falls back to local disk (for dev environments
 * where files were uploaded before the DB migration).
 * Returns null when the file does not exist in either location.
 */
export async function getFile(
    tenantId: string,
    filename: string,
): Promise<Buffer | null> {
    // Primary: PostgreSQL
    try {
        const result = await pool.query(
            'SELECT data FROM uploaded_files WHERE tenant_id = $1 AND filename = $2',
            [tenantId, filename],
        );
        if (result.rows.length > 0) {
            return result.rows[0].data as Buffer;
        }
    } catch (err) {
        console.warn('[Storage] DB read failed, trying local disk:', err);
    }

    // Fallback: local disk (development / pre-migration files)
    const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
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

    // Also remove from local disk if it exists (dev cleanup)
    const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
    if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
}
