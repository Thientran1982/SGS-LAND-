import { Router, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import crypto from 'node:crypto';
import {
  getMarketingFacebookDailyStatus,
  getAutoPostingSettings,
  upsertAutoPostingSettings,
  type AutoPostingTimeWindow,
} from '../repositories/autoPostingRepository';
import { normalizeSocialPlatforms } from '../services/socialPublicationService';
import {
  localDayKey,
  runAutoPostingBackfill,
  runAutoPostingTick,
} from '../services/autoPostingSelector';

const MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MARKETING']);
const AUTO_PLATFORMS = new Set(['FACEBOOK_PAGE']);

function tenantId(req: Request): string {
  return typeof (req as any).user?.tenantId === 'string'
    ? (req as any).user.tenantId.trim()
    : '';
}

function requireManager(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user || !MANAGER_ROLES.has(user.role)) {
    res.status(403).json({ error: 'Cần quyền quản lý marketing hoặc quản trị viên' });
    return false;
  }
  if (!tenantId(req)) {
    res.status(403).json({ error: 'Không xác định được tenant của người dùng' });
    return false;
  }
  return true;
}

function normalizeWindows(value: unknown): AutoPostingTimeWindow[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('Cần ít nhất một khung giờ đăng');
  }
  const result = value.map(item => {
    const start = String(item?.start || '');
    const end = String(item?.end || '');
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      throw new Error('Khung giờ phải có định dạng HH:MM');
    }
    const valid = (value: string) => {
      const [hour, minute] = value.split(':').map(Number);
      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    };
    if (!valid(start) || !valid(end)) throw new Error('Khung giờ không hợp lệ');
    return { start, end };
  });
  return result;
}

function normalizePlatforms(value: unknown): string[] {
  const platforms = normalizeSocialPlatforms(value)
    .filter(platform => AUTO_PLATFORMS.has(platform));
  if (!platforms.length) throw new Error('Chọn ít nhất một nền tảng tự động');
  return platforms;
}

function matchesCronSecret(expected: string, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string') return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length
    && crypto.timingSafeEqual(expectedBytes, providedBytes);
}

function normalizeLogicalDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Ngày chạy bù phải có định dạng YYYY-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('Ngày chạy bù không hợp lệ');
  }
  if (value > localDayKey()) throw new Error('Không thể chạy bù cho ngày trong tương lai');
  return value;
}

export function createAutoPostingRouter(
  pool: Pool,
  authenticateToken: RequestHandler,
  cronSecret: string,
): Router {
  const router = Router();

  router.get('/api/auto-posting/settings', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    res.json(await getAutoPostingSettings(pool, tenantId(req)));
  });

  router.get('/api/auto-posting/status', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    res.json(await getMarketingFacebookDailyStatus(pool, tenantId(req), localDayKey()));
  });

  router.put('/api/auto-posting/settings', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    try {
      const body = req.body || {};
      const settings = await upsertAutoPostingSettings(pool, tenantId(req), {
        enabled: Boolean(body.enabled),
        postsPerDay: Number(body.postsPerDay),
        recycleAfterDays: Number(body.recycleAfterDays),
        timeWindows: normalizeWindows(body.timeWindows || [{ start: '18:30', end: '23:59' }]),
        platforms: normalizePlatforms(body.platforms),
      });
      return res.json(settings);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể lưu cấu hình tự động' });
    }
  });

  router.post('/api/auto-posting/backfill', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    try {
      const logicalDay = normalizeLogicalDay(req.body?.logicalDay ?? req.body?.date);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
      if (reason.length < 3) {
        return res.status(400).json({ error: 'Cần ghi lý do chạy bù tối thiểu 3 ký tự' });
      }
      const requestedBy = String((req as any).user?.id || '');
      if (!requestedBy) return res.status(400).json({ error: 'Không xác định được người yêu cầu chạy bù' });

      const result = await runAutoPostingBackfill(
        pool,
        tenantId(req),
        logicalDay,
        reason,
        requestedBy,
      );
      if (result.reason === 'BACKFILL_ALREADY_REQUESTED') {
        return res.status(409).json({
          error: 'Ngày này đã có yêu cầu chạy bù; không tạo thêm yêu cầu gửi.',
          code: result.reason,
          ...result,
        });
      }
      return res.json({ logicalDay, requestedReason: reason, requestedBy, ...result });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể yêu cầu chạy bù bài Marketing' });
    }
  });

  router.post('/api/internal/auto-posting-cron', async (req, res) => {
    const provided = (req.headers['x-internal-secret'] as string | undefined) || req.body?.secret;
    if (!matchesCronSecret(cronSecret, provided)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      return res.json({ ok: true, results: await runAutoPostingTick(pool) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Auto posting tick failed' });
    }
  });

  return router;
}