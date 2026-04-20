import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { DEFAULT_TENANT_ID } from '../constants';
import { storeFile, getFile, deleteFile } from '../services/storageService';

let sharp: typeof import('sharp') | null = null;
(async () => {
  try {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp');
  } catch {
    console.warn('[Upload] sharp not available — images will be stored as-is');
  }
})();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB for images
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB for videos
const MAX_FILE_SIZE = MAX_VIDEO_SIZE;       // multer uses the highest limit; per-file check below
const MAX_FILES = 10;

const IMAGE_MAX_DIM = 1920;
const WEBP_QUALITY = 82;
const THUMB_WEBP_QUALITY = 78;

const ALLOWED_MIMES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/avi'],
  document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'],
};

const ALL_ALLOWED = [...ALLOWED_MIMES.image, ...ALLOWED_MIMES.video, ...ALLOWED_MIMES.document];

const ALLOWED_REAL_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/avi',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-cfb',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/avi': '.avi',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
};

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
};

const PUBLIC_MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogv', '.mov']);

// ─── Resize cache (key = "tenantId/filename?w=N") ────────────────────────────
const RESIZE_CACHE_MAX_BYTES = 60 * 1024 * 1024; // 60 MB for thumbnails
const RESIZE_CACHE_MAX_ENTRIES = 500;

interface ResizeCacheEntry { buffer: Buffer; size: number }
const resizeCache = new Map<string, ResizeCacheEntry>();
let resizeCacheTotalBytes = 0;

function resizeLruGet(key: string): Buffer | undefined {
  const entry = resizeCache.get(key);
  if (!entry) return undefined;
  resizeCache.delete(key);
  resizeCache.set(key, entry);
  return entry.buffer;
}

function resizeLruSet(key: string, buffer: Buffer): void {
  while (
    resizeCache.size > 0 &&
    (resizeCacheTotalBytes + buffer.length > RESIZE_CACHE_MAX_BYTES ||
      resizeCache.size >= RESIZE_CACHE_MAX_ENTRIES)
  ) {
    const firstKey = resizeCache.keys().next().value!;
    const evicted = resizeCache.get(firstKey)!;
    resizeCacheTotalBytes -= evicted.size;
    resizeCache.delete(firstKey);
  }
  resizeCache.set(key, { buffer, size: buffer.length });
  resizeCacheTotalBytes += buffer.length;
}

