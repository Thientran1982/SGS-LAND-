import { PoolClient } from 'pg';
import { Migration } from './runner';
import fs from 'fs';
import path from 'path';

const migration: Migration = {
    description: 'Create uploaded_files table for persistent binary file storage in PostgreSQL',

    async up(client: PoolClient) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id           SERIAL PRIMARY KEY,
                tenant_id    VARCHAR(36)   NOT NULL,
                filename     VARCHAR(512)  NOT NULL,
                content_type VARCHAR(128)  NOT NULL DEFAULT 'application/octet-stream',
                data         BYTEA         NOT NULL,
                size         INTEGER       NOT NULL DEFAULT 0,
                created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                UNIQUE(tenant_id, filename)
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_lookup
            ON uploaded_files (tenant_id, filename)
        `);

        // Migrate existing files from the local disk uploads/ directory.
        // Safe to re-run: ON CONFLICT DO NOTHING.
        const uploadsBase = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsBase)) return;

        const EXT_TO_MIME: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.txt': 'text/plain',
        };

        const tenantDirs = fs.readdirSync(uploadsBase, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const tenantId of tenantDirs) {
            const tenantDir = path.join(uploadsBase, tenantId);
            const files = fs.readdirSync(tenantDir, { withFileTypes: true })
                .filter(f => f.isFile())
                .map(f => f.name);

            for (const filename of files) {
                const filePath = path.join(tenantDir, filename);
                try {
                    const data = fs.readFileSync(filePath);
                    const ext = path.extname(filename).toLowerCase();
                    const contentType = EXT_TO_MIME[ext] || 'application/octet-stream';

                    await client.query(
                        `INSERT INTO uploaded_files (tenant_id, filename, content_type, data, size)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (tenant_id, filename) DO NOTHING`,
                        [tenantId, filename, contentType, data, data.length],
                    );
                } catch {
                    // Skip unreadable files silently
                }
            }
        }
    },

    async down(client: PoolClient) {
        await client.query('DROP TABLE IF EXISTS uploaded_files');
    },
};

export default migration;
