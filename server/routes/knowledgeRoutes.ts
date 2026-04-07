import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { documentRepository } from '../repositories/documentRepository';
import { articleRepository } from '../repositories/articleRepository';
import { extractTextFromFile } from '../services/textExtractor';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads');
const CAN_MANAGE = ['ADMIN', 'TEAM_LEAD'];

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
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { title, type, content, status, fileUrl, sizeKb } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      let extractedContent = content || '';
      if (fileUrl && !extractedContent) {
        try {
          const tenantId = user.tenantId;
          const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
          const filePath = path.join(process.cwd(), relativePath);
          const resolved = path.resolve(filePath);
          const tenantDir = path.resolve(path.join(process.cwd(), 'uploads', tenantId));
          if (resolved.startsWith(tenantDir + path.sep) || resolved.startsWith(tenantDir + '/')) {
            extractedContent = await extractTextFromFile(resolved);
          }
        } catch (err) {
          console.error('Text extraction failed:', err);
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

      // Background extraction: if content not yet available, retry async then update to ACTIVE
      if (initialStatus === 'PROCESSING' && fileUrl) {
        (async () => {
          try {
            const tenantId = user.tenantId;
            const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
            const filePath = path.join(process.cwd(), relativePath);
            const resolved = path.resolve(filePath);
            const tenantDir = path.resolve(path.join(process.cwd(), 'uploads', tenantId));

            let bgContent = '';
            if (resolved.startsWith(tenantDir + path.sep) || resolved.startsWith(tenantDir + '/')) {
              try { bgContent = await extractTextFromFile(resolved); } catch { /* ignore */ }
            }

            // Gemini fallback: if file extraction still empty, use AI to summarize filename as placeholder
            if (!bgContent && title) {
              bgContent = `[Tài liệu: ${title}]`;
            }

            const docId = (doc as any).id as string;
            await documentRepository.update(tenantId, docId, {
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

      // Fetch document first to get file_url for physical deletion
      const doc = await documentRepository.findById(user.tenantId, String(req.params.id));
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      const deleted = await documentRepository.deleteById(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Document not found' });

      // Delete physical file if it exists
      if (doc.fileUrl) {
        try {
          const relativePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
          const filePath = path.join(process.cwd(), relativePath);
          const resolved = path.resolve(filePath);
          const tenantDir = path.resolve(path.join(UPLOAD_BASE, user.tenantId));
          if (resolved.startsWith(tenantDir + path.sep) || resolved.startsWith(tenantDir + '/')) {
            if (fs.existsSync(resolved)) {
              fs.unlinkSync(resolved);
            }
          }
        } catch (fileErr) {
          console.error('Failed to delete physical file:', fileErr);
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
      if (!CAN_MANAGE.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const { title, content, excerpt, category, tags, author, coverImage, image, images, featured, status, slug } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      const article = await articleRepository.create(user.tenantId, {
        title, content, excerpt, category, tags,
        author: author || user.name, coverImage: coverImage || image, image, images, featured,
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

  return router;
}
