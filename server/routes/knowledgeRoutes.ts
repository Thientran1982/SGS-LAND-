import { Router, Request, Response } from 'express';
import path from 'path';
import { documentRepository } from '../repositories/documentRepository';
import { articleRepository } from '../repositories/articleRepository';
import { extractTextFromBuffer, extractTextFromFile } from '../services/textExtractor';
import { getFile } from '../services/storageService';
import {
  indexDocument,
  semanticSearch,
  getIndexStats,
  deleteSource,
  buildRagContext,
} from '../services/ragService';

// Upload & create: mọi nhân viên nội bộ có thể đóng góp tài liệu huấn luyện
const CAN_UPLOAD = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING'];
// Edit & delete: chỉ quản lý cấp cao mới được sửa/xoá
const CAN_MANAGE = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

/**
 * Parse a fileUrl like "/uploads/{tenantId}/{filename}" into its parts.
 * Returns null when the URL does not match this pattern.
 */
function parseUploadUrl(fileUrl: string): { tenantId: string; filename: string; ext: string } | null {
  // Normalise: strip leading slash
  const rel = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
  // Expected pattern: uploads/<tenantId>/<filename>
  const parts = rel.split('/');
  if (parts.length < 3 || parts[0] !== 'uploads') return null;
  const tenantId = parts[1];
  const filename = parts.slice(2).join('/');
  const ext = path.extname(filename).toLowerCase();
  return { tenantId, filename, ext };
}

/**
 * Extract plain text from a document's fileUrl.
 * 1. Tries to fetch the file buffer from PostgreSQL (primary path).
 * 2. Falls back to local disk (dev / legacy files).
 */
async function extractContent(fileUrl: string, tenantId: string): Promise<string> {
  const parsed = parseUploadUrl(fileUrl);
  if (parsed) {
    // Primary: fetch from PostgreSQL storage
    try {
      const fileResult = await getFile(parsed.tenantId, parsed.filename);
      if (fileResult) {
        const text = await extractTextFromBuffer(fileResult.buffer, parsed.ext);
        if (text.trim()) return text;
      }
    } catch (err) {
      console.warn('[Knowledge] Postgres extraction failed, trying disk fallback:', err);
    }

    // Fallback: local disk (dev environment)
    try {
      const diskPath = path.join(process.cwd(), 'uploads', parsed.tenantId, parsed.filename);
      const diskText = await extractTextFromFile(diskPath);
      if (diskText.trim()) return diskText;
    } catch { /* ignore */ }
  }

  // Legacy path: fileUrl is a direct filesystem path (shouldn't happen but keep for safety)
  try {
    const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
    const filePath = path.join(process.cwd(), relativePath);
    const resolved = path.resolve(filePath);
    const tenantDir = path.resolve(path.join(process.cwd(), 'uploads', tenantId));
    if (resolved.startsWith(tenantDir + path.sep) || resolved.startsWith(tenantDir + '/')) {
      return await extractTextFromFile(resolved);
    }
  } catch { /* ignore */ }

  return '';
}

