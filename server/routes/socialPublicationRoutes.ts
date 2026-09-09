import { Router, Request, Response, RequestHandler } from 'express';
import { Pool } from 'pg';
import { listingRepository } from '../repositories/listingRepository';
import {
  applySocialTargetOperatorAction,
  activateSocialPublication,
  cancelSocialPublication,
  createSocialPublication,
  findSocialPublication,
  listSocialPublications,
  markSocialTargetsPending,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  buildPlatformContent,
  buildSocialProductSnapshot,
  getTenantPublicationCatalog,
  MAX_FACEBOOK_IMAGES,
  normalizePublicationCaption,
  normalizePublicationImages,
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

function parseProviderPostUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Provider post URL không hợp lệ');
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.toString().slice(0, 1000);
  } catch {
    throw new Error('Provider post URL phải là HTTP(S)');
  }
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
      const listingImages = normalizePublicationImages((await listingRepository.findById(
        tenantId(req),
        String(req.body?.listingId || ''),
      ))?.images);
      const images = Array.isArray(req.body?.imageUrls)
        ? normalizePublicationImages(req.body.imageUrls)
        : listingImages;
      const caption = normalizePublicationCaption(req.body?.caption);
      const previewSnapshot = caption ? { ...snapshot, caption } : snapshot;
      return res.json({
        snapshot,
        previews: platforms.map(platform => buildPlatformContent(previewSnapshot, platform, images)),
        catalog: await getTenantPublicationCatalog(tenantId(req)),
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể tạo preview' });
    }
  });

  router.get('/api/social-publications', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const requestedSource = String(req.query.source || '').toUpperCase();
    const source = requestedSource === 'AUTO' || requestedSource === 'MANUAL'
      ? requestedSource as 'AUTO' | 'MANUAL'
      : undefined;
    const rows = await listSocialPublications(pool, tenantId(req), Number(req.query.limit) || 100, source);
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
      const listingImages = normalizePublicationImages(listing.images);
      const imageUrls = Array.isArray(req.body?.imageUrls)
        ? normalizePublicationImages(req.body.imageUrls)
        : listingImages;
      const unavailableImages = imageUrls.filter(image => !listingImages.includes(image));
      if (unavailableImages.length) {
        return res.status(400).json({ error: 'Ảnh được chọn phải thuộc listing hiện tại' });
      }
      if (platforms.includes('FACEBOOK_PAGE') && !imageUrls.length) {
        return res.status(400).json({ error: 'Facebook publication cần ít nhất một ảnh đại diện' });
      }
      if (platforms.includes('FACEBOOK_PAGE') && imageUrls.length > MAX_FACEBOOK_IMAGES) {
        return res.status(400).json({ error: `Facebook hiện chỉ hỗ trợ tối đa ${MAX_FACEBOOK_IMAGES} ảnh trong một album` });
      }
      const requestedCaption = normalizePublicationCaption(req.body?.caption);
      const caption = requestedCaption || buildPlatformContent(snapshot, platforms[0], imageUrls).text;
      const contentSnapshot = {
        ...snapshot,
        caption,
      };
      const publication = await createSocialPublication(pool, {
        tenantId: currentTenant,
        listingId,
        createdBy: (req as any).user?.id || null,
        publishMode,
        scheduledAt,
        contentSnapshot: contentSnapshot as unknown as Record<string, unknown>,
        assetSnapshot: imageUrls,
        platforms,
      });
      await recordSocialPublicationEvent(pool, {
        tenantId: currentTenant,
        publicationId: publication.id,
        actorId: (req as any).user?.id || null,
        eventType: 'DRAFT_CREATED',
        toStatus: 'DRAFT',
        reason: 'Operator tạo publication draft từ snapshot listing.',
        metadata: { platforms },
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
    await recordSocialPublicationEvent(pool, {
      tenantId: tenantId(req),
      publicationId: String(req.params.id),
      actorId: (req as any).user?.id || null,
      eventType: 'ACTIVATED',
      fromStatus: 'DRAFT',
      toStatus: activated.status,
      reason: 'Operator kích hoạt publication sau khi kiểm tra readiness.',
    });
    return res.json(await findSocialPublication(pool, tenantId(req), String(req.params.id)));
  });

  router.post('/api/social-publications/:id/cancel', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const cancelled = await cancelSocialPublication(pool, tenantId(req), String(req.params.id));
    if (!cancelled) return res.status(409).json({ error: 'Publication không thể hủy ở trạng thái hiện tại' });
    await recordSocialPublicationEvent(pool, {
      tenantId: tenantId(req),
      publicationId: String(req.params.id),
      actorId: (req as any).user?.id || null,
      eventType: 'CANCELLED',
      toStatus: 'CANCELLED',
      reason: 'Operator hủy publication.',
    });
    res.json({ ok: true, id: req.params.id, status: 'CANCELLED' });
  });

  router.post('/api/social-publications/:id/targets/:targetId/reconcile', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    const action = String(req.body?.action || '').toUpperCase();
    if (!['CONFIRM_PUBLISHED', 'MARK_FAILED', 'REQUEUE'].includes(action)) {
      return res.status(400).json({ error: 'Thao tác reconcile không hợp lệ' });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Cần ghi lý do xử lý tối thiểu 3 ký tự' });
    }
    const providerPostId = typeof req.body?.providerPostId === 'string'
      ? req.body.providerPostId.trim().slice(0, 500)
      : '';
    if (action === 'CONFIRM_PUBLISHED' && !providerPostId) {
      return res.status(400).json({ error: 'Cần provider post ID để xác nhận đã đăng' });
    }
    try {
      const result = await applySocialTargetOperatorAction(pool, {
        tenantId: tenantId(req),
        publicationId: String(req.params.id),
        targetId: String(req.params.targetId),
        actorId: (req as any).user?.id || null,
        action: action as 'CONFIRM_PUBLISHED' | 'MARK_FAILED' | 'REQUEUE',
        reason,
        providerPostId: providerPostId || undefined,
        providerPostUrl: parseProviderPostUrl(req.body?.providerPostUrl),
      });
      if (result.kind === 'NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy publication target trong tenant hiện tại' });
      if (result.kind === 'INVALID_INPUT') return res.status(400).json({ error: result.message });
      if (result.kind === 'INVALID_STATE') {
        return res.status(409).json({
          error: `Target đang ở trạng thái ${result.status}, không phù hợp với thao tác này`,
          code: 'TARGET_STATE_CONFLICT',
        });
      }
      return res.json(await findSocialPublication(pool, tenantId(req), String(req.params.id)));
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Không thể reconcile publication target' });
    }
  });

  return router;
}