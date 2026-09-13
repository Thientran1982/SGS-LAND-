import { Router, Request, Response, RequestHandler } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { listingRepository } from '../repositories/listingRepository';
import { projectRepository } from '../repositories/projectRepository';
import {
  applySocialTargetOperatorAction,
  activateSocialPublication,
  cancelSocialPublication,
  countSocialPublications,
  createSocialPublication,
  encodeSocialPublicationCursor,
  findSocialPublication,
  listSocialPublications,
  markSocialTargetsPending,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  buildPlatformContent,
  buildSocialProjectSnapshot,
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestedSource(body: any): { listingId: string | null; projectId: string | null } {
  const listingId = typeof body?.listingId === 'string' && body.listingId.trim()
    ? body.listingId.trim()
    : null;
  const projectId = typeof body?.projectId === 'string' && body.projectId.trim()
    ? body.projectId.trim()
    : null;
  if ((listingId ? 1 : 0) + (projectId ? 1 : 0) !== 1) {
    throw new Error('Cần chọn đúng một nguồn: sản phẩm hoặc dự án');
  }
  if (listingId && !UUID_PATTERN.test(listingId)) throw new Error('Listing ID không hợp lệ');
  if (projectId && !UUID_PATTERN.test(projectId)) throw new Error('Project ID không hợp lệ');
  return { listingId, projectId };
}

function isTenantUploadedImage(imageUrl: string, currentTenant: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:'
      && parsed.pathname.startsWith(`/uploads/${currentTenant}/`);
  } catch {
    return false;
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
      const currentTenant = tenantId(req);
      const { listingId, projectId } = requestedSource(req.body);
      const listing = listingId ? await listingRepository.findById(currentTenant, listingId) : null;
      const snapshot = projectId
        ? await buildSocialProjectSnapshot(currentTenant, projectId)
        : await buildSocialProductSnapshot(currentTenant, listingId!);
      const platforms = normalizeSocialPlatforms(req.body?.platforms);
      if (!platforms.length) return res.status(400).json({ error: 'Chọn ít nhất một nền tảng để xem trước' });
      if (listingId && !listing) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong tenant hiện tại' });
      const sourceImages = projectId
        ? normalizePublicationImages('images' in snapshot ? snapshot.images : [])
        : normalizePublicationImages(listing?.images);
      const images = Array.isArray(req.body?.imageUrls)
        ? normalizePublicationImages(req.body.imageUrls)
        : sourceImages;
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
    const staleOnly = String(req.query.staleOnly || '').toLowerCase() === 'true';
    const requestedPage = Number(req.query.page);
    const page = Number.isFinite(requestedPage)
      ? Math.min(Math.max(Math.floor(requestedPage), 1), 1_000_000)
      : 1;
    const requestedPageSize = Number(req.query.pageSize ?? req.query.limit);
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(Math.max(Math.floor(requestedPageSize), 1), 200)
      : 100;
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor.trim()
      ? req.query.cursor.trim()
      : undefined;
    const offset = (page - 1) * pageSize;
    const listArguments: Parameters<typeof listSocialPublications> = [
      pool,
      tenantId(req),
      pageSize,
      source,
      staleOnly,
    ];
    if (cursor) {
      // Cursor pagination keeps a stale-only report stable while new
      // publications or listing status changes happen between requests.
      listArguments.push(0, cursor);
    } else if (offset > 0) {
      listArguments.push(offset);
    }
    const [rows, countedTotal] = await Promise.all([
      listSocialPublications(...listArguments),
      countSocialPublications(pool, tenantId(req), source, staleOnly),
    ]);
    // Keep a safe fallback for older test doubles and callers while the
    // repository count remains authoritative in production.
    const total = Number.isFinite(countedTotal) ? countedTotal : rows.length;
    const lastRow = rows[rows.length - 1];
    const nextCursor = rows.length === pageSize && lastRow?.createdAt && lastRow?.id
      ? encodeSocialPublicationCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
      : null;
    res.json({
      data: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: cursor ? Boolean(nextCursor) : page * pageSize < total,
      nextCursor,
    });
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
      const { listingId, projectId } = requestedSource(req.body);
      const platforms = normalizeSocialPlatforms(req.body?.platforms);
      if (!platforms.length) return res.status(400).json({ error: 'Chọn ít nhất một nền tảng' });
      const listing = listingId ? await listingRepository.findById(currentTenant, listingId) : null;
      if (listingId && !listing) return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong tenant hiện tại' });
      const snapshot = projectId
        ? await buildSocialProjectSnapshot(currentTenant, projectId)
        : await buildSocialProductSnapshot(currentTenant, listingId!);
      const publishMode = req.body?.publishMode === 'SCHEDULED' ? 'SCHEDULED' : 'NOW';
      const scheduledAt = publishMode === 'SCHEDULED' ? parseDate(req.body?.scheduledAt) : null;
      if (publishMode === 'SCHEDULED' && !scheduledAt) {
        return res.status(400).json({ error: 'Chiến dịch hẹn giờ cần có thời điểm đăng' });
      }
       const sourceImages = projectId
         ? normalizePublicationImages('images' in snapshot ? snapshot.images : [])
         : normalizePublicationImages(listing?.images);
      const imageUrls = Array.isArray(req.body?.imageUrls)
        ? normalizePublicationImages(req.body.imageUrls)
         : sourceImages;
       const unavailableImages = imageUrls.filter(image => (
         !sourceImages.includes(image) && !isTenantUploadedImage(image, currentTenant)
       ));
      if (unavailableImages.length) {
         return res.status(400).json({ error: projectId
           ? 'Ảnh được chọn phải thuộc dự án hiện tại hoặc là ảnh vừa tải lên'
           : 'Ảnh được chọn phải thuộc listing hiện tại hoặc là ảnh vừa tải lên' });
      }
      const imageRequiredPlatforms = platforms.filter(platform => (
        platform === 'FACEBOOK_PAGE' || platform === 'ZALO_BROADCAST'
      ));
      if (imageRequiredPlatforms.length && !imageUrls.length) {
        return res.status(400).json({
          error: `${imageRequiredPlatforms.join(', ')} cần ít nhất một ảnh HTTPS công khai để tạo publication`,
        });
      }
      if (platforms.includes('FACEBOOK_PAGE') && imageUrls.length > MAX_FACEBOOK_IMAGES) {
        return res.status(400).json({ error: `Facebook hiện chỉ hỗ trợ tối đa ${MAX_FACEBOOK_IMAGES} ảnh trong một album` });
      }
      const requestedCaption = normalizePublicationCaption(req.body?.caption);
      const caption = requestedCaption || buildPlatformContent(snapshot, 'FACEBOOK_PAGE', imageUrls).text;
      const contentSnapshot = {
        ...snapshot,
        caption,
      };
      const publication = await createSocialPublication(pool, {
        tenantId: currentTenant,
         listingId,
         projectId,
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
         reason: `Operator tạo publication draft từ snapshot ${projectId ? 'dự án' : 'listing'}.`,
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
    try {
      const publicationId = String(req.params.id);
      const requestId = (req as any).id as string | undefined;
      if (!UUID_PATTERN.test(publicationId)) {
        return res.status(400).json({
          error: 'Publication ID không hợp lệ',
          code: 'INVALID_PUBLICATION_ID',
          ...(requestId ? { requestId } : {}),
        });
      }
      const currentTenant = tenantId(req);
      const row = await findSocialPublication(pool, currentTenant, publicationId);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy publication' });
      const readiness = await Promise.all(row.targets.map(async (target: any) => ({
        target,
        capability: await getTenantSocialPlatformCapability(
          target.platform,
          currentTenant,
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
          ...(requestId ? { requestId } : {}),
          targets: notReady.map(({ target, capability }: { target: any; capability: any }) => ({
            platform: target.platform,
            status: capability.status,
            canPublish: capability.canPublish,
            retryable: capability.retryable ?? false,
            reason: capability.reason,
          })),
        });
      }
      const activated = await activateSocialPublication(pool, currentTenant, publicationId);
      if (!activated) return res.status(409).json({ error: 'Publication không còn ở trạng thái DRAFT' });
      await markSocialTargetsPending(pool, currentTenant, publicationId);
      await recordSocialPublicationEvent(pool, {
        tenantId: currentTenant,
        publicationId,
        actorId: (req as any).user?.id || null,
        eventType: 'ACTIVATED',
        fromStatus: 'DRAFT',
        toStatus: activated.status,
        reason: 'Operator kích hoạt publication sau khi kiểm tra readiness.',
      });
      return res.json(await findSocialPublication(pool, currentTenant, publicationId));
    } catch (error: any) {
      const requestId = (req as any).id as string | undefined;
      logger.error('[SocialPublishing] Activate failed:', error);
      return res.status(503).json({
        error: 'Không thể xác minh hoặc kích hoạt publication lúc này.',
        code: 'PUBLICATION_ACTIVATION_UNAVAILABLE',
        ...(requestId ? { requestId } : {}),
      });
    }
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