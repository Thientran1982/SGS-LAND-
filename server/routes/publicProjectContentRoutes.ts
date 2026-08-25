import { Router, Request, Response } from 'express';
import { publicProjectContentRepository } from '../repositories/publicProjectContentRepository';

const CAN_POST = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING'];
const CAN_MANAGE = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

function validPayload(body: any) {
  const slug = String(body.slug || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  if (!name || name.length > 255) return 'Tên dự án không hợp lệ';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) return 'Slug chỉ gồm chữ thường, số và dấu gạch ngang';
  if (body.status && !['DRAFT', 'PUBLISHED'].includes(body.status)) return 'Trạng thái không hợp lệ';
  if (body.content !== undefined && (typeof body.content !== 'object' || Array.isArray(body.content))) return 'Nội dung phải là object';
  return null;
}

export function createPublicProjectContentRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/published', async (_req: Request, res: Response) => {
    try { res.json({ data: await publicProjectContentRepository.findPublished() }); }
    catch (error) { console.error('[PublicProjectContent] published:', error); res.status(500).json({ error: 'Không thể tải dự án' }); }
  });
  router.get('/published/:slug', async (req: Request, res: Response) => {
    try {
      const item = (await publicProjectContentRepository.findPublished()).find((row: any) => row.slug === req.params.slug);
      return item ? res.json(item) : res.status(404).json({ error: 'Không tìm thấy dự án' });
    } catch (error) { return res.status(500).json({ error: 'Không thể tải dự án' }); }
  });

  router.use(authenticateToken);
  router.get('/', async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json({ data: await publicProjectContentRepository.findForTenant(user.tenantId) });
  });
  router.get('/:id', async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const item = await publicProjectContentRepository.findForTenant(user.tenantId, String(req.params.id));
    return item ? res.json(item) : res.status(404).json({ error: 'Không tìm thấy dự án' });
  });
  router.post('/', async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!CAN_POST.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const error = validPayload(req.body);
    if (error) return res.status(400).json({ error });
    try {
      res.status(201).json(await publicProjectContentRepository.create(user.tenantId, user.id, {
        ...req.body, slug: String(req.body.slug).trim().toLowerCase(), name: String(req.body.name).trim(),
      }));
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'Slug đã tồn tại trong workspace' });
      throw e;
    }
  });
  router.put('/:id', async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const error = validPayload({ ...req.body, name: req.body.name ?? 'ok', slug: req.body.slug ?? 'ok' });
    if (error && (req.body.name !== undefined || req.body.slug !== undefined)) return res.status(400).json({ error });
    try {
      const item = await publicProjectContentRepository.update(user.tenantId, user.id, String(req.params.id), req.body);
      return item ? res.json(item) : res.status(404).json({ error: 'Không tìm thấy dự án' });
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'Slug đã tồn tại trong workspace' });
      throw e;
    }
  });
  router.delete('/:id', async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!CAN_MANAGE.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json({ deleted: await publicProjectContentRepository.remove(user.tenantId, String(req.params.id)) });
  });
  return router;
}