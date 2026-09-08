import { Router, Request, Response, RequestHandler } from 'express';
import { Pool } from 'pg';
import { listingRepository } from '../repositories/listingRepository';
import {
  activateSocialPublication,
  cancelSocialPublication,
  createSocialPublication,
  findSocialPublication,
  listSocialPublications,
  markSocialTargetsPending,
} from '../repositories/socialPublicationRepository';
import {
  buildPlatformContent,
  buildSocialProductSnapshot,
  getTenantPublicationCatalog,
  normalizeSocialPlatforms,
} from '../services/socialPublicationService';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';

const MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MARKETING']);

function tenantId(req: Request): string {
  return String((req as any).user?.tenantId || (req as any).tenantId || '');
}

function requireManager(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user || !MANAGER_ROLES.has(user.role)) {
    res.status(403).json({ error: 'Cần quyền quản lý marketing hoặc quản trị viên' });
    return false;
  }
  return true;
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) {
    throw new Error('Thời điểm hẹn đăng không hợp lệ');
  }
  if (new Date(value).getTime() <= Date.now()) {
    throw new Error('Thời điểm hẹn đăng phải ở tương lai');
  }
  return value;
}

export function createSocialPublicationRouter(
  pool: Pool,
  authenticateToken: RequestHandler,
): Router {
  const router = Router();

  router.get('/api/social-publications/catalog', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    res.json({ data: await getTenantPublicationCatalog(tenantId(req)) });
  });

  router.post('/api/social-publications/preview', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    try {
      const snapshot = await buildSocialProductSnapshot(tenantId(req), String(req.body?.listingId || ''));
      const platforms = normalizeSocialPlatforms(req.body?.platforms);
      if (!platforms.length) return res.status(400).json({ error: 'Chọn ít nhất một nền tảng để xem trước' });
      const images = Array.isArray(req.body?.imageUrls)
        ? req.body.imageUrls.filter((value: unknown): value is string => typeof value === 'string')
        : [];
      return res.json({
        snapshot,
        previews: platforms.map(platform => buildPlatformContent(snapshot, platform, images)),
        catalog: await getTenantPublicationCatalog(tenantId(req)),
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể tạo preview' });
    }
  });

  router.get('/api/social-publications', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const rows = await listSocialPublications(pool, tenantId(req), Number(req.query.limit) || 100);
    res.json({ data: rows, total: rows.length });
  });

  router.get('/api/social-publications/:id', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const row = await findSocialPublication(pool, tenantId(req), String(req.params.id));
    if (!row) return res.status(404).json({ error: 'Không tìm thấy publication' });
    res.json(row);
  });

  router.post('/api/social-publications', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    try {
      const currentTenant = tenantId(req);
      const listingId = String(req.body?.listingId || '');
      const platforms = normalizeSocialPlatforms(req.body?.platforms);
      if (!listingId || !/^[0-9a-f-]{36}$/i.test(listingId)) {
        return res.status(400).json({ error: 'Listing ID không hợp lệ' });
      }
      if (!platforms.length) return res.status(400).json({ error: 'Chọn ít nhất một nền tảng' });
      const listing = await listingRepository.findById(currentTenant, listingId);
      if (!listing) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong tenant hiện tại' });
      const snapshot = await buildSocialProductSnapshot(currentTenant, listingId);
      const publishMode = req.body?.publishMode === 'SCHEDULED' ? 'SCHEDULED' : 'NOW';
      const scheduledAt = publishMode === 'SCHEDULED' ? parseDate(req.body?.scheduledAt) : null;
      if (publishMode === 'SCHEDULED' && !scheduledAt) {
        return res.status(400).json({ error: 'Chiến dịch hẹn giờ cần có thời điểm đăng' });
      }
      const imageUrls = Array.isArray(listing.images)
        ? listing.images.filter((value: unknown): value is string => typeof value === 'string')
        : [];
      const publication = await createSocialPublication(pool, {
        tenantId: currentTenant,
        listingId,
        createdBy: (req as any).user?.id || null,
        publishMode,
        scheduledAt,
        contentSnapshot: snapshot as unknown as Record<string, unknown>,
        assetSnapshot: imageUrls.slice(0, 10),
        platforms,
      });
      return res.status(201).json({
        ...publication,
        note: 'Đã lưu snapshot. Publication chỉ được đăng khi nền tảng có publisher và quyền hợp lệ.',
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể tạo publication' });
    }
  });

  router.post('/api/social-publications/:id/activate', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const row = await findSocialPublication(pool, tenantId(req), String(req.params.id));
    if (!row) return res.status(404).json({ error: 'Không tìm thấy publication' });
    const readiness = await Promise.all(row.targets.map(async (target: any) => ({
      target,
      capability: await getTenantSocialPlatformCapability(
        target.platform,
        tenantId(req),
        target.accountId,
      ),
    })));
    const notReady = readiness.filter(({ target, capability }) => (
      ['NOT_READY', 'PENDING', 'FAILED_RETRYABLE'].includes(target.status)
      && !capability.canPublish
    ));
    if (notReady.length) {
      return res.status(409).json({
        error: 'Chưa thể đăng: một hoặc nhiều nền tảng chưa có publisher/quyền đăng công khai.',
        code: 'PUBLISHERS_NOT_READY',
        targets: notReady.map((target: any) => target.platform),
      });
    }
    const activated = await activateSocialPublication(pool, tenantId(req), String(req.params.id));
    if (!activated) return res.status(409).json({ error: 'Publication không còn ở trạng thái DRAFT' });
    await markSocialTargetsPending(pool, tenantId(req), String(req.params.id));
    return res.json(await findSocialPublication(pool, tenantId(req), String(req.params.id)));
  });

  router.post('/api/social-publications/:id/cancel', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const cancelled = await cancelSocialPublication(pool, tenantId(req), String(req.params.id));
    if (!cancelled) return res.status(409).json({ error: 'Publication không thể hủy ở trạng thái hiện tại' });
    res.json({ ok: true, id: req.params.id, status: 'CANCELLED' });
  });

  return router;
}