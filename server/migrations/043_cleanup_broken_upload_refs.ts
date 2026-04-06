import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * Removes /uploads/ image URLs from listings where the corresponding file
 * does not exist in the uploaded_files table.  These are files that were
 * stored on an ephemeral container disk before the PostgreSQL storage
 * migration and are now permanently lost.
 */
const migration: Migration = {
    description: 'Remove broken /uploads/ image refs from listings where file is not in uploaded_files',

    async up(client: PoolClient) {
        // Fetch every listing that has at least one /uploads/ URL
        const { rows } = await client.query<{ id: string; images: string[] | null }>(`
            SELECT id, images
            FROM listings
            WHERE images::text LIKE '%/uploads/%'
        `);

        for (const row of rows) {
            const imgs: string[] = Array.isArray(row.images)
                ? row.images
                : JSON.parse((row.images as unknown as string) || '[]');

            const validImgs: string[] = [];
            for (const url of imgs) {
                if (!url.includes('/uploads/')) {
                    validImgs.push(url);
                    continue;
                }
                const parts = url.split('/');
                const tenantId = parts[parts.length - 2] ?? '';
                const filename = parts[parts.length - 1] ?? '';

                const { rows: found } = await client.query(
                    'SELECT id FROM uploaded_files WHERE tenant_id = $1 AND filename = $2',
                    [tenantId, filename],
                );
                if (found.length > 0) {
                    validImgs.push(url);
                }
                // else: file missing → drop the URL silently
            }

            if (validImgs.length !== imgs.length) {
                await client.query(
                    'UPDATE listings SET images = $1 WHERE id = $2',
                    [JSON.stringify(validImgs), row.id],
                );
            }
        }
    },

    async down(_client: PoolClient) {
        // Cannot restore deleted URLs — intentionally a no-op
    },
};

export default migration;
