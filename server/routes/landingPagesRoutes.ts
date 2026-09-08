/**
 * Public + owner API for AI-generated landing pages (bang landing_pages).
 * - GET  /api/landing-pages/:slug        -> trang theo slug (cong khai)
 * - GET  /api/landing-pages?visitorKey   -> danh sach trang cua 1 visitor
 * - PATCH /api/landing-pages/:slug       -> sua noi dung / lien he / slug (can visitorKey khop)
 * - POST /api/landing-pages/:slug/publish   -> draft -> published (can visitorKey)
 * - POST /api/landing-pages/:slug/unpublish -> published -> draft (can visitorKey)
 * Khong co auth token: visitor_key duoc cap khi tao trang chinh la khoa quan tri.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { agentAuditRepository } from '../repositories/agentAuditRepository';
import { v4 as uuidv4 } from 'uuid';
import { storeFile } from '../services/storageService';
import {
    enqueueGalleryCleanup,
    listGalleryCleanupJobs,
    retryGalleryCleanup,
} from '../services/galleryCleanupService';

let sharp: typeof import('sharp') | null = null;
(async () => {
    try {
        sharp = (await import('sharp')).default as unknown as typeof import('sharp');
    } catch {
        console.warn('[landingPages] sharp not available - images will be stored as-is');
    }
})();

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const MAX_GALLERY_IMAGES = 20;
const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB moi anh
const MAX_IMAGE_FILES_PER_REQUEST = 10;
const IMAGE_MAX_DIM = 1920;
const WEBP_QUALITY = 82;
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE, files: MAX_IMAGE_FILES_PER_REQUEST },
    fileFilter(_req, file, cb) {
        if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) cb(null, true);
        else cb(new Error('IMAGE_INVALID_MIME'));
    },
});

function handleImageMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Anh qua lon (toi da 10MB moi anh)' });
        // `array('files', maxCount)` reports an extra file as
        // LIMIT_UNEXPECTED_FILE, while the global `limits.files` guard reports
        // LIMIT_FILE_COUNT. Both represent the configured per-request limit
        // for this route.
        if (
            err.code === 'LIMIT_FILE_COUNT'
            || (err.code === 'LIMIT_UNEXPECTED_FILE' && (!err.field || err.field === 'files'))
        ) {
            return res.status(400).json({ error: 'Chi duoc tai toi da 10 anh moi lan' });
        }
        return res.status(400).json({ error: 'Loi tai anh len. Vui long thu lai.' });
    }
    if (err?.message === 'IMAGE_INVALID_MIME') return res.status(415).json({ error: 'Chi chap nhan anh JPEG, PNG, WebP hoac GIF' });
    if (err) return res.status(400).json({ error: err?.message || 'Loi tai anh len' });
    next();
}

async function compressGalleryImage(buf: Buffer, mime: string): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
    if (!sharp || mime === 'image/gif') {
        return { buffer: buf, contentType: mime, ext: IMAGE_MIME_TO_EXT[mime] || '.jpg' };
    }
    try {
        const s = (sharp as any)(buf);
        const meta = await s.metadata();
        let pipeline = s;
        if ((meta.width || 0) > IMAGE_MAX_DIM || (meta.height || 0) > IMAGE_MAX_DIM) {
            pipeline = pipeline.resize(IMAGE_MAX_DIM, IMAGE_MAX_DIM, { fit: 'inside', withoutEnlargement: true });
        }
        const compressed: Buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
        return { buffer: compressed, contentType: 'image/webp', ext: '.webp' };
    } catch (err) {
        console.warn('[landingPages] sharp compression failed, storing original:', err);
        return { buffer: buf, contentType: mime, ext: IMAGE_MIME_TO_EXT[mime] || '.jpg' };
    }
}

export function slugifyCustom(input: string): string {
    const base = (input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u0110\u0111]/g, 'd').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
    return base;
}

const PAGE_COLUMNS = 'id, tenant_id, owner_user_id, visitor_key, project_name, slug, brochure_name, brochure_text, sections, status, tokens_used, language, created_at, updated_at';

async function audit(tenantId: string, action: string, input: Record<string, any>, output: Record<string, any>): Promise<void> {
    try {
        await agentAuditRepository.record(tenantId, {
            eventKey: 'landing-tool:' + action + ':' + uuidv4(),
            eventType: 'TOOL_EXECUTION',
            direction: 'OUTBOUND',
            toolName: 'landing_builder',
            entityType: 'landing_page',
            entityId: String(output?.id || ''),
            status: 'SUCCESS',
            input,
            output,
            metadata: { surface: 'landing_builder_editor' },
        });
    } catch (err) {
        console.warn('[landingPages] audit failed:', (err as Error).message);
    }
}

const OPERATOR_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEAD']);
const STORAGE_URL_PREFIX = '/uploads/' + DEFAULT_TENANT_ID + '/';

function storageFilenameFromUrl(url: string): string | null {
    if (!url.startsWith(STORAGE_URL_PREFIX)) return null;
    const filename = url.slice(STORAGE_URL_PREFIX.length);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(filename) || filename === '.' || filename === '..') {
        return null;
    }
    return filename;
}

export function createLandingPagesRoutes(authenticateToken?: any): Router {
    const router = Router();

    if (authenticateToken) {
        const operator = (req: Request, res: Response) => {
            const user = (req as any).user;
            if (!OPERATOR_ROLES.has(user?.role)) {
                res.status(403).json({ error: 'Không có quyền truy cập' });
                return null;
            }
            return user;
        };

        router.get('/cleanup-failures', authenticateToken, async (req: Request, res: Response) => {
            const user = operator(req, res);
            if (!user) return;
            try {
                const jobs = await listGalleryCleanupJobs(user.tenantId, Number(req.query.limit) || 50);
                return res.json({ jobs });
            } catch {
                return res.status(500).json({ error: 'Không thể tải danh sách dọn dẹp ảnh.' });
            }
        });

        router.post('/cleanup-failures/:id/retry', authenticateToken, async (req: Request, res: Response) => {
            const user = operator(req, res);
            if (!user) return;
            const jobId = String(req.params.id || '').trim();
            if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
                return res.status(400).json({ error: 'ID không hợp lệ' });
            }
            try {
                const job = await retryGalleryCleanup(user.tenantId, jobId);
                if (!job) return res.status(404).json({ error: 'Không tìm thấy tác vụ dọn dẹp.' });
                return res.json({ job });
            } catch {
                return res.status(503).json({ error: 'Không thể hoàn tất dọn dẹp; tác vụ vẫn có thể thử lại.' });
            }
        });
    }

    router.get('/:slug', async (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug || '').trim().slice(0, 220);
            if (!slug) return res.status(400).json({ error: 'MISSING_SLUG' });
            const page = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query(
                    'SELECT ' + PAGE_COLUMNS + ' FROM landing_pages WHERE slug = $1 LIMIT 1',
                    [slug],
                );
                return r.rows[0] || null;
            });
            if (!page) return res.status(404).json({ error: 'NOT_FOUND' });
            return res.json({ page });
        } catch (err) {
            logger.error('[landingPages] fetch by slug failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });

    router.get('/', async (req: Request, res: Response) => {
        try {
            const visitorKey = String(req.query.visitorKey || '').trim().slice(0, 120);
            if (!visitorKey) return res.status(400).json({ error: 'MISSING_VISITOR_KEY' });
            const pages = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query(
                    'SELECT id, project_name, slug, status, tokens_used, language, created_at, updated_at FROM landing_pages WHERE tenant_id = $1 AND visitor_key = $2 ORDER BY created_at DESC LIMIT 50',
                    [DEFAULT_TENANT_ID, visitorKey],
                );
                return r.rows;
            });
            return res.json({ pages, total: pages.length });
        } catch (err) {
            logger.error('[landingPages] list failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });

    /** Commons: kiem tra quyen so huu theo visitorKey, tra ve row hoac loi */
    async function loadOwnedPage(slug: string, visitorKey: string): Promise<Record<string, any> | null> {
        return withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
            const r = await client.query(
                'SELECT ' + PAGE_COLUMNS + ' FROM landing_pages WHERE slug = $1 AND visitor_key = $2 LIMIT 1',
                [slug, visitorKey],
            );
            return r.rows[0] || null;
        });
    }

    router.patch('/:slug', async (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug || '').trim().slice(0, 220);
            const visitorKey = String(req.body?.visitorKey || '').trim().slice(0, 120);
            if (!slug || !visitorKey) return res.status(400).json({ error: 'MISSING_SLUG_OR_KEY' });

            const page = await loadOwnedPage(slug, visitorKey);
            if (!page) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });

            // Slug moi (neu co): hop le va khong trung
            let newSlug = slug;
            const wantedSlug = slugifyCustom(String(req.body?.slug || ''));
            if (wantedSlug && wantedSlug !== slug) {
                if (wantedSlug.length < 3) return res.status(400).json({ error: 'SLUG_TOO_SHORT' });
                const dup = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                    const r = await client.query('SELECT 1 FROM landing_pages WHERE slug = $1 LIMIT 1', [wantedSlug]);
                    return r.rows.length > 0;
                });
                if (dup) return res.status(409).json({ error: 'SLUG_TAKEN', message: 'Slug nay da co nguoi dung.' });
                newSlug = wantedSlug;
            }

            const projectName = req.body?.projectName !== undefined
                ? String(req.body.projectName).trim().slice(0, 200) || page.project_name
                : page.project_name;

            // Sections: nhan toan bo mang tu editor (da duoc sua); kiem tra hinh thuc toi thieu
            let sections = page.sections;
            if (Array.isArray(req.body?.sections)) {
                sections = req.body.sections
                    .filter((x: any) => x && typeof x.stage === 'string' && x.stage.length <= 40)
                    .map((x: any) => ({
                        stage: String(x.stage),
                        title: x.title !== undefined && x.title !== null ? String(x.title).slice(0, 200) : undefined,
                        body: x.body !== undefined && x.body !== null ? String(x.body).slice(0, 4000) : undefined,
                        items: Array.isArray(x.items) ? x.items.map((i: any) => String(i).slice(0, 200)).slice(0, 24) : undefined,
                        images: Array.isArray(x.images) ? x.images.map((i: any) => String(i).slice(0, 500)).filter((u: string) => u.startsWith('/uploads/') || /^https?:\/\//.test(u)).slice(0, MAX_GALLERY_IMAGES) : undefined,
                        phone: x.phone !== undefined && x.phone !== null ? String(x.phone).slice(0, 40) : undefined,
                        contactName: x.contactName !== undefined && x.contactName !== null ? String(x.contactName).slice(0, 120) : undefined,
                        tokens: Number(x.tokens) || 0,
                    }));
            }

            const updated = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query(
                    'UPDATE landing_pages SET project_name = $1, slug = $2, sections = $3::jsonb, updated_at = now() WHERE id = $4 RETURNING ' + PAGE_COLUMNS,
                    [projectName, newSlug, JSON.stringify(sections), page.id],
                );
                return r.rows[0];
            });

            await audit(DEFAULT_TENANT_ID, 'landing_update', { slug, visitorKey }, { id: updated.id, slug: updated.slug });
            return res.json({ page: updated });
        } catch (err) {
            logger.error('[landingPages] update failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });

    /** Upload anh du an cho phan gallery. Xac thuc quyen so huu qua visitorKey (khong dung authenticateToken - trang nay khong co dang nhap). */
    router.post('/:slug/images', imageUpload.array('files', MAX_IMAGE_FILES_PER_REQUEST), handleImageMulterError, async (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug || '').trim().slice(0, 220);
            const visitorKey = String(req.body?.visitorKey || '').trim().slice(0, 120);
            if (!slug || !visitorKey) return res.status(400).json({ error: 'MISSING_SLUG_OR_KEY' });

            const page = await loadOwnedPage(slug, visitorKey);
            if (!page) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });

            const files = req.files as Express.Multer.File[] | undefined;
            if (!files || files.length === 0) {
                return res.status(400).json({ error: 'NO_FILES', message: 'Chua chon anh nao de tai len' });
            }

            const sections: any[] = Array.isArray(page.sections) ? page.sections : [];
            let gallery = sections.find((x: any) => x && x.stage === 'gallery');
            if (!gallery) {
                gallery = { stage: 'gallery', title: 'Hinh anh du an', items: [], images: [], tokens: 0 };
                sections.push(gallery);
            }
            const existingImages: string[] = Array.isArray(gallery.images) ? gallery.images : [];
            const uploadedUrls: string[] = [];
            const rejected: string[] = [];

            for (const f of files) {
                if (existingImages.length + uploadedUrls.length >= MAX_GALLERY_IMAGES) {
                    rejected.push(f.originalname + ' (da dat toi da ' + MAX_GALLERY_IMAGES + ' anh)');
                    continue;
                }
                const detected = await fileTypeFromBuffer(f.buffer);
                if (!detected || !ALLOWED_IMAGE_MIMES.has(detected.mime)) {
                    rejected.push(f.originalname);
                    continue;
                }
                const compressedResult = await compressGalleryImage(f.buffer, detected.mime);
                const uniqueId = crypto.randomBytes(16).toString('hex');
                const filename = Date.now() + '-' + uniqueId + compressedResult.ext;
                const url = await storeFile(DEFAULT_TENANT_ID, filename, compressedResult.buffer, compressedResult.contentType);
                uploadedUrls.push(url);
            }

            if (uploadedUrls.length === 0) {
                return res.status(415).json({ error: 'Khong co anh hop le nao duoc tai len', rejected });
            }

            gallery.images = [...existingImages, ...uploadedUrls];

            const updated = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query(
                    'UPDATE landing_pages SET sections = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING ' + PAGE_COLUMNS,
                    [JSON.stringify(sections), page.id],
                );
                return r.rows[0];
            });

            await audit(DEFAULT_TENANT_ID, 'landing_image_upload', { slug, visitorKey }, { id: updated.id, slug: updated.slug, uploaded: uploadedUrls.length });
            return res.json({ page: updated, uploaded: uploadedUrls.length, rejected: rejected.length ? rejected : undefined });
        } catch (err) {
            logger.error('[landingPages] image upload failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });

    /** Xoa 1 anh khoi gallery (va don dep file luu tru neu la file cua chinh he thong). */
    router.delete('/:slug/images', async (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug || '').trim().slice(0, 220);
            const visitorKey = String(req.body?.visitorKey || '').trim().slice(0, 120);
            const url = String(req.body?.url || '').trim();
            if (!slug || !visitorKey || !url) return res.status(400).json({ error: 'MISSING_FIELDS' });

            const page = await loadOwnedPage(slug, visitorKey);
            if (!page) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });

            const sections: any[] = Array.isArray(page.sections) ? page.sections : [];
            const gallery = sections.find((x: any) => x && x.stage === 'gallery');
            if (!gallery || !Array.isArray(gallery.images) || !gallery.images.includes(url)) {
                return res.status(404).json({ error: 'IMAGE_NOT_FOUND' });
            }
            gallery.images = gallery.images.filter((u: string) => u !== url);

            const updated = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query(
                    'UPDATE landing_pages SET sections = $1::jsonb, updated_at = now() WHERE id = $2 RETURNING ' + PAGE_COLUMNS,
                    [JSON.stringify(sections), page.id],
                );
                return r.rows[0];
            });

            const filename = storageFilenameFromUrl(url);
            let cleanup: { id: string; status: string } | undefined;
            if (filename) {
                try {
                    const job = await enqueueGalleryCleanup(DEFAULT_TENANT_ID, String(page.id), filename);
                    cleanup = { id: job.id, status: job.status };
                    void retryGalleryCleanup(DEFAULT_TENANT_ID, job.id).catch(() => {
                        logger.warn('[landingPages] gallery cleanup remains retryable', {
                            event: 'gallery_cleanup_retryable',
                            jobId: job.id,
                        });
                    });
                } catch {
                    logger.error('[landingPages] failed to enqueue gallery cleanup', {
                        event: 'gallery_cleanup_enqueue_failed',
                    });
                }
            }

            await audit(DEFAULT_TENANT_ID, 'landing_image_remove', { slug, visitorKey }, { id: updated.id, slug: updated.slug });
            return res.json({ page: updated, cleanup });
        } catch (err) {
            logger.error('[landingPages] image remove failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });

    function statusHandler(status: 'draft' | 'published') {
        return async (req: Request, res: Response) => {
            try {
                const slug = String(req.params.slug || '').trim().slice(0, 220);
                const visitorKey = String(req.body?.visitorKey || '').trim().slice(0, 120);
                if (!slug || !visitorKey) return res.status(400).json({ error: 'MISSING_SLUG_OR_KEY' });
                const page = await loadOwnedPage(slug, visitorKey);
                if (!page) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });
                if (status === 'published') {
                    const secArr = Array.isArray(page.sections) ? page.sections : [];
                    const hero = secArr.find((s: any) => s && s.stage === 'hero');
                    if (!hero || !String(hero.title || '').trim()) {
                        return res.status(400).json({ error: 'CONTENT_INCOMPLETE', message: 'Can co it nhat phan hero co tieu de truoc khi publish.' });
                    }
                }
                const updated = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                    const r = await client.query(
                        'UPDATE landing_pages SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, slug, status, updated_at',
                        [status, page.id],
                    );
                    return r.rows[0];
                });
                await audit(DEFAULT_TENANT_ID, 'landing_' + status, { slug, visitorKey }, updated);
                return res.json({ page: updated });
            } catch (err) {
                logger.error('[landingPages] status change failed: ' + (err as Error).message);
                return res.status(500).json({ error: 'INTERNAL' });
            }
        };
    }

    router.post('/:slug/publish', statusHandler('published'));
    router.post('/:slug/unpublish', statusHandler('draft'));

    router.get('/:slug/status', async (req: Request, res: Response) => {
        try {
            const slug = String(req.params.slug || '').trim().slice(0, 220);
            if (!slug) return res.status(400).json({ error: 'MISSING_SLUG' });
            const row = await withTenantContext(DEFAULT_TENANT_ID, async (client: any) => {
                const r = await client.query('SELECT status FROM landing_pages WHERE slug = $1 LIMIT 1', [slug]);
                return r.rows[0] || null;
            });
            if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
            return res.json({ status: row.status });
        } catch (err) {
            logger.error('[landingPages] status fetch failed: ' + (err as Error).message);
            return res.status(500).json({ error: 'INTERNAL' });
        }
    });
    return router;
}