// Use memory storage so we can forward buffers to any backend (disk or Object Storage)
const memStorage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALL_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Định dạng file không được hỗ trợ: ${file.mimetype}`));
  }
};

const upload = multer({
  storage: memStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File quá lớn (tối đa 10MB cho ảnh, 100MB cho video)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Số lượng file vượt giới hạn (tối đa 10 file)' });
    }
    return res.status(400).json({ error: 'Lỗi tải file. Vui lòng thử lại.' });
  }
  if (err?.message?.includes('Định dạng file')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
}

async function compressImage(buf: Buffer, mime: string): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  if (!sharp || mime === 'image/gif') {
    return { buffer: buf, contentType: mime, ext: MIME_TO_EXT[mime] || '.jpg' };
  }
  try {
    const s = (sharp as any)(buf);
    const meta = await s.metadata();
    const w: number = meta.width || 0;
    const h: number = meta.height || 0;
    let pipeline = s;
    if (w > IMAGE_MAX_DIM || h > IMAGE_MAX_DIM) {
      pipeline = pipeline.resize(IMAGE_MAX_DIM, IMAGE_MAX_DIM, { fit: 'inside', withoutEnlargement: true });
    }
    const compressed: Buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    return { buffer: compressed, contentType: 'image/webp', ext: '.webp' };
  } catch (err) {
    console.warn('[Upload] sharp compression failed, storing original:', err);
    return { buffer: buf, contentType: mime, ext: MIME_TO_EXT[mime] || '.jpg' };
  }
}

export function createUploadRoutes(authenticateToken: any) {
  const router = Router();

  router.post('/', authenticateToken, upload.array('files', MAX_FILES), handleMulterError, async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Chưa có file nào được chọn để tải lên' });
      }

      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      const uploaded: { filename: string; originalName: string; mimetype: string; size: number; url: string }[] = [];
      const rejected: string[] = [];

      for (const f of files) {
        let buf = f.buffer;
        let contentType = f.mimetype;

        if (f.mimetype !== 'text/plain') {
          const detected = await fileTypeFromBuffer(buf);
          if (!detected || !ALLOWED_REAL_MIMES.has(detected.mime)) {
            rejected.push(f.originalname);
            continue;
          }
          contentType = detected.mime;
        }

        // Enforce per-type size limits
        if (ALLOWED_MIMES.image.includes(contentType) && buf.length > MAX_IMAGE_SIZE) {
          rejected.push(`${f.originalname} (vượt giới hạn 10MB cho ảnh)`);
          continue;
        }

        const uniqueId = crypto.randomBytes(16).toString('hex');
        let ext = MIME_TO_EXT[contentType] || path.extname(f.originalname).toLowerCase();

        // Compress & resize images using sharp
        if (ALLOWED_MIMES.image.includes(contentType)) {
          const result = await compressImage(buf, contentType);
          buf = result.buffer;
          contentType = result.contentType;
          ext = result.ext;
        }

        const filename = `${Date.now()}-${uniqueId}${ext}`;
        const url = await storeFile(tenantId, filename, buf, contentType);

        uploaded.push({
          filename,
          originalName: f.originalname,
          mimetype: contentType,
          size: buf.length,
          url,
        });
      }

      if (uploaded.length === 0) {
        return res.status(415).json({
          error: 'Định dạng file không hợp lệ. Chỉ chấp nhận ảnh JPEG, PNG, WebP, HEIC và tài liệu PDF.',
          rejected,
        });
      }

      if (rejected.length > 0) {
        return res.json({ files: uploaded, warnings: [`${rejected.length} file bị từ chối do định dạng không hợp lệ: ${rejected.join(', ')}`] });
      }

      res.json({ files: uploaded });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Tải ảnh thất bại. Vui lòng thử lại.' });
    }
  });

  router.delete('/:filename', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      const filename = path.basename(String(req.params.filename));

      if (!SAFE_FILENAME_REGEX.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      await deleteFile(tenantId, filename);
      res.json({ message: 'File deleted' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  return router;
}

export function createUploadServeRoute(authenticateToken: any) {
  const router = Router();

  router.get('/:tenantId/:filename', (req: Request, res: Response, next: NextFunction) => {
    const ext = path.extname(String(req.params.filename)).toLowerCase();
    if (PUBLIC_MEDIA_EXTS.has(ext)) {
      return next('route');
    }
    authenticateToken(req, res, next);
  }, (req: Request, res: Response) => {
    serveUploadedFile(req, res, (req as any).tenantId);
  });

  router.get('/:tenantId/:filename', (req: Request, res: Response) => {
    serveUploadedFile(req, res, null);
  });

  return router;
}

async function serveUploadedFile(req: Request, res: Response, userTenantId: string | null) {
  try {
    const requestedTenantId = String(req.params.tenantId);

    if (!UUID_REGEX.test(requestedTenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }

    if (userTenantId !== null && requestedTenantId !== userTenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filename = path.basename(String(req.params.filename));
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const ext = path.extname(filename).toLowerCase();
    const isPublicMedia = PUBLIC_MEDIA_EXTS.has(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

    // Parse optional width param for responsive thumbnails (?w=400, ?w=800, etc.)
    const wParam = parseInt(String(req.query.w || ''), 10);
    const wantResize = isImage && sharp && wParam > 0 && wParam <= 2400;

    const nameWithoutExt = path.basename(filename, ext);
    const hashPart = nameWithoutExt.includes('-') ? nameWithoutExt.split('-').slice(1).join('-') : nameWithoutExt;
    const etag = wantResize ? `"${hashPart}-w${wParam}"` : `"${hashPart}"`;

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === '*')) {
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', isPublicMedia ? 'public, max-age=31536000, immutable' : 'private, max-age=86400');
      return res.status(304).end();
    }

    // Check resize cache first for thumbnail requests
    if (wantResize) {
      const rKey = `${requestedTenantId}/${filename}?w=${wParam}`;
      const cached = resizeLruGet(rKey);
      if (cached) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        res.setHeader('Content-Length', cached.length);
        return res.end(cached);
      }
    }

    const fileResult = await getFile(requestedTenantId, filename);
    if (!fileResult) {
      return res.status(404).json({ error: 'File not found' });
    }

    let { buffer, contentType: dbContentType } = fileResult;
    let contentType = EXT_TO_CONTENT_TYPE[ext] || dbContentType || 'application/octet-stream';

    const tsMatch = filename.match(/^(\d+)-/);
    const lastModified = tsMatch
      ? new Date(parseInt(tsMatch[1], 10)).toUTCString()
      : new Date(0).toUTCString();

    // Resize on-the-fly for thumbnail requests
    if (wantResize) {
      try {
        const resized: Buffer = await (sharp as any)(buffer)
          .resize(wParam, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: THUMB_WEBP_QUALITY })
          .toBuffer();

        const rKey = `${requestedTenantId}/${filename}?w=${wParam}`;
        resizeLruSet(rKey, resized);

        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', lastModified);
        res.setHeader('Content-Length', resized.length);
        return res.end(resized);
      } catch (err) {
        console.warn('[Serve] sharp resize failed, serving original:', err);
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', isPublicMedia ? 'public, max-age=31536000, immutable' : 'private, max-age=86400');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
}
