import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { DEFAULT_TENANT_ID } from '../constants';
import { leadRepository } from '../repositories/leadRepository';
import { storeFile } from '../services/storageService';
import { extractTextFromBuffer } from '../services/textExtractor';
import { livechatRateLimit } from '../middleware/rateLimiter';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_EXTRACTED_TEXT = 50_000;
const MAX_ATTACHMENT_NAME = 160;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

const REAL_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-cfb',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/x-cfb': '.doc',
  'text/plain': '.txt',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('ATTACHMENT_INVALID_MIME'));
  },
});

function handleUploadError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File quá lớn (tối đa 10MB mỗi file)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Chỉ được đính kèm tối đa 5 file mỗi tin nhắn' });
    }
    return res.status(400).json({ error: 'Không thể tải file lên. Vui lòng thử lại.' });
  }
  if (err?.message === 'ATTACHMENT_INVALID_MIME') {
    return res.status(415).json({
      error: 'Chỉ nhận ảnh JPEG, PNG, WebP, GIF hoặc tài liệu PDF, DOC, DOCX, TXT',
    });
  }
  if (err) return res.status(400).json({ error: err.message || 'File không hợp lệ' });
  next();
}

function attachmentKind(contentType: string): 'image' | 'document' {
  return contentType.startsWith('image/') ? 'image' : 'document';
}

function safeOriginalName(name: string): string {
  return path.basename(String(name || 'file')).replace(/[^\p{L}\p{N}._() -]/gu, '_').slice(0, MAX_ATTACHMENT_NAME) || 'file';
}

export function createPublicLiveChatAttachmentRoutes() {
  const router = Router();

  router.post(
    '/attachments',
    livechatRateLimit,
    upload.array('files', MAX_FILES),
    handleUploadError,
    async (req: Request, res: Response) => {
      try {
        const leadId = String(req.body?.leadId || '').trim();
        if (!leadId) return res.status(400).json({ error: 'leadId bắt buộc' });
        if (!UUID_RE.test(leadId)) return res.status(400).json({ error: 'leadId không hợp lệ' });
        const lead = await leadRepository.findById(DEFAULT_TENANT_ID, leadId);
        if (!lead) return res.status(404).json({ error: 'Phiên chat không tồn tại' });

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (files.length === 0) return res.status(400).json({ error: 'Chưa có file được chọn' });

        const attachments: Array<Record<string, unknown>> = [];
        for (const file of files) {
          let contentType = file.mimetype;
          if (contentType !== 'text/plain') {
            const detected = await fileTypeFromBuffer(file.buffer);
            if (!detected || !REAL_MIMES.has(detected.mime)) {
              return res.status(415).json({ error: `File "${safeOriginalName(file.originalname)}" không đúng định dạng` });
            }
            contentType = detected.mime === 'application/x-cfb' ? 'application/msword' : detected.mime;
          }

          const ext = MIME_TO_EXT[contentType] || path.extname(file.originalname).toLowerCase();
          const filename = `chat-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
          const url = await storeFile(DEFAULT_TENANT_ID, filename, file.buffer, contentType);
          const kind = attachmentKind(contentType);
          const result: Record<string, unknown> = {
            id: filename,
            name: safeOriginalName(file.originalname),
            mimeType: contentType,
            size: file.buffer.length,
            kind,
          };

          if (kind === 'image') {
            // Only images are exposed as public landing gallery assets.
            result.url = url;
          } else {
            const extracted = await extractTextFromBuffer(file.buffer, ext);
            if (extracted.trim()) result.text = extracted.slice(0, MAX_EXTRACTED_TEXT);
          }
          attachments.push(result);
        }

        return res.status(201).json({ attachments });
      } catch (error: any) {
        console.error('[PublicLiveChatAttachment] upload failed:', error);
        return res.status(500).json({ error: 'Tải file thất bại. Vui lòng thử lại.' });
      }
    },
  );

  return router;
}