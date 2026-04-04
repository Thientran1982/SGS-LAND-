/**
 * storageService.ts
 *
 * Abstraction over file storage backends:
 *   - Replit Object Storage  (production — when REPLIT_OBJECT_STORAGE_BUCKET is set)
 *   - Local disk             (development — fallback)
 *
 * Public URL format stays the same in both modes: /uploads/{tenantId}/{filename}
 * The serve route reads from whichever backend is active.
 */

import fs from 'fs';
import path from 'path';

const LOCAL_UPLOAD_BASE = path.join(process.cwd(), 'uploads');

// Lazily-initialised Replit Object Storage client
let replitClient: any = null;
let replitClientReady = false;

function getReplitClient() {
    if (replitClientReady) return replitClient;
    replitClientReady = true;

    if (!process.env.REPLIT_OBJECT_STORAGE_BUCKET) {
        replitClient = null;
        return null;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Client } = require('@replit/object-storage');
        replitClient = new Client();
        console.log('[Storage] Using Replit Object Storage');
    } catch (e) {
        console.warn('[Storage] @replit/object-storage not available, falling back to local disk');
        replitClient = null;
    }
    return replitClient;
}

export const isObjectStorageEnabled = () => !!process.env.REPLIT_OBJECT_STORAGE_BUCKET;

/** Store a file. Returns the relative public URL path. */
export async function storeFile(
    tenantId: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
): Promise<string> {
    const client = getReplitClient();
    const key = `${tenantId}/${filename}`;

    if (client) {
        const { ok, error } = await client.uploadFromBuffer(key, buffer, {
            contentType,
        });
        if (!ok) throw new Error(`Object Storage upload failed: ${error}`);
    } else {
        // Local disk
        const dir = path.join(LOCAL_UPLOAD_BASE, tenantId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), buffer);
    }

    return `/uploads/${tenantId}/${filename}`;
}

/**
 * Retrieve a file as a Buffer.
 * Returns null when the file does not exist.
 */
export async function getFile(
    tenantId: string,
    filename: string,
): Promise<Buffer | null> {
    const client = getReplitClient();
    const key = `${tenantId}/${filename}`;

    if (client) {
        const result = await client.downloadAsBuffer(key);
        if (!result.ok) return null;
        return result.value as Buffer;
    }

    // Local disk
    const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
}

/** Delete a file. */
export async function deleteFile(
    tenantId: string,
    filename: string,
): Promise<void> {
    const client = getReplitClient();
    const key = `${tenantId}/${filename}`;

    if (client) {
        await client.delete(key);
    } else {
        const filePath = path.join(LOCAL_UPLOAD_BASE, tenantId, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}
