import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DEFAULT_TENANT_ID } from '../constants';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIMES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'],
};

const ALL_ALLOWED = [...ALLOWED_MIMES.image, ...ALLOWED_MIMES.document];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
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
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
};

const storage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const tenantId = req.tenantId || DEFAULT_TENANT_ID;
    const dir = path.join(UPLOAD_BASE, tenantId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uniqueId}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALL_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 10MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files (max 10)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.includes('File type')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
}

export function createUploadRoutes(authenticateToken: any) {
  const router = Router();

  router.post('/', authenticateToken, upload.array('files', MAX_FILES), handleMulterError, (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;

      const uploaded = files.map(f => ({
        filename: f.filename,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: `/uploads/${tenantId}/${f.filename}`,
      }));

      res.json({ files: uploaded });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  router.delete('/:filename', authenticateToken, (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
      const filename = path.basename(req.params.filename);

      if (!SAFE_FILENAME_REGEX.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const filePath = path.join(UPLOAD_BASE, tenantId, filename);
      const resolved = path.resolve(filePath);
      const expectedDir = path.resolve(path.join(UPLOAD_BASE, tenantId));
      if (!resolved.startsWith(expectedDir)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  return router;
}

// Image extensions served publicly (listing photos are not sensitive)
const PUBLIC_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function createUploadServeRoute(authenticateToken: any) {
  const router = Router();

  router.get('/:tenantId/:filename', (req: Request, res: Response, next: NextFunction) => {
    const ext = path.extname(req.params.filename).toLowerCase();
    // Images are public — browser <img> tags cannot send auth headers
    // Documents (PDF, DOCX, etc.) remain protected
    if (PUBLIC_IMAGE_EXTS.has(ext)) {
      return next('route');  // skip to public handler below
    }
    // Non-image files: require authentication
    authenticateToken(req, res, next);
  }, (req: Request, res: Response) => {
    // Protected document serving (auth already verified above)
    serveUploadedFile(req, res, (req as any).tenantId);
  });

  // Public image route (no auth required — path traversal & UUID still validated)
  router.get('/:tenantId/:filename', (req: Request, res: Response) => {
    serveUploadedFile(req, res, null);
  });

  return router;
}

function serveUploadedFile(req: Request, res: Response, userTenantId: string | null) {
  try {
    const requestedTenantId = req.params.tenantId;

    if (!UUID_REGEX.test(requestedTenantId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }

    // For protected documents: verify tenant matches the logged-in user
    if (userTenantId !== null && requestedTenantId !== userTenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filename = path.basename(req.params.filename);
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(UPLOAD_BASE, requestedTenantId, filename);
    const resolved = path.resolve(filePath);
    const expectedDir = path.resolve(path.join(UPLOAD_BASE, requestedTenantId));
    if (!resolved.startsWith(expectedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = EXT_TO_CONTENT_TYPE[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    // Images: public cacheable; documents: private
    const isPublicImage = PUBLIC_IMAGE_EXTS.has(ext);
    res.setHeader('Cache-Control', isPublicImage ? 'public, max-age=31536000, immutable' : 'private, max-age=86400');
    res.sendFile(resolved);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
}