export function createKnowledgeRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/documents', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 200));
      const filters: { search?: string } = {};
      if (req.query.search) filters.search = req.query.search as string;
      const result = await documentRepository.findDocuments(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  router.post('/documents', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_UPLOAD.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { title, type, content, status, fileUrl, sizeKb } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      // Attempt inline extraction when a fileUrl is provided and no content given yet
      let extractedContent = content || '';
      if (fileUrl && !extractedContent) {
        try {
          extractedContent = await extractContent(fileUrl, user.tenantId);
        } catch (err) {
          console.error('[Knowledge] Inline text extraction failed:', err);
        }
      }

      const initialStatus = extractedContent ? (status || 'ACTIVE') : 'PROCESSING';
      const doc = await documentRepository.create(user.tenantId, {
        title,
        type,
        content: extractedContent,
        status: initialStatus,
        fileUrl,
        sizeKb,
      });
      res.status(201).json(doc);

      // Background extraction: retry async when inline extraction returned nothing
      if (initialStatus === 'PROCESSING' && fileUrl) {
        (async () => {
          try {
            let bgContent = await extractContent(fileUrl, user.tenantId);

            // Gemini fallback: if extraction is still empty, use a title placeholder
            if (!bgContent && title) {
              bgContent = `[Tài liệu: ${title}]`;
            }

            const docId = (doc as any).id as string;
            await documentRepository.update(user.tenantId, docId, {
              content: bgContent,
              status: 'ACTIVE',
            });
          } catch (bgErr: any) {
            console.error('[Knowledge] Background extraction failed, forcing ACTIVE:', bgErr.message);
            try {
              const docId = (doc as any).id as string;
              await documentRepository.update(user.tenantId, docId, { status: 'ACTIVE' });
            } catch { /* ignore */ }
          }
        })();
      }
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Failed to create document' });
    }
  });

  router.get('/documents/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const doc = await documentRepository.findById(user.tenantId, String(req.params.id));
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  router.put('/documents/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const doc = await documentRepository.update(user.tenantId, String(req.params.id), req.body);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });

  router.delete('/documents/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const doc = await documentRepository.findById(user.tenantId, String(req.params.id));
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      const deleted = await documentRepository.deleteById(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Document not found' });

      // Delete physical file from storage
      if (doc.fileUrl) {
        try {
          const parsed = parseUploadUrl(doc.fileUrl as string);
          if (parsed) {
            const { deleteFile } = await import('../services/storageService');
            await deleteFile(parsed.tenantId, parsed.filename);
          }
        } catch (fileErr) {
          console.error('[Knowledge] Failed to delete stored file:', fileErr);
        }
      }

      res.json({ message: 'Document deleted' });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  router.get('/articles', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 200));
      const filters: any = {};
      if (req.query.category) filters.category = req.query.category;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.search) filters.search = req.query.search;
      const result = await articleRepository.findArticles(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  });

  router.get('/articles/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const article = await articleRepository.findById(user.tenantId, String(req.params.id));
      if (!article) return res.status(404).json({ error: 'Article not found' });
      res.json(article);
    } catch (error) {
      console.error('Error fetching article:', error);
      res.status(500).json({ error: 'Failed to fetch article' });
    }
  });

  router.post('/articles', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_UPLOAD.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const { title, content, excerpt, category, tags, author, coverImage, image, images, videos, featured, status, slug } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const article = await articleRepository.create(user.tenantId, {
        title, content, excerpt, category, tags,
        author: author || user.name, coverImage: coverImage || image, image, images, videos, featured,
        status: status || 'PUBLISHED', slug,
      });
      res.status(201).json(article);
    } catch (error) {
      console.error('Error creating article:', error);
      res.status(500).json({ error: 'Failed to create article' });
    }
  });

  router.put('/articles/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const article = await articleRepository.update(user.tenantId, String(req.params.id), req.body);
      if (!article) return res.status(404).json({ error: 'Article not found' });
      res.json(article);
    } catch (error) {
      console.error('Error updating article:', error);
      res.status(500).json({ error: 'Failed to update article' });
    }
  });

  router.delete('/articles/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const deleted = await articleRepository.deleteById(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Article not found' });
      res.json({ message: 'Article deleted' });
    } catch (error) {
      console.error('Error deleting article:', error);
      res.status(500).json({ error: 'Failed to delete article' });
    }
  });

  // ── RAG: Indexing endpoints ────────────────────────────────────────────

  /**
   * POST /api/knowledge/rag/index/document/:id
   * Embed + store một document cụ thể vào vector store
   */
  router.post('/rag/index/document/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Không có quyền' });

      const doc = await documentRepository.findById(user.tenantId, String(req.params.id));
      if (!doc) return res.status(404).json({ error: 'Tài liệu không tồn tại' });

      const content = (doc as any).content || '';
      if (!content.trim()) return res.status(422).json({ error: 'Tài liệu chưa có nội dung để index' });

      const count = await indexDocument({
        tenantId: user.tenantId,
        sourceType: 'document',
        sourceId: String((doc as any).id),
        title: (doc as any).title || '',
        content,
        metadata: { type: (doc as any).type, status: (doc as any).status },
      });

      res.json({ ok: true, chunks: count, message: `Đã index ${count} chunk(s)` });
    } catch (err: any) {
      console.error('[RAG] index document error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi index tài liệu' });
    }
  });

  /**
   * POST /api/knowledge/rag/index/article/:id
   * Embed + store một bài viết vào vector store
   */
  router.post('/rag/index/article/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Không có quyền' });

      const article = await articleRepository.findById(user.tenantId, String(req.params.id));
      if (!article) return res.status(404).json({ error: 'Bài viết không tồn tại' });

      const content = [(article as any).title, (article as any).excerpt, (article as any).content]
        .filter(Boolean).join('\n\n');

      const count = await indexDocument({
        tenantId: user.tenantId,
        sourceType: 'article',
        sourceId: String((article as any).id),
        title: (article as any).title || '',
        content,
        metadata: { category: (article as any).category, slug: (article as any).slug },
      });

      res.json({ ok: true, chunks: count, message: `Đã index ${count} chunk(s)` });
    } catch (err: any) {
      console.error('[RAG] index article error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi index bài viết' });
    }
  });

  /**
   * POST /api/knowledge/rag/index-all
   * Re-index toàn bộ documents + articles của tenant (chạy nền)
   * Trả về ngay lập tức, indexing diễn ra async
   */
  router.post('/rag/index-all', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Không có quyền' });

      res.json({ ok: true, message: 'Đang index nền — kiểm tra /rag/stats sau vài phút' });

      // Async background job
      (async () => {
        let indexed = 0;
        let errors = 0;
        try {
          // Index documents
          const docsResult = await documentRepository.findDocuments(user.tenantId, { page: 1, pageSize: 200 });
          for (const doc of (docsResult.data || []) as any[]) {
            if (!doc.content?.trim()) continue;
            try {
              await indexDocument({
                tenantId: user.tenantId,
                sourceType: 'document',
                sourceId: String(doc.id),
                title: doc.title || '',
                content: doc.content,
                metadata: { type: doc.type, status: doc.status },
              });
              indexed++;
            } catch { errors++; }
          }
          // Index articles
          const articlesResult = await articleRepository.findArticles(user.tenantId, { page: 1, pageSize: 200 });
          for (const art of (articlesResult.data || []) as any[]) {
            const content = [art.title, art.excerpt, art.content].filter(Boolean).join('\n\n');
            if (!content.trim()) continue;
            try {
              await indexDocument({
                tenantId: user.tenantId,
                sourceType: 'article',
                sourceId: String(art.id),
                title: art.title || '',
                content,
                metadata: { category: art.category, slug: art.slug },
              });
              indexed++;
            } catch { errors++; }
          }
          console.log(`[RAG] index-all done: ${indexed} indexed, ${errors} errors (tenant:${user.tenantId.slice(0,8)})`);
        } catch (bgErr) {
          console.error('[RAG] index-all background error:', bgErr);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/knowledge/rag/source
   * Xóa vector embeddings của một source cụ thể
   */
  router.delete('/rag/source', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Không có quyền' });

      const { sourceType, sourceId } = req.body;
      if (!sourceType || !sourceId) return res.status(400).json({ error: 'sourceType và sourceId là bắt buộc' });

      const deleted = await deleteSource(user.tenantId, sourceType, sourceId);
      res.json({ ok: true, deleted, message: `Đã xóa ${deleted} chunk(s)` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── RAG: Search & Query endpoints ─────────────────────────────────────

  /**
   * POST /api/knowledge/rag/search
   * Semantic search trong knowledge base
   */
  router.post('/rag/search', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { query, topK = 5, sourceTypes } = req.body;
      if (!query?.trim()) return res.status(400).json({ error: 'query là bắt buộc' });

      const results = await semanticSearch(user.tenantId, query.trim(), topK, sourceTypes);
      res.json({ results, total: results.length });
    } catch (err: any) {
      console.error('[RAG] search error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi tìm kiếm' });
    }
  });

  /**
   * POST /api/knowledge/rag/context
   * Lấy context string đã format sẵn để inject vào AI prompt
   */
  router.post('/rag/context', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { query, topK = 5 } = req.body;
      if (!query?.trim()) return res.status(400).json({ error: 'query là bắt buộc' });

      const context = await buildRagContext(user.tenantId, query.trim(), topK);
      res.json({ context, hasContext: context.length > 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/knowledge/rag/stats
   * Thống kê số chunks đã index
   */
  router.get('/rag/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const stats = await getIndexStats(user.tenantId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
